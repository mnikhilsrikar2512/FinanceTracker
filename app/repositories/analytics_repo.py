from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.transaction import Transaction
from app.models.category import Category

def get_summary(db: Session, user_id: int):
    income = db.query(func.sum(Transaction.amount)).join(Category).filter(
        Transaction.user_id == user_id, Category.type == "income"
    ).scalar()

    expense = db.query(func.sum(Transaction.amount)).join(Category).filter(
        Transaction.user_id == user_id, Category.type == "expense"
    ).scalar()

    return {
        "total_income": income or 0,
        "total_expense": expense or 0,
        "balance": (income or 0) - (expense or 0)
    }


def get_summary_by_category(db: Session, user_id: int):
    results = db.query(
        Category.name,
        Category.type,
        func.sum(Transaction.amount).label("total")
    ) \
    .join(Category, Transaction.category_id == Category.id) \
    .filter(Transaction.user_id == user_id) \
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


def get_monthly_summary(db: Session, user_id: int):
    results = db.query(
        func.year(Transaction.date).label("year"),
        func.month(Transaction.date).label("month"),
        Category.type,
        func.sum(Transaction.amount).label("total")
    ) \
    .join(Category, Transaction.category_id == Category.id) \
    .filter(Transaction.user_id == user_id) \
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