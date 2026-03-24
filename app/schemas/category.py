from pydantic import BaseModel, field_validator

class CategoryCreate(BaseModel):
    name: str
    type: str

    @field_validator("type")
    def validate_type(cls, v):
        if v not in ["income", "expense"]:
            raise ValueError("Type must be 'income' or 'expense'")
        return v

class CategoryResponse(BaseModel):
    id: int
    name: str
    type: str

    model_config = {
        "from_attributes": True
    }