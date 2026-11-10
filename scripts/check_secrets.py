#!/usr/bin/env python3
"""高置信度敏感信息扫描：私钥、云厂商密钥、平台 Token 与误提交的 .env。"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "私钥": re.compile(r"-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----"),
    "AWS Access Key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "GitHub Token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36}\b"),
    "Slack Token": re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{10,}\b"),
}
SKIP_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".pdf", ".zip", ".gz",
    ".mp4", ".woff", ".woff2", ".ttf", ".eot", ".lock",
}


def tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return [ROOT / line for line in result.stdout.splitlines() if line.strip()]


def main() -> int:
    errors: list[str] = []
    scanned = 0
    for path in tracked_files():
        rel = path.relative_to(ROOT).as_posix()
        if path.suffix.lower() in SKIP_SUFFIXES or not path.is_file():
            continue
        if path.name.startswith(".env") and path.name != ".env.example":
            errors.append(f"{rel}: .env 文件不得进入 Git")
            continue
        try:
            if path.stat().st_size > 1_000_000:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        scanned += 1
        for name, pattern in PATTERNS.items():
            for match in pattern.finditer(text):
                line = text.count("\n", 0, match.start()) + 1
                errors.append(f"{rel}:{line}: 疑似{name}")

    if errors:
        print("FAIL: 发现疑似敏感信息：")
        for item in errors:
            print(f"  - {item}")
        return 1

    print(f"OK: 已扫描 {scanned} 个文本文件，未发现高置信度敏感信息。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
