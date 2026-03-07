from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, AsyncIterator


TERMINAL_EVENT_TYPES = {"execution.completed", "execution.failed", "execution.cancelled"}


class ExecutionEventBroker:
    def __init__(self) -> None:
        self._channels: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def ensure_channel(self, execution_id: str) -> None:
        async with self._lock:
            self._channels.setdefault(
                execution_id,
                {
                    "history": [],
                    "subscribers": set(),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "closed": False,
                },
            )

    async def publish(self, execution_id: str, event: dict[str, Any]) -> None:
        await self.ensure_channel(execution_id)
        channel = self._channels[execution_id]
        event_payload = deepcopy(event)
        event_payload.setdefault("execution_id", execution_id)
        event_payload.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        channel["history"].append(event_payload)
        if event_payload.get("type") in TERMINAL_EVENT_TYPES:
            channel["closed"] = True
        for queue in list(channel["subscribers"]):
            await queue.put(deepcopy(event_payload))

    async def history(self, execution_id: str) -> list[dict[str, Any]]:
        await self.ensure_channel(execution_id)
        channel = self._channels[execution_id]
        return deepcopy(channel["history"])

    @asynccontextmanager
    async def subscribe(self, execution_id: str) -> AsyncIterator[tuple[list[dict[str, Any]], asyncio.Queue]]:
        await self.ensure_channel(execution_id)
        channel = self._channels[execution_id]
        queue: asyncio.Queue = asyncio.Queue()
        channel["subscribers"].add(queue)
        try:
            yield deepcopy(channel["history"]), queue
        finally:
            channel["subscribers"].discard(queue)


execution_event_broker = ExecutionEventBroker()

