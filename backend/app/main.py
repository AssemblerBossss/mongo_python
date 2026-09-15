from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import register_exception_handlers
from app.logging_config import RequestIdMiddleware, setup_logging
from app.routers import collections, documents, health, imports


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

    app.include_router(health.router)
    app.include_router(collections.router)
    app.include_router(documents.router)
    app.include_router(imports.router)

    return app


app = create_app()
