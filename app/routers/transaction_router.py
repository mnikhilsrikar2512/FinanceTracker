from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
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
from app.services.log_service import log_action
from app.core.timezone import utc_now_naive
from app.core.transaction_filters import active_transaction_condition
import csv
import io

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _category_name(db: Session, category_id: int | None) -> str | None:
    if not category_id:
        return None
    category = db.query(Category).filter(Category.id == category_id).first()
    return category.name if category else None


def enrich_transaction(txn: Transaction, db: Session) -> dict:
    """Add type field to transaction"""
    cat = db.query(Category).filter(Category.id == txn.category_id).first()
    user = db.query(User).filter(User.id == txn.user_id).first()
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
        "is_deleted": txn.is_deleted,
        "type": cat.type if cat else None,
        "user_email": user.email if user else None,
        "user_name": user.name if user else None,
        "category_name": cat.name if cat else None,
    }


@router.post("", response_model=dict)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = transaction_service.create_transaction(db, data, current_user.id)
    enriched = enrich_transaction(result, db)
    log_action(
        action="CREATE_TRANSACTION",
        user_id=current_user.id,
        payload={
            "name": current_user.name,
            "email": current_user.email,
            "description": enriched.get("description"),
            "amount": enriched.get("amount"),
            "category_name": enriched.get("category_name"),
        },
        entity_type="transaction",
        entity_id=enriched.get("id"),
        level="INFO",
    )
    return success_response(data=enriched)


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
    archive_filter: str = Query(default="active", description="Archive filter: active, archived, all"),
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

    category_joined = False
    user_joined = False
    
    filters = {}

    normalized_archive_filter = str(archive_filter or "active").lower()
    if normalized_archive_filter not in {"active", "archived", "all"}:
        raise HTTPException(status_code=400, detail="Invalid archive_filter. Use active, archived, or all.")

    if include_deleted and normalized_archive_filter == "active":
        normalized_archive_filter = "all"

    if normalized_archive_filter == "archived":
        query = query.filter(Transaction.is_deleted == True)
    elif normalized_archive_filter == "all":
        pass
    else:
        query = query.filter(active_transaction_condition(Transaction))

    filters["archive_filter"] = normalized_archive_filter
    
    if type:
        if not category_joined:
            query = query.outerjoin(Category, Transaction.category_id == Category.id)
            category_joined = True
        cat_type = "income" if type.lower() == "income" else "expense"
        query = query.filter(Category.type == cat_type)
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
        query = query.filter(func.abs(Transaction.amount) >= min_amount)
        filters["min_amount"] = min_amount
    
    if max_amount is not None:
        query = query.filter(func.abs(Transaction.amount) <= max_amount)
        filters["max_amount"] = max_amount
    
    if search:
        search_term = search.strip()
        if search_term:
            if not category_joined:
                query = query.outerjoin(Category, Transaction.category_id == Category.id)
                category_joined = True
            conditions = [
                Transaction.description.ilike(f"%{search_term}%"),
                Category.name.ilike(f"%{search_term}%")
            ]
            if getattr(current_user, 'role', None) == 'admin':
                if not user_joined:
                    query = query.outerjoin(User, Transaction.user_id == User.id)
                    user_joined = True
                conditions.extend([
                    User.email.ilike(f"%{search_term}%"),
                    User.name.ilike(f"%{search_term}%")
                ])
            query = query.filter(or_(*conditions))
            filters["search"] = search_term

    total = query.count()

    allowed_sorts = {
        "date": Transaction.date,
        "amount": func.abs(Transaction.amount),
        "created_at": Transaction.created_at,
        "description": Transaction.description,
    }
    sort_column = allowed_sorts.get(sort_by, Transaction.date)
    normalized_sort_by = sort_by if sort_by in allowed_sorts else "date"
    normalized_sort_order = "asc" if str(sort_order).lower() == "asc" else "desc"
    filters["sort_by"] = normalized_sort_by
    filters["sort_order"] = normalized_sort_order

    if normalized_sort_order == "desc":
        query = query.order_by(sort_column.desc(), Transaction.id.desc())
    else:
        query = query.order_by(sort_column.asc(), Transaction.id.asc())
    
    results = query.offset(offset).limit(limit).all()

    category_lookup = {}
    user_lookup = {}
    category_ids = {t.category_id for t in results if t.category_id}
    user_ids = {t.user_id for t in results if t.user_id}

    if category_ids:
        category_lookup = {
            row.id: {"name": row.name, "type": row.type}
            for row in db.query(Category).filter(Category.id.in_(category_ids)).all()
        }
    if user_ids:
        user_lookup = {
            row.id: {"email": row.email, "name": row.name}
            for row in db.query(User).filter(User.id.in_(user_ids)).all()
        }

    data = []
    for txn in results:
        category = category_lookup.get(txn.category_id, {})
        user = user_lookup.get(txn.user_id, {})
        data.append({
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
            "is_deleted": txn.is_deleted,
            "type": category.get("type"),
            "category_name": category.get("name"),
            "user_email": user.get("email"),
            "user_name": user.get("name"),
        })
    
    return paginated_response(data, total, limit, offset, filters)


