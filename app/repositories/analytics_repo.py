"""Analytics repository: data access helpers for analytics views."""
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, case, literal, Integer
from datetime import datetime, timedelta
from app.models.transaction import Transaction
from app.models.category import Category
from app.core.transaction_filters import active_transaction_condition

# Export Transaction for admin use
TransactionModel = Transaction


def _normalize_bucket_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        return value
    try:
        return datetime.fromisoformat(str(value)).date()
    except (ValueError, TypeError):
        return None


def _bucket_date_expression(db: Session):
    dialect = (db.bind.dialect.name if db.bind and db.bind.dialect else "").lower()
    if dialect == "sqlite":
        return func.date(Transaction.date)
    return cast(Transaction.date, Date)


def _year_month_expressions(db: Session):
    dialect = (db.bind.dialect.name if db.bind and db.bind.dialect else "").lower()
    if dialect == "sqlite":
        return (
            cast(func.strftime("%Y", Transaction.date), Integer),
            cast(func.strftime("%m", Transaction.date), Integer),
        )
    return func.year(Transaction.date), func.month(Transaction.date)


def get_summary(db: Session, user_id: int):
    income = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id,
        active_transaction_condition(Transaction),
        Transaction.amount > 0
    ).scalar()

    expense = db.query(func.sum(func.abs(Transaction.amount))).filter(
        Transaction.user_id == user_id,
        active_transaction_condition(Transaction),
        Transaction.amount < 0
    ).scalar()

    return {
        "total_income": income or 0,
        "total_expense": expense or 0,
        "balance": (income or 0) - (expense or 0)
    }


def get_summary_filtered(db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None):
    base_filter = [
        Transaction.user_id == user_id,
        active_transaction_condition(Transaction)
    ]
    
    income = db.query(func.sum(Transaction.amount)).filter(
        *base_filter,
        Transaction.amount > 0
    )
    expense = db.query(func.sum(func.abs(Transaction.amount))).filter(
        *base_filter,
        Transaction.amount < 0
    )
    
    if start_date:
        income = income.filter(Transaction.date >= start_date)
        expense = expense.filter(Transaction.date >= start_date)
    if end_date:
        income = income.filter(Transaction.date <= end_date)
        expense = expense.filter(Transaction.date <= end_date)
    
    income_total = income.scalar() or 0
    expense_total = expense.scalar() or 0
    
    return {
        "total_income": income_total,
        "total_expense": expense_total,
        "balance": income_total - expense_total
    }


def get_summary_by_category(db: Session, user_id: int):
    base_query = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        active_transaction_condition(Transaction)
    )

    income_rows = base_query.with_entities(
        Category.name.label("category_name"),
        func.sum(Transaction.amount).label("total")
    ).outerjoin(Category, Transaction.category_id == Category.id).filter(
        Transaction.amount > 0
    ).group_by(Category.name).all()

    expense_rows = base_query.with_entities(
        Category.name.label("category_name"),
        func.sum(Transaction.amount).label("total")
    ).outerjoin(Category, Transaction.category_id == Category.id).filter(
        Transaction.amount < 0
    ).group_by(Category.name).all()

    data = [
        {
            "category": row.category_name or "Uncategorized",
            "type": "income",
            "total": row.total,
        }
        for row in income_rows
    ]
    data.extend(
        {
            "category": row.category_name or "Uncategorized",
            "type": "expense",
            "total": row.total,
        }
        for row in expense_rows
    )
    return data


def get_summary_by_category_filtered(db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None, type: str = None):
    base_query = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        active_transaction_condition(Transaction)
    )

    if start_date:
        base_query = base_query.filter(Transaction.date >= start_date)
    if end_date:
        base_query = base_query.filter(Transaction.date <= end_date)

    normalized_type = (type or "").lower().strip()
    data = []

    if normalized_type in {"", "income"}:
        income_rows = base_query.with_entities(
            Category.name.label("category_name"),
            func.sum(Transaction.amount).label("total")
        ).outerjoin(Category, Transaction.category_id == Category.id).filter(
            Transaction.amount > 0
        ).group_by(Category.name).all()
        data.extend(
            {
                "category": row.category_name or "Uncategorized",
                "type": "income",
                "total": row.total,
            }
            for row in income_rows
        )

    if normalized_type in {"", "expense"}:
        expense_rows = base_query.with_entities(
            Category.name.label("category_name"),
            func.sum(Transaction.amount).label("total")
        ).outerjoin(Category, Transaction.category_id == Category.id).filter(
            Transaction.amount < 0
        ).group_by(Category.name).all()
        data.extend(
            {
                "category": row.category_name or "Uncategorized",
                "type": "expense",
                "total": row.total,
            }
            for row in expense_rows
        )

    return data


def get_monthly_summary(db: Session, user_id: int):
    year_expr, month_expr = _year_month_expressions(db)
    results = db.query(
        year_expr.label("year"),
        month_expr.label("month"),
        func.sum(case((Transaction.amount >= 0, Transaction.amount), else_=0)).label("income_total"),
        func.sum(case((Transaction.amount < 0, Transaction.amount), else_=0)).label("expense_total"),
    ) \
    .filter(Transaction.user_id == user_id, active_transaction_condition(Transaction)) \
    .group_by(year_expr, month_expr) \
    .order_by(year_expr, month_expr) \
    .all()

    data = []
    for row in results:
        if row.income_total:
            data.append({
                "year": int(row.year),
                "month": int(row.month),
                "type": "income",
                "total": row.income_total,
            })
        if row.expense_total:
            data.append({
                "year": int(row.year),
                "month": int(row.month),
                "type": "expense",
                "total": row.expense_total,
            })
    return data


