import json
from fastapi import APIRouter, Depends, Query
from datetime import datetime
from sqlalchemy import func, asc, desc
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_admin
from app.core.response import success_response, paginated_response
from app.core.deps import get_db
from app.core.timezone import to_utc_naive
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/logs", tags=["Logs"])

ACTION_LABELS = {
    "USER_SIGNUP": "User signed up",
    "USER_LOGIN": "User logged in",
    "PASSWORD_CHANGE": "Password changed",
    "CREATE_TRANSACTION": "Transaction created",
    "UPDATE_TRANSACTION": "Transaction updated",
    "ARCHIVE_TRANSACTION": "Transaction archived",
    "RESTORE_TRANSACTION": "Transaction restored",
    "DELETE_TRANSACTION": "Transaction deleted",
    "BULK_ARCHIVE_TRANSACTION": "Transactions archived",
    "BULK_RESTORE_TRANSACTION": "Transactions restored",
    "BULK_DELETE_TRANSACTION": "Transactions deleted",
    "ADMIN_BLOCK_USER": "Admin blocked user",
    "ADMIN_UNBLOCK_USER": "Admin unblocked user",
    "CREATE_CATEGORY": "Category created",
    "DELETE_CATEGORY": "Category deleted",
    "CREATE_BUDGET": "Budget created",
    "UPDATE_BUDGET": "Budget updated",
    "DELETE_BUDGET": "Budget deleted",
    "BUDGET_REACHED_50": "Budget reached 50%",
    "BUDGET_REACHED_75": "Budget reached 75%",
    "BUDGET_REACHED_LIMIT": "Budget reached 100%",
    "BUDGET_OVER_BUDGET": "Budget exceeded",
    "UPDATE_PROFILE": "Profile updated",
    "DELETE_ACCOUNT": "Account deleted",
    "FAILED_LOGIN": "Sign-in failed",
}

ACTION_DESCRIPTIONS = {
    "USER_SIGNUP": "New user registration",
    "USER_LOGIN": "User authentication",
    "PASSWORD_CHANGE": "User changed their password",
    "CREATE_TRANSACTION": "New income or expense recorded",
    "UPDATE_TRANSACTION": "Transaction details modified",
    "ARCHIVE_TRANSACTION": "Transaction hidden from the default view",
    "RESTORE_TRANSACTION": "Archived transaction moved back to the active list",
    "DELETE_TRANSACTION": "Transaction removed",
    "BULK_ARCHIVE_TRANSACTION": "Multiple transactions were archived together",
    "BULK_RESTORE_TRANSACTION": "Multiple archived transactions were restored together",
    "BULK_DELETE_TRANSACTION": "Multiple transactions were permanently removed",
    "ADMIN_BLOCK_USER": "Admin restricted user access",
    "ADMIN_UNBLOCK_USER": "Admin restored user access",
    "CREATE_CATEGORY": "New category added",
    "DELETE_CATEGORY": "Category removed",
    "CREATE_BUDGET": "New budget created",
    "UPDATE_BUDGET": "Budget limit or note updated",
    "DELETE_BUDGET": "Budget removed",
    "BUDGET_REACHED_50": "Budget usage crossed the 50% mark",
    "BUDGET_REACHED_75": "Budget usage crossed the 75% mark",
    "BUDGET_REACHED_LIMIT": "Budget is fully used",
    "BUDGET_OVER_BUDGET": "Spending went beyond the budget limit",
    "UPDATE_PROFILE": "Profile information updated",
    "DELETE_ACCOUNT": "User account was deleted",
    "FAILED_LOGIN": "An unsuccessful sign-in attempt was recorded",
}

