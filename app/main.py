"""Finance Tracker API - Main entrypoint.
This module wires routers, middleware, and error handling for the backend API.
"""
from pathlib import Path

from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
import uuid
import time

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
from app.core.config import settings
from app.core.rate_limit import RateLimiter
from app.services.log_service import setup_logging
from app.core.dev_bootstrap import seed_dev_data
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "Frontend"


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
        passthrough_paths = {"/", "/health", "/login", "/app", "/admin", "/docs", "/openapi.json", "/redoc"}
        if path in passthrough_paths:
            return await call_next(request)
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


class APICacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the API versioning rewrite middleware
app.add_middleware(APIVersionRewriteMiddleware)
app.add_middleware(APICacheControlMiddleware)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(RateLimiter, requests_per_minute=60)

setup_logging()
seed_dev_data()

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


@app.get("/")
def root():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/index.html")
def root_html():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/login")
def login_page():
    return FileResponse(FRONTEND_DIR / "login.html")


@app.get("/login.html")
def login_page_html():
    return FileResponse(FRONTEND_DIR / "login.html")


@app.get("/signup")
def signup_page():
    return FileResponse(FRONTEND_DIR / "signup.html")


@app.get("/signup.html")
def signup_page_html():
    return FileResponse(FRONTEND_DIR / "signup.html")


@app.get("/forgot-password")
def forgot_password_page():
    return FileResponse(FRONTEND_DIR / "forgot-password.html")


@app.get("/forgot-password.html")
def forgot_password_page_html():
    return FileResponse(FRONTEND_DIR / "forgot-password.html")


@app.get("/reset-password")
def reset_password_page():
    return FileResponse(FRONTEND_DIR / "reset-password.html")


@app.get("/reset-password.html")
def reset_password_page_html():
    return FileResponse(FRONTEND_DIR / "reset-password.html")


@app.get("/support")
def support_page():
    return FileResponse(FRONTEND_DIR / "support.html")


@app.get("/support.html")
def support_page_html():
    return FileResponse(FRONTEND_DIR / "support.html")


@app.get("/app")
def app_page():
    return FileResponse(FRONTEND_DIR / "app.html")


@app.get("/app.html")
def app_page_html():
    return FileResponse(FRONTEND_DIR / "app.html")


@app.get("/admin")
def admin_page():
    return FileResponse(FRONTEND_DIR / "admin.html")


@app.get("/admin.html")
def admin_page_html():
    return FileResponse(FRONTEND_DIR / "admin.html")


if FRONTEND_DIR.exists():
    app.mount("/scripts", StaticFiles(directory=str(FRONTEND_DIR / "scripts")), name="frontend-scripts")
    app.mount("/styles", StaticFiles(directory=str(FRONTEND_DIR / "styles")), name="frontend-styles")
else:
    logger.warning("Frontend directory missing; static frontend routes are disabled", extra={"path": str(FRONTEND_DIR)})
