import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate, validate_password_strength
from app.services.user_service import normalize_email


def test_validate_password_strength_accepts_strong_password():
    assert validate_password_strength("StrongPass1") == "StrongPass1"


@pytest.mark.parametrize(
    ("password", "expected"),
    [
        ("Short1", "at least 8 characters"),
        ("lowercase1", "uppercase letter"),
        ("UPPERCASE1", "lowercase letter"),
        ("NoNumbersHere", "number"),
    ],
)
def test_validate_password_strength_rejects_weak_password(password, expected):
    with pytest.raises(ValueError, match=expected):
        validate_password_strength(password)


def test_user_create_validates_name_and_password():
    with pytest.raises(ValidationError):
        UserCreate(name=" ", email="user@example.com", password="StrongPass1")

    with pytest.raises(ValidationError):
        UserCreate(name="Valid User", email="user@example.com", password="weakpass")


def test_normalize_email_strips_and_lowercases():
    assert normalize_email("  Admin@FinanceTracker.COM  ") == "admin@financetracker.com"
