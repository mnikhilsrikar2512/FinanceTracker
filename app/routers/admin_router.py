"""Admin router: privileged endpoints for user management and config"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from app.core.deps import get_db
from app.core.auth import get_current_user, require_admin
from app.core.response import success_response, paginated_response
from app.models.user import User
from app.models.transaction import Transaction
from app.models.category import Category
from app.repositories import user_repo, transaction_repo
from app.repositories import analytics_repo
from app.services.log_service import log_action

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


class UserStatusUpdate(BaseModel):
    status: str


@router.get("/dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.status == "active").count()
    blocked_users = db.query(User).filter(User.status == "blocked").count()
    admin_count = db.query(User).filter(User.role == "admin").count()
    total_transactions = db.query(Transaction).count()

    return success_response(data={
        "total_users": total_users,
        "active_users": active_users,
        "blocked_users": blocked_users,
        "admin_users": admin_count,
        "total_transactions": total_transactions
    })


@router.get("/users")
def list_users(
    status: str = Query(default=None, description="Filter by status: active, inactive, blocked"),
    role: str = Query(default=None, description="Filter by role: user, admin"),
    search: str = Query(default=None, description="Search by name or email"),
    created_after: datetime = Query(default=None, description="Created after date"),
    created_before: datetime = Query(default=None, description="Created before date"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of records to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    sort_by: str = Query(default="created_at", description="Sort by: created_at, name, email"),
    sort_order: str = Query(default="desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    query = db.query(User)
    filters = {}

    if status:
        query = query.filter(User.status == status)
        filters["status"] = status
    
    if role:
        query = query.filter(User.role == role)
        filters["role"] = role
    
    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) | 
            (User.email.ilike(f"%{search}%"))
        )
        filters["search"] = search
    
    if created_after:
        query = query.filter(User.created_at >= created_after)
        filters["created_after"] = created_after.isoformat()
    
    if created_before:
        query = query.filter(User.created_at <= created_before)
        filters["created_before"] = created_before.isoformat()

    total = query.count()
    
    sort_column = getattr(User, sort_by, User.created_at)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    users = query.offset(offset).limit(limit).all()
    
    data = [{
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "status": u.status,
        "role": u.role,
        "created_at": u.created_at
    } for u in users]
    
    return paginated_response(data, total, limit, offset, filters)


@router.get("/users/{user_id}")
def get_user_details(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return success_response(data={
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "status": user.status,
        "role": user.role,
        "created_at": user.created_at
    })


@router.put("/users/{user_id}/block")
def block_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot block an admin")
    
    user.status = "blocked"
    db.commit()

    log_action(
        action="ADMIN_BLOCK_USER",
        user_id=admin_user.id,
        payload={"blocked_user_id": user_id, "email": user.email},
        entity_type="user",
        entity_id=user_id,
        level="WARNING"
    )

    return success_response(message=f"User {user.email} has been blocked")


@router.put("/users/{user_id}/unblock")
def unblock_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.status = "active"
    db.commit()

    log_action(
        action="ADMIN_UNBLOCK_USER",
        user_id=admin_user.id,
        payload={"unblocked_user_id": user_id, "email": user.email},
        entity_type="user",
        entity_id=user_id,
        level="INFO"
    )

    return success_response(message=f"User {user.email} has been unblocked")


@router.get("/users/{user_id}/transactions")
def get_user_transactions(
    user_id: int,
    type: str = Query(default=None, description="Filter by type: income, expense"),
    category_id: int = Query(default=None, description="Filter by category ID"),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    min_amount: float = Query(default=None, description="Minimum amount"),
    max_amount: float = Query(default=None, description="Maximum amount"),
    search: str = Query(default=None, description="Search in description"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of records"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    sort_by: str = Query(default="date", description="Sort by: date, amount"),
    sort_order: str = Query(default="desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    query = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.is_deleted != True
    )
    filters = {}
    
    if type:
        cat_type = "income" if type.lower() == "income" else "expense"
        query = query.join(Category).filter(Category.type == cat_type)
        filters["type"] = type
    
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
        filters["category_id"] = category_id
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
        filters["start_date"] = start_date.isoformat()
    
    if end_date:
        query = query.filter(Transaction.date <= end_date)
        filters["end_date"] = end_date.isoformat()
    
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
        filters["min_amount"] = min_amount
    
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
        filters["max_amount"] = max_amount
    
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))
        filters["search"] = search

    total = query.count()
    
    sort_column = getattr(Transaction, sort_by, Transaction.date)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    txns = query.offset(offset).limit(limit).all()
    
    data = [{
        "id": t.id,
        "user_id": t.user_id,
        "category_id": t.category_id,
        "amount": t.amount,
        "description": t.description,
        "date": t.date,
        "created_by": t.created_by,
        "created_at": t.created_at,
        "modified_by": t.modified_by,
        "modified_at": t.modified_at
    } for t in txns]
    
    return paginated_response(data, total, limit, offset, filters)


@router.get("/users/{user_id}/summary")
def get_user_summary(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    income_total = analytics_repo.get_summary(db, user_id).get("total_income", 0)
    expense_total = analytics_repo.get_summary(db, user_id).get("total_expense", 0)
    transaction_count = db.query(Transaction).filter(Transaction.user_id == user_id).count()

    return success_response(data={
        "user_id": user_id,
        "user_name": user.name,
        "user_email": user.email,
        "total_income": income_total,
        "total_expense": expense_total,
        "balance": income_total - expense_total,
        "transaction_count": transaction_count
    })


@router.get("/categories/stats")
def get_category_stats(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    categories = db.query(Category).all()
    
    data = []
    for cat in categories:
        usage_count = db.query(Transaction).filter(Transaction.category_id == cat.id).count()
        txns = db.query(Transaction).filter(Transaction.category_id == cat.id).all()
        total_amount = sum(abs(t.amount) for t in txns)
        
        data.append({
            "id": cat.id,
            "name": cat.name,
            "type": cat.type,
            "usage_count": usage_count,
            "total_amount": total_amount
        })
    
    return success_response(data=data)
