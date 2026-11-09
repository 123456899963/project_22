"""端到端演示数据（仅 dev 库，幂等；不写入 init.sql）。

用途：让 Playwright 核心链路在本地 dev 环境有可浏览的已上架茶品。
用法：backend/.venv/Scripts/python.exe -m tests.seed_e2e
"""

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.timeutil import now
from app.models.catalog import Tea, TeaCategory, TeaSubcategory

SEEDS = [
    ("龙井", "longjing", "longjing", "green", "shaqing", 2024, "浙江杭州"),
    ("铁观音", "tieguanyin", "tieguanyin", "oolong", "minnan", 2023, "福建安溪"),
]


def main() -> None:
    db = SessionLocal()
    try:
        for name, code, pinyin, cat_code, sub_code, year, origin in SEEDS:
            exists = db.execute(select(Tea).where(Tea.tea_code == f"E2E{code.upper()}")).scalars().first()
            if exists is not None:
                continue
            category = db.execute(
                select(TeaCategory).where(TeaCategory.code == cat_code)
            ).scalar_one()
            subcategory = db.execute(
                select(TeaSubcategory).where(
                    TeaSubcategory.category_id == category.id,
                    TeaSubcategory.code == sub_code,
                )
            ).scalar_one()
            db.add(
                Tea(
                    tea_code=f"E2E{code.upper()}",
                    name=name,
                    name_pinyin=pinyin,
                    name_initials=code[:2],
                    category_id=category.id,
                    subcategory_id=subcategory.id,
                    origin_summary=origin,
                    production_year=year,
                    status="published",
                    image_count=0,
                    gallery_ready=False,
                    published_version=1,
                    version=1,
                    published_at=now(),
                    last_update_at=now(),
                )
            )
        db.commit()
        print("E2E 演示茶品已就绪")
    finally:
        db.close()


if __name__ == "__main__":
    main()