ACTION_ENTITY_TYPES = {
    "USER_SIGNUP": "user",
    "USER_LOGIN": "user",
    "PASSWORD_CHANGE": "user",
    "CREATE_TRANSACTION": "transaction",
    "UPDATE_TRANSACTION": "transaction",
    "ARCHIVE_TRANSACTION": "transaction",
    "RESTORE_TRANSACTION": "transaction",
    "DELETE_TRANSACTION": "transaction",
    "BULK_ARCHIVE_TRANSACTION": "transaction",
    "BULK_RESTORE_TRANSACTION": "transaction",
    "BULK_DELETE_TRANSACTION": "transaction",
    "ADMIN_BLOCK_USER": "user",
    "ADMIN_UNBLOCK_USER": "user",
    "CREATE_CATEGORY": "category",
    "DELETE_CATEGORY": "category",
    "CREATE_BUDGET": "budget",
    "UPDATE_BUDGET": "budget",
    "DELETE_BUDGET": "budget",
    "BUDGET_REACHED_50": "budget",
    "BUDGET_REACHED_75": "budget",
    "BUDGET_REACHED_LIMIT": "budget",
    "BUDGET_OVER_BUDGET": "budget",
    "UPDATE_PROFILE": "user",
    "DELETE_ACCOUNT": "user",
    "FAILED_LOGIN": "user",
}


def _actor_name(log: dict) -> str:
    payload = log.get("payload") or {}
    return payload.get("name") or log.get("user_name") or payload.get("email") or log.get("user_email") or "User"


def _transaction_summary(payload: dict) -> str:
    category = payload.get("category_name") or payload.get("category") or "Uncategorized"
    amount = payload.get("amount")
    description = payload.get("description") or "No description"
    if amount is None:
        return f"{description} in {category}"
    return f"{description} in {category} for {abs(float(amount)):.0f}"


def _format_action_label(action: str, log: dict) -> str:
    payload = log.get("payload") or {}
    actor = _actor_name(log)
    category_name = payload.get("category_name") or "This budget"
    target = payload.get("target_name") or payload.get("email") or "a user"

    custom_labels = {
        "USER_SIGNUP": f"{actor} created an account",
        "USER_LOGIN": f"{actor} logged in",
        "PASSWORD_CHANGE": f"{actor} changed password",
        "UPDATE_PROFILE": f"{actor} updated profile",
        "DELETE_ACCOUNT": f"{actor} deleted the account",
        "CREATE_TRANSACTION": f"{actor} added a transaction",
        "UPDATE_TRANSACTION": f"{actor} updated a transaction",
        "ARCHIVE_TRANSACTION": f"{actor} archived a transaction",
        "RESTORE_TRANSACTION": f"{actor} restored a transaction",
        "DELETE_TRANSACTION": f"{actor} deleted a transaction",
        "BULK_ARCHIVE_TRANSACTION": f"{actor} archived multiple transactions",
        "BULK_RESTORE_TRANSACTION": f"{actor} restored multiple transactions",
        "BULK_DELETE_TRANSACTION": f"{actor} deleted multiple transactions",
        "ADMIN_BLOCK_USER": f"{actor} blocked {target}",
        "ADMIN_UNBLOCK_USER": f"{actor} unblocked {target}",
        "CREATE_BUDGET": f"{actor} created a budget",
        "UPDATE_BUDGET": f"{actor} updated a budget",
        "DELETE_BUDGET": f"{actor} deleted a budget",
        "BUDGET_REACHED_50": f"{category_name} reached 50% of budget",
        "BUDGET_REACHED_75": f"{category_name} reached 75% of budget",
        "BUDGET_REACHED_LIMIT": f"{category_name} reached the budget limit",
        "BUDGET_OVER_BUDGET": f"{category_name} is over budget",
        "FAILED_LOGIN": f"Sign-in failed for {payload.get('email') or 'this account'}",
    }
    return custom_labels.get(action, ACTION_LABELS.get(action, action.replace("_", " ").title()))


