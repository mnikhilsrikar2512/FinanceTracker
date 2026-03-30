"""User repository: data access helpers for User model."""
from sqlalchemy.orm import Session
from app.models.user import User

def create_user(db: Session, name: str, email: str, password_hash: str):
    user = User(name=name, email=email, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def get_all_users(db: Session):
    return db.query(User).all()

def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def update_user_password(db: Session, user_id: int, new_password_hash: str):
    user = get_user_by_id(db, user_id)
    if user:
        user.password_hash = new_password_hash
        db.commit()
    return user