@router.get("/recent", response_model=dict)
def get_recent_transactions(
    limit: int = Query(default=5, ge=1, le=20, description="Number of recent transactions"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    txns = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        active_transaction_condition(Transaction)
    ).order_by(Transaction.date.desc()).limit(limit).all()
    
    data = [enrich_transaction(t, db) for t in txns]
    return success_response(data=data)


@router.put("/restore-many")
def bulk_restore_transactions(
    ids: str = Query(description="Comma-separated transaction IDs to restore"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not ids:
        raise HTTPException(status_code=400, detail="No transaction IDs provided")

    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IDs format. Use comma-separated integers.")

    if not id_list:
        raise HTTPException(status_code=400, detail="No transaction IDs provided")

    query = db.query(Transaction).filter(Transaction.id.in_(id_list))
    if getattr(current_user, 'role', None) != 'admin':
        query = query.filter(Transaction.user_id == current_user.id)
    txns = query.all()

    if not txns:
        raise HTTPException(status_code=404, detail="No transactions found")

    restored_count = 0
    for txn in txns:
        if txn.is_deleted:
            txn.is_deleted = False
            txn.modified_by = current_user.id
            txn.modified_at = utc_now_naive()
            restored_count += 1

    db.commit()
    if restored_count:
        log_action(
            action="BULK_RESTORE_TRANSACTION",
            user_id=current_user.id,
            payload={
                "name": current_user.name,
                "email": current_user.email,
                "count": restored_count,
                "ids": id_list,
            },
            entity_type="transaction",
            level="INFO",
        )
    return success_response(message=f"{restored_count} transaction(s) restored")


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
    if txn.user_id != current_user.id and getattr(current_user, 'role', None) != 'admin':
        raise HTTPException(status_code=403, detail="You can only update your own transactions")
    
    result = transaction_service.update_transaction(db, transaction_id, data, current_user.id)
    enriched = enrich_transaction(result, db)
    log_action(
        action="UPDATE_TRANSACTION",
        user_id=current_user.id,
        payload={
            "name": current_user.name,
            "email": current_user.email,
            "description": enriched.get("description"),
            "amount": enriched.get("amount"),
            "category_name": enriched.get("category_name"),
        },
        entity_type="transaction",
        entity_id=transaction_id,
        level="INFO",
    )
    return success_response(data=enriched)


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
    if txn.user_id != current_user.id and getattr(current_user, 'role', None) != 'admin':
        raise HTTPException(status_code=403, detail="You can only delete your own transactions")
    
    if mode == "hard":
        payload = {
            "name": current_user.name,
            "email": current_user.email,
            "description": txn.description,
            "amount": txn.amount,
            "category_name": _category_name(db, txn.category_id),
        }
        db.delete(txn)
        db.commit()
        log_action(
            action="DELETE_TRANSACTION",
            user_id=current_user.id,
            payload=payload,
            entity_type="transaction",
            entity_id=transaction_id,
            level="WARNING",
        )
        return success_response(message="Transaction permanently deleted")
    
    if mode != "soft":
        raise HTTPException(status_code=400, detail="Invalid mode. Use 'soft' or 'hard'")
    
    txn.is_deleted = True
    db.commit()
    log_action(
        action="ARCHIVE_TRANSACTION",
        user_id=current_user.id,
        payload={
            "name": current_user.name,
            "email": current_user.email,
            "description": txn.description,
            "amount": txn.amount,
            "category_name": _category_name(db, txn.category_id),
        },
        entity_type="transaction",
        entity_id=transaction_id,
        level="INFO",
    )
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
    
    query = db.query(Transaction).filter(Transaction.id.in_(id_list))
    if getattr(current_user, 'role', None) != 'admin':
        query = query.filter(Transaction.user_id == current_user.id)
    txns = query.all()
    
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
    if deleted_count:
        log_action(
            action="BULK_DELETE_TRANSACTION" if mode == "hard" else "BULK_ARCHIVE_TRANSACTION",
            user_id=current_user.id,
            payload={
                "name": current_user.name,
                "email": current_user.email,
                "count": deleted_count,
                "ids": id_list,
            },
            entity_type="transaction",
            level="WARNING" if mode == "hard" else "INFO",
        )
    action = "permanently deleted" if mode == "hard" else "archived"
    return success_response(message=f"{deleted_count} transaction(s) {action}")


@router.put("/{transaction_id}/restore")
def restore_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.user_id != current_user.id and getattr(current_user, 'role', None) != 'admin':
        raise HTTPException(status_code=403, detail="You can only restore your own transactions")
    if txn.is_deleted is not True:
        return success_response(message="Transaction is already active", data=enrich_transaction(txn, db))

    txn.is_deleted = False
    txn.modified_by = current_user.id
    txn.modified_at = utc_now_naive()
    db.commit()
    db.refresh(txn)
    enriched = enrich_transaction(txn, db)
    log_action(
        action="RESTORE_TRANSACTION",
        user_id=current_user.id,
        payload={
            "name": current_user.name,
            "email": current_user.email,
            "description": enriched.get("description"),
            "amount": enriched.get("amount"),
            "category_name": enriched.get("category_name"),
        },
        entity_type="transaction",
        entity_id=transaction_id,
        level="INFO",
    )
    return success_response(message="Transaction restored", data=enriched)


@router.get("/export")
def export_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    type: str = Query(default=None, description="Filter by type: income, expense"),
    category_id: int = Query(default=None, description="Filter by category ID"),
    start_date: datetime = Query(default=None, description="Start date"),
    end_date: datetime = Query(default=None, description="End date"),
    search: str = Query(default=None, description="Search in description or category"),
    archive_filter: str = Query(default="active", description="Archive filter: active, archived, all"),
    format: str = Query(default="csv", description="Export format: csv")
):
    # RBAC: Admins can export all; regular users can export only their own
    if getattr(current_user, 'role', None) == 'admin':
        query = db.query(Transaction)
    else:
        query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    normalized_archive_filter = str(archive_filter or "active").lower()
    if normalized_archive_filter not in {"active", "archived", "all"}:
        raise HTTPException(status_code=400, detail="Invalid archive_filter. Use active, archived, or all.")

    if normalized_archive_filter == "archived":
        query = query.filter(Transaction.is_deleted == True)
    elif normalized_archive_filter == "active":
        query = query.filter(active_transaction_condition(Transaction))
    
    if type:
        cat_type = "income" if type.lower() == "income" else "expense"
        query = query.join(Category).filter(Category.type == cat_type)
    
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    if search:
        search_term = search.strip()
        if search_term:
            query = query.outerjoin(Category, Transaction.category_id == Category.id).filter(
                or_(
                    Transaction.description.ilike(f"%{search_term}%"),
                    Category.name.ilike(f"%{search_term}%")
                )
            )
    
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


@router.get("/{transaction_id}", response_model=dict)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.user_id != current_user.id and getattr(current_user, 'role', None) != 'admin':
        raise HTTPException(status_code=403, detail="You can only view your own transactions")

    return success_response(data=enrich_transaction(txn, db))
