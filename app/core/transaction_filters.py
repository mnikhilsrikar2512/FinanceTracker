"""Shared transaction query helpers."""

from sqlalchemy import false, or_


def active_transaction_condition(transaction_model):
    """Treat NULL soft-delete flags as active rows."""
    return or_(
        transaction_model.is_deleted.is_(None),
        transaction_model.is_deleted == false(),
    )
