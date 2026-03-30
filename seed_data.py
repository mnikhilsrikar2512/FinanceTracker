from app.core.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.category import Category
from app.models.transaction import Transaction
from app.core.auth import get_password_hash
from datetime import datetime, timedelta
import random

def seed_database():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Clear existing data
        db.query(Transaction).delete()
        db.query(Category).delete()
        db.query(User).delete()
        db.commit()
        print("✓ Cleared existing data")
        
        # Create Admin User
        admin = User(
            name="Admin User",
            email="admin@financetracker.com",
            password_hash=get_password_hash("admin123"),
            role="admin",
            status="active"
        )
        db.add(admin)
        db.flush()
        print("✓ Created admin user: admin@financetracker.com / admin123")
        
        # Create Regular User
        user = User(
            name="John Doe",
            email="john@example.com",
            password_hash=get_password_hash("john123"),
            role="user",
            status="active"
        )
        db.add(user)
        db.flush()
        print("✓ Created user: john@example.com / john123")
        
        # Create global categories
        income_categories = [
            {"name": "Salary", "type": "income"},
            {"name": "Freelance", "type": "income"},
            {"name": "Investments", "type": "income"},
            {"name": "Business", "type": "income"},
            {"name": "Other Income", "type": "income"},
        ]
        
        expense_categories = [
            {"name": "Food & Dining", "type": "expense"},
            {"name": "Transportation", "type": "expense"},
            {"name": "Shopping", "type": "expense"},
            {"name": "Entertainment", "type": "expense"},
            {"name": "Utilities", "type": "expense"},
            {"name": "Rent", "type": "expense"},
            {"name": "Healthcare", "type": "expense"},
            {"name": "Education", "type": "expense"},
        ]
        
        categories = []
        for cat in income_categories + expense_categories:
            category = Category(
                name=cat["name"],
                type=cat["type"]
            )
            db.add(category)
            categories.append(category)
        
        db.flush()
        print(f"✓ Created {len(categories)} categories")
        
        # Create sample transactions for user
        descriptions_income = [
            "Monthly Salary", "Freelance Project Payment", "Stock Dividend",
            "Business Revenue", "Side Gig Income", "Consulting Fee", "Bonus"
        ]
        
        descriptions_expense = [
            "Grocery Shopping", "Uber Ride", "Amazon Purchase", "Netflix Subscription",
            "Electricity Bill", "Water Bill", "Internet Bill", "Rent Payment",
            "Doctor Visit", "Medicine", "Online Course", "Restaurant Dinner",
            "Coffee Shop", "Gas Station", "Phone Recharge", "Gym Membership"
        ]
        
        # Generate transactions for the past 3 months
        base_date = datetime.now()
        
        # Income transactions
        for i in range(15):
            days_ago = random.randint(0, 90)
            date = base_date - timedelta(days=days_ago)
            amount = random.choice([5000, 7500, 10000, 15000, 20000, 25000, 30000])
            category = random.choice([c for c in categories if c.type == "income"])
            
            txn = Transaction(
                user_id=user.id,
                category_id=category.id,
                amount=amount,
                description=random.choice(descriptions_income),
                date=date,
                created_by=user.id
            )
            db.add(txn)
        
        # Expense transactions
        for i in range(25):
            days_ago = random.randint(0, 90)
            date = base_date - timedelta(days=days_ago)
            amount = random.choice([150, 300, 500, 750, 1000, 1500, 2000, 3000, 5000])
            category = random.choice([c for c in categories if c.type == "expense"])
            
            txn = Transaction(
                user_id=user.id,
                category_id=category.id,
                amount=-amount,
                description=random.choice(descriptions_expense),
                date=date,
                created_by=user.id
            )
            db.add(txn)
        
        print("✓ Created 40 sample transactions")
        
        # Create additional sample users (10 more)
        sample_users = [
            ("Alice Smith", "alice@example.com", "alice123"),
            ("Bob Johnson", "bob@example.com", "bob123"),
            ("Charlie Brown", "charlie@example.com", "charlie123"),
            ("Diana Prince", "diana@example.com", "diana123"),
            ("Edward Norton", "edward@example.com", "edward123"),
            ("Fiona Apple", "fiona@example.com", "fiona123"),
            ("George Bush", "george@example.com", "george123"),
            ("Hannah Montana", "hannah@example.com", "hannah123"),
            ("Ivan Petrov", "ivan@example.com", "ivan123"),
            ("Julia Roberts", "julia@example.com", "julia123"),
        ]
        
        for name, email, password in sample_users:
            new_user = User(
                name=name,
                email=email,
                password_hash=get_password_hash(password),
                role="user",
                status="active"
            )
            db.add(new_user)
        
        db.flush()
        print(f"✓ Created {len(sample_users)} additional sample users")
        
        db.commit()
        print("\n" + "="*50)
        print("DATABASE SEEDED SUCCESSFULLY!")
        print("="*50)
        print("\n📋 LOGIN CREDENTIALS:")
        print("-" * 50)
        print("👑 ADMIN:")
        print("   Email: admin@financetracker.com")
        print("   Password: admin123")
        print()
        print("👤 USER:")
        print("   Email: john@example.com")
        print("   Password: john123")
        print()
        print("📝 SAMPLE USERS (10 more):")
        print("   alice@example.com / alice123")
        print("   bob@example.com / bob123")
        print("   charlie@example.com / charlie123")
        print("   diana@example.com / diana123")
        print("   edward@example.com / edward123")
        print("   fiona@example.com / fiona123")
        print("   george@example.com / george123")
        print("   hannah@example.com / hannah123")
        print("   ivan@example.com / ivan123")
        print("   julia@example.com / julia123")
        print("-" * 50)
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()