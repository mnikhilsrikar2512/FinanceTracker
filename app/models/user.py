"""User ORM model."""
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(20), default="active")
    role = Column(String(20), default="user")
    created_at = Column(DateTime, default=datetime.utcnow)
