"""Budget service layer."""
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.repositories import budget_repo, user_repo, category_repo
from app.models.category import Category

def create_budget(db: Session, data, current_user_id: int):
    """Create a new budget for the user."""
    user = user_repo.get_user_by_id(db, current_user_id)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    # If category_id is provided, verify it exists and belongs to user (or is global)
    if data.category_id:
        category = db.query(Category).filter(Category.id == data.category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
    
    # Validate dates
    if data.end_date <= data.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    return budget_repo.create_budget(db, current_user_id, data)

def get_budget(db: Session, budget_id: int, current_user_id: int):
    """Get a single budget by ID."""
    budget = budget_repo.get_budget(db, budget_id, current_user_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget

def get_user_budgets(db: Session, current_user_id: int, skip: int = 0, limit: int = 100):
    """Get all budgets for the user."""
    return budget_repo.get_user_budgets(db, current_user_id, skip, limit)

def update_budget(db: Session, budget_id: int, update_data, current_user_id: int):
    """Update an existing budget."""
    budget = budget_repo.update_budget(db, budget_id, current_user_id, update_data)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget

def delete_budget(db: Session, budget_id: int, current_user_id: int):
    """Delete a budget."""
    success = budget_repo.delete_budget(db, budget_id, current_user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Budget not found")
    return {"message": "Budget deleted successfully"}

def get_budget_progress(db: Session, budget_id: int, current_user_id: int):
    """Get progress for a specific budget."""
    progress = budget_repo.get_budget_progress(db, budget_id, current_user_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Budget not found")
    return progress

def get_budgets_summary(db: Session, current_user_id: int):
    """Get summary of all budgets with progress."""
    return budget_repo.get_budgets_summary(db, current_user_id)