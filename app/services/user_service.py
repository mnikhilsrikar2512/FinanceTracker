from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.repositories import user_repo
from app.services.log_service import log_action
from app.core.auth import get_password_hash, verify_password, create_access_token


def normalize_email(email: str) -> str:
    return email.strip().lower()


def signup(db: Session, name: str, email: str, password: str):
    normalized_email = normalize_email(email)
    existing = user_repo.get_user_by_email(db, normalized_email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    password_hash = get_password_hash(password)
    user = user_repo.create_user(db, name.strip(), normalized_email, password_hash)

    log_action(
        action="USER_SIGNUP",
        user_id=user.id,
        payload={"name": user.name, "email": user.email},
        entity_type="user",
        entity_id=user.id,
        level="INFO"
    )

    return user


def login(db: Session, email: str, password: str):
    normalized_email = normalize_email(email)
    user = user_repo.get_user_by_email(db, normalized_email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.status == "blocked":
        raise HTTPException(status_code=403, detail="User is blocked")

    token = create_access_token({"sub": str(user.id)})

    log_action(
        action="USER_LOGIN",
        user_id=user.id,
        payload={"name": user.name, "email": user.email},
        entity_type="user",
        entity_id=user.id,
        level="INFO"
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "status": user.status,
        }
    }


def change_password(db: Session, user_id: int, old_password: str, new_password: str):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    new_password_hash = get_password_hash(new_password)
    user_repo.update_user_password(db, user_id, new_password_hash)

    log_action(
        action="PASSWORD_CHANGE",
        user_id=user_id,
        payload={},
        entity_type="user",
        entity_id=user_id,
        level="INFO"
    )

    return {"message": "Password changed successfully"}


def get_all_users(db: Session):
    return user_repo.get_all_users(db)


def get_user(db: Session, user_id: int):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
