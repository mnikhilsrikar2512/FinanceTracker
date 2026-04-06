"""Budget API router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse, BudgetProgress
from app.services import budget_service
from app.core.deps import get_db
from app.core.auth import get_current_user
from app.core.response import success_response
from app.models.user import User

router = APIRouter(prefix="/budgets", tags=["Budgets"])

@router.post("", response_model=dict)
def create_budget(
    data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new budget."""
    budget = budget_service.create_budget(db, data, current_user.id)
    return success_response(data={
        "id": budget.id,
        "user_id": budget.user_id,
        "category_id": budget.category_id,
        "amount": budget.amount,
        "period": budget.period,
        "start_date": budget.start_date.isoformat(),
        "end_date": budget.end_date.isoformat(),
        "description": budget.description,
        "created_at": budget.created_at.isoformat() if budget.created_at else None
    })

@router.get("", response_model=dict)
def get_user_budgets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """Get all budgets for the current user."""
    budgets = budget_service.get_user_budgets(db, current_user.id, skip, limit)
    data = []
    for budget in budgets:
        data.append({
            "id": budget.id,
            "category_id": budget.category_id,
            "amount": budget.amount,
            "period": budget.period,
            "start_date": budget.start_date.isoformat(),
            "end_date": budget.end_date.isoformat(),
            "description": budget.description,
            "created_at": budget.created_at.isoformat() if budget.created_at else None
        })
    return success_response(data=data)

@router.get("/summary", response_model=dict)
def get_budgets_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get summary of all budgets with progress."""
    summaries = budget_service.get_budgets_summary(db, current_user.id)
    data = []
    for summary in summaries:
        data.append({
            "budget_id": summary["budget"].id,
            "category_id": summary["budget"].category_id,
            "amount": summary["budget"].amount,
            "spent": summary["spent"],
            "remaining": summary["remaining"],
            "percentage_used": summary["percentage_used"],
            "is_over_budget": summary["is_over_budget"]
        })
    return success_response(data=data)

@router.get("/{budget_id}", response_model=dict)
def get_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific budget."""
    budget = budget_service.get_budget(db, budget_id, current_user.id)
    return success_response(data={
        "id": budget.id,
        "category_id": budget.category_id,
        "amount": budget.amount,
        "period": budget.period,
        "start_date": budget.start_date.isoformat(),
        "end_date": budget.end_date.isoformat(),
        "description": budget.description,
        "created_at": budget.created_at.isoformat() if budget.created_at else None,
        "updated_at": budget.updated_at.isoformat() if budget.updated_at else None
    })

@router.put("/{budget_id}", response_model=dict)
def update_budget(
    budget_id: int,
    data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing budget."""
    budget = budget_service.update_budget(db, budget_id, data, current_user.id)
    return success_response(data={
        "id": budget.id,
        "category_id": budget.category_id,
        "amount": budget.amount,
        "period": budget.period,
        "start_date": budget.start_date.isoformat(),
        "end_date": budget.end_date.isoformat(),
        "description": budget.description,
        "created_at": budget.created_at.isoformat() if budget.created_at else None,
        "updated_at": budget.updated_at.isoformat() if budget.updated_at else None
    })

@router.delete("/{budget_id}", response_model=dict)
def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a budget."""
    result = budget_service.delete_budget(db, budget_id, current_user.id)
    return success_response(message=result["message"])

@router.get("/{budget_id}/progress", response_model=dict)
def get_budget_progress(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get progress for a specific budget."""
    progress = budget_service.get_budget_progress(db, budget_id, current_user.id)
    return success_response(data={
        "budget_id": progress["budget"].id,
        "amount": progress["budget"].amount,
        "spent": progress["spent"],
        "remaining": progress["remaining"],
        "percentage_used": progress["percentage_used"],
        "is_over_budget": progress["is_over_budget"]
    })