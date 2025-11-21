#!/usr/bin/env python3
"""
数据库迁移：为 users 表添加 participate_in_leaderboard 字段
"""

import sqlite3
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def migrate():
    """执行数据库迁移"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tradingagents.db')

    if not os.path.exists(db_path):
        print("数据库文件不存在: " + db_path)
        print("请先运行后端创建数据库")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'participate_in_leaderboard' not in columns:
            # 添加字段
            cursor.execute("""
                ALTER TABLE users
                ADD COLUMN participate_in_leaderboard BOOLEAN DEFAULT 0 NOT NULL
            """)
            print("成功添加 participate_in_leaderboard 字段")
        else:
            print("字段 participate_in_leaderboard 已存在")

        # 创建索引
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_participate_leaderboard
            ON users(participate_in_leaderboard)
        """)
        print("成功创建索引")

        conn.commit()
        print("\n数据库迁移完成！")

    except Exception as e:
        conn.rollback()
        print("迁移失败: " + str(e))
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
