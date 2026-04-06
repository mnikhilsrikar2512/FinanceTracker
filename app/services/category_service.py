from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.repositories import category_repo

def create_category(db: Session, name: str, type: str):
    if type not in ["income", "expense"]:
        raise HTTPException(status_code=400, detail="Invalid category type")

    normalized_name = name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Category name is required")

    existing = category_repo.get_category_by_name(db, normalized_name)
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    return category_repo.create_category(db, normalized_name, type)

def get_all_categories(db: Session):
    return category_repo.get_all_categories(db)
