from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.core.auth import get_password_hash
from app.core.database import Base, SessionLocal, engine
from app.core.mongo import logs_collection
from app.models import Budget, Category, Transaction, User


USER_FIXTURES = [
    {"name": "System Admin", "email": "admin@financetracker.com", "password": "admin123", "role": "admin", "status": "active"},
    {"name": "John Doe", "email": "john@example.com", "password": "john123", "role": "user", "status": "active"},
    {"name": "Alice Johnson", "email": "alice@example.com", "password": "alice123", "role": "user", "status": "active"},
    {"name": "Bob Smith", "email": "bob@example.com", "password": "bob123", "role": "user", "status": "active"},
    {"name": "Charlie Brown", "email": "charlie@example.com", "password": "charlie123", "role": "user", "status": "active"},
    {"name": "Diana Prince", "email": "diana@example.com", "password": "diana123", "role": "user", "status": "active"},
    {"name": "Ethan Clark", "email": "ethan@example.com", "password": "ethan123", "role": "user", "status": "active"},
    {"name": "Farah Khan", "email": "farah@example.com", "password": "farah123", "role": "user", "status": "blocked"},
    {"name": "Gina Lopez", "email": "gina@example.com", "password": "gina123", "role": "user", "status": "active"},
    {"name": "Harish Patel", "email": "harish@example.com", "password": "harish123", "role": "user", "status": "active"},
    {"name": "Irene Walker", "email": "irene@example.com", "password": "irene123", "role": "user", "status": "blocked"},
    {"name": "Jack Wilson", "email": "jack@example.com", "password": "jack123", "role": "user", "status": "active"},
]

CATEGORY_FIXTURES = [
    ("Salary", "income"),
    ("Freelance", "income"),
    ("Investments", "income"),
    ("Bonus", "income"),
    ("Food & Dining", "expense"),
    ("Rent", "expense"),
    ("Utilities", "expense"),
    ("Transportation", "expense"),
    ("Entertainment", "expense"),
    ("Healthcare", "expense"),
    ("Shopping", "expense"),
    ("Education", "expense"),
    ("Travel", "expense"),
]


def reset_sql_data(session):
    session.query(Budget).delete()
    session.query(Transaction).delete()
    session.query(User).delete()
    session.query(Category).delete()
    session.commit()


def reset_logs():
    try:
        logs_collection.delete_many({})
    except Exception as exc:
        print(f"Mongo reset warning: {exc}")


def seed_categories(session):
    categories = {}
    for name, type_ in CATEGORY_FIXTURES:
        category = Category(name=name, type=type_)
        session.add(category)
        session.flush()
        categories[name] = category
    session.commit()
    return categories


def seed_users(session):
    users = {}
    for item in USER_FIXTURES:
        user = User(
            name=item["name"],
            email=item["email"],
            password_hash=get_password_hash(item["password"]),
            role=item["role"],
            status=item["status"],
        )
        session.add(user)
        session.flush()
        users[item["email"]] = user
    session.commit()
    return users


def add_transaction(session, *, user, category, amount, description, days_ago, created_by=None, archived=False):
    txn_date = datetime.now() - timedelta(days=days_ago)
    txn = Transaction(
        user_id=user.id,
        category_id=category.id,
        amount=amount,
        description=description,
        date=txn_date,
        created_by=(created_by or user).id,
        created_at=txn_date,
        modified_by=(created_by or user).id,
        modified_at=txn_date,
        is_deleted=archived,
    )
    session.add(txn)
    return txn


