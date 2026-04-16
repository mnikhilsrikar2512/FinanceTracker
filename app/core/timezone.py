"""Shared timezone helpers for UTC handling across the app."""

from __future__ import annotations

from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(UTC)


def utc_now_naive() -> datetime:
    """Return the current UTC time without tzinfo for legacy DateTime columns."""
    return utc_now().replace(tzinfo=None)


def to_utc_naive(value: datetime | None) -> datetime | None:
    """Normalize any datetime to a naive UTC value for database comparisons."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)

