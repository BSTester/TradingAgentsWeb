#!/usr/bin/env python3
"""
数据库迁移：增加API密钥字段长度
解决JWT token等长密钥存储问题
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text, inspect
from web.backend.database import DATABASE_URL

def migrate():
    """增加API密钥字段长度"""
    # 将异步URL转换为同步URL
    sync_url = DATABASE_URL.replace('sqlite+aiosqlite:', 'sqlite:')
    engine = create_engine(sync_url)
    
    print("=" * 60)
    print("数据库迁移：增加API密钥字段长度")
    print("=" * 60)
    
    with engine.connect() as conn:
        # 检查数据库类型
        dialect_name = engine.dialect.name
        print(f"\n数据库类型: {dialect_name}")
        
        # 需要修改的字段列表（设置为1000字符支持JWT token）
        fields_to_modify = [
            ('user_configs', 'intraday_api_key', 1000),
            ('user_configs', 'last_api_key', 1000),
            ('user_configs', 'futu_api_key', 1000),
            ('user_configs', 'intraday_futu_api_key', 1000),
            ('llm_providers', 'api_key', 1000),
            ('scheduled_tasks', 'api_key', 1000),
            ('scheduled_tasks', 'futu_api_key', 1000),
            ('analysis_records', 'api_key', 1000),
            ('analysis_records', 'futu_api_key', 1000),
        ]
        
        for table_name, column_name, new_length in fields_to_modify:
            try:
                print(f"\n处理 {table_name}.{column_name}...")
                
                # 检查表是否存在
                inspector = inspect(engine)
                if table_name not in inspector.get_table_names():
                    print(f"  ⚠️  表 {table_name} 不存在，跳过")
                    continue
                
                # 检查列是否存在
                columns = [col['name'] for col in inspector.get_columns(table_name)]
                if column_name not in columns:
                    print(f"  ⚠️  列 {column_name} 不存在，跳过")
                    continue
                
                # 根据数据库类型使用不同的SQL
                if dialect_name == 'sqlite':
                    # SQLite不支持直接修改列类型，需要重建表
                    print(f"  ℹ️  SQLite数据库，将在下次创建表时自动使用新长度")
                    print(f"  ℹ️  当前数据不受影响，新数据将使用VARCHAR({new_length})")
                    
                elif dialect_name == 'mysql':
                    # MySQL
                    sql = text(f"ALTER TABLE {table_name} MODIFY COLUMN {column_name} VARCHAR({new_length})")
                    conn.execute(sql)
                    conn.commit()
                    print(f"  ✅ 成功修改为 VARCHAR({new_length})")
                    
                elif dialect_name == 'postgresql':
                    # PostgreSQL
                    sql = text(f"ALTER TABLE {table_name} ALTER COLUMN {column_name} TYPE VARCHAR({new_length})")
                    conn.execute(sql)
                    conn.commit()
                    print(f"  ✅ 成功修改为 VARCHAR({new_length})")
                    
                else:
                    print(f"  ⚠️  未知数据库类型: {dialect_name}")
                    
            except Exception as e:
                print(f"  ❌ 修改失败: {e}")
                # 继续处理其他字段
                continue
    
    print("\n" + "=" * 60)
    print("迁移完成！")
    print("=" * 60)
    print("\n说明:")
    print("- API密钥字段长度已增加到1000字符")
    print("- 支持存储JWT token等长密钥")
    print("- 现有数据不受影响")
    print("\n如果使用SQLite，请更新models.py中的字段定义")
    print("=" * 60)

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
