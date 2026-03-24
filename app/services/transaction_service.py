from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.repositories import transaction_repo, user_repo, category_repo
from app.models.category import Category

def create_transaction(db: Session, data):
    user = user_repo.get_user_by_id(db, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    category = db.query(Category).filter(Category.id == data.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    return transaction_repo.create_transaction(db, data.model_dump())


def get_transactions(db: Session, user_id: int, txn_type: str | None):
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    txns = transaction_repo.get_transactions_by_user(db, user_id, txn_type)
    return txns


def update_transaction(db: Session, txn_id: int, updates):
    txn = transaction_repo.get_transaction(db, txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return transaction_repo.update_transaction(db, txn, updates.model_dump(exclude_unset=True))


def delete_transaction(db: Session, txn_id: int):
    txn = transaction_repo.get_transaction(db, txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    transaction_repo.delete_transaction(db, txn)
    return {"message": "Deleted successfully"}