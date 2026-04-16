from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import Date, cast
from datetime import datetime, timedelta
from app.services import analytics_service
from app.core.deps import get_db
from app.core.auth import get_current_user
from app.core.response import success_response, ApiResponse
from app.models.user import User
from app.models.transaction import Transaction
from app.models.category import Category
from app.core.transaction_filters import active_transaction_condition

router = APIRouter(prefix="/summary", tags=["Analytics"])


@router.get("/by-category")
def summary_by_category(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    type: str = Query(default=None, description="Filter by type: income, expense")
):
    data = analytics_service.get_summary_by_category_filtered(
        db, current_user.id, start_date, end_date, type
    )
    return success_response(data=data)


@router.get("/monthly")
def monthly_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    granularity: str = Query(default="month", description="Time bucket: day, week, or month")
):
    data = analytics_service.get_monthly_summary_filtered(
        db, current_user.id, start_date, end_date, granularity
    )
    return success_response(data=data)


@router.get("")
def summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date")
):
    data = analytics_service.get_summary_filtered(
        db, current_user.id, start_date, end_date
    )
    return success_response(data=data)


@router.get("/dashboard")
def user_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    txn_type: str = Query(default=None, description="Filter by type: income, expense"),
    category_id: int = Query(default=None, description="Filter by category ID"),
    granularity: str = Query(default="day", description="Time bucket: day, week, or month"),
    minimal: bool = Query(default=False, description="Return minimal response (overview + recent only)")
):
    try:
        normalized_granularity = str(granularity or "day").lower()
        if normalized_granularity not in {"day", "week", "month"}:
            normalized_granularity = "day"

        query = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            active_transaction_condition(Transaction)
        )
        
        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)
        if txn_type:
            cat_type = "income" if txn_type.lower() == "income" else "expense"
            query = query.join(Category).filter(Category.type == cat_type)
        if category_id:
            query = query.filter(Transaction.category_id == category_id)
        
        total_txns = query.count()
        
        income_txns = query.filter(Transaction.amount > 0)
        expense_txns = query.filter(Transaction.amount < 0)
        
        total_income = sum(t.amount for t in income_txns.all())
        total_expense = sum(abs(t.amount) for t in expense_txns.all())
        
        recent_txns = query.order_by(Transaction.date.desc()).limit(5).all()
        monthly_summary = analytics_service.get_monthly_summary_filtered(
            db,
            current_user.id,
            start_date,
            end_date,
            normalized_granularity
        )
        category_summary = analytics_service.get_summary_by_category_filtered(
            db,
            current_user.id,
            start_date,
            end_date,
            "expense"
        )
        
        filters = {}
        if start_date:
            filters["start_date"] = start_date.isoformat()
        if end_date:
            filters["end_date"] = end_date.isoformat()
        if txn_type:
            filters["type"] = txn_type
        if category_id:
            filters["category_id"] = category_id
        
        data = {
            "overview": {
                "total_income": total_income,
                "total_expense": total_expense,
                "balance": total_income - total_expense,
                "income_count": income_txns.count(),
                "expense_count": expense_txns.count(),
                "total_transactions": total_txns
            },
            "recent_transactions": [
                {
                    "id": t.id,
                    "amount": t.amount,
                    "description": t.description,
                    "date": t.date.isoformat() if t.date else None,
                    "category_id": t.category_id
                }
                for t in recent_txns
            ],
            "monthly_summary": monthly_summary,
            "category_summary": category_summary
        }
        
        return ApiResponse.with_meta(data, {"filters": filters, "minimal": minimal})
    except Exception as e:
        data = {
            "overview": {
                "total_income": 0,
                "total_expense": 0,
                "balance": 0,
                "income_count": 0,
                "expense_count": 0,
                "total_transactions": 0
            },
            "recent_transactions": []
        }
        return ApiResponse.with_meta(data, {"filters": {}, "error": str(e)})


