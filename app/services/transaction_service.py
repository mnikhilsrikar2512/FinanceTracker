from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.repositories import transaction_repo, user_repo, category_repo
from app.models.category import Category
from app.models.transaction import Transaction
from datetime import datetime, UTC


def create_transaction(db: Session, data, current_user_id: int = None):
    user_id = current_user_id or data.user_id
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    category = db.query(Category).filter(Category.id == data.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")

    normalized_amount = abs(data.amount) if category.type == "income" else -abs(data.amount)

    # Check for potential duplicate (same user, amount, category, date within 1 minute)
    existing = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.category_id == data.category_id,
        Transaction.amount == normalized_amount,
        Transaction.date == data.date
    ).first()
    
    if existing and data.description:
        # Only warn if description matches too
        if existing.description == data.description:
            raise HTTPException(
                status_code=409,
                detail="A similar transaction already exists. Consider updating it instead."
            )

    txn_data = data.model_dump()
    txn_data["user_id"] = user_id
    txn_data["created_by"] = current_user_id or user_id
    txn_data["amount"] = normalized_amount
    
    return transaction_repo.create_transaction(db, txn_data)


def get_transactions(db: Session, user_id: int, txn_type: str | None = None, 
                     start_date: datetime = None, end_date: datetime = None,
                     limit: int = 100, offset: int = 0):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    txns = transaction_repo.get_transactions_by_user(db, user_id, txn_type, start_date, end_date, limit, offset)
    return txns


def update_transaction(db: Session, txn_id: int, updates, current_user_id: int = None):
    txn = transaction_repo.get_transaction(db, txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_data = updates.model_dump(exclude_unset=True)

    if "amount" in update_data:
        target_category_id = update_data.get("category_id", txn.category_id)
        category = db.query(Category).filter(Category.id == target_category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
        update_data["amount"] = abs(update_data["amount"]) if category.type == "income" else -abs(update_data["amount"])

    update_data["modified_by"] = current_user_id or txn.user_id
    update_data["modified_at"] = datetime.now(UTC)

    return transaction_repo.update_transaction(db, txn, update_data)


def delete_transaction(db: Session, txn_id: int, current_user_id: int = None):
    txn = transaction_repo.get_transaction(db, txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    transaction_repo.delete_transaction(db, txn)
    return {"message": "Deleted successfully"}
