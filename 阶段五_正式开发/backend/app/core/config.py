"""运行配置：全部来自环境变量（前缀 MM_），敏感项禁止写死在代码里。"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MM_", env_file=".env", extra="ignore")

    app_name: str = "mingmai"
    debug: bool = False
    profile: str = "dev"

    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_name: str = "mingmai"
    db_user: str = "mingmai"
    db_password: str = "mingmai_dev"
    db_echo: bool = False

    redis_url: str = "redis://127.0.0.1:6379/0"

    jwt_secret: str = "mingmai-dev-secret-key-change-in-production-0123456789abcd"
    access_expire_seconds: int = 7200
    refresh_expire_seconds: int = 604800

    storage_dir: str = "./data/uploads"
    public_prefix: str = "/uploads"

    wechat_mock: bool = True
    wechat_app_id: str = ""
    wechat_app_secret: str = ""
    wechat_qrcode_redirect: str = "https://mingmai.example.com/api/v1/auth/wechat/callback"

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @property
    def database_url(self) -> str:
        # MySQL 5.7：使用 mysql_native_password 兼容的 PyMySQL 驱动，字符集固定 utf8mb4
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
