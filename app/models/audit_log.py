"""SQLAlchemy model for application audit logs."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String, Text

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    event = Column(String(100), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    entity_type = Column(String(50), nullable=True, index=True)
    entity_id = Column(Integer, nullable=True, index=True)
    level = Column(String(20), nullable=False, default="INFO", index=True)
    request_id = Column(String(120), nullable=True, index=True)
    payload_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_audit_user_timestamp", "user_id", "timestamp"),
        Index("idx_audit_action_timestamp", "action", "timestamp"),
        Index("idx_audit_entity", "entity_type", "entity_id"),
    )
