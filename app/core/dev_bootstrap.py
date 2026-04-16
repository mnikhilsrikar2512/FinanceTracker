"""Development bootstrap helpers for local environments."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import json

from app.core.auth import get_password_hash
from app.core.database import Base, SessionLocal, engine
from app.core.config import settings
from app.core.rate_limit import rate_limit_store
import app.models  # noqa: F401
from app.models.category import Category
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.models.user import User
from app.models.audit_log import AuditLog


LOCAL_ENVS = {"development", "dev", "local", "test", "testing"}


def _seed_marker_exists(db, user_id: int, marker: str) -> bool:
    return db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.description.like(f"[seed:{marker}]%"),
    ).first() is not None


def _bootstrap_transactions(db, user: User, categories: dict[tuple[str, str], Category], marker: str, salary: float) -> None:
    if _seed_marker_exists(db, user.id, marker):
        return

    now = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0)
    rows: list[tuple[tuple[str, str], float, str, int]] = []

    for month in range(18):
        base = month * 30
        seasonal_up = 1 + ((month % 6) - 2) * 0.035
        seasonal_down = 1 - ((month % 5) - 2) * 0.022
        bonus = 1.0 + (0.08 if month in {5, 11, 17} else 0)
        salary_cycle = salary * seasonal_up * bonus
        groceries_cycle = salary * 0.08 * seasonal_down
        commute_cycle = salary * 0.03 * (1 + (0.04 if month % 4 == 0 else -0.02))
        utilities_cycle = salary * 0.04 * (1 + (0.06 if month % 3 == 0 else 0))
        shopping_cycle = salary * 0.03 * (1 + (0.09 if month % 5 == 2 else -0.03))
        rows.extend([
            (("Salary", "income"), salary_cycle, f"Monthly salary cycle {month + 1}", base + 2),
            (("Housing", "expense"), -(salary * 0.33), f"Rent payment cycle {month + 1}", base + 4),
            (("Food & Dining", "expense"), -groceries_cycle, f"Groceries cycle {month + 1}", base + 7),
            (("Transportation", "expense"), -commute_cycle, f"Commute spend cycle {month + 1}", base + 10),
            (("Utilities", "expense"), -utilities_cycle, f"Utilities cycle {month + 1}", base + 13),
            (("Entertainment", "expense"), -(salary * 0.025 * seasonal_down), f"Entertainment cycle {month + 1}", base + 17),
            (("Healthcare", "expense"), -(salary * 0.02 * (1 + (0.1 if month % 7 == 0 else 0))), f"Healthcare cycle {month + 1}", base + 20),
            (("Shopping", "expense"), -shopping_cycle, f"Shopping cycle {month + 1}", base + 24),
        ])

        if month % 2 == 1:
            rows.append((("Freelance", "income"), salary * (0.14 + (month % 4) * 0.02), f"Freelance payout cycle {month + 1}", base + 15))

        if month % 6 == 3:
            rows.append((("Education", "expense"), -(salary * 0.035), f"Learning spend cycle {month + 1}", base + 11))

    for category_key, amount, description, days_ago in rows:
        category = categories.get(category_key)
        if not category:
            continue
        db.add(
            Transaction(
                user_id=user.id,
                category_id=category.id,
                amount=round(amount, 2),
                description=f"[seed:{marker}] {description}",
                date=now - timedelta(days=days_ago),
                created_by=user.id,
            )
        )


def _bootstrap_budgets(db, user: User, categories: dict[tuple[str, str], Category], marker: str) -> None:
    month_start = date.today().replace(day=1)
    month_end = month_start + timedelta(days=89)

    targets = [
        (("Food & Dining", "expense"), 18000),
        (("Housing", "expense"), 60000),
        (("Utilities", "expense"), 12000),
        (("Transportation", "expense"), 9000),
    ]

    for category_key, amount in targets:
        category = categories.get(category_key)
        if not category:
            continue
        existing = db.query(Budget).filter(
            Budget.user_id == user.id,
            Budget.category_id == category.id,
            Budget.period == "monthly",
        ).first()
        if existing:
            continue
        db.add(
            Budget(
                user_id=user.id,
                category_id=category.id,
                amount=amount,
                period="monthly",
                start_date=month_start,
                end_date=month_end,
                description=f"[seed:{marker}] Quarterly budget for {category.name}",
            )
        )


def _bootstrap_logs(db, users_by_email: dict[str, User]) -> None:
    existing = db.query(AuditLog).filter(AuditLog.event == "seed_bootstrap").first()
    if existing:
        return

    now = datetime.utcnow().replace(microsecond=0)
    log_rows = [
        (1, "USER_LOGIN", "INFO", "john@example.com", "user"),
        (2, "CREATE_TRANSACTION", "INFO", "john@example.com", "transaction"),
        (3, "CREATE_BUDGET", "INFO", "john@example.com", "budget"),
        (4, "USER_LOGIN", "INFO", "jane@example.com", "user"),
        (5, "UPDATE_TRANSACTION", "INFO", "jane@example.com", "transaction"),
        (6, "BUDGET_REACHED_75", "WARNING", "john@example.com", "budget"),
        (7, "FAILED_LOGIN", "WARNING", "blocked@example.com", "user"),
        (8, "ADMIN_BLOCK_USER", "WARNING", "admin@financetracker.com", "user"),
        (9, "RESTORE_TRANSACTION", "INFO", "admin@financetracker.com", "transaction"),
        (10, "BUDGET_OVER_BUDGET", "ERROR", "jane@example.com", "budget"),
        (11, "DELETE_CATEGORY", "WARNING", "admin@financetracker.com", "category"),
        (12, "CREATE_CATEGORY", "INFO", "admin@financetracker.com", "category"),
        (13, "PASSWORD_CHANGE", "INFO", "john@example.com", "user"),
        (14, "UPDATE_PROFILE", "INFO", "jane@example.com", "user"),
        (15, "BULK_ARCHIVE_TRANSACTION", "INFO", "admin@financetracker.com", "transaction"),
    ]

    for days_ago, action, level, email, entity_type in log_rows:
        user = users_by_email.get(email)
        payload = {
            "name": user.name if user else email.split("@")[0],
            "email": email,
            "seed": "dev-bootstrap",
            "action": action,
        }
        db.add(
            AuditLog(
                event="seed_bootstrap",
                action=action,
                user_id=user.id if user else None,
                entity_type=entity_type,
                entity_id=None,
                level=level,
                payload_json=json.dumps(payload),
                timestamp=now - timedelta(days=days_ago),
                created_at=now - timedelta(days=days_ago),
            )
        )


def seed_dev_data() -> None:
    if settings.APP_ENV not in LOCAL_ENVS:
        return

    Base.metadata.create_all(bind=engine, checkfirst=True)
    rate_limit_store.clear_all()
    db = SessionLocal()
    try:
        defaults = [
            ("john@example.com", "John Doe", "john123", "user", "active"),
            ("jane@example.com", "Jane Smith", "jane123", "user", "active"),
            ("blocked@example.com", "Blocked User", "blocked123", "user", "blocked"),
            ("admin@financetracker.com", "System Admin", "admin123", "admin", "active"),
        ]
        for email, name, password, role, status in defaults:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                db.add(
                    User(
                        name=name,
                        email=email,
                        password_hash=get_password_hash(password),
                        role=role,
                        status=status,
                    )
                )
            else:
                user.name = user.name or name
                user.role = role
                user.status = status

        category_defaults = [
            ("Food & Dining", "expense"),
            ("Salary", "income"),
            ("Freelance", "income"),
            ("Housing", "expense"),
            ("Transportation", "expense"),
            ("Utilities", "expense"),
            ("Entertainment", "expense"),
            ("Healthcare", "expense"),
            ("Shopping", "expense"),
            ("Education", "expense"),
        ]
        for name, cat_type in category_defaults:
            category = db.query(Category).filter(Category.name == name, Category.type == cat_type).first()
            if not category:
                db.add(Category(name=name, type=cat_type))

        db.commit()

        users = {
            row.email: row
            for row in db.query(User).filter(User.email.in_([email for email, *_ in defaults])).all()
        }
        categories = {(row.name, row.type): row for row in db.query(Category).all()}

        john = users.get("john@example.com")
        jane = users.get("jane@example.com")

        if john:
            _bootstrap_transactions(db, john, categories, "john-v2", 62000)
            _bootstrap_budgets(db, john, categories, "john")

        if jane:
            _bootstrap_transactions(db, jane, categories, "jane-v2", 54000)
            _bootstrap_budgets(db, jane, categories, "jane")

        _bootstrap_logs(db, users)
        db.commit()
    finally:
        db.close()
