from pydantic import BaseModel, field_validator
from datetime import datetime

class TransactionCreate(BaseModel):
    user_id: int
    category_id: int
    amount: float
    description: str | None = None
    date: datetime

    @field_validator("amount")
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v

class TransactionUpdate(BaseModel):
    amount: float | None = None
    description: str | None = None
    category_id: int | None = None

class TransactionResponse(BaseModel):
    id: int
    user_id: int
    category_id: int
    amount: float
    description: str | None
    date: datetime
    created_at: datetime

    model_config = {"from_attributes": True}