def _format_action_description(action: str, log: dict) -> str:
    payload = log.get("payload") or {}
    category_name = payload.get("category_name") or "This budget"
    threshold = payload.get("threshold")
    remaining = payload.get("remaining")

    custom_descriptions = {
        "USER_SIGNUP": f"Account created with {payload.get('email') or 'a verified email address'}",
        "USER_LOGIN": f"Signed in as {payload.get('email') or log.get('user_email') or 'this user'}",
        "PASSWORD_CHANGE": "Security settings were updated",
        "UPDATE_PROFILE": f"Profile now uses {payload.get('email') or log.get('user_email') or 'the latest email'}",
        "DELETE_ACCOUNT": "Account data and owned records were removed",
        "CREATE_TRANSACTION": _transaction_summary(payload),
        "UPDATE_TRANSACTION": _transaction_summary(payload),
        "ARCHIVE_TRANSACTION": _transaction_summary(payload),
        "RESTORE_TRANSACTION": _transaction_summary(payload),
        "DELETE_TRANSACTION": _transaction_summary(payload),
        "BULK_ARCHIVE_TRANSACTION": f"{payload.get('count') or 0} transactions were archived",
        "BULK_RESTORE_TRANSACTION": f"{payload.get('count') or 0} transactions were restored",
        "BULK_DELETE_TRANSACTION": f"{payload.get('count') or 0} transactions were permanently deleted",
        "ADMIN_BLOCK_USER": f"{payload.get('email') or 'Selected account'} can no longer sign in",
        "ADMIN_UNBLOCK_USER": f"{payload.get('email') or 'Selected account'} can sign in again",
        "CREATE_BUDGET": f"{category_name} budget set to {abs(float(payload.get('amount') or 0)):.0f}",
        "UPDATE_BUDGET": f"{category_name} budget updated to {abs(float(payload.get('amount') or 0)):.0f}",
        "DELETE_BUDGET": f"{category_name} budget removed",
        "BUDGET_REACHED_50": f"{category_name} has used about {threshold or 50}% of its limit",
        "BUDGET_REACHED_75": f"{category_name} has used about {threshold or 75}% of its limit",
        "BUDGET_REACHED_LIMIT": f"{category_name} has reached 100% of its budget",
        "BUDGET_OVER_BUDGET": (
            f"{category_name} is over budget by {abs(float(remaining)):.0f}"
            if remaining is not None else f"{category_name} is over budget"
        ),
        "FAILED_LOGIN": "Someone used an invalid password or email combination",
    }
    return custom_descriptions.get(action, ACTION_DESCRIPTIONS.get(action, ""))


def enrich_log(log: dict) -> dict:
    action = log.get("action", "")
    entity_type = log.get("entity_type") or ACTION_ENTITY_TYPES.get(action, "unknown")
    return {
        **log,
        "action_label": _format_action_label(action, log),
        "action_description": _format_action_description(action, log),
        "entity_type": entity_type
    }


def serialize_log(log: AuditLog, user_lookup: dict | None = None) -> dict:
    payload = {}
    if log.payload_json:
        try:
            payload = json.loads(log.payload_json)
        except Exception:
            payload = {"raw": log.payload_json}

    user_meta = (user_lookup or {}).get(log.user_id, {})

    return enrich_log({
        "event": log.event,
        "action": log.action,
        "user_id": log.user_id,
        "user_name": payload.get("name") or user_meta.get("name"),
        "user_email": payload.get("email") or user_meta.get("email"),
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "level": log.level,
        "request_id": log.request_id,
        "payload": payload,
        "timestamp": log.timestamp,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    })


def serialize_logs(logs: list[AuditLog], db: Session) -> list[dict]:
    user_ids = {log.user_id for log in logs if log.user_id}
    user_lookup = {}
    if user_ids:
        user_lookup = {
            user.id: {"name": user.name, "email": user.email}
            for user in db.query(User).filter(User.id.in_(user_ids)).all()
        }
    return [serialize_log(log, user_lookup) for log in logs]


