import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import get_mongo_client
from app.errors import register_exception_handlers
from app.logging_config import RequestIdMiddleware, setup_logging
from app.routers import (
    collection_router,
    document_router,
    health_router,
    import_router,
    server_router,
)


logger = logging.getLogger("timing")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await get_mongo_client().close()


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging(settings.log_level)

    app = FastAPI(
        title="Mongo Admin API",
        description="Универсальный REST API для администрирования произвольных коллекций MongoDB",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestIdMiddleware)

    @app.middleware("http")
    async def add_process_time_header(request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.2f}"
        logger.info("%s %s -> %.2f ms", request.method, request.url.path, elapsed_ms)
        return response

    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(collection_router)
    app.include_router(document_router)
    app.include_router(import_router)
    app.include_router(server_router)

    return app


app = create_app()
