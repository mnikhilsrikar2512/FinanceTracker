from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel, EmailStr
from app.schemas.user import UserResponse
from app.services import user_service
from app.services.log_service import log_action
from app.core.deps import get_db
from app.core.auth import get_current_user
from app.core.response import success_response
from app.models.user import User
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.repositories import user_repo

router = APIRouter(prefix="/users", tags=["Users"])


class ProfileUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None


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
    
    if data.name is not None:
        normalized_name = data.name.strip()
        if not normalized_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty"
            )
        current_user.name = normalized_name

    if data.email is not None:
        normalized_email = user_service.normalize_email(data.email)
        existing_user = user_repo.get_user_by_email(db, normalized_email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        current_user.email = normalized_email
    
    db.commit()
    db.refresh(current_user)

    log_action(
        action="UPDATE_PROFILE",
        user_id=current_user.id,
        payload={"name": current_user.name, "email": current_user.email},
        entity_type="user",
        entity_id=current_user.id,
        level="INFO"
    )
    
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
    user_id = current_user.id

    if current_user.role == "admin":
        remaining_admins = db.query(User).filter(
            User.role == "admin",
            User.id != user_id
        ).count()
        if remaining_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot delete the last admin account"
            )

    try:
        # Remove owned records first so the user row can be deleted safely.
        deleted_budget_count = db.query(Budget).filter(Budget.user_id == user_id).delete(synchronize_session=False)
        deleted_transaction_count = db.query(Transaction).filter(Transaction.user_id == user_id).delete(synchronize_session=False)

        # Preserve historical records created by this user on other accounts by nulling audit references.
        db.query(Transaction).filter(Transaction.created_by == user_id).update(
            {Transaction.created_by: None},
            synchronize_session=False
        )
        db.query(Transaction).filter(Transaction.modified_by == user_id).update(
            {Transaction.modified_by: None},
            synchronize_session=False
        )

        db.delete(current_user)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="We could not delete this account right now. Please try again."
        )

    log_action(
        action="DELETE_ACCOUNT",
        user_id=user_id,
        payload={
            "email": user_email,
            "deleted_transactions": deleted_transaction_count,
            "deleted_budgets": deleted_budget_count,
        },
        entity_type="user",
        entity_id=user_id,
        level="WARNING"
    )

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
