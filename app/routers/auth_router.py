from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserLogin, ChangePassword, TokenResponse, ForgotPassword, ResetPassword
from app.services import user_service
from app.core.deps import get_db
from app.core.auth import get_current_user, create_access_token
from app.core.rate_limit import login_rate_limiter
from app.core.email import verification_store, send_verification_code
from app.core.response import success_response
from app.repositories import user_repo
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup")
def signup(data: UserCreate, db: Session = Depends(get_db)):
    if login_rate_limiter.is_blocked(data.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many signup attempts. Please try again later."
        )
    user = user_service.signup(db, data.name, data.email, data.password)
    token = create_access_token({"sub": str(user.id)})
    login_rate_limiter.reset(data.email)
    return success_response(data={"access_token": token, "token_type": "bearer"})


@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    if login_rate_limiter.is_blocked(data.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    
    result = user_service.login(db, data.email, data.password)
    
    if "access_token" in result:
        login_rate_limiter.reset(data.email)
    else:
        login_rate_limiter.record_attempt(data.email)
    
    return success_response(data=result)


@router.post("/change-password")
def change_password(
    data: ChangePassword,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = user_service.change_password(db, current_user.id, data.old_password, data.new_password)
    return success_response(message="Password changed successfully")


@router.post("/forgot-password")
def forgot_password(data: ForgotPassword, db: Session = Depends(get_db)):
    user = user_repo.get_user_by_email(db, data.email)
    
    if not user:
        return success_response(message="If the email exists, a verification code will be sent.")
    
    code = verification_store.generate_code(data.email)
    
    email_sent = send_verification_code(data.email, code)
    
    if not email_sent:
        logger.warning(f"Email not sent. Code for {data.email}: {code}")
    
    return success_response(message="If the email exists, a verification code will be sent.")


@router.post("/reset-password")
def reset_password(data: ResetPassword, db: Session = Depends(get_db)):
    user = user_repo.get_user_by_email(db, data.email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not verification_store.verify_code(data.email, data.code):
        remaining = verification_store.get_remaining_attempts(data.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or expired verification code. {remaining} attempts remaining."
        )
    
    from app.core.auth import get_password_hash
    user.password_hash = get_password_hash(data.new_password)
    db.commit()
    
    return success_response(message="Password has been reset successfully. Please login with your new password.")
