from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.schemas.category import CategoryCreate
from app.services import category_service
from app.repositories import category_repo
from app.core.deps import get_db
from app.core.auth import get_current_user, require_admin
from app.core.response import success_response, paginated_response
from app.models.user import User
from app.models.category import Category
from app.models.transaction import Transaction

router = APIRouter(prefix="/categories", tags=["Categories"])
CATEGORY_OWNERSHIP_SCOPE = "global"
CATEGORY_OWNERSHIP_LABEL = "Global admin-managed"


def _serialize_category(category: Category, usage_count: int = 0, total_amount: float = 0.0) -> dict:
    return {
        "id": category.id,
        "name": category.name,
        "type": category.type,
        "usage_count": int(usage_count or 0),
        "total_amount": float(total_amount or 0),
        "ownership_scope": CATEGORY_OWNERSHIP_SCOPE,
        "ownership_label": CATEGORY_OWNERSHIP_LABEL,
    }


@router.post("", response_model=dict)
def create_category(
    data: CategoryCreate, 
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    result = category_service.create_category(db, data.name, data.type)
    return success_response(data=_serialize_category(result))


@router.get("", response_model=dict)
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    type: str = None,
    include_stats: bool = True
):
    if include_stats:
        rows = category_repo.get_categories_with_stats(db, type)
        data = [
            {
                "id": row.id,
                "name": row.name,
                "type": row.type,
                "usage_count": int(row.usage_count or 0),
                "total_amount": float(row.total_amount or 0),
                "ownership_scope": CATEGORY_OWNERSHIP_SCOPE,
                "ownership_label": CATEGORY_OWNERSHIP_LABEL,
            }
            for row in rows
        ]
    else:
        query = db.query(Category)
        if type:
            query = query.filter(Category.type == type)
        categories = query.all()
        data = [
            {
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "ownership_scope": CATEGORY_OWNERSHIP_SCOPE,
                "ownership_label": CATEGORY_OWNERSHIP_LABEL,
            }
            for c in categories
        ]
    
    return success_response(data=data)


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    reassign_to: int = Query(default=None, description="Reassign transactions to this category ID"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    usage_count = db.query(Transaction).filter(Transaction.category_id == category_id).count()
    
    if usage_count > 0:
        if reassign_to:
            reassign_category = db.query(Category).filter(Category.id == reassign_to).first()
            if not reassign_category:
                raise HTTPException(status_code=404, detail="Reassignment category not found")
            
            db.query(Transaction).filter(
                Transaction.category_id == category_id
            ).update({Transaction.category_id: reassign_to})
            db.commit()
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Category is used in {usage_count} transaction(s). Provide reassign_to category ID or delete transactions first."
            )
    
    db.delete(category)
    db.commit()
    
    return success_response(message="Category deleted successfully")
