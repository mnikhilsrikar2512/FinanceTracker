from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime


def validate_password_strength(value: str, field_name: str = "Password") -> str:
    if len(value) < 8:
        raise ValueError(f"{field_name} must be at least 8 characters")
    if not any(char.islower() for char in value):
        raise ValueError(f"{field_name} must include a lowercase letter")
    if not any(char.isupper() for char in value):
        raise ValueError(f"{field_name} must include an uppercase letter")
    if not any(char.isdigit() for char in value):
        raise ValueError(f"{field_name} must include a number")
    return value

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
        return validate_password_strength(v, "Password")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ChangePassword(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    def new_password_min_length(cls, v):
        return validate_password_strength(v, "New password")


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
        return validate_password_strength(v, "Password")
