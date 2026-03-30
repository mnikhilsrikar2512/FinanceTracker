from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

connection_string = (
    f"mssql+pyodbc://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_SERVER}:{settings.DB_PORT}/{settings.DB_NAME}"
    "?driver=ODBC+Driver+18+for+SQL+Server"
    "&Encrypt=yes"
    "&TrustServerCertificate=yes"
)

engine = create_engine(
    connection_string,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    echo=False,
    connect_args={"timeout": 30}
)

SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()
