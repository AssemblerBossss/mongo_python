from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("app.request")


def setup_logging(level: str = "INFO") -> None:
    """Настраивает базовое логирование приложения."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Прокидывает X-Request-ID через запрос/ответ и логирует параметры запроса."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        start = time.monotonic()
        response: Response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 2)

        response.headers["X-Request-ID"] = request_id
        logger.info(
            "%s %s -> %s (%.2f ms) request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response
