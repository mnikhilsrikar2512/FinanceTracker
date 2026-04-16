"""Configuration module for Finance Tracker API.

Loads environment-specific settings and exposes them via a single
`settings` object for other modules to import.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def get_cors_allowed_origins(
    app_env: str | None = None,
    origins: str | None = None,
) -> list[str]:
    env = (app_env or os.getenv("APP_ENV", "development")).strip().lower()
    parsed = _split_csv(origins if origins is not None else os.getenv("CORS_ALLOWED_ORIGINS"))
    if parsed:
        return parsed
    if env in {"development", "dev", "local", "test", "testing"}:
        return [
            "http://127.0.0.1:8000",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://localhost:3000",
        ]
    raise RuntimeError("CORS_ALLOWED_ORIGINS is required outside development/test environments")


class Settings:
    APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
    DB_SERVER = os.getenv("DB_SERVER")
    DB_PORT = os.getenv("DB_PORT")
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_ENCRYPT = os.getenv("DB_ENCRYPT", "no")
    DB_TRUST_SERVER_CERTIFICATE = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "yes")

    JWT_SECRET = os.getenv("JWT_SECRET")
    if not JWT_SECRET:
        if APP_ENV in {"development", "dev", "local", "test", "testing"}:
            JWT_SECRET = "dev-only-change-me"
        else:
            raise RuntimeError("JWT_SECRET is required outside development/test environments")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRE_MINUTES = 60 * 24
    CORS_ALLOWED_ORIGINS = get_cors_allowed_origins(APP_ENV)

settings = Settings()
