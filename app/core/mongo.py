from pymongo import MongoClient
from app.core.config import settings

client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[settings.MONGO_DB]
logs_collection = db["logs"]