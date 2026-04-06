from pydantic import BaseModel, field_validator
from datetime import date, datetime
from typing import Optional

class BudgetCreate(BaseModel):
    category_id: Optional[int] = None  # NULL for overall budget
    amount: float
    period: str = "monthly"  # monthly, yearly, custom
    start_date: date
    end_date: date
    description: Optional[str] = None

    @field_validator("amount")
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("Amount must be positive")
        if v > 1000000000:
            raise ValueError("Amount is too large")
        return v

    @field_validator("period")
    def period_valid(cls, v):
        allowed = ["monthly", "yearly", "custom"]
        if v not in allowed:
            raise ValueError(f"Period must be one of {allowed}")
        return v

    @field_validator("end_date")
    def end_date_after_start(cls, v, values):
        if "start_date" in values.data and v <= values.data["start_date"]:
            raise ValueError("End date must be after start date")
        return v

    model_config = {"extra": "forbid"}

class BudgetUpdate(BaseModel):
    amount: Optional[float] = None
    period: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None

    @field_validator("amount")
    def amount_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Amount must be positive")
        if v is not None and v > 1000000000:
            raise ValueError("Amount is too large")
        return v

class BudgetResponse(BaseModel):
    id: int
    user_id: int
    category_id: Optional[int]
    amount: float
    period: str
    start_date: date
    end_date: date
    description: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}

class BudgetProgress(BaseModel):
    budget: BudgetResponse
    spent: float
    remaining: float
    percentage_used: float
    is_over_budget: bool