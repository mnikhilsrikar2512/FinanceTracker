from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta
from collections import defaultdict
import time
import os

class RateLimiter(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)
    
    def cleanup_old_requests(self, key):
        cutoff = datetime.now() - timedelta(minutes=1)
        self.requests[key] = [
            req_time for req_time in self.requests[key] 
            if req_time > cutoff
        ]
    
    async def dispatch(self, request: Request, call_next):
        if os.getenv("PYTEST_CURRENT_TEST") or os.getenv("DISABLE_RATE_LIMIT") == "1":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        
        # Skip rate limiting for health check
        if request.url.path == "/":
            return await call_next(request)
        
        self.cleanup_old_requests(client_ip)
        
        current_requests = len(self.requests[client_ip])
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
        
        self.requests[client_ip].append(datetime.now())
        
        response = await call_next(request)
        
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = "60"
        
        return response


class LoginRateLimiter:
    """Rate limiter specifically for login attempts"""
    
    def __init__(self, max_attempts: int = 5, window_minutes: int = 15):
        self.max_attempts = max_attempts
        self.window_minutes = window_minutes
        self.attempts = defaultdict(list)
    
    def cleanup_old_attempts(self, key):
        cutoff = datetime.now() - timedelta(minutes=self.window_minutes)
        self.attempts[key] = [
            attempt_time for attempt_time in self.attempts[key]
            if attempt_time > cutoff
        ]
    
    def is_blocked(self, identifier: str) -> bool:
        self.cleanup_old_attempts(identifier)
        return len(self.attempts[identifier]) >= self.max_attempts

    def get_retry_after(self, identifier: str) -> int:
        self.cleanup_old_attempts(identifier)
        if not self.attempts[identifier]:
            return 0
        oldest_attempt = min(self.attempts[identifier])
        retry_at = oldest_attempt + timedelta(minutes=self.window_minutes)
        return max(0, int((retry_at - datetime.now()).total_seconds()))
    
    def record_attempt(self, identifier: str):
        self.attempts[identifier].append(datetime.now())
    
    def reset(self, identifier: str):
        self.attempts[identifier] = []


login_rate_limiter = LoginRateLimiter()
password_reset_request_limiter = LoginRateLimiter(max_attempts=5, window_minutes=15)
password_reset_attempt_limiter = LoginRateLimiter(max_attempts=5, window_minutes=15)
