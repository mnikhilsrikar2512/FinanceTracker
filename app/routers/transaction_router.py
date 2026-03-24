from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse
from app.services import transaction_service
from app.core.deps import get_db

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.post("", response_model=TransactionResponse)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    return transaction_service.create_transaction(db, data)

@router.get("", response_model=list[TransactionResponse])
def get_transactions(user_id: int = Query(), type: str = Query(default=None), db: Session = Depends(get_db)):
    return transaction_service.get_transactions(db, user_id, type)

@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(transaction_id: int, data: TransactionUpdate, db: Session = Depends(get_db)):
    return transaction_service.update_transaction(db, transaction_id, data)

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    return transaction_service.delete_transaction(db, transaction_id)