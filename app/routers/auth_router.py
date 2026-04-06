from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserLogin, ChangePassword, TokenResponse, ForgotPassword, ResetPassword
from app.services import user_service
from app.core.deps import get_db
from app.core.auth import get_current_user, create_access_token
from app.core.rate_limit import (
    login_rate_limiter,
    password_reset_attempt_limiter,
    password_reset_request_limiter,
)
from app.core.email import verification_store, send_verification_code, should_log_reset_code
from app.core.response import success_response
from app.repositories import user_repo
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup")
def signup(data: UserCreate, db: Session = Depends(get_db)):
    normalized_email = user_service.normalize_email(data.email)
    if login_rate_limiter.is_blocked(normalized_email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many signup attempts. Please try again later."
        )
    user = user_service.signup(db, data.name, data.email, data.password)
    token = create_access_token({"sub": str(user.id)})
    login_rate_limiter.reset(normalized_email)
    return success_response(data={
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "status": user.status,
        }
    })


@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    normalized_email = user_service.normalize_email(data.email)
    if login_rate_limiter.is_blocked(normalized_email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    
    result = user_service.login(db, data.email, data.password)
    
    if "access_token" in result:
        login_rate_limiter.reset(normalized_email)
    else:
        login_rate_limiter.record_attempt(normalized_email)
    
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
    normalized_email = user_service.normalize_email(data.email)

    if password_reset_request_limiter.is_blocked(normalized_email):
        retry_after = max(1, password_reset_request_limiter.get_retry_after(normalized_email))
        return success_response(
            message=f"If the email exists, a verification code will be sent. Please wait {retry_after} seconds before trying again."
        )

    resend_wait = verification_store.get_resend_wait_seconds(normalized_email)
    if resend_wait > 0:
        return success_response(
            message=f"If the email exists, a verification code will be sent. Please wait {resend_wait} seconds before requesting another code."
        )

    password_reset_request_limiter.record_attempt(normalized_email)
    verification_store.record_request(normalized_email)
    user = user_repo.get_user_by_email(db, normalized_email)
    
    if not user:
        return success_response(message="If the email exists, a verification code will be sent.")
    
    code = verification_store.generate_code(normalized_email)
    
    email_sent = send_verification_code(normalized_email, code)
    
    if not email_sent:
        if should_log_reset_code():
            logger.warning("Password reset email not sent. Code for %s: %s", normalized_email, code)
        else:
            logger.warning("Password reset email could not be delivered for %s", normalized_email)
    
    return success_response(message="If the email exists, a verification code will be sent.")


@router.post("/reset-password")
def reset_password(data: ResetPassword, db: Session = Depends(get_db)):
    normalized_email = user_service.normalize_email(data.email)

    if password_reset_attempt_limiter.is_blocked(normalized_email):
        retry_after = max(1, password_reset_attempt_limiter.get_retry_after(normalized_email))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many reset attempts. Please wait {retry_after} seconds and try again."
        )

    user = user_repo.get_user_by_email(db, normalized_email)
    
    if not user:
        password_reset_attempt_limiter.record_attempt(normalized_email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please request a new code and try again."
        )
    
    if not verification_store.verify_code(normalized_email, data.code):
        password_reset_attempt_limiter.record_attempt(normalized_email)
        remaining = verification_store.get_remaining_attempts(normalized_email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or expired verification code. {remaining} attempts remaining."
        )
    
    from app.core.auth import get_password_hash
    user.password_hash = get_password_hash(data.new_password)
    db.commit()
    password_reset_attempt_limiter.reset(normalized_email)
    password_reset_request_limiter.reset(normalized_email)
    verification_store.clear_request_lock(normalized_email)
    
    return success_response(message="Password has been reset successfully. Please login with your new password.")
