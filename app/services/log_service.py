"""Logging service for audit trails."""
import json
import threading

from app.core.database import SessionLocal
from app.models.audit_log import AuditLog
from app.core.timezone import utc_now_naive

_audit_config = {
    "enabled": True,
    "retention_days": 90
}

def log_action(action, user_id, payload=None, entity_type=None, entity_id=None, level="INFO", request_id=None):
    try:
        timestamp = utc_now_naive()
        payload_json = json.dumps(payload or {}, default=str)
        
        def _async_insert():
            session = SessionLocal()
            try:
                session.add(AuditLog(
                    event=action,
                    action=action,
                    user_id=user_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    level=level,
                    request_id=request_id,
                    payload_json=payload_json,
                    timestamp=timestamp,
                    created_at=timestamp,
                ))
                session.commit()
            except Exception:
                session.rollback()
            finally:
                session.close()
        
        thread = threading.Thread(target=_async_insert, daemon=True)
        thread.start()
        
    except Exception:
        pass


def log_info(action, user_id, payload=None, entity_type=None, entity_id=None, request_id=None):
    log_action(action, user_id, payload, entity_type, entity_id, "INFO", request_id)


def log_warning(action, user_id, payload=None, entity_type=None, entity_id=None, request_id=None):
    log_action(action, user_id, payload, entity_type, entity_id, "WARNING", request_id)


def log_error(action, user_id, payload=None, entity_type=None, entity_id=None, request_id=None):
    log_action(action, user_id, payload, entity_type, entity_id, "ERROR", request_id)


def setup_logging():
    return None
