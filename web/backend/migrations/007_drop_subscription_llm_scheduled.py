#!/usr/bin/env python3
"""迁移 007：删除订阅/积分/后台 LLM 配置/定时任务相关表与列。

背景：订阅、积分、订单、后台 LLM 配置（Provider/模型目录、系统默认 Provider、
用户级持久化设置）与定时任务已整体下线，代码不再引用这些表；本迁移清理数据库。

幂等：重复执行不会报错；执行前自动备份 SQLite 库文件。
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

DROP_TABLES = [
    "apscheduler_jobs",
    "scheduled_tasks",
    "subscription_plans",
    "credit_transactions",
    "llm_providers",
    "llm_models",
    "user_llm_provider_settings",
]
DROP_COLUMNS = [("users", "credit_balance"), ("user_configs", "last_api_key")]


def _backup_sqlite() -> None:
    """SQLite 场景下先备份库文件，便于回滚。"""
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
        for table in DROP_TABLES:
            try:
                conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
                print(f"✅ 已删除表 {table}")
            except Exception as exc:  # noqa: BLE001 - 迁移必须尽力而为、可重复执行
                print(f"⚠️  删除表 {table} 失败（继续）: {exc}")

        for table, column in DROP_COLUMNS:
            try:
                conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))
                print(f"✅ 已删除列 {table}.{column}")
            except Exception as exc:  # noqa: BLE001
                print(f"⚠️  跳过列 {table}.{column}（列不存在或 SQLite < 3.35）: {exc}")


if __name__ == "__main__":
    upgrade()
