"""Authentication utilities and current-user retrieval.

This module provides common helpers used by the API to authenticate users,
generate tokens, and enforce admin permissions. It is designed to be readable
and debuggable during local development.
"""

from datetime import datetime, timedelta, UTC
from typing import Any
from jose import jwt
import bcrypt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.deps import get_db
from app.repositories import user_repo

security = HTTPBearer()


def verify_password(plain: str, hashed: str) -> bool:
    """Validate a plaintext password against a stored bcrypt hash."""
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


def get_password_hash(password: str) -> str:
    """Hash a password for storage using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token with an expiration."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(str(user_id))
    except Exception as e:
        # Debug output left intentionally lightweight to avoid noisy logs in prod
        print(f"DEBUG - Error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.status == "blocked":
        raise HTTPException(status_code=403, detail="User is blocked")
    
    return user


def require_admin(current_user = Depends(get_current_user)):
    """Admin RBAC gatekeeper: require user to have admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
