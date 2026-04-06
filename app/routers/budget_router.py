"""Budget API router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse, BudgetProgress
from app.services import budget_service
from app.core.deps import get_db
from app.core.auth import get_current_user
from app.core.response import success_response
from app.models.user import User
from app.models.category import Category
from app.models.audit_log import AuditLog
from app.services.log_service import log_action

router = APIRouter(prefix="/budgets", tags=["Budgets"])

THRESHOLD_ACTIONS = {
    50: "BUDGET_REACHED_50",
    75: "BUDGET_REACHED_75",
    100: "BUDGET_REACHED_LIMIT",
    101: "BUDGET_OVER_BUDGET",
}


def _budget_category_name(db: Session, category_id: int) -> str:
    category = db.query(Category).filter(Category.id == category_id).first()
    return category.name if category else "Uncategorized"


def _emit_budget_threshold_updates(db: Session, current_user: User, summaries: list[dict]) -> None:
    budget_ids = [summary["budget"].id for summary in summaries if summary.get("budget")]
    if not budget_ids:
        return

    existing_logs = {
        (row.entity_id, row.action)
        for row in db.query(AuditLog.entity_id, AuditLog.action)
        .filter(
            AuditLog.entity_type == "budget",
            AuditLog.entity_id.in_(budget_ids),
            AuditLog.action.in_(THRESHOLD_ACTIONS.values()),
        )
        .all()
    }

    for summary in summaries:
        budget = summary.get("budget")
        if not budget:
            continue
        percent = float(summary.get("percentage_used") or 0)
        is_over_budget = bool(summary.get("is_over_budget"))
        threshold = None
        if is_over_budget:
            threshold = 101
        elif percent >= 100:
            threshold = 100
        elif percent >= 75:
            threshold = 75
        elif percent >= 50:
            threshold = 50

        if not threshold:
            continue

        action = THRESHOLD_ACTIONS[threshold]
        if (budget.id, action) in existing_logs:
            continue

        category_name = _budget_category_name(db, budget.category_id)
        log_action(
            action=action,
            user_id=current_user.id,
            payload={
                "name": current_user.name,
                "email": current_user.email,
                "category_name": category_name,
                "amount": budget.amount,
                "spent": summary.get("spent"),
                "remaining": summary.get("remaining"),
                "threshold": 100 if threshold == 101 else threshold,
                "percentage_used": percent,
            },
            entity_type="budget",
            entity_id=budget.id,
            level="WARNING" if threshold in {100, 101} else "INFO",
        )
        existing_logs.add((budget.id, action))

@router.post("", response_model=dict)
def create_budget(
    data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new budget."""
    budget = budget_service.create_budget(db, data, current_user.id)
    log_action(
        action="CREATE_BUDGET",
        user_id=current_user.id,
        payload={
            "name": current_user.name,
            "email": current_user.email,
            "category_name": _budget_category_name(db, budget.category_id),
            "amount": budget.amount,
        },
        entity_type="budget",
        entity_id=budget.id,
        level="INFO",
    )
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
    _emit_budget_threshold_updates(db, current_user, summaries)
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
    log_action(
        action="UPDATE_BUDGET",
        user_id=current_user.id,
        payload={
            "name": current_user.name,
            "email": current_user.email,
            "category_name": _budget_category_name(db, budget.category_id),
            "amount": budget.amount,
        },
        entity_type="budget",
        entity_id=budget.id,
        level="INFO",
    )
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
    budget = budget_service.get_budget(db, budget_id, current_user.id)
    result = budget_service.delete_budget(db, budget_id, current_user.id)
    log_action(
        action="DELETE_BUDGET",
        user_id=current_user.id,
        payload={
            "name": current_user.name,
            "email": current_user.email,
            "category_name": _budget_category_name(db, budget.category_id),
            "amount": budget.amount,
        },
        entity_type="budget",
        entity_id=budget_id,
        level="WARNING",
    )
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
