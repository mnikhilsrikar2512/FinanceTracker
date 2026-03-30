from sqlalchemy.orm import Session
from datetime import datetime
from fastapi import HTTPException
from app.repositories import analytics_repo, user_repo


def validate_user(db: Session, user_id: int):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")


def get_summary(db: Session, user_id: int):
    validate_user(db, user_id)
    return analytics_repo.get_summary(db, user_id)


def get_summary_filtered(db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None):
    validate_user(db, user_id)
    return analytics_repo.get_summary_filtered(db, user_id, start_date, end_date)


def get_summary_by_category(db: Session, user_id: int):
    validate_user(db, user_id)
    return analytics_repo.get_summary_by_category(db, user_id)


def get_summary_by_category_filtered(db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None, type: str = None):
    validate_user(db, user_id)
    return analytics_repo.get_summary_by_category_filtered(db, user_id, start_date, end_date, type)


def get_monthly_summary(db: Session, user_id: int):
    validate_user(db, user_id)
    return analytics_repo.get_monthly_summary(db, user_id)


def get_monthly_summary_filtered(db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None):
    validate_user(db, user_id)
    return analytics_repo.get_monthly_summary_filtered(db, user_id, start_date, end_date)