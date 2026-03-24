from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Index
from datetime import datetime
from app.core.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    amount = Column(Float)
    description = Column(String(255))
    date = Column(DateTime, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_user_date", "user_id", "date"),
    )