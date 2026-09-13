"""Health/readiness-проверки."""
from fastapi import APIRouter, Depends, HTTPException
from pymongo import MongoClient

from app.database import get_mongo_client, ping

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness-проверка: приложение поднято."""
    return {"status": "ok"}


@router.get("/ready")
def ready(client: MongoClient = Depends(get_mongo_client)) -> dict[str, str]:
    """Readiness-проверка: MongoDB доступна."""
    if not ping(client):
        raise HTTPException(status_code=503, detail="MongoDB недоступна")
    return {"status": "ok"}
