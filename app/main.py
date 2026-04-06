"""Finance Tracker API - Main entrypoint.
This module wires routers, middleware, and error handling for the backend API.
Frontend hosting is removed for local development and testing by default."""
from fastapi import FastAPI, Request, Response, APIRouter
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp
import uuid
import time
from pathlib import Path

import app.models
from app.routers import analytics_router

from app.routers import user_router, category_router, transaction_router, log_router, auth_router, admin_router, budget_router
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    integrity_error_handler,
    database_error_handler,
    operational_error_handler,
    app_exception_handler,
    generic_exception_handler,
)
from app.core.rate_limit import RateLimiter
from app.services.log_service import setup_logging
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "Project"


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        
        start_time = time.time()
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)

        if request.url.path.startswith("/api/v1/admin") or request.url.path.startswith("/api/v1/logs"):
            if process_time >= 0.25:
                logger.warning(
                    "Slow admin/log request",
                    extra={
                        "request_id": request_id,
                        "path": request.url.path,
                        "method": request.method,
                        "process_time_ms": round(process_time * 1000, 2),
                    },
                )
        
        return response


app = FastAPI()

from app.routers import auth_router, user_router, category_router, transaction_router, log_router, analytics_router, admin_router, budget_router
# All API routes are migrated under /api/v1. /api is a redirect alias to /api/v1

# API versioning: expose same endpoints under /api/v1
api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(auth_router.router)
api_v1.include_router(user_router.router)
api_v1.include_router(category_router.router)
api_v1.include_router(transaction_router.router)
api_v1.include_router(log_router.router)
api_v1.include_router(analytics_router.router)
api_v1.include_router(admin_router.router)
api_v1.include_router(budget_router.router)
app.include_router(api_v1)

"""API versioning middleware and routes."""
class APIVersionRewriteMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        legacy_prefixes = (
            "/auth",
            "/users",
            "/categories",
            "/transactions",
            "/logs",
            "/summary",
            "/admin",
            "/budgets",
        )
        # Redirect base /api to /api/v1
        if path == "/api":
            from starlette.responses import RedirectResponse
            return RedirectResponse(url="/api/v1", status_code=308)
        # Internally rewrite /api/... to /api/v1/... to unify versioning
        if path.startswith("/api/") and not path.startswith("/api/v1/"):
            new_path = "/api/v1" + path[len("/api"):]
            query = request.url.query
            new_url = new_path + ("?" + query if query else "")
            from starlette.responses import RedirectResponse
            return RedirectResponse(url=new_url, status_code=307)
        # Backward compatibility: redirect old top-level endpoints to /api/v1
        if any(path == prefix or path.startswith(prefix + "/") for prefix in legacy_prefixes):
            query = request.url.query
            new_url = "/api/v1" + path + ("?" + query if query else "")
            from starlette.responses import RedirectResponse
            return RedirectResponse(url=new_url, status_code=307)
        return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the API versioning rewrite middleware
app.add_middleware(APIVersionRewriteMiddleware)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(RateLimiter, requests_per_minute=60)

setup_logging()

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(OperationalError, operational_error_handler)
app.add_exception_handler(SQLAlchemyError, database_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)

from app.core.exceptions import AppException
app.add_exception_handler(AppException, app_exception_handler)


@app.get("/health")
def health_check():
    return {"status": "OK"}


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
else:
    logger.warning("Frontend directory missing, static hosting disabled", extra={"path": str(FRONTEND_DIR)})
