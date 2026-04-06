from pydantic import BaseModel, field_validator, computed_field
from datetime import datetime, timedelta, UTC

class TransactionCreate(BaseModel):
    category_id: int
    amount: float
    description: str | None = None
    date: datetime

    @field_validator("amount")
    def amount_non_zero(cls, v):
        if v == 0:
            raise ValueError("Amount cannot be zero")
        if abs(v) > 1000000000:
            raise ValueError("Amount is too large")
        return v

    @field_validator("date")
    def date_not_far_future(cls, v):
        compare_date = v if v.tzinfo is not None else v.replace(tzinfo=UTC)
        if compare_date > datetime.now(UTC) + timedelta(days=365):
            raise ValueError("Date cannot be more than 1 year in the future")
        if compare_date < datetime(2000, 1, 1, tzinfo=UTC):
            raise ValueError("Date cannot be before year 2000")
        return v
    
    model_config = {"extra": "forbid"}


class TransactionUpdate(BaseModel):
    amount: float | None = None
    description: str | None = None
    category_id: int | None = None
    date: datetime | None = None

    @field_validator("amount")
    def amount_non_zero(cls, v):
        if v is not None and v == 0:
            raise ValueError("Amount cannot be zero")
        if v is not None and abs(v) > 1000000000:
            raise ValueError("Amount is too large")
        return v


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    category_id: int
    amount: float
    description: str | None
    date: datetime
    created_by: int | None
    created_at: datetime
    modified_by: int | None
    modified_at: datetime | None
    type: str | None = None

    model_config = {"from_attributes": True}
