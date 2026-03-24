from fastapi import FastAPI
from app.core.database import engine, Base
import app.models
from app.routers import analytics_router

from app.routers import user_router, category_router, transaction_router, log_router
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    integrity_error_handler,
    database_error_handler,
)


app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(user_router.router)
app.include_router(category_router.router)
app.include_router(transaction_router.router)
app.include_router(log_router.router)
app.include_router(analytics_router.router)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(SQLAlchemyError, database_error_handler)

@app.get("/")
def health_check():
    return {"status": "OK"}