@router.get("")
def get_user_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    query = db.query(AuditLog)
    filters = {}

    if current_user.role != "admin":
        query = query.filter(AuditLog.user_id == current_user.id)
    elif user_id:
        query = query.filter(AuditLog.user_id == user_id)
        filters["user_id"] = user_id
    
    sort_column = AuditLog.timestamp if sort_by != "created_at" else AuditLog.created_at
    order_fn = desc if sort_order == "desc" else asc
    
    if action:
        query = query.filter(AuditLog.action == action)
        filters["action"] = action
    
    if level:
        query = query.filter(AuditLog.level == level.upper())
        filters["level"] = level
    
    if start_date:
        query = query.filter(AuditLog.timestamp >= to_utc_naive(start_date))
        filters["start_date"] = start_date.isoformat()
    
    if end_date:
        query = query.filter(AuditLog.timestamp <= to_utc_naive(end_date))
        filters["end_date"] = end_date.isoformat()
    
    if request_id:
        query = query.filter(AuditLog.request_id == request_id)
        filters["request_id"] = request_id
    
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
        filters["entity_type"] = entity_type
    
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
        filters["entity_id"] = entity_id
    
    total = query.count()
    logs = query.order_by(order_fn(sort_column)).offset(offset).limit(limit).all()
    data = serialize_logs(logs, db)
    
    return paginated_response(data, total, limit, offset, filters)


@router.get("/recent")
def get_recent_logs(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
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
    query = db.query(AuditLog)
    filters = {}
    
    sort_column = AuditLog.timestamp if sort_by != "created_at" else AuditLog.created_at
    order_fn = desc if sort_order == "desc" else asc
    
    if action:
        query = query.filter(AuditLog.action == action)
        filters["action"] = action
    
    if level:
        query = query.filter(AuditLog.level == level.upper())
        filters["level"] = level
    
    if start_date:
        query = query.filter(AuditLog.timestamp >= to_utc_naive(start_date))
        filters["start_date"] = start_date.isoformat()
    
    if end_date:
        query = query.filter(AuditLog.timestamp <= to_utc_naive(end_date))
        filters["end_date"] = end_date.isoformat()
    
    if request_id:
        query = query.filter(AuditLog.request_id == request_id)
        filters["request_id"] = request_id
    
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
        filters["entity_type"] = entity_type
    
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
        filters["entity_id"] = entity_id
    
    total = query.count()
    logs = query.order_by(order_fn(sort_column)).offset(offset).limit(limit).all()
    data = serialize_logs(logs, db)
    
    return paginated_response(data, total, limit, offset, filters)


@router.get("/stats")
def get_log_stats(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date")
):
    base_query = db.query(AuditLog)

    if start_date:
        base_query = base_query.filter(AuditLog.timestamp >= to_utc_naive(start_date))
    if end_date:
        base_query = base_query.filter(AuditLog.timestamp <= to_utc_naive(end_date))

    action_stats = [
        {
            "_id": {"action": action, "level": level},
            "count": count,
        }
        for action, level, count in (
            base_query.with_entities(AuditLog.action, AuditLog.level, func.count(AuditLog.id))
            .group_by(AuditLog.action, AuditLog.level)
            .order_by(desc(func.count(AuditLog.id)))
            .all()
        )
    ]

    user_stats = [
        {"_id": user_id, "count": count}
        for user_id, count in (
            base_query.with_entities(AuditLog.user_id, func.count(AuditLog.id))
            .group_by(AuditLog.user_id)
            .order_by(desc(func.count(AuditLog.id)))
            .limit(10)
            .all()
        )
    ]

    level_stats = [
        {"_id": level, "count": count}
        for level, count in (
            base_query.with_entities(AuditLog.level, func.count(AuditLog.id))
            .group_by(AuditLog.level)
            .all()
        )
    ]
    
    return success_response(data={
        "by_action": action_stats,
        "by_user": user_stats,
        "by_level": level_stats,
        "total": base_query.count()
    })


@router.get("/failed-logins")
def get_failed_logins(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of records")
):
    query = db.query(AuditLog).filter(AuditLog.action == "FAILED_LOGIN")
    
    if start_date:
        query = query.filter(AuditLog.timestamp >= to_utc_naive(start_date))
    if end_date:
        query = query.filter(AuditLog.timestamp <= to_utc_naive(end_date))
    
    logs = query.order_by(desc(AuditLog.timestamp)).limit(limit).all()
    
    return success_response(data=serialize_logs(logs, db))
