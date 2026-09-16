from typing import Any

from fastapi import APIRouter

from app.dependencies import MongoServiceDep

router = APIRouter(prefix="/api")


@router.get("/server-stats")
def get_server_stats(service: MongoServiceDep) -> dict[str, Any]:
    return service.server_stats()
