from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.schemas.user import UserResponse
from app.services import user_service
from app.core.deps import get_db
from app.core.auth import get_current_user
from app.core.response import success_response
from app.models.user import User

router = APIRouter(prefix="/users", tags=["Users"])


class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None


@router.get("/me")
def get_profile(current_user: User = Depends(get_current_user)):
    return success_response(data={
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "status": current_user.status,
        "role": current_user.role,
        "created_at": current_user.created_at
    })


@router.put("/me")
def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.name is None and data.email is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field (name or email) must be provided"
        )
    
    if data.name:
        current_user.name = data.name
    if data.email:
        current_user.email = data.email
    
    db.commit()
    db.refresh(current_user)
    
    return success_response(data={
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "status": current_user.status,
        "role": current_user.role,
        "created_at": current_user.created_at
    }, message="Profile updated successfully")


@router.delete("/me")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_email = current_user.email
    db.delete(current_user)
    db.commit()
    return success_response(message=f"Account {user_email} has been deleted")


@router.get("")
def get_users(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list all users"
        )
    users = user_service.get_all_users(db)
    data = [{
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "status": u.status,
        "role": u.role,
        "created_at": u.created_at
    } for u in users]
    return success_response(data=data)


@router.get("/{user_id}")
def get_user(
    user_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own profile"
        )
    user = user_service.get_user(db, user_id)
    return success_response(data={
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "status": user.status,
        "role": user.role,
        "created_at": user.created_at
    })
