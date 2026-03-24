from fastapi import APIRouter
from app.core.mongo import logs_collection

router = APIRouter(prefix="/logs", tags=["Logs"])

@router.get("/{user_id}")
def get_user_logs(user_id: int):
    logs = list(logs_collection.find({"user_id": user_id}, {"_id": 0}))
    return logs

@router.get("/recent")
def get_recent_logs():
    logs = list(logs_collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(10))
    return logs