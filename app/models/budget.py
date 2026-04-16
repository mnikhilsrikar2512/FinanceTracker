"""SQLAlchemy model for Budget.

Represents a spending budget for a user, optionally tied to a category.
Includes period (monthly/yearly) and date range.
"""
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Date, Enum
from app.core.database import Base
from app.core.timezone import utc_now_naive
import enum

class BudgetPeriod(str, enum.Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CUSTOM = "custom"

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # NULL for overall budget
    amount = Column(Float, nullable=False)
    period = Column(String(20), default=BudgetPeriod.MONTHLY.value)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    description = Column(String(200))
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=True, onupdate=utc_now_naive)

    def __repr__(self):
        return f"<Budget {self.id}: {self.amount} for user {self.user_id}>"
