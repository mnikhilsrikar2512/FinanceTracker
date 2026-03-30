from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse
from app.services import transaction_service
from app.core.deps import get_db
from app.core.auth import get_current_user
from app.core.response import success_response, paginated_response
from app.models.user import User
from app.models.category import Category
from app.models.transaction import Transaction
import csv
import io

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def enrich_transaction(txn: Transaction, db: Session) -> dict:
    """Add type field to transaction"""
    cat = db.query(Category).filter(Category.id == txn.category_id).first()
    return {
        "id": txn.id,
        "user_id": txn.user_id,
        "category_id": txn.category_id,
        "amount": txn.amount,
        "description": txn.description,
        "date": txn.date,
        "created_by": txn.created_by,
        "created_at": txn.created_at,
        "modified_by": txn.modified_by,
        "modified_at": txn.modified_at,
        "type": cat.type if cat else None
    }


@router.post("", response_model=dict)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = transaction_service.create_transaction(db, data, current_user.id)
    return success_response(data=enrich_transaction(result, db))


@router.get("", response_model=dict)
def get_transactions(
    type: str = Query(default=None, description="Filter by type: income, expense"),
    category_id: int = Query(default=None, description="Filter by category ID"),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    min_amount: float = Query(default=None, ge=0, description="Minimum amount"),
    max_amount: float = Query(default=None, ge=0, description="Maximum amount"),
    search: str = Query(default=None, description="Search in description"),
    sort_by: str = Query(default="date", description="Sort by: date, amount, created_at"),
    sort_order: str = Query(default="desc", description="Sort order: asc, desc"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of records"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    include_deleted: bool = Query(default=False, description="Include soft-deleted transactions"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.transaction import Transaction
    from app.models.category import Category
    
    # RBAC: admins can view all transactions; regular users see only their own
    if getattr(current_user, 'role', None) == 'admin':
        query = db.query(Transaction)
    else:
        query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    
    if not include_deleted:
        query = query.filter(Transaction.is_deleted != True)
    
    filters = {}
    
    if type:
        cat_type = "income" if type.lower() == "income" else "expense"
        query = query.join(Category).filter(Category.type == cat_type)
        filters["type"] = type
    
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
        filters["category_id"] = category_id
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
        filters["start_date"] = start_date.isoformat()
    
    if end_date:
        query = query.filter(Transaction.date <= end_date)
        filters["end_date"] = end_date.isoformat()
    
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
        filters["min_amount"] = min_amount
    
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
        filters["max_amount"] = max_amount
    
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))
        filters["search"] = search

    total = query.count()
    
    sort_column = getattr(Transaction, sort_by, Transaction.date)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    results = query.offset(offset).limit(limit).all()
    
    data = [enrich_transaction(t, db) for t in results]
    
    return paginated_response(data, total, limit, offset, filters)


@router.get("/recent", response_model=dict)
def get_recent_transactions(
    limit: int = Query(default=5, ge=1, le=20, description="Number of recent transactions"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    txns = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_deleted != True
    ).order_by(Transaction.date.desc()).limit(limit).all()
    
    data = [enrich_transaction(t, db) for t in txns]
    return success_response(data=data)


@router.put("/{transaction_id}", response_model=dict)
def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.repositories import transaction_repo
    txn = transaction_repo.get_transaction(db, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own transactions")
    
    result = transaction_service.update_transaction(db, transaction_id, data, current_user.id)
    return success_response(data=enrich_transaction(result, db))


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    mode: str = Query(default="soft", description="Delete mode: soft (archive) or hard (permanent)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.repositories import transaction_repo
    txn = transaction_repo.get_transaction(db, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own transactions")
    
    if mode == "hard":
        db.delete(txn)
        db.commit()
        return success_response(message="Transaction permanently deleted")
    
    if mode != "soft":
        raise HTTPException(status_code=400, detail="Invalid mode. Use 'soft' or 'hard'")
    
    txn.is_deleted = True
    db.commit()
    return success_response(message="Transaction archived (soft delete)")


@router.delete("")
def bulk_delete_transactions(
    ids: str = Query(description="Comma-separated transaction IDs to delete"),
    mode: str = Query(default="soft", description="Delete mode: soft (archive) or hard (permanent)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not ids:
        raise HTTPException(status_code=400, detail="No transaction IDs provided")
    
    if mode not in ["soft", "hard"]:
        raise HTTPException(status_code=400, detail="Invalid mode. Use 'soft' or 'hard'")
    
    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IDs format. Use comma-separated integers.")
    
    if not id_list:
        raise HTTPException(status_code=400, detail="No transaction IDs provided")
    
    txns = db.query(Transaction).filter(
        Transaction.id.in_(id_list),
        Transaction.user_id == current_user.id
    ).all()
    
    if not txns:
        raise HTTPException(status_code=404, detail="No transactions found")
    
    deleted_count = 0
    for txn in txns:
        if mode == "hard":
            db.delete(txn)
        else:
            txn.is_deleted = True
        deleted_count += 1
    
    db.commit()
    action = "permanently deleted" if mode == "hard" else "archived"
    return success_response(message=f"{deleted_count} transaction(s) {action}")


@router.get("/export")
def export_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    type: str = Query(default=None, description="Filter by type: income, expense"),
    category_id: int = Query(default=None, description="Filter by category ID"),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    format: str = Query(default="csv", description="Export format: csv")
):
    # RBAC: Admins can export all; regular users can export only their own
    if getattr(current_user, 'role', None) == 'admin':
        query = db.query(Transaction).filter(Transaction.is_deleted != True)
    else:
        query = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.is_deleted != True
        )
    
    if type:
        cat_type = "income" if type.lower() == "income" else "expense"
        query = query.join(Category).filter(Category.type == cat_type)
    
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    txns = query.order_by(Transaction.date.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Category", "Type", "Amount", "Description", "Date", "Created By", "Created At"])
    
    for t in txns:
        cat = db.query(Category).filter(Category.id == t.category_id).first()
        writer.writerow([
            t.id,
            cat.name if cat else "Unknown",
            "income" if t.amount > 0 else "expense",
            abs(t.amount),
            t.description or "",
            t.date.isoformat() if t.date else "",
            t.created_by,
            t.created_at.isoformat() if t.created_at else ""
        ])
    
    output.seek(0)
    
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=transactions_{current_user.id}.csv"}
    )
