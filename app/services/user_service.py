from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.repositories import user_repo
from app.services.log_service import log_action


def create_user(db: Session, name: str, email: str):
    existing = user_repo.get_user_by_email(db, email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    user = user_repo.create_user(db, name, email)

    log_action(
        action="CREATE_USER",
        user_id=user.id,
        payload={
            "name": user.name,
            "email": user.email
        }
    )

    return user


def get_all_users(db: Session):
    return user_repo.get_all_users(db)


def get_user(db: Session, user_id: int):
    user = user_repo.get_user_by_id(db, user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user