def seed_transactions(session, users, categories):
    admin = users["admin@financetracker.com"]
    john = users["john@example.com"]
    alice = users["alice@example.com"]
    bob = users["bob@example.com"]
    charlie = users["charlie@example.com"]
    diana = users["diana@example.com"]
    ethan = users["ethan@example.com"]
    farah = users["farah@example.com"]
    gina = users["gina@example.com"]
    harish = users["harish@example.com"]
    irene = users["irene@example.com"]
    jack = users["jack@example.com"]

    # John: main personal demo account with richer history.
    john_rows = [
        ("Salary", 25000, "Monthly salary", 1),
        ("Food & Dining", -1250, "Team lunch", 1),
        ("Transportation", -450, "Metro recharge", 2),
        ("Utilities", -2100, "Electricity bill", 4),
        ("Entertainment", -950, "Movie night", 5),
        ("Shopping", -3400, "Work essentials", 7),
        ("Freelance", 6800, "Freelance design", 10),
        ("Healthcare", -1800, "Clinic visit", 13),
        ("Food & Dining", -980, "Cafe meetings", 16),
        ("Travel", -4200, "Weekend trip", 28),
        ("Salary", 25000, "Monthly salary", 32),
        ("Rent", -12000, "Apartment rent", 33),
        ("Food & Dining", -1650, "Groceries", 35),
        ("Transportation", -520, "Fuel", 38),
        ("Bonus", 5000, "Performance bonus", 40),
        ("Education", -2400, "Online course", 50),
    ]
    for category_name, amount, description, days_ago in john_rows:
        add_transaction(
            session,
            user=john,
            category=categories[category_name],
            amount=amount,
            description=description,
            days_ago=days_ago,
            archived=description == "Weekend trip",
        )

    # Remaining users: enough activity for admin analytics and per-user summary.
    user_batches = {
        alice: [
            ("Salary", 21000, "Monthly salary", 2),
            ("Rent", -9000, "Home rent", 3),
            ("Food & Dining", -1450, "Family groceries", 6),
            ("Utilities", -2200, "Power and water", 11),
            ("Shopping", -2100, "Household supplies", 19),
            ("Freelance", 3200, "Weekend consulting", 24),
        ],
        bob: [
            ("Salary", 28000, "Monthly salary", 3),
            ("Transportation", -1200, "Car fuel", 4),
            ("Food & Dining", -1750, "Dining out", 8),
            ("Entertainment", -1300, "Concert tickets", 12),
            ("Investments", 4500, "Dividend payout", 21),
            ("Travel", -3600, "Client travel", 27),
        ],
        charlie: [
            ("Salary", 18500, "Monthly salary", 2),
            ("Education", -2800, "Certification course", 5),
            ("Food & Dining", -900, "Groceries", 9),
            ("Shopping", -1600, "Laptop accessories", 14),
            ("Utilities", -1950, "Internet and electricity", 20),
        ],
        diana: [
            ("Salary", 32000, "Monthly salary", 1),
            ("Rent", -15000, "City apartment rent", 2),
            ("Healthcare", -1200, "Pharmacy", 6),
            ("Food & Dining", -2400, "Dining and groceries", 10),
            ("Travel", -5400, "Family trip", 23),
            ("Bonus", 7000, "Quarterly incentive", 35),
        ],
        ethan: [
            ("Salary", 23000, "Monthly salary", 4),
            ("Transportation", -980, "Bike service", 7),
            ("Food & Dining", -1100, "Lunches", 8),
            ("Entertainment", -700, "Streaming and games", 15),
            ("Investments", 2500, "Mutual fund redemption", 31),
        ],
        farah: [
            ("Salary", 19000, "Monthly salary", 6),
            ("Rent", -7800, "Shared apartment rent", 7),
            ("Utilities", -1600, "Gas and electricity", 9),
            ("Food & Dining", -1200, "Groceries", 13),
            ("Healthcare", -900, "Diagnostics", 26),
        ],
        gina: [
            ("Salary", 26500, "Monthly salary", 2),
            ("Freelance", 3800, "Workshop session", 5),
            ("Food & Dining", -1700, "Dining", 6),
            ("Shopping", -2400, "Office wardrobe", 17),
            ("Travel", -2900, "Conference travel", 22),
        ],
        harish: [
            ("Salary", 24000, "Monthly salary", 3),
            ("Transportation", -1500, "Commute and fuel", 4),
            ("Food & Dining", -1350, "Team lunches", 9),
            ("Education", -3200, "Certification renewal", 18),
            ("Investments", 4100, "Stock sale", 29),
        ],
        irene: [
            ("Salary", 20500, "Monthly salary", 7),
            ("Rent", -8200, "Home rent", 8),
            ("Utilities", -1750, "Utilities", 11),
            ("Food & Dining", -1180, "Essentials", 14),
            ("Entertainment", -620, "Subscriptions", 25),
        ],
        jack: [
            ("Salary", 30000, "Monthly salary", 1),
            ("Bonus", 6500, "Referral bonus", 12),
            ("Food & Dining", -1950, "Client dinner", 13),
            ("Shopping", -2800, "Phone upgrade", 16),
            ("Travel", -4700, "Airport run", 20),
            ("Utilities", -2300, "Home internet and power", 33),
        ],
    }

    for user, rows in user_batches.items():
        for category_name, amount, description, days_ago in rows:
            add_transaction(
                session,
                user=user,
                category=categories[category_name],
                amount=amount,
                description=description,
                days_ago=days_ago,
                created_by=admin if user.email in {"farah@example.com", "irene@example.com"} else user,
                archived=(user.email == "farah@example.com" and description == "Diagnostics"),
            )

    # A few admin-created smoke records to make logs and audits clearer.
    add_transaction(
        session,
        user=alice,
        category=categories["Food & Dining"],
        amount=-640,
        description="Admin audit adjustment",
        days_ago=41,
        created_by=admin,
        archived=True,
    )
    add_transaction(
        session,
        user=bob,
        category=categories["Salary"],
        amount=2200,
        description="Admin bonus correction",
        days_ago=44,
        created_by=admin,
    )

    session.commit()


