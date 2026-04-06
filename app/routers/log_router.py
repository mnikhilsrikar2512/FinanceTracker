from fastapi import APIRouter, Depends, Query
from datetime import datetime
from app.core.mongo import logs_collection
from app.core.auth import get_current_user, require_admin
from app.core.response import success_response, paginated_response
from app.models.user import User

router = APIRouter(prefix="/logs", tags=["Logs"])

ACTION_LABELS = {
    "USER_SIGNUP": "User signed up",
    "USER_LOGIN": "User logged in",
    "PASSWORD_CHANGE": "Password changed",
    "CREATE_TRANSACTION": "Transaction created",
    "UPDATE_TRANSACTION": "Transaction updated",
    "DELETE_TRANSACTION": "Transaction deleted",
    "ADMIN_BLOCK_USER": "Admin blocked user",
    "ADMIN_UNBLOCK_USER": "Admin unblocked user",
    "CREATE_CATEGORY": "Category created",
    "DELETE_CATEGORY": "Category deleted",
    "UPDATE_PROFILE": "Profile updated",
    "DELETE_ACCOUNT": "Account deleted"
}

ACTION_DESCRIPTIONS = {
    "USER_SIGNUP": "New user registration",
    "USER_LOGIN": "User authentication",
    "PASSWORD_CHANGE": "User changed their password",
    "CREATE_TRANSACTION": "New income or expense recorded",
    "UPDATE_TRANSACTION": "Transaction details modified",
    "DELETE_TRANSACTION": "Transaction removed",
    "ADMIN_BLOCK_USER": "Admin restricted user access",
    "ADMIN_UNBLOCK_USER": "Admin restored user access",
    "CREATE_CATEGORY": "New category added",
    "DELETE_CATEGORY": "Category removed",
    "UPDATE_PROFILE": "Profile information updated",
    "DELETE_ACCOUNT": "User account was deleted"
}

ACTION_ENTITY_TYPES = {
    "USER_SIGNUP": "user",
    "USER_LOGIN": "user",
    "PASSWORD_CHANGE": "user",
    "CREATE_TRANSACTION": "transaction",
    "UPDATE_TRANSACTION": "transaction",
    "DELETE_TRANSACTION": "transaction",
    "ADMIN_BLOCK_USER": "user",
    "ADMIN_UNBLOCK_USER": "user",
    "CREATE_CATEGORY": "category",
    "DELETE_CATEGORY": "category",
    "UPDATE_PROFILE": "user",
    "DELETE_ACCOUNT": "user"
}


def enrich_log(log: dict) -> dict:
    action = log.get("action", "")
    entity_type = log.get("entity_type") or ACTION_ENTITY_TYPES.get(action, "unknown")
    return {
        **log,
        "action_label": ACTION_LABELS.get(action, action),
        "action_description": ACTION_DESCRIPTIONS.get(action, ""),
        "entity_type": entity_type
    }


@router.get("")
def get_user_logs(
    current_user: User = Depends(get_current_user),
    user_id: int = Query(default=None, description="Filter by user ID"),
    action: str = Query(default=None, description="Filter by action type"),
    level: str = Query(default=None, description="Filter by level: INFO, WARNING, ERROR"),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    request_id: str = Query(default=None, description="Filter by request ID"),
    entity_type: str = Query(default=None, description="Filter by entity type"),
    entity_id: int = Query(default=None, description="Filter by entity ID"),
    sort_by: str = Query(default="timestamp", description="Sort by: timestamp"),
    sort_order: str = Query(default="desc", description="Sort order: asc, desc"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of records"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination")
):
    query = {}
    filters = {}

    if current_user.role != "admin":
        query["user_id"] = current_user.id
    elif user_id:
        query["user_id"] = user_id
        filters["user_id"] = user_id
    
    mongo_sort = -1 if sort_order == "desc" else 1
    
    if action:
        query["action"] = action
        filters["action"] = action
    
    if level:
        query["level"] = level.upper()
        filters["level"] = level
    
    if start_date:
        query["timestamp"] = {"$gte": start_date}
        filters["start_date"] = start_date.isoformat()
    
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
        filters["end_date"] = end_date.isoformat()
    
    if request_id:
        query["request_id"] = request_id
        filters["request_id"] = request_id
    
    if entity_type:
        query["entity_type"] = entity_type
        filters["entity_type"] = entity_type
    
    if entity_id:
        query["entity_id"] = entity_id
        filters["entity_id"] = entity_id
    
    total = logs_collection.count_documents(query)
    
    logs = list(logs_collection.find(
        query,
        {"_id": 0}
    ).sort("timestamp", mongo_sort).skip(offset).limit(limit))
    
    data = [enrich_log(log) for log in logs]
    
    return paginated_response(data, total, limit, offset, filters)


