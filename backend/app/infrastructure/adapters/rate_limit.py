"""Rate limit en memoria: ventana deslizante por (IP, recurso) (M1-D3).

La versión distribuida (Redis) llegará con WebSockets/dashboards; este
middleware es independiente y reemplazable.
"""
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from typing import Deque

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings


class MemoryRateLimiter:
    """Ventana deslizante: permite `max_requests` en los últimos `window_seconds`."""

    def __init__(self, max_requests: int, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[tuple[str, str], Deque[float]] = defaultdict(deque)

    def allow(self, key: str, path: str) -> bool:
        now = time.monotonic()
        hits = self._hits[(key, path)]
        while hits and hits[0] <= now - self.window_seconds:
            hits.popleft()
        if len(hits) >= self.max_requests:
            return False
        hits.append(now)
        return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Limita por IP+recurso; los endpoints de login usan cuota reducida."""

    def __init__(self, app: FastAPI) -> None:
        super().__init__(app)
        settings = get_settings()
        self.default = MemoryRateLimiter(settings.rate_limit_default_per_minute)
        self.login = MemoryRateLimiter(settings.rate_limit_login_per_minute)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        path = request.url.path
        client = request.client.host if request.client else "desconocido"
        limiter = self.login if path.endswith("/login") or path.endswith("/kiosk") else self.default
        if not limiter.allow(client, path):
            return Response(status_code=429, content='{"error":{"code":"TOO_MANY_REQUESTS"}}',
                            media_type="application/json")
        return await call_next(request)
