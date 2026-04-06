"""Budget repository: data access helpers for Budget model."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.models.category import Category

def create_budget(db: Session, user_id: int, budget_data):
    budget = Budget(
        user_id=user_id,
        category_id=budget_data.category_id,
        amount=budget_data.amount,
        period=budget_data.period,
        start_date=budget_data.start_date,
        end_date=budget_data.end_date,
        description=budget_data.description
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget

def get_budget(db: Session, budget_id: int, user_id: int):
    return db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == user_id).first()

def get_user_budgets(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(Budget).filter(Budget.user_id == user_id).order_by(Budget.id).offset(skip).limit(limit).all()

def update_budget(db: Session, budget_id: int, user_id: int, update_data):
    budget = get_budget(db, budget_id, user_id)
    if not budget:
        return None
    
    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(budget, field, value)
    
    budget.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(budget)
    return budget

def delete_budget(db: Session, budget_id: int, user_id: int):
    budget = get_budget(db, budget_id, user_id)
    if not budget:
        return False
    
    db.delete(budget)
    db.commit()
    return True

def get_budget_progress(db: Session, budget_id: int, user_id: int):
    """Calculate how much has been spent against a budget."""
    budget = get_budget(db, budget_id, user_id)
    if not budget:
        return None
    
    # Convert date to datetime for comparison
    from datetime import datetime, time
    start_datetime = datetime.combine(budget.start_date, time.min)
    end_datetime = datetime.combine(budget.end_date, time.max)
    
    # Calculate total spending for the budget period and category
    query = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id,
        Transaction.date >= start_datetime,
        Transaction.date <= end_datetime,
        Transaction.amount < 0  # Only expenses
    )
    
    if budget.category_id:
        query = query.filter(Transaction.category_id == budget.category_id)
    
    spent = query.scalar() or 0
    spent = abs(spent)  # Convert to positive for comparison
    
    remaining = budget.amount - spent
    percentage_used = (spent / budget.amount * 100) if budget.amount > 0 else 0
    is_over_budget = spent > budget.amount
    
    return {
        "budget": budget,
        "spent": spent,
        "remaining": remaining,
        "percentage_used": percentage_used,
        "is_over_budget": is_over_budget
    }

def get_budgets_summary(db: Session, user_id: int):
    """Get summary of all budgets with progress."""
    budgets = get_user_budgets(db, user_id)
    summaries = []
    for budget in budgets:
        progress = get_budget_progress(db, budget.id, user_id)
        if progress:
            summaries.append(progress)
    return summaries