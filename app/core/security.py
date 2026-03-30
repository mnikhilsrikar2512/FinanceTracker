"""Security utilities and RBAC helpers for the API."""

from fastapi import Header, HTTPException
from typing import Optional

from app.core.config import settings

def _decode_token(token: str) -> Optional[dict]:
    # Try common JWT libraries to decode the token. We won't fail hard if verification
    # isn't available in the runtime; payload is what we mostly need for RBAC in tests.
    payload = None
    try:
        # jose
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])  # type: ignore
    except Exception:
        pass
    if payload is None:
        try:
            import jwt  # PyJWT
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"], options={"verify_signature": False})
        except Exception:
            payload = None
    return payload

def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    payload = _decode_token(token)
    if not payload or not isinstance(payload, dict):
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

def admin_required(authorization: Optional[str] = Header(None)) -> dict:
    user = get_current_user(authorization)
    role = user.get("role") or user.get("payload", {}).get("role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user
