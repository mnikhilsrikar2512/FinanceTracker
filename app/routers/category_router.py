from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.schemas.category import CategoryCreate, CategoryResponse
from app.services import category_service
from app.core.deps import get_db
from app.core.auth import get_current_user
from app.core.response import success_response, paginated_response
from app.models.user import User
from app.models.category import Category
from app.models.transaction import Transaction

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.post("", response_model=dict)
def create_category(
    data: CategoryCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = category_service.create_category(db, data.name, data.type)
    return success_response(data={
        "id": result.id,
        "name": result.name,
        "type": result.type
    })


@router.get("", response_model=dict)
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    type: str = None,
    include_stats: bool = True
):
    query = db.query(Category)
    
    if type:
        query = query.filter(Category.type == type)
    
    categories = query.all()
    
    if include_stats:
        data = []
        for cat in categories:
            usage_count = db.query(Transaction).filter(Transaction.category_id == cat.id).count()
            total = db.query(Transaction).filter(Transaction.category_id == cat.id).all()
            total_amount = sum(abs(t.amount) for t in total)
            data.append({
                "id": cat.id,
                "name": cat.name,
                "type": cat.type,
                "usage_count": usage_count,
                "total_amount": total_amount
            })
    else:
        data = [{"id": c.id, "name": c.name, "type": c.type} for c in categories]
    
    return success_response(data=data)


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    reassign_to: int = Query(default=None, description="Reassign transactions to this category ID"),
    current_user: User = Depends(get_current_user),
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
