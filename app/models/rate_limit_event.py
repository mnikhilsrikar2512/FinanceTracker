"""Shared persistent rate limit event store."""

from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Index, Integer, String

from app.core.database import Base


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class RateLimitEvent(Base):
    __tablename__ = "rate_limit_events"

    id = Column(Integer, primary_key=True)
    scope = Column(String(64), nullable=False, index=True)
    identifier = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=_utc_now_naive, index=True)

    __table_args__ = (
        Index("idx_rate_limit_scope_identifier_created_at", "scope", "identifier", "created_at"),
    )
