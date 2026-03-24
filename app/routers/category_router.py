from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.category import CategoryCreate, CategoryResponse
from app.services import category_service
from app.core.deps import get_db

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.post("", response_model=CategoryResponse)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    return category_service.create_category(db, data.name, data.type)

@router.get("", response_model=list[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    return category_service.get_all_categories(db)