"""Category repository: data access helpers for Category model."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.category import Category
from app.models.transaction import Transaction

def create_category(db: Session, name: str, type: str):
    category = Category(name=name, type=type)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

def get_all_categories(db: Session):
    return db.query(Category).all()

def get_category_by_name(db: Session, name: str):
    normalized_name = name.strip().lower()
    return db.query(Category).filter(func.lower(Category.name) == normalized_name).first()


def get_categories_with_stats(db: Session, category_type: str | None = None):
    query = (
        db.query(
            Category.id.label("id"),
            Category.name.label("name"),
            Category.type.label("type"),
            func.count(Transaction.id).label("usage_count"),
            func.coalesce(func.sum(func.abs(Transaction.amount)), 0).label("total_amount"),
        )
        .outerjoin(Transaction, Transaction.category_id == Category.id)
    )

    if category_type:
        query = query.filter(Category.type == category_type)

    return query.group_by(Category.id, Category.name, Category.type).all()
