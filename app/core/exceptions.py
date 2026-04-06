"""Centralized API exception handling.

This module defines the custom AppException types and all FastAPI exception
handlers used across the API. The handlers now emit a consistent error payload
via api_error_response (see below).
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
import logging
import traceback
import datetime

logger = logging.getLogger(__name__)

def api_error_response(status_code: int, code: str, message: str, detail: str | None = None, path: str | None = None):
    payload = {
        "success": False,
        "error": message,
        "error_code": code,
        "path": path or "",
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat()
    }
    if detail is not None:
        payload["detail"] = detail
    return JSONResponse(status_code=status_code, content=payload)


class AppException(HTTPException):
    def __init__(self, status_code: int, detail: str, error_code: str = None):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code or f"ERR_{status_code}"


class NotFoundException(AppException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail, error_code="ERR_NOT_FOUND")


class UnauthorizedException(AppException):
    def __init__(self, detail: str = "Unauthorized"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail, error_code="ERR_UNAUTHORIZED")


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Forbidden"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail, error_code="ERR_FORBIDDEN")


class ConflictException(AppException):
    def __init__(self, detail: str = "Conflict"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail, error_code="ERR_CONFLICT")


class BadRequestException(AppException):
    def __init__(self, detail: str = "Bad request"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail, error_code="ERR_BAD_REQUEST")


class ValidationException(AppException):
    def __init__(self, detail: str = "Validation error"):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail, error_code="ERR_VALIDATION")


class InvalidDateRangeException(AppException):
    def __init__(self, detail: str = "Invalid date range"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail, error_code="ERR_INVALID_DATE_RANGE")


class InvalidAmountException(AppException):
    def __init__(self, detail: str = "Invalid amount"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail, error_code="ERR_INVALID_AMOUNT")


class InvalidFilterException(AppException):
    def __init__(self, detail: str = "Invalid filter value"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail, error_code="ERR_INVALID_FILTER")


def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle generic HTTP exceptions with a consistent error payload."""
    error_code = getattr(exc, "error_code", f"ERR_{exc.status_code}")
    # Use centralized error response format
    return api_error_response(
        exc.status_code,
        error_code,
        exc.detail or "Error",
        path=str(request.url.path),
    )


def app_exception_handler(request: Request, exc: AppException):
    """Handle AppException using the standard error payload."""
    return api_error_response(
        exc.status_code,
        exc.error_code,
        exc.detail,
        path=str(request.url.path),
    )


def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"] if loc != "body"),
            "message": error["msg"],
            "type": error["type"],
        })
    # Return a structured error payload with details serialized as string
    return api_error_response(
        422,
        "ERR_VALIDATION",
        "Validation Error",
        detail=str(errors),
        path=str(request.url.path),
    )


def integrity_error_handler(request: Request, exc: IntegrityError):
    error_msg = str(exc.orig)
    logger.error(f"Integrity Error: {error_msg}")

    if "unique" in error_msg.lower():
        return api_error_response(
            409,
            "ERR_DUPLICATE",
            "Duplicate entry. This record already exists.",
            path=str(request.url.path),
        )
    if "foreign key" in error_msg.lower():
        return api_error_response(
            400,
            "ERR_REFERENCE",
            "Referenced entity not found",
            path=str(request.url.path),
        )
    return api_error_response(
        400,
        "ERR_CONSTRAINT",
        "Database constraint violation",
        path=str(request.url.path),
    )


def operational_error_handler(request: Request, exc: OperationalError):
    logger.error(f"Operational Error: {exc}")
    return api_error_response(
        503,
        "ERR_DB_UNAVAILABLE",
        "Database temporarily unavailable",
        path=str(request.url.path),
    )


def database_error_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database Error: {exc}\n{traceback.format_exc()}")
    return api_error_response(
        500,
        "ERR_INTERNAL",
        "Internal server error",
        path=str(request.url.path),
    )


def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {exc}\n{traceback.format_exc()}")
    return api_error_response(
        500,
        "ERR_INTERNAL",
        "Internal server error",
        path=str(request.url.path),
    )
