"""
Idempotency Middleware
======================
Caches POST responses by an ``Idempotency-Key`` header.
If a client retries a POST with the same key, the cached response is returned
immediately without re-processing — preventing duplicate side-effects.

Uses an in-memory TTL cache (300 s).  For production scale, swap with Redis.
"""
from __future__ import annotations

from cachetools import TTLCache
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

# TTL cache: max 4096 keys, 5 minute expiry
_idempotency_cache: TTLCache = TTLCache(maxsize=4096, ttl=300)


class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method != "POST":
            return await call_next(request)

        idem_key = request.headers.get("Idempotency-Key")
        if not idem_key:
            # No key provided — process normally
            return await call_next(request)

        # Check cache
        cached = _idempotency_cache.get(idem_key)
        if cached is not None:
            return Response(
                content=cached["body"],
                status_code=cached["status_code"],
                media_type=cached["media_type"],
                headers={"X-Idempotent-Replay": "true"},
            )

        # Process request
        response = await call_next(request)

        # Read body for caching (must be consumed then re-wrapped)
        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        _idempotency_cache[idem_key] = {
            "body": body,
            "status_code": response.status_code,
            "media_type": response.media_type,
        }

        return Response(
            content=body,
            status_code=response.status_code,
            media_type=response.media_type,
            headers=dict(response.headers),
        )
