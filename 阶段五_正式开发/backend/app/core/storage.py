"""本地磁盘存储：三重校验（扩展名 + MIME + 文件头），单图 ≤5MB，仅 jpg/png/webp。

目录规则 tea/{teaId}/{type}-{seq}.{ext}，Nginx 以 /uploads/ 只读直出。
"""

import io
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from PIL import Image

from app.core.config import settings
from app.core.errors import BizException, ErrorCode

MAX_SIZE = 5 * 1024 * 1024
ALLOWED_EXT = {"jpg", "jpeg", "png", "webp"}


@dataclass(frozen=True)
class StoredFile:
    relative_path: str
    url: str
    size: int
    thumb_path: Optional[str]
    display_path: Optional[str]


class StorageService:
    def __init__(self, base_dir: str | None = None, public_prefix: str | None = None) -> None:
        self._base = Path(base_dir or settings.storage_dir).resolve()
        self._prefix = public_prefix or settings.public_prefix

    def store(self, filename: str | None, content_type: str | None, content: bytes, relative_path: str) -> StoredFile:
        if not content:
            raise BizException(ErrorCode.MEDIA_001, "文件为空")
        if len(content) > MAX_SIZE:
            raise BizException(ErrorCode.MEDIA_002)
        extension = self._extension_of(filename)
        if extension not in ALLOWED_EXT:
            raise BizException(ErrorCode.MEDIA_001)
        if not content_type or not content_type.startswith("image/"):
            raise BizException(ErrorCode.MEDIA_001, "仅支持图片文件")
        if not self._magic_matches(content, extension):
            raise BizException(ErrorCode.MEDIA_001, "文件内容与扩展名不符")

        target = self._safe_resolve(relative_path)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        except OSError as exc:
            raise BizException(ErrorCode.SYS_003, "图片保存失败") from exc

        thumb_path: Optional[str] = None
        display_path: Optional[str] = None
        try:
            with Image.open(io.BytesIO(content)) as source:
                source.load()
                thumb_path = self._write_derivative(target, source, 640, 480)
                display_path = self._write_derivative(target, source, 1600, 1200)
        except Exception:
            # 派生图失败不阻断上传，前台回退原图
            pass
        return StoredFile(
            relative_path=relative_path,
            url=self.url(relative_path),
            size=len(content),
            thumb_path=thumb_path,
            display_path=display_path,
        )

    def delete(self, relative_path: str) -> None:
        try:
            self._safe_resolve(relative_path).unlink(missing_ok=True)
        except OSError:
            pass

    def url(self, relative_path: str) -> str:
        return f"{self._prefix}/{relative_path.replace(os.sep, '/')}"

    def exists(self, relative_path: str) -> bool:
        return self._safe_resolve(relative_path).exists()

    def _write_derivative(self, original: Path, source: "Image.Image", width: int, height: int) -> str:
        sw, sh = source.size
        ratio = width / float(height)
        if sw / float(sh) > ratio:
            crop_h, crop_w = sh, round(sh * ratio)
        else:
            crop_w, crop_h = sw, round(sw / ratio)
        left, top = (sw - crop_w) // 2, (sh - crop_h) // 2
        box = (left, top, left + crop_w, top + crop_h)
        target = source.convert("RGB").resize((width, height), Image.BILINEAR, box=box)
        base = original.stem
        prefix = "display-" if width >= 1600 else "thumb-"
        out = original.with_name(f"{prefix}{base}.jpg")
        target.save(out, format="JPEG", quality=85)
        return out.relative_to(self._base).as_posix()

    def _safe_resolve(self, relative_path: str) -> Path:
        if not relative_path or not relative_path.strip():
            raise BizException(ErrorCode.MEDIA_001, "存储路径为空")
        target = (self._base / relative_path).resolve()
        if self._base not in target.parents and target != self._base:
            raise BizException(ErrorCode.MEDIA_001, "非法存储路径")
        return target

    @staticmethod
    def _extension_of(filename: str | None) -> str:
        if not filename or "." not in filename:
            return ""
        return filename.rsplit(".", 1)[-1].lower()

    @staticmethod
    def _magic_matches(content: bytes, extension: str) -> bool:
        if len(content) < 4:
            return False
        if extension in ("jpg", "jpeg"):
            return content[0] == 0xFF and content[1] == 0xD8 and content[2] == 0xFF
        if extension == "png":
            return content[0] == 0x89 and content[1:4] == b"PNG"
        if extension == "webp":
            return content[0:4] == b"RIFF" and content[8:12] == b"WEBP"
        return False


storage_service = StorageService()
