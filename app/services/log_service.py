from datetime import datetime
from app.core.mongo import logs_collection

def log_action(action, user_id, payload):
    try:
        logs_collection.insert_one({
            "action": action,
            "user_id": user_id,
            "payload": payload,
            "timestamp": datetime.utcnow()
        })
    except Exception:
        pass