from sqlalchemy.orm import Session
from app.models.category import Category

def create_category(db: Session, name: str, type: str):
    category = Category(name=name, type=type)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

def get_all_categories(db: Session):
    return db.query(Category).all()