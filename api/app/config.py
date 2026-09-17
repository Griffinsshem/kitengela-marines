from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "staging", "production"]

PLACEHOLDER_MARKERS = ("change-me", "changeme", "secret", "password")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    APP_ENV: Environment = "development"

    SECRET_KEY: str
    JWT_SECRET_KEY: str
    DATABASE_URL: str

    JWT_ACCESS_TOKEN_MINUTES: int = Field(default=15, ge=1, le=120)
    JWT_REFRESH_TOKEN_DAYS: int = Field(default=14, ge=1, le=90)
    JWT_COOKIE_SECURE: bool = True

    CORS_ORIGINS: str = ""
    RATELIMIT_STORAGE_URI: str = "memory://"

    MEDIA_BACKEND: Literal["local", "cloudinary"] = "local"
    MEDIA_LOCAL_DIR: str = "uploads"
    MEDIA_MAX_UPLOAD_MB: int = Field(default=8, ge=1, le=50)

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @field_validator("DATABASE_URL")
    @classmethod
    def _require_psycopg_driver(cls, value: str) -> str:
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError(
                "DATABASE_URL must start with 'postgresql+psycopg://'. "
                "Rewrite the provider's URL rather than relying on a default driver."
            )
        return value

    @model_validator(mode="after")
    def _reject_weak_production_config(self) -> Settings:
        if not self.is_production:
            return self

        for name, value in (
            ("SECRET_KEY", self.SECRET_KEY),
            ("JWT_SECRET_KEY", self.JWT_SECRET_KEY),
        ):
            lowered = value.lower()
            if len(value) < 32 or any(marker in lowered for marker in PLACEHOLDER_MARKERS):
                raise ValueError(f"{name} looks like a placeholder or is too short for production.")

        if self.SECRET_KEY == self.JWT_SECRET_KEY:
            raise ValueError("SECRET_KEY and JWT_SECRET_KEY must differ in production.")

        if not self.cors_origin_list:
            raise ValueError("CORS_ORIGINS must list the production frontend origin.")

        if not self.JWT_COOKIE_SECURE:
            raise ValueError("JWT_COOKIE_SECURE must be true in production.")

        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
