from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import register_exception_handlers
from app.logging_config import RequestIdMiddleware, setup_logging
from app.routers import collection_router, document_router, health_router, import_router


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging(settings.log_level)

    app = FastAPI(
        title="Mongo Admin API",
        description="Универсальный REST API для администрирования произвольных коллекций MongoDB",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestIdMiddleware)

    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(collection_router)
    app.include_router(document_router)
    app.include_router(import_router)

    return app


app = create_app()
