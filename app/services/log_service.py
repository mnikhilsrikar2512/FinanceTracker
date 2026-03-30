"""Logging service for audit trails."""
from datetime import datetime
from datetime import timezone
import threading
import uuid
from app.core.mongo import logs_collection, ensure_log_indexes

_audit_config = {
    "enabled": True,
    "retention_days": 90
}

def log_action(action, user_id, payload=None, entity_type=None, entity_id=None, level="INFO", request_id=None):
    try:
        log_entry = {
            "event": action,
            "action": action,
            "user_id": user_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "level": level,
            "request_id": request_id,
            "payload": payload or {},
            "timestamp": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        def _async_insert():
            try:
                logs_collection.insert_one(log_entry)
            except Exception:
                pass
        
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
    try:
        ensure_log_indexes()
    except Exception:
        pass
