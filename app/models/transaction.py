"""SQLAlchemy model for Transaction.

Represents a financial transaction record tied to a user and a category.
Includes audit fields and a soft-delete flag.
"""
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Index, Boolean, text
from app.core.database import Base
from app.core.timezone import utc_now_naive

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    amount = Column(Float, nullable=False)
    description = Column(String(500))
    date = Column(DateTime, nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now_naive)
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    modified_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False, server_default=text("0"), nullable=False, index=True)

    __table_args__ = (
        Index("idx_user_date", "user_id", "date"),
    )
