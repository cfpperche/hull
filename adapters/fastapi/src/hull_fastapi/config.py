from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HULL_", extra="ignore")

    host: str = "hull.test"
    brand: str = "Hull"
    mark: str = ""
    database_url: str = "postgresql://hull:hull@127.0.0.1:5432/hull"
    # Loopback by default so the host-side dev loop is not published to the LAN.
    # The container image sets HULL_API_HOST=0.0.0.0, where binding wide is correct.
    api_host: str = "127.0.0.1"
    api_port: int = 8080
    root_path: str = ""
    public_origin: str = ""
    cors_origins: str = ""
    smtp_host: str = ""
    smtp_port: int = 1025
    mail_from: str = ""
    s3_endpoint: str = ""
    s3_access_key: str = "hull-s3"
    s3_secret_key: str = "hull-s3-lab-secret"
    s3_region: str = "us-east-1"
    s3_bucket_avatars: str = "hull-avatars"
    schema_dir: str = ""
    cookie_name: str = "hull_session"

    def resolved_brand(self) -> str:
        return (self.brand or "Hull").strip() or "Hull"

    def resolved_mark(self) -> str:
        mark = (self.mark or "").strip()
        if mark:
            return mark[0]
        brand = self.resolved_brand()
        return brand[0] if brand else "H"

    def resolved_mail_from(self) -> str:
        raw = (self.mail_from or "").strip()
        if raw:
            return raw
        return f"{self.resolved_brand()} <noreply@{self.host}>"

    def resolved_public_origin(self) -> str:
        raw = (self.public_origin or "").strip()
        if raw:
            return raw
        return f"https://app.{self.host}"

    def welcome_subject(self) -> str:
        return f"Welcome to {self.resolved_brand()}"

    def reset_subject(self) -> str:
        return f"Reset your {self.resolved_brand()} password"
