from .collections import router as collection_router
from .documents import router as document_router
from .imports import router as import_router
from .health import router as health_router
from .server import router as server_router

__all__ = [
    "collection_router",
    "document_router",
    "import_router",
    "health_router",
    "server_router",
]
