"""Persistent password reset code model for multi-process deployments."""

from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import declarative_base


ResetStoreBase = declarative_base()


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class PasswordResetCode(ResetStoreBase):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    code = Column(String(32), nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    requested_at = Column(DateTime, nullable=True, index=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=_utc_now_naive, onupdate=_utc_now_naive)
