from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.services import analytics_service
from app.core.deps import get_db

router = APIRouter(prefix="/summary", tags=["Analytics"])


@router.get("/{user_id}/by-category")
def summary_by_category(user_id: int, db: Session = Depends(get_db)):
    return analytics_service.get_summary_by_category(db, user_id)


@router.get("/{user_id}/monthly")
def monthly_summary(user_id: int, db: Session = Depends(get_db)):
    return analytics_service.get_monthly_summary(db, user_id)


@router.get("/{user_id}")
def summary(user_id: int, db: Session = Depends(get_db)):
    return analytics_service.get_summary(db, user_id)