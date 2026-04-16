"""Database schema initialization helpers."""

from time import sleep

import pyodbc
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import Base, engine, build_connection_string
import app.models  # noqa: F401  # Ensure metadata is registered before create_all runs


def _build_master_connection_string() -> str:
    return build_connection_string("master")


def ensure_database_exists() -> None:
    if engine.dialect.name == "sqlite":
        return

    if not settings.DB_NAME:
        return

    try:
        with engine.connect():
            return
    except OperationalError:
        pass

    master_engine = create_engine(
        "mssql+pyodbc://",
        creator=lambda: pyodbc.connect(_build_master_connection_string()),
        pool_pre_ping=True,
        echo=False,
    )

    last_error = None
    for attempt in range(1, 11):
        try:
            with master_engine.begin() as connection:
                exists = connection.execute(
                    text("SELECT DB_ID(:db_name)"),
                    {"db_name": settings.DB_NAME},
                ).scalar()
                if exists is None:
                    connection.execute(text(f"CREATE DATABASE [{settings.DB_NAME}]"))
                return
        except OperationalError as exc:
            last_error = exc
            if attempt == 10:
                raise
            sleep(min(2 * attempt, 10))

    if last_error:
        raise last_error


def init_database_schema() -> None:
    """Create SQL tables for the application if they do not exist yet."""
    ensure_database_exists()
    Base.metadata.create_all(bind=engine, checkfirst=True)
