import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Credit Decisioning Engine API"
    VERSION: str = "2.0.0"

    # Database URLs
    ASYNC_DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/intelli_credit"
    )

    # Security / Auth
    FIREBASE_PROJECT_ID: str = Field(default="intelli-credit-ai-dhanu")
    
    # Origins
    ALLOWED_ORIGINS_STR: str = Field(
        default="http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    )

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS_STR.split(",") if origin.strip()]

    # External APIs
    SIGNZY_API_KEY: str = Field(default="")
    KARZA_API_KEY: str = Field(default="")
    CIBIL_API_KEY: str = Field(default="")
    
    # Internal keys/Webhooks (these used to be hardcoded in routers/analyze.py)
    HDFC_API_KEY: str = Field(default="sk_live_hdfc_9x2b")
    ICICI_API_KEY: str = Field(default="sk_live_icici_4a1f")
    HDFC_WEBHOOK_URL: str = Field(default="https://api.hdfc.com/v1/intelli-credit/webhook")
    ICICI_WEBHOOK_URL: str = Field(default="https://api.icici.com/webhooks/cam-ready")
    
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
