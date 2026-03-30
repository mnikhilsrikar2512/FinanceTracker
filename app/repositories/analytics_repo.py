"""Analytics repository: data access helpers for analytics views."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from app.models.transaction import Transaction
from app.models.category import Category

# Export Transaction for admin use
TransactionModel = Transaction


def get_summary(db: Session, user_id: int):
    income = db.query(func.sum(Transaction.amount)).join(Category).filter(
        Transaction.user_id == user_id, Category.type == "income", Transaction.is_deleted != True
    ).scalar()

    expense = db.query(func.sum(Transaction.amount)).join(Category).filter(
        Transaction.user_id == user_id, Category.type == "expense", Transaction.is_deleted != True
    ).scalar()

    return {
        "total_income": income or 0,
        "total_expense": expense or 0,
        "balance": (income or 0) - (expense or 0)
    }


def get_summary_filtered(db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None):
    base_filter = [
        Transaction.user_id == user_id,
        Transaction.is_deleted != True
    ]
    
    income = db.query(func.sum(Transaction.amount)).join(Category).filter(
        *base_filter,
        Category.type == "income"
    )
    expense = db.query(func.sum(Transaction.amount)).join(Category).filter(
        *base_filter,
        Category.type == "expense"
    )
    
    if start_date:
        income = income.filter(Transaction.date >= start_date)
        expense = expense.filter(Transaction.date >= start_date)
    if end_date:
        income = income.filter(Transaction.date <= end_date)
        expense = expense.filter(Transaction.date <= end_date)
    
    income_total = income.scalar() or 0
    expense_total = expense.scalar() or 0
    
    return {
        "total_income": income_total,
        "total_expense": abs(expense_total),
        "balance": income_total - abs(expense_total)
    }


def get_summary_by_category(db: Session, user_id: int):
    results = db.query(
        Category.name,
        Category.type,
        func.sum(Transaction.amount).label("total")
    ) \
    .join(Category, Transaction.category_id == Category.id) \
    .filter(Transaction.user_id == user_id, Transaction.is_deleted != True) \
    .group_by(Category.name, Category.type) \
    .all()

    return [
        {
            "category": r.name,
            "type": r.type,
            "total": r.total
        }
        for r in results
    ]


def get_summary_by_category_filtered(db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None, type: str = None):
    query = db.query(
        Category.name,
        Category.type,
        func.sum(Transaction.amount).label("total")
    ) \
    .join(Category, Transaction.category_id == Category.id) \
    .filter(Transaction.user_id == user_id, Transaction.is_deleted != True)
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if type:
        query = query.filter(Category.type == type)
    
    results = query.group_by(Category.name, Category.type).all()

    return [
        {
            "category": r.name,
            "type": r.type,
            "total": r.total
        }
        for r in results
    ]


def get_monthly_summary(db: Session, user_id: int):
    results = db.query(
        func.year(Transaction.date).label("year"),
        func.month(Transaction.date).label("month"),
        Category.type,
        func.sum(Transaction.amount).label("total")
    ) \
    .join(Category, Transaction.category_id == Category.id) \
    .filter(Transaction.user_id == user_id, Transaction.is_deleted != True) \
    .group_by(
        func.year(Transaction.date),
        func.month(Transaction.date),
        Category.type
    ) \
    .order_by(
        func.year(Transaction.date),
        func.month(Transaction.date)
    ) \
    .all()

    return [
        {
            "year": r.year,
            "month": r.month,
            "type": r.type,
            "total": r.total
        }
        for r in results
    ]


def get_monthly_summary_filtered(db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None):
    query = db.query(
        func.year(Transaction.date).label("year"),
        func.month(Transaction.date).label("month"),
        Category.type,
        func.sum(Transaction.amount).label("total")
    ) \
    .join(Category, Transaction.category_id == Category.id) \
    .filter(Transaction.user_id == user_id, Transaction.is_deleted != True)
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    results = query.group_by(
        func.year(Transaction.date),
        func.month(Transaction.date),
        Category.type
    ).order_by(
        func.year(Transaction.date),
        func.month(Transaction.date)
    ).all()

    return [
        {
            "year": r.year,
            "month": r.month,
            "type": r.type,
            "total": r.total
        }
        for r in results
    ]
