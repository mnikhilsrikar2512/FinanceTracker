"""Database schema initialization helpers."""

from app.core.database import Base, engine


def init_database_schema() -> None:
    """Create SQL tables for the application if they do not exist yet."""
    Base.metadata.create_all(bind=engine)
