from fastapi import APIRouter, HTTPException

from app.database import ping
from app.dependencies import MongoClientDep

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready(client: MongoClientDep) -> dict[str, str]:
    if not ping(client):
        raise HTTPException(status_code=503, detail="MongoDB недоступна")
    return {"status": "ok"}
