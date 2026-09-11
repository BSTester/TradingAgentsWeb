#!/usr/bin/env python3
"""迁移 008：清理 LLM 配置彻底下线后的遗留列。

背景：LLM 配置改为「请求即配置」并完全前端本地化后，后端不再需要保存任何
LLM 偏好或密钥，因此删除：

- ``user_configs.last_llm_provider`` / ``last_shallow_thinker`` /
  ``last_deep_thinker`` / ``last_backend_url``（"上次使用"的 LLM 偏好）
- ``analysis_records.api_key``（历史遗留的按任务密钥列，已不再写入）

幂等：重复执行不会报错；SQLite 场景执行前自动备份库文件。
"""

from __future__ import annotations

import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from sqlalchemy import text  # noqa: E402

from web.backend.database import sync_engine  # noqa: E402

DROP_COLUMNS = [
    ("user_configs", "last_llm_provider"),
    ("user_configs", "last_shallow_thinker"),
    ("user_configs", "last_deep_thinker"),
    ("user_configs", "last_backend_url"),
    ("analysis_records", "api_key"),
]


def _backup_sqlite() -> None:
    url = sync_engine.url
    if url.get_backend_name() != "sqlite":
        return
    db_path = url.database
    if not db_path or not os.path.exists(db_path):
        return
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = f"{db_path}.bak-{stamp}"
    shutil.copy2(db_path, backup)
    print(f"🗄️  已备份数据库: {backup}")


def upgrade() -> None:
    _backup_sqlite()
    with sync_engine.begin() as conn:
        for table, column in DROP_COLUMNS:
            try:
                conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))
                print(f"✅ 已删除列 {table}.{column}")
            except Exception as exc:  # noqa: BLE001 - 迁移必须尽力而为、可重复执行
                print(f"⚠️  跳过列 {table}.{column}（列不存在或 SQLite < 3.35）: {exc}")


if __name__ == "__main__":
    upgrade()
