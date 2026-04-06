"""Configuration module for Finance Tracker API.

Loads environment-specific settings and exposes them via a single
`settings` object for other modules to import.
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DB_SERVER = os.getenv("DB_SERVER")
    DB_PORT = os.getenv("DB_PORT")
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")

    JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRE_MINUTES = 60 * 24

settings = Settings()
