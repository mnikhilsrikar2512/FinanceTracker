from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.repositories import category_repo

def create_category(db: Session, name: str, type: str):
    if type not in ["income", "expense"]:
        raise HTTPException(status_code=400, detail="Invalid category type")

    return category_repo.create_category(db, name, type)

def get_all_categories(db: Session):
    return category_repo.get_all_categories(db)