def get_monthly_summary_filtered(
    db: Session,
    user_id: int,
    start_date: datetime = None,
    end_date: datetime = None,
    granularity: str = "month"
):
    normalized_granularity = str(granularity or "month").lower()
    if normalized_granularity not in {"day", "week", "month"}:
        normalized_granularity = "month"

    base_query = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        active_transaction_condition(Transaction)
    )

    if start_date:
        base_query = base_query.filter(Transaction.date >= start_date)
    if end_date:
        base_query = base_query.filter(Transaction.date <= end_date)

    if normalized_granularity == "day":
        bucket_date = _bucket_date_expression(db).label("bucket_date")
        results = db.query(
            bucket_date,
            func.sum(case((Transaction.amount >= 0, Transaction.amount), else_=0)).label("income_total"),
            func.sum(case((Transaction.amount < 0, Transaction.amount), else_=0)).label("expense_total"),
        ) \
        .filter(
            Transaction.user_id == user_id,
            active_transaction_condition(Transaction)
        )

        if start_date:
            results = results.filter(Transaction.date >= start_date)
        if end_date:
            results = results.filter(Transaction.date <= end_date)

        rows = results.group_by(
            bucket_date,
        ).order_by(bucket_date).all()

        normalized_rows = []
        for row in rows:
            bucket = _normalize_bucket_date(row.bucket_date)
            if not bucket:
                continue
            if row.income_total:
                normalized_rows.append(
                    {
                        "year": bucket.year,
                        "month": bucket.month,
                        "day": bucket.day,
                        "bucketType": "day",
                        "bucketStartKey": bucket.isoformat(),
                        "type": "income",
                        "total": row.income_total,
                        "label": bucket.strftime("%d %b"),
                        "bucket": bucket.isoformat(),
                    }
                )
            if row.expense_total:
                normalized_rows.append(
                    {
                        "year": bucket.year,
                        "month": bucket.month,
                        "day": bucket.day,
                        "bucketType": "day",
                        "bucketStartKey": bucket.isoformat(),
                        "type": "expense",
                        "total": row.expense_total,
                        "label": bucket.strftime("%d %b"),
                        "bucket": bucket.isoformat(),
                    }
                )
        return normalized_rows

    if normalized_granularity == "week":
        rows = base_query.with_entities(
            Transaction.date,
            Transaction.amount
        ).all()

        buckets = {}
        for row in rows:
          if not row.date:
              continue
          bucket_start = row.date - timedelta(days=row.date.weekday())
          bucket_start = bucket_start.replace(hour=0, minute=0, second=0, microsecond=0)
          bucket_key = bucket_start.date().isoformat()
          bucket_end = bucket_start + timedelta(days=6)
          bucket = buckets.setdefault(bucket_key, {
              "year": bucket_start.year,
              "month": bucket_start.month,
              "day": bucket_start.day,
              "bucketType": "week",
              "type": "income" if row.amount >= 0 else "expense",
              "income": 0,
              "expense": 0,
              "total": 0,
              "bucket": bucket_key,
              "label": f"{bucket_start.strftime('%d %b')} – {bucket_end.strftime('%d %b')}",
          })
          if row.amount >= 0:
              bucket["income"] += row.amount
              bucket["type"] = bucket["type"] or "income"
          else:
              expense = abs(row.amount)
              bucket["expense"] += expense
              bucket["type"] = "expense"
          bucket["total"] += row.amount

        result_rows = []
        for key, bucket in sorted(buckets.items()):
            if bucket["income"] > 0:
                result_rows.append({
                    "year": bucket["year"],
                    "month": bucket["month"],
                    "day": bucket["day"],
                    "bucketType": "week",
                    "bucketStartKey": key,
                    "type": "income",
                    "total": bucket["income"],
                    "label": bucket["label"],
                    "bucket": key,
                })
            if bucket["expense"] > 0:
                result_rows.append({
                    "year": bucket["year"],
                    "month": bucket["month"],
                    "day": bucket["day"],
                    "bucketType": "week",
                    "bucketStartKey": key,
                    "type": "expense",
                    "total": -bucket["expense"],
                    "label": bucket["label"],
                    "bucket": key,
                })
        return result_rows

    year_expr, month_expr = _year_month_expressions(db)
    rows = base_query.with_entities(
        year_expr.label("year"),
        month_expr.label("month"),
        func.sum(case((Transaction.amount >= 0, Transaction.amount), else_=0)).label("income_total"),
        func.sum(case((Transaction.amount < 0, Transaction.amount), else_=0)).label("expense_total"),
    ).group_by(
        year_expr,
        month_expr,
    ).order_by(
        year_expr,
        month_expr,
    ).all()

    data = []
    for row in rows:
        year = int(row.year)
        month = int(row.month)
        key = f"{year}-{month:02d}"
        label = f"{datetime(2000, month, 1).strftime('%b')} {year}"
        if row.income_total:
            data.append({
                "year": year,
                "month": month,
                "bucketType": "month",
                "bucketStartKey": key,
                "type": "income",
                "total": row.income_total,
                "label": label,
            })
        if row.expense_total:
            data.append({
                "year": year,
                "month": month,
                "bucketType": "month",
                "bucketStartKey": key,
                "type": "expense",
                "total": row.expense_total,
                "label": label,
            })
    return data
