from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail},
    )

def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"success": False, "error": "Validation Error", "details": exc.errors()},
    )

def integrity_error_handler(request: Request, exc: IntegrityError):
    error_msg = str(exc.orig)
    if "unique" in error_msg.lower():
        return JSONResponse(
            status_code=409,
            content={"success": False, "error": "Duplicate entry"},
        )
    if "foreign key" in error_msg.lower():
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Referenced entity not found"},
        )
    return JSONResponse(
        status_code=400,
        content={"success": False, "error": "Database constraint violation"},
    )

def database_error_handler(request: Request, exc: SQLAlchemyError):
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Database error"},
    )