from pymongo import MongoClient, ASCENDING, DESCENDING
from app.core.config import settings

client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[settings.MONGO_DB]
logs_collection = db["logs"]

RETENTION_DAYS = 90


def ensure_log_indexes():
    try:
        logs_collection.create_index(
            [("timestamp", DESCENDING)],
            name="idx_timestamp"
        )
        
        logs_collection.create_index(
            [("user_id", DESCENDING), ("timestamp", DESCENDING)],
            name="idx_user_timestamp"
        )
        
        logs_collection.create_index(
            [("action", DESCENDING), ("timestamp", DESCENDING)],
            name="idx_action_timestamp"
        )
        
        logs_collection.create_index(
            [("entity_type", ASCENDING), ("entity_id", ASCENDING)],
            name="idx_entity"
        )
        
        logs_collection.create_index(
            [("request_id", ASCENDING)],
            name="idx_request_id",
            unique=False,
            sparse=True
        )
        
        logs_collection.create_index(
            [("level", ASCENDING)],
            name="idx_level"
        )
        
        logs_collection.create_index(
            [("timestamp", ASCENDING)],
            name="idx_ttl",
            expireAfterSeconds=RETENTION_DAYS * 24 * 60 * 60
        )
        
    except Exception as e:
        print(f"Index creation warning: {e}")


def get_collection_stats():
    try:
        return {
            "total_logs": logs_collection.count_documents({}),
            "indexes": logs_collection.index_information(),
            "storage": db.command("collStats", "logs")
        }
    except Exception:
        return {}
