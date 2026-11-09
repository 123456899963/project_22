"""测试库准备：建 mingmai_test、授权业务账号、导入 init.sql 与迁移脚本。

用法（口令只走环境变量，禁止写入仓库）：
    $env:MM_TEST_ADMIN_PASSWORD = "<root 口令>"
    backend/.venv/Scripts/python backend/tests/prepare_test_db.py

可重复执行：每次先 DROP 再重建，保证用例初始态干净。
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEST_DB = "mingmai_test"
INIT_SQL = ROOT / "database" / "init.sql"
MIGRATIONS = [
    ROOT / "database" / "migration" / "V2__submission_license.sql",
]


def _run(sql: str, *, database: str | None = None, password: str) -> None:
    command = ["mysql", "-uroot", "--default-character-set=utf8mb4"]
    if database:
        command.append(f"--database={database}")
    env = os.environ.copy()
    env["MYSQL_PWD"] = password
    result = subprocess.run(
        command,
        input=sql,
        text=True,
        encoding="utf-8",
        capture_output=True,
        env=env,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        raise SystemExit(f"mysql 执行失败（exit {result.returncode}）")


def _transform(sql: str) -> str:
    return (
        sql.replace("CREATE DATABASE IF NOT EXISTS mingmai ", f"CREATE DATABASE IF NOT EXISTS {TEST_DB} ")
        .replace("USE mingmai;", f"USE {TEST_DB};")
    )


def main() -> None:
    password = os.environ.get("MM_TEST_ADMIN_PASSWORD")
    if not password:
        raise SystemExit("请先设置 MM_TEST_ADMIN_PASSWORD（本机 root 口令，仅用于测试库初始化）")

    _run(
        f"DROP DATABASE IF EXISTS {TEST_DB};"
        f"CREATE DATABASE {TEST_DB} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        f"GRANT ALL PRIVILEGES ON {TEST_DB}.* TO 'mingmai'@'localhost';"
        f"GRANT ALL PRIVILEGES ON {TEST_DB}.* TO 'mingmai'@'127.0.0.1';"
        "FLUSH PRIVILEGES;",
        password=password,
    )
    _run(_transform(INIT_SQL.read_text(encoding="utf-8")), database=TEST_DB, password=password)
    for migration in MIGRATIONS:
        _run(_transform(migration.read_text(encoding="utf-8")), database=TEST_DB, password=password)
    print(f"测试库 {TEST_DB} 已重建并导入 init.sql + {len(MIGRATIONS)} 个迁移")


if __name__ == "__main__":
    main()
