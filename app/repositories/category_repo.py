"""Category repository: data access helpers for Category model."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.category import Category

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
