"""
Async SQLAlchemy Database Layer (Parallel Infrastructure)
=========================================================
Completely decoupled from the existing sync database.py.
Uses asyncpg as the PostgreSQL driver for full async I/O.
"""
from __future__ import annotations

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from core.config import settings

ASYNC_DATABASE_URL = settings.ASYNC_DATABASE_URL

async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    future=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class AsyncBase(DeclarativeBase):
    """Declarative base for all async ORM models.  Isolated from sync Base."""
    pass


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency – yields an async session and guarantees cleanup."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