@router.get("/recent")
def get_recent_logs(
    admin_user: User = Depends(require_admin),
    action: str = Query(default=None, description="Filter by action type"),
    level: str = Query(default=None, description="Filter by level: INFO, WARNING, ERROR"),
    user_id: int = Query(default=None, description="Filter by user ID"),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    request_id: str = Query(default=None, description="Filter by request ID"),
    entity_type: str = Query(default=None, description="Filter by entity type"),
    entity_id: int = Query(default=None, description="Filter by entity ID"),
    sort_by: str = Query(default="timestamp", description="Sort by: timestamp"),
    sort_order: str = Query(default="desc", description="Sort order: asc, desc"),
    limit: int = Query(default=10, ge=1, le=50, description="Number of records"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination")
):
    query = {}
    filters = {}
    
    mongo_sort = -1 if sort_order == "desc" else 1
    
    if action:
        query["action"] = action
        filters["action"] = action
    
    if level:
        query["level"] = level.upper()
        filters["level"] = level
    
    if start_date:
        query["timestamp"] = {"$gte": start_date}
        filters["start_date"] = start_date.isoformat()
    
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
        filters["end_date"] = end_date.isoformat()
    
    if request_id:
        query["request_id"] = request_id
        filters["request_id"] = request_id
    
    if entity_type:
        query["entity_type"] = entity_type
        filters["entity_type"] = entity_type
    
    if entity_id:
        query["entity_id"] = entity_id
        filters["entity_id"] = entity_id
    
    total = logs_collection.count_documents(query)
    
    logs = list(logs_collection.find(
        query,
        {"_id": 0}
    ).sort("timestamp", mongo_sort).skip(offset).limit(limit))
    
    data = [enrich_log(log) for log in logs]
    
    return paginated_response(data, total, limit, offset, filters)


@router.get("/stats")
def get_log_stats(
    admin_user: User = Depends(require_admin),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date")
):
    match_stage = {"$match": {}}
    
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        match_stage["$match"]["timestamp"] = date_filter
    
    pipeline = [
        match_stage,
        {
            "$group": {
                "_id": {
                    "action": "$action",
                    "level": "$level"
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}}
    ]
    
    action_stats = list(logs_collection.aggregate(pipeline))
    
    user_pipeline = [
        match_stage,
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    user_stats = list(logs_collection.aggregate(user_pipeline))
    
    level_pipeline = [
        match_stage,
        {"$group": {"_id": "$level", "count": {"$sum": 1}}}
    ]
    level_stats = list(logs_collection.aggregate(level_pipeline))
    
    return success_response(data={
        "by_action": action_stats,
        "by_user": user_stats,
        "by_level": level_stats,
        "total": logs_collection.count_documents(match_stage["$match"] if match_stage["$match"] else {})
    })


@router.get("/failed-logins")
def get_failed_logins(
    admin_user: User = Depends(require_admin),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of records")
):
    query = {"action": "FAILED_LOGIN"}
    
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    logs = list(logs_collection.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit))
    
    return success_response(data=logs)
