from __future__ import annotations

import io

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from PIL import Image, UnidentifiedImageError

from hull_fastapi.config import Settings

ALLOWED = {"image/jpeg", "image/png", "image/webp"}


class StorageError(Exception):
    def __init__(self, reason_code: str, message: str) -> None:
        super().__init__(message)
        self.reason_code = reason_code
        self.message = message


def s3_enabled(settings: Settings) -> bool:
    return bool((settings.s3_endpoint or "").strip())


def s3_client(settings: Settings):
    endpoint = (settings.s3_endpoint or "").strip()
    if not endpoint:
        raise StorageError("storage_not_configured", "HULL_S3_ENDPOINT is empty")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(s3={"addressing_style": "path"}, signature_version="s3v4"),
    )


def ensure_buckets(settings: Settings) -> None:
    if not s3_enabled(settings):
        return
    client = s3_client(settings)
    try:
        client.head_bucket(Bucket=settings.s3_bucket_avatars)
    except ClientError:
        client.create_bucket(Bucket=settings.s3_bucket_avatars)


def put_avatar(settings: Settings, *, user_id: str, data: bytes, content_type: str) -> str:
    if content_type not in ALLOWED:
        raise StorageError("request_validation_error", "photo must be jpeg, png, or webp")
    if len(data) > 5 * 1024 * 1024:
        raise StorageError("request_validation_error", "photo is too large")
    # Decode rather than trust the client's content type, and keep Pillow's own
    # errors inside the StorageError contract so a bad file is a 422, not a 500.
    try:
        img = Image.open(io.BytesIO(data))
        img = img.convert("RGB")
        img.thumbnail((256, 256))
        canvas = Image.new("RGB", (256, 256), (255, 255, 255))
        canvas.paste(img, ((256 - img.width) // 2, (256 - img.height) // 2))
        out = io.BytesIO()
        canvas.save(out, format="WEBP", quality=85)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise StorageError("request_validation_error", "photo could not be read") from exc
    key = f"{user_id}.webp"
    client = s3_client(settings)
    ensure_buckets(settings)
    client.put_object(
        Bucket=settings.s3_bucket_avatars,
        Key=key,
        Body=out.getvalue(),
        ContentType="image/webp",
    )
    return key


def get_avatar(settings: Settings, *, key: str) -> bytes:
    client = s3_client(settings)
    try:
        resp = client.get_object(Bucket=settings.s3_bucket_avatars, Key=key)
    except ClientError as exc:
        raise StorageError("not_found", "photo not found") from exc
    return resp["Body"].read()


def delete_avatar(settings: Settings, *, key: str) -> None:
    if not key or not s3_enabled(settings):
        return
    try:
        s3_client(settings).delete_object(Bucket=settings.s3_bucket_avatars, Key=key)
    except ClientError:
        return