@router.get("/insights")
def user_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    granularity: str = Query(default="month", description="Time bucket: day, week, or month")
):
    try:
        normalized_granularity = str(granularity or "month").lower()
        if normalized_granularity not in {"day", "week", "month"}:
            normalized_granularity = "month"

        query = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            active_transaction_condition(Transaction)
        )
        
        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)
        
        all_txns = query.all()
        
        if not all_txns:
            return success_response(data={
                "spending_trend": [],
                "top_category": None,
                "avg_transaction": 0,
                "highest_transaction": None,
                "lowest_transaction": None,
                "transactions_per_day": 0
            })
        
        income_txns = [t for t in all_txns if t.amount > 0]
        expense_txns = [t for t in all_txns if t.amount < 0]
        
        total_income = sum(t.amount for t in income_txns)
        total_expense = sum(abs(t.amount) for t in expense_txns)
        
        category_spending = {}
        for t in expense_txns:
            cat = db.query(Category).filter(Category.id == t.category_id).first()
            if cat:
                cat_name = cat.name
                if cat_name not in category_spending:
                    category_spending[cat_name] = 0
                category_spending[cat_name] += abs(t.amount)
        
        top_category = max(category_spending, key=category_spending.get) if category_spending else None
        
        amounts = [abs(t.amount) for t in expense_txns] if expense_txns else [t.amount for t in income_txns]
        avg_transaction = sum(amounts) / len(amounts) if amounts else 0
        
        spending_by_period = {}
        for t in all_txns:
            if not t.date:
                continue

            if normalized_granularity == "day":
                bucket_date = t.date.date() if hasattr(t.date, "date") else t.date
                period_key = bucket_date.isoformat()
                period_bucket = spending_by_period.setdefault(period_key, {
                    "income": 0,
                    "expense": 0,
                    "label": t.date.strftime("%d %b"),
                    "bucket": period_key,
                    "bucketType": "day",
                    "bucketStartKey": period_key,
                    "year": t.date.year,
                    "month": t.date.month,
                    "day": t.date.day,
                })
            elif normalized_granularity == "week":
                bucket_start = t.date - timedelta(days=t.date.weekday())
                bucket_start = bucket_start.replace(hour=0, minute=0, second=0, microsecond=0)
                period_key = bucket_start.date().isoformat()
                bucket_end = bucket_start + timedelta(days=6)
                period_bucket = spending_by_period.setdefault(period_key, {
                    "income": 0,
                    "expense": 0,
                    "label": f"{bucket_start.strftime('%d %b')} – {bucket_end.strftime('%d %b')}",
                    "bucket": period_key,
                    "bucketType": "week",
                    "bucketStartKey": period_key,
                    "year": bucket_start.year,
                    "month": bucket_start.month,
                    "day": bucket_start.day,
                })
            else:
                period_key = f"{t.date.year}-{t.date.month:02d}"
                period_bucket = spending_by_period.setdefault(period_key, {
                    "income": 0,
                    "expense": 0,
                    "label": t.date.strftime("%b %Y"),
                    "bucket": period_key,
                    "bucketType": "month",
                    "bucketStartKey": period_key,
                    "year": t.date.year,
                    "month": t.date.month,
                })

            if t.amount > 0:
                period_bucket["income"] += t.amount
            else:
                period_bucket["expense"] += abs(t.amount)

        spending_trend = [
            {
                **value,
                "month": value["month"],
            }
            for _, value in sorted(spending_by_period.items())
        ]
        
        highest = max(all_txns, key=lambda t: abs(t.amount))
        lowest = min(all_txns, key=lambda t: abs(t.amount))
        
        return success_response(data={
            "spending_trend": spending_trend,
            "top_category": {"name": top_category, "amount": category_spending.get(top_category, 0)} if top_category else None,
            "avg_transaction": round(avg_transaction, 2),
            "highest_transaction": {"amount": highest.amount, "description": highest.description},
            "lowest_transaction": {"amount": lowest.amount, "description": lowest.description},
            "transaction_count": len(all_txns),
            "transactions_per_day": round(len(all_txns) / max(1, (end_date - start_date).days) if start_date and end_date else len(all_txns) / 30, 2) if start_date and end_date else round(len(all_txns) / 30, 2),
            "total_income": total_income,
            "total_expense": total_expense
        })
    except Exception as e:
        return success_response(data={
            "spending_trend": [],
            "top_category": None,
            "avg_transaction": 0,
            "highest_transaction": None,
            "lowest_transaction": None,
            "transaction_count": 0,
            "transactions_per_day": 0,
            "total_income": 0,
            "total_expense": 0,
            "error": str(e)
        })