def seed_budgets(session, users, categories):
    john = users["john@example.com"]
    alice = users["alice@example.com"]
    bob = users["bob@example.com"]

    budgets = [
        Budget(
            user_id=john.id,
            category_id=categories["Food & Dining"].id,
            amount=6000,
            period="monthly",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 30),
            description="Meals and groceries",
        ),
        Budget(
            user_id=john.id,
            category_id=categories["Transportation"].id,
            amount=2500,
            period="monthly",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 30),
            description="Commute and fuel",
        ),
        Budget(
            user_id=john.id,
            category_id=categories["Entertainment"].id,
            amount=3000,
            period="monthly",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 30),
            description="Leisure budget",
        ),
        Budget(
            user_id=alice.id,
            category_id=categories["Utilities"].id,
            amount=3500,
            period="monthly",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 30),
            description="Utilities budget",
        ),
        Budget(
            user_id=bob.id,
            category_id=categories["Travel"].id,
            amount=6000,
            period="monthly",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 30),
            description="Travel buffer",
        ),
    ]
    session.add_all(budgets)
    session.commit()


def seed_logs(users):
    try:
        now = datetime.now(timezone.utc)
        admin = users["admin@financetracker.com"]
        john = users["john@example.com"]
        farah = users["farah@example.com"]
        irene = users["irene@example.com"]
        alice = users["alice@example.com"]
        bob = users["bob@example.com"]

        log_rows = [
            {"action": "USER_LOGIN", "user_id": john.id, "level": "INFO", "entity_type": "user", "entity_id": john.id, "payload": {"email": john.email}, "timestamp": now - timedelta(minutes=15)},
            {"action": "CREATE_TRANSACTION", "user_id": john.id, "level": "INFO", "entity_type": "transaction", "entity_id": 1, "payload": {"description": "Monthly salary"}, "timestamp": now - timedelta(minutes=14)},
            {"action": "USER_LOGIN", "user_id": alice.id, "level": "INFO", "entity_type": "user", "entity_id": alice.id, "payload": {"email": alice.email}, "timestamp": now - timedelta(minutes=52)},
            {"action": "CREATE_TRANSACTION", "user_id": alice.id, "level": "INFO", "entity_type": "transaction", "entity_id": 2, "payload": {"description": "Family groceries"}, "timestamp": now - timedelta(minutes=50)},
            {"action": "ADMIN_BLOCK_USER", "user_id": admin.id, "level": "WARNING", "entity_type": "user", "entity_id": farah.id, "payload": {"blocked_user_id": farah.id, "email": farah.email}, "timestamp": now - timedelta(hours=3)},
            {"action": "ADMIN_BLOCK_USER", "user_id": admin.id, "level": "WARNING", "entity_type": "user", "entity_id": irene.id, "payload": {"blocked_user_id": irene.id, "email": irene.email}, "timestamp": now - timedelta(hours=4)},
            {"action": "ADMIN_UNBLOCK_USER", "user_id": admin.id, "level": "INFO", "entity_type": "user", "entity_id": bob.id, "payload": {"unblocked_user_id": bob.id, "email": bob.email}, "timestamp": now - timedelta(days=1, hours=2)},
            {"action": "UPDATE_TRANSACTION", "user_id": admin.id, "level": "INFO", "entity_type": "transaction", "entity_id": 3, "payload": {"description": "Admin bonus correction"}, "timestamp": now - timedelta(days=1, hours=1)},
            {"action": "DELETE_TRANSACTION", "user_id": admin.id, "level": "WARNING", "entity_type": "transaction", "entity_id": 4, "payload": {"mode": "soft"}, "timestamp": now - timedelta(days=2)},
            {"action": "USER_LOGIN", "user_id": admin.id, "level": "INFO", "entity_type": "user", "entity_id": admin.id, "payload": {"email": admin.email}, "timestamp": now - timedelta(minutes=5)},
        ]

        docs = []
        for index, row in enumerate(log_rows, start=1):
            docs.append({
                "event": row["action"],
                "action": row["action"],
                "user_id": row["user_id"],
                "entity_type": row["entity_type"],
                "entity_id": row["entity_id"],
                "level": row["level"],
                "request_id": f"seed-log-{index:03d}",
                "payload": row["payload"],
                "timestamp": row["timestamp"],
                "created_at": row["timestamp"].isoformat(),
            })

        logs_collection.insert_many(docs)
    except Exception as exc:
        print(f"Mongo seed warning: {exc}")


def main():
    Base.metadata.create_all(bind=engine)
    reset_logs()

    session = SessionLocal()
    try:
        reset_sql_data(session)
        categories = seed_categories(session)
        users = seed_users(session)
        seed_transactions(session, users, categories)
        seed_budgets(session, users, categories)
        seed_logs(users)
    finally:
        session.close()

    print("Database reseeded successfully.")
    print("Admin: admin@financetracker.com / admin123")
    print("User: john@example.com / john123")
    print("Additional demo users:")
    for item in USER_FIXTURES[2:]:
        print(f" - {item['email']} / {item['password']} ({item['status']})")


if __name__ == "__main__":
    main()
