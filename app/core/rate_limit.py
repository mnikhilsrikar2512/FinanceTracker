"""Shared, persistent request and auth rate limiting utilities."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
import os
import sqlite3
import threading
import tempfile

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _serialize_dt(value: datetime | None = None) -> str:
    return (value or _utc_now()).strftime("%Y-%m-%d %H:%M:%S.%f")


def _deserialize_dt(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=UTC)


class SharedRateLimitStore:
    """SQLite-backed shared storage for request and auth rate limit events."""

    def __init__(self, path: str | None = None):
        self.path = Path(path or os.getenv("RATE_LIMIT_STORE_PATH") or (Path(tempfile.gettempdir()) / "finly_rate_limits.sqlite3"))
        self._lock = threading.Lock()
        self._ensure_schema()

    @contextmanager
    def _connection(self):
        conn = sqlite3.connect(self.path, timeout=5, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _ensure_schema(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock, self._connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rate_limit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scope TEXT NOT NULL,
                    identifier TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_rate_limit_scope_identifier_created_at ON rate_limit_events(scope, identifier, created_at)"
            )
            conn.commit()

    def record(self, scope: str, identifier: str, created_at: datetime | None = None) -> None:
        with self._lock, self._connection() as conn:
            conn.execute(
                "INSERT INTO rate_limit_events (scope, identifier, created_at) VALUES (?, ?, ?)",
                (scope, identifier, _serialize_dt(created_at)),
            )
            conn.commit()

    def count_since(self, scope: str, identifier: str, cutoff: datetime) -> int:
        with self._lock, self._connection() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) AS total
                FROM rate_limit_events
                WHERE scope = ? AND identifier = ? AND created_at >= ?
                """,
                (scope, identifier, _serialize_dt(cutoff)),
            ).fetchone()
            return int(row["total"] if row else 0)

    def cleanup_before(self, scope: str, cutoff: datetime) -> None:
        with self._lock, self._connection() as conn:
            conn.execute(
                "DELETE FROM rate_limit_events WHERE scope = ? AND created_at < ?",
                (scope, _serialize_dt(cutoff)),
            )
            conn.commit()

    def reset(self, scope: str, identifier: str) -> None:
        with self._lock, self._connection() as conn:
            conn.execute(
                "DELETE FROM rate_limit_events WHERE scope = ? AND identifier = ?",
                (scope, identifier),
            )
            conn.commit()

    def clear_scope(self, scope: str) -> None:
        with self._lock, self._connection() as conn:
            conn.execute("DELETE FROM rate_limit_events WHERE scope = ?", (scope,))
            conn.commit()

    def clear_all(self) -> None:
        with self._lock, self._connection() as conn:
            conn.execute("DELETE FROM rate_limit_events")
            conn.commit()

class RateLimiter(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 60, store: SharedRateLimitStore | None = None):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.store = store or rate_limit_store
    
    def _should_skip(self, request: Request) -> bool:
        path = request.url.path
        if path == "/health":
            return True
        if not path.startswith("/api/"):
            return True
        if path.startswith("/api/v1/auth") or path.startswith("/api/auth"):
            return True
        if path in {"/docs", "/openapi.json", "/redoc", "/favicon.ico"}:
            return True
        return False
    
    async def dispatch(self, request: Request, call_next):
        if os.getenv("DISABLE_RATE_LIMIT") == "1":
            return await call_next(request)

        if self._should_skip(request):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        scope = "general"
        cutoff = _utc_now() - timedelta(minutes=1)
        self.store.cleanup_before(scope, cutoff)
        current_requests = self.store.count_since(scope, client_ip, cutoff)
        remaining = self.requests_per_minute - current_requests - 1

        if current_requests >= self.requests_per_minute:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "success": False,
                    "error": "Too many requests. Please try again later.",
                    "error_code": "ERR_RATE_LIMITED"
                },
                headers={
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": "60"
                }
            )

        self.store.record(scope, client_ip)
        
        response = await call_next(request)
        
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = "60"
        
        return response


class LoginRateLimiter:
    """Rate limiter specifically for login attempts"""
    
    def __init__(self, max_attempts: int = 5, window_minutes: int = 15, scope: str = "auth:login", store: SharedRateLimitStore | None = None):
        self.max_attempts = max_attempts
        self.window_minutes = window_minutes
        self.scope = scope
        self.store = store or rate_limit_store
    
    def is_blocked(self, identifier: str) -> bool:
        cutoff = _utc_now() - timedelta(minutes=self.window_minutes)
        self.store.cleanup_before(self.scope, cutoff)
        return self.store.count_since(self.scope, identifier, cutoff) >= self.max_attempts

    def get_retry_after(self, identifier: str) -> int:
        cutoff = _utc_now() - timedelta(minutes=self.window_minutes)
        self.store.cleanup_before(self.scope, cutoff)
        if not self.store.count_since(self.scope, identifier, cutoff):
            return 0
        with self.store._lock, self.store._connection() as conn:
            row = conn.execute(
                """
                SELECT created_at
                FROM rate_limit_events
                WHERE scope = ? AND identifier = ?
                ORDER BY created_at ASC
                LIMIT 1
                """,
                (self.scope, identifier),
            ).fetchone()
        if not row:
            return 0
        oldest_attempt = _deserialize_dt(row["created_at"])
        retry_at = oldest_attempt + timedelta(minutes=self.window_minutes)
        return max(0, int((retry_at - _utc_now()).total_seconds()))
    
    def record_attempt(self, identifier: str):
        self.store.record(self.scope, identifier)
    
    def reset(self, identifier: str):
        self.store.reset(self.scope, identifier)

    def reset_all(self):
        self.store.clear_scope(self.scope)


rate_limit_store = SharedRateLimitStore()
login_rate_limiter = LoginRateLimiter(scope="auth:login", store=rate_limit_store)
signup_rate_limiter = LoginRateLimiter(max_attempts=5, window_minutes=15, scope="auth:signup", store=rate_limit_store)
password_reset_request_limiter = LoginRateLimiter(max_attempts=5, window_minutes=15, scope="auth:reset-request", store=rate_limit_store)
password_reset_attempt_limiter = LoginRateLimiter(max_attempts=5, window_minutes=15, scope="auth:reset-attempt", store=rate_limit_store)
