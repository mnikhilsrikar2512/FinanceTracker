"""Admin router: privileged endpoints for user management and config"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import Date, Integer, and_, case, cast, func

from app.core.deps import get_db
from app.core.auth import get_current_user, require_admin
from app.core.response import success_response, paginated_response
from app.models.user import User
from app.models.transaction import Transaction
from app.models.category import Category
from app.repositories import user_repo, transaction_repo
from app.repositories import analytics_repo
from app.services.log_service import log_action
from app.core.transaction_filters import active_transaction_condition

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


class UserStatusUpdate(BaseModel):
    status: str


def _normalize_bucket_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        return value
    try:
        return datetime.fromisoformat(str(value)).date()
    except (ValueError, TypeError):
        return None


def _bucket_date_expression(db: Session):
    dialect = (db.bind.dialect.name if db.bind and db.bind.dialect else "").lower()
    if dialect == "sqlite":
        return func.date(Transaction.date)
    return cast(Transaction.date, Date)


def _year_month_expressions(db: Session):
    dialect = (db.bind.dialect.name if db.bind and db.bind.dialect else "").lower()
    if dialect == "sqlite":
        return (
            cast(func.strftime("%Y", Transaction.date), Integer),
            cast(func.strftime("%m", Transaction.date), Integer),
        )
    return func.year(Transaction.date), func.month(Transaction.date)


def _apply_transaction_date_filters(query, start_date: datetime = None, end_date: datetime = None):
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    return query


@router.get("/dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    total_users = db.query(User).count()
    non_admin_users = db.query(User).filter(User.role != "admin")
    active_users = non_admin_users.filter(User.status == "active").count()
    blocked_users = non_admin_users.filter(User.status == "blocked").count()
    other_users = non_admin_users.filter(User.status.notin_(["active", "blocked"])).count()
    admin_count = db.query(User).filter(User.role == "admin").count()
    total_transactions = db.query(Transaction).filter(active_transaction_condition(Transaction)).count()

    return success_response(data={
        "total_users": total_users,
        "active_users": active_users,
        "blocked_users": blocked_users,
        "other_users": other_users,
        "admin_users": admin_count,
        "total_transactions": total_transactions
    })


@router.get("/analytics")
def admin_analytics(
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    granularity: str = Query(default="month", description="Time bucket: day, week, or month"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    normalized_granularity = str(granularity or "month").lower()
    if normalized_granularity not in {"day", "week", "month"}:
        normalized_granularity = "month"

    base_query = db.query(Transaction).filter(active_transaction_condition(Transaction))
    base_query = _apply_transaction_date_filters(base_query, start_date, end_date)

    income_total = _apply_transaction_date_filters(
        db.query(func.sum(Transaction.amount))
        .filter(active_transaction_condition(Transaction), Transaction.amount > 0),
        start_date,
        end_date,
    ).scalar() or 0

    expense_total = _apply_transaction_date_filters(
        db.query(func.sum(func.abs(Transaction.amount)))
        .filter(active_transaction_condition(Transaction), Transaction.amount < 0),
        start_date,
        end_date,
    ).scalar() or 0
    average_transaction = _apply_transaction_date_filters(
        db.query(func.avg(func.abs(Transaction.amount))).filter(active_transaction_condition(Transaction)),
        start_date,
        end_date,
    ).scalar() or 0

    expense_category_rows = _apply_transaction_date_filters(
        db.query(
            Category.name.label("category_name"),
            func.sum(func.abs(Transaction.amount)).label("total"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .filter(active_transaction_condition(Transaction), Transaction.amount < 0),
        start_date,
        end_date,
    ).group_by(Category.name).all()

    category_summary = [
        {
            "category": row.category_name or "Uncategorized",
            "total": float(row.total or 0),
        }
        for row in expense_category_rows
    ]

    top_category = max(category_summary, key=lambda item: item["total"], default=None)

    highest_expense = _apply_transaction_date_filters(
        db.query(Transaction, Category.name.label("category_name"))
        .outerjoin(Category, Transaction.category_id == Category.id)
        .filter(active_transaction_condition(Transaction), Transaction.amount < 0),
        start_date,
        end_date,
    ).order_by(func.abs(Transaction.amount).desc(), Transaction.date.desc()).first()

    txn_type_expr = case(
        (Transaction.amount >= 0, "income"),
        else_="expense",
    )

    if normalized_granularity == "day":
        bucket_date = _bucket_date_expression(db).label("bucket_date")
        period_rows = _apply_transaction_date_filters(
            db.query(
                bucket_date,
                txn_type_expr.label("type"),
                func.sum(Transaction.amount).label("total"),
            )
            .filter(active_transaction_condition(Transaction)),
            start_date,
            end_date,
        ).group_by(
            bucket_date,
            txn_type_expr,
        ).order_by(bucket_date).all()

        monthly_summary = []
        for row in period_rows:
            bucket = _normalize_bucket_date(row.bucket_date)
            if not bucket:
                continue
            monthly_summary.append(
                {
                    "year": bucket.year,
                    "month": bucket.month,
                    "day": bucket.day,
                    "bucketType": "day",
                    "bucketStartKey": bucket.isoformat(),
                    "type": row.type,
                    "total": float(abs(row.total or 0) if row.type == "expense" else (row.total or 0)),
                    "label": bucket.strftime("%d %b"),
                    "bucket": bucket.isoformat(),
                }
            )
    elif normalized_granularity == "week":
        period_rows = _apply_transaction_date_filters(
            db.query(
                Transaction.date,
                Transaction.amount,
            )
            .filter(active_transaction_condition(Transaction)),
            start_date,
            end_date,
        ).all()

        weekly_buckets = {}
        for row in period_rows:
            if not row.date:
                continue
            bucket_start = row.date - timedelta(days=row.date.weekday())
            bucket_start = bucket_start.replace(hour=0, minute=0, second=0, microsecond=0)
            bucket_key = bucket_start.date().isoformat()
            bucket_end = bucket_start + timedelta(days=6)
            bucket = weekly_buckets.setdefault(bucket_key, {
                "year": bucket_start.year,
                "month": bucket_start.month,
                "day": bucket_start.day,
                "bucketType": "week",
                "type": "income" if row.amount >= 0 else "expense",
                "income": 0,
                "expense": 0,
                "total": 0,
                "bucket": bucket_key,
                "label": f"{bucket_start.strftime('%d %b')} – {bucket_end.strftime('%d %b')}",
            })
            if row.amount >= 0:
                bucket["income"] += float(row.amount or 0)
            else:
                bucket["expense"] += abs(float(row.amount or 0))
            bucket["total"] += float(row.amount or 0)
            bucket["type"] = "expense" if row.amount < 0 else bucket["type"] or "income"

        monthly_summary = []
        for key, bucket in sorted(weekly_buckets.items()):
            if bucket["income"] > 0:
                monthly_summary.append({
                    "year": bucket["year"],
                    "month": bucket["month"],
                    "day": bucket["day"],
                    "bucketType": "week",
                    "bucketStartKey": key,
                    "type": "income",
                    "total": float(bucket["income"]),
                    "label": bucket["label"],
                    "bucket": key,
                })
            if bucket["expense"] > 0:
                monthly_summary.append({
                    "year": bucket["year"],
                    "month": bucket["month"],
                    "day": bucket["day"],
                    "bucketType": "week",
                    "bucketStartKey": key,
                    "type": "expense",
                    "total": float(bucket["expense"]),
                    "label": bucket["label"],
                    "bucket": key,
                })
    else:
        year_expr, month_expr = _year_month_expressions(db)
        period_rows = _apply_transaction_date_filters(
            db.query(
                year_expr.label("year"),
                month_expr.label("month"),
                func.sum(case((Transaction.amount >= 0, Transaction.amount), else_=0)).label("income_total"),
                func.sum(case((Transaction.amount < 0, func.abs(Transaction.amount)), else_=0)).label("expense_total"),
            )
            .filter(active_transaction_condition(Transaction)),
            start_date,
            end_date,
        ).group_by(
            year_expr,
            month_expr,
        ).order_by(
            year_expr,
            month_expr,
        ).all()

        monthly_summary = []
        for row in period_rows:
            year = int(row.year)
            month = int(row.month)
            key = f"{year}-{month:02d}"
            label = datetime(year, month, 1).strftime("%b %Y")
            if row.income_total:
                monthly_summary.append({
                    "year": year,
                    "month": month,
                    "bucketType": "month",
                    "bucketStartKey": key,
                    "type": "income",
                    "total": float(row.income_total or 0),
                    "label": label,
                    "bucket": key,
                })
            if row.expense_total:
                monthly_summary.append({
                    "year": year,
                    "month": month,
                    "bucketType": "month",
                    "bucketStartKey": key,
                    "type": "expense",
                    "total": float(row.expense_total or 0),
                    "label": label,
                    "bucket": key,
                })

    transaction_count = base_query.count()

    if start_date and end_date:
        day_span = max((end_date.date() - start_date.date()).days + 1, 1)
    else:
        day_span = _apply_transaction_date_filters(
            db.query(func.count(func.distinct(_bucket_date_expression(db)))),
            start_date,
            end_date,
        ).filter(active_transaction_condition(Transaction)).scalar() or 0
        if not day_span:
            day_span = 1

    transactions_per_day = round(transaction_count / day_span, 1) if transaction_count else 0

    trend_direction = "Stable"
    monthly_by_period = {}
    for item in monthly_summary:
        key = item.get("bucketStartKey") or item.get("bucket")
        if not key:
            if item.get("day"):
                key = f"{item['year']}-{item['month']:02d}-{item['day']:02d}"
            else:
                key = f"{item['year']}-{item['month']:02d}"
        monthly_by_period.setdefault(key, {"income": 0, "expense": 0})
        monthly_by_period[key][item["type"]] = item["total"]

    sorted_periods = sorted(monthly_by_period.keys())
    if len(sorted_periods) >= 2:
        current_key = sorted_periods[-1]
        previous_key = sorted_periods[-2]
        current_net = monthly_by_period[current_key]["income"] - monthly_by_period[current_key]["expense"]
        previous_net = monthly_by_period[previous_key]["income"] - monthly_by_period[previous_key]["expense"]
        if current_net > previous_net:
            trend_direction = "Improving"
        elif current_net < previous_net:
            trend_direction = "Cooling"

    highest_transaction_data = None
    if highest_expense:
        expense_txn = highest_expense[0]
        highest_transaction_data = {
            "id": expense_txn.id,
            "description": expense_txn.description,
            "amount": float(abs(expense_txn.amount or 0)),
            "date": expense_txn.date,
            "category": highest_expense[1],
        }

    user_join_conditions = [
        Transaction.user_id == User.id,
        active_transaction_condition(Transaction),
    ]
    if start_date:
        user_join_conditions.append(Transaction.date >= start_date)
    if end_date:
        user_join_conditions.append(Transaction.date <= end_date)

    user_summary_rows = (
        db.query(
            User.id.label("user_id"),
            User.name.label("name"),
            User.email.label("email"),
            func.count(Transaction.id).label("transaction_count"),
            func.sum(
                case(
                    (Transaction.amount > 0, Transaction.amount),
                    else_=0,
                )
            ).label("income_total"),
            func.sum(
                case(
                    (Transaction.amount < 0, func.abs(Transaction.amount)),
                    else_=0,
                )
            ).label("expense_total"),
        )
        .outerjoin(Transaction, and_(*user_join_conditions))
        .group_by(User.id, User.name, User.email)
        .order_by(func.count(Transaction.id).desc(), User.name.asc())
        .all()
    )

    user_summary = [
        {
            "user_id": row.user_id,
            "name": row.name,
            "email": row.email,
            "transaction_count": int(row.transaction_count or 0),
            "income_total": float(row.income_total or 0),
            "expense_total": float(row.expense_total or 0),
            "net_total": float((row.income_total or 0) - (row.expense_total or 0)),
        }
        for row in user_summary_rows
        if int(row.transaction_count or 0) > 0
    ]

    return success_response(data={
        "scope": "system",
        "total_income": float(income_total),
        "total_expense": float(expense_total),
        "balance": float(income_total - expense_total),
        "top_category": {
            "name": top_category["category"],
            "amount": top_category["total"],
        } if top_category else None,
        "highest_transaction": highest_transaction_data,
        "transactions_per_day": transactions_per_day,
        "transaction_count": transaction_count,
        "avg_transaction": round(float(average_transaction), 2),
        "trend_direction": trend_direction,
        "monthly_summary": monthly_summary,
        "category_summary": category_summary,
        "user_summary": user_summary,
        "user_counts": {
            "total": db.query(User).filter(User.role != "admin").count(),
            "active": db.query(User).filter(User.role != "admin", User.status == "active").count(),
            "blocked": db.query(User).filter(User.role != "admin", User.status == "blocked").count(),
            "other": db.query(User).filter(User.role != "admin", User.status.notin_(["active", "blocked"])).count(),
            "admins": db.query(User).filter(User.role == "admin").count(),
        },
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
        active_transaction_condition(Transaction)
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
        query = query.filter(func.abs(Transaction.amount) >= min_amount)
        filters["min_amount"] = min_amount
    
    if max_amount is not None:
        query = query.filter(func.abs(Transaction.amount) <= max_amount)
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
