from sqlalchemy.orm import Session
from app.models.transaction import Transaction
from app.models.category import Category

def create_transaction(db: Session, data):
    txn = Transaction(**data)
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn

def get_transactions_by_user(db: Session, user_id: int, txn_type: str | None = None):
    query = db.query(Transaction).filter(Transaction.user_id == user_id)
    if txn_type:
        query = query.join(Category).filter(Category.type == txn_type)
    return query.all()

def get_transaction(db: Session, txn_id: int):
    return db.query(Transaction).filter(Transaction.id == txn_id).first()

def update_transaction(db: Session, txn, updates: dict):
    for key, value in updates.items():
        setattr(txn, key, value)
    db.commit()
    db.refresh(txn)
    return txn

def delete_transaction(db: Session, txn):
    db.delete(txn)
    db.commit()