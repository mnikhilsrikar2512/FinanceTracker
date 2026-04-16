import logging
import pyodbc
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger(__name__)

def _build_odbc_connection_string(database_name: str) -> str:
    encrypt = str(getattr(settings, "DB_ENCRYPT", "no")).strip().lower()
    trust_server_certificate = str(getattr(settings, "DB_TRUST_SERVER_CERTIFICATE", "yes")).strip().lower()
    encrypt_value = "yes" if encrypt in {"1", "true", "yes", "on"} else "no"
    trust_value = "yes" if trust_server_certificate in {"1", "true", "yes", "on"} else "no"
    return (
        f"Driver={{ODBC Driver 18 for SQL Server}};"
        f"Server={settings.DB_SERVER},{settings.DB_PORT};"
        f"Database={database_name};"
        f"UID={settings.DB_USER};"
        f"PWD={settings.DB_PASSWORD};"
        f"Encrypt={encrypt_value};"
        f"TrustServerCertificate={trust_value};"
        "LoginTimeout=5;"
        "Connection Timeout=5;"
    )


def _connect(database_name: str):
    return pyodbc.connect(_build_odbc_connection_string(database_name))

def _build_sqlite_engine():
    return create_engine(
        "sqlite:///./finly_dev.sqlite3",
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
        echo=False,
    )


def _build_engine():
    if settings.APP_ENV in {"development", "dev", "local", "test", "testing"}:
        try:
            probe = _connect("master")
            probe.close()
            return create_engine(
                "mssql+pyodbc://",
                creator=lambda: _connect(settings.DB_NAME),
                pool_size=5,
                max_overflow=10,
                pool_pre_ping=True,
                echo=False,
            )
        except Exception as exc:
            logger.warning("Falling back to SQLite dev database because SQL Server is unavailable: %s", exc)
            return _build_sqlite_engine()

    return create_engine(
        "mssql+pyodbc://",
        creator=lambda: _connect(settings.DB_NAME),
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        echo=False,
    )


engine = _build_engine()

SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()


def build_connection_string(database_name: str) -> str:
    return _build_odbc_connection_string(database_name)
