from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HULL_", extra="ignore")

    host: str = "hull.dev"
    database_url: str = "postgresql://hull:hull@127.0.0.1:5432/hull"
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    root_path: str = ""
    public_origin: str = "https://app.hull.dev"
    cors_origins: str = ""
    smtp_host: str = ""
    smtp_port: int = 1025
    mail_from: str = "Hull <noreply@hull.dev>"
    s3_endpoint: str = ""
    s3_access_key: str = "hull-s3"
    s3_secret_key: str = "hull-s3-lab-secret"
    s3_region: str = "us-east-1"
    s3_bucket_avatars: str = "hull-avatars"
    migrations_dir: str = ""
    demo_password: str = "demodemo1"
    seed_demo: bool = False
    cookie_name: str = "hull_session"
