import uuid
from pathlib import Path

from PIL import Image

from app.core.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024
MAX_VIDEO_BYTES = 500 * 1024 * 1024
THUMBNAIL_SIZE = (400, 400)


def storage_root() -> Path:
    root = Path(settings.STORAGE_LOCAL_PATH)
    root.mkdir(parents=True, exist_ok=True)
    return root


def validate_upload(mime_type: str, size_bytes: int, expect_video: bool) -> None:
    allowed = ALLOWED_VIDEO_TYPES if expect_video else ALLOWED_IMAGE_TYPES
    max_bytes = MAX_VIDEO_BYTES if expect_video else MAX_IMAGE_BYTES
    if mime_type not in allowed:
        raise ValueError(f"Unsupported file type: {mime_type}")
    if size_bytes > max_bytes:
        raise ValueError("File exceeds the maximum allowed size")


def save_file(content: bytes, mime_type: str, subdir: str) -> str:
    """Persist a validated file to local object storage and return its storage key."""
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"}.get(mime_type, "bin")
    key = f"{subdir}/{uuid.uuid4().hex}.{ext}"
    dest = storage_root() / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return key


def generate_thumbnail(storage_key: str) -> str | None:
    """Generate a compressed thumbnail for an image storage key. Returns None for non-images."""
    src = storage_root() / storage_key
    if src.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
        return None
    thumb_key = storage_key.rsplit(".", 1)[0] + "_thumb.jpg"
    dest = storage_root() / thumb_key
    with Image.open(src) as img:
        img = img.convert("RGB")
        img.thumbnail(THUMBNAIL_SIZE)
        img.save(dest, "JPEG", quality=80)
    return thumb_key


def storage_url(storage_key: str | None) -> str | None:
    if not storage_key:
        return None
    return f"{settings.API_URL}/media-files/{storage_key}"
