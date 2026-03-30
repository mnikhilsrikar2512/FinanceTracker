from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("name")
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v

    @field_validator("password")
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ChangePassword(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    def new_password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("New password must be at least 6 characters")
        return v


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    status: str = "active"
    role: str = "user"
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    email: EmailStr
    code: str
    new_password: str

    @field_validator("new_password")
    def new_password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v