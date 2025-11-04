#!/usr/bin/env python3
"""
数据库迁移脚本：简化API Key存储
将多个LLM提供商的API Key字段合并为单个last_api_key字段
"""

import os
import sys
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# 加载环境变量
env_path = project_root / '.env'
load_dotenv(env_path)

def get_database_url():
    """从环境变量获取数据库URL"""
    db_url = os.getenv('DATABASE_URL')
    if db_url:
        return db_url
    
    # 如果没有DATABASE_URL，尝试构建MySQL URL
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '3306')
    db_user = os.getenv('DB_USER', 'root')
    db_password = os.getenv('DB_PASSWORD', '')
    db_name = os.getenv('DB_NAME', 'tradingagents')
    
    if db_password:
        return f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    # 默认使用SQLite
    db_path = project_root / 'db' / 'tradingagents.db'
    # 确保目录存在
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path}"

def migrate_api_keys():
    """迁移API Key字段"""
    database_url = get_database_url()
    print(f"📊 连接数据库: {database_url.split('@')[-1] if '@' in database_url else database_url}")
    
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # 检查是否是MySQL
        is_mysql = 'mysql' in database_url.lower()
        
        print("\n🔍 检查user_configs表结构...")
        
        # 检查last_api_key列是否已存在
        if is_mysql:
            result = session.execute(text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'user_configs'
                AND COLUMN_NAME = 'last_api_key'
            """))
            has_last_api_key = result.fetchone()[0] > 0
        else:
            # SQLite
            result = session.execute(text("PRAGMA table_info(user_configs)"))
            columns = [row[1] for row in result.fetchall()]
            has_last_api_key = 'last_api_key' in columns
        
        if has_last_api_key:
            print("✅ last_api_key列已存在，无需添加")
        else:
            print("⚠️ last_api_key列不存在，需要添加")
            # 添加last_api_key列
            session.execute(text("""
                ALTER TABLE user_configs
                ADD COLUMN last_api_key VARCHAR(255)
            """))
            session.commit()
            print("✅ 已添加last_api_key列")
        
        # 迁移现有数据（如果有旧字段）
        print("\n📦 迁移现有API Key数据...")
        
        # 检查是否有旧的API Key字段
        old_fields = ['last_openai_api_key', 'last_anthropic_api_key', 'last_google_api_key', 'last_openrouter_api_key']
        existing_old_fields = []
        
        if is_mysql:
            for field in old_fields:
                result = session.execute(text(f"""
                    SELECT COUNT(*) as count
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'user_configs'
                    AND COLUMN_NAME = '{field}'
                """))
                if result.fetchone()[0] > 0:
                    existing_old_fields.append(field)
        else:
            result = session.execute(text("PRAGMA table_info(user_configs)"))
            columns = [row[1] for row in result.fetchall()]
            existing_old_fields = [f for f in old_fields if f in columns]
        
        if existing_old_fields:
            print(f"发现旧字段: {', '.join(existing_old_fields)}")
            
            # 迁移数据：优先使用与last_llm_provider匹配的API Key
            for field in existing_old_fields:
                provider_map = {
                    'last_openai_api_key': 'openai',
                    'last_anthropic_api_key': 'anthropic',
                    'last_google_api_key': 'google',
                    'last_openrouter_api_key': 'openrouter'
                }
                provider = provider_map.get(field)
                
                if provider:
                    # 更新匹配的记录
                    session.execute(text(f"""
                        UPDATE user_configs
                        SET last_api_key = {field}
                        WHERE last_llm_provider = :provider
                        AND {field} IS NOT NULL
                        AND (last_api_key IS NULL OR last_api_key = '')
                    """), {'provider': provider})
            
            session.commit()
            print("✅ 数据迁移完成")
            
            # 删除旧字段
            print("\n🗑️ 删除旧的API Key字段...")
            for field in existing_old_fields:
                try:
                    session.execute(text(f"""
                        ALTER TABLE user_configs
                        DROP COLUMN {field}
                    """))
                    print(f"✅ 已删除 {field}")
                except Exception as e:
                    print(f"⚠️ 删除 {field} 失败: {e}")
            
            session.commit()
        else:
            print("✅ 未发现旧字段，无需迁移")
        
        print("\n✅ API Key字段简化完成！")
        print("\n📋 当前user_configs表结构:")
        
        if is_mysql:
            result = session.execute(text("""
                SELECT COLUMN_NAME, COLUMN_TYPE
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'user_configs'
                ORDER BY ORDINAL_POSITION
            """))
            for row in result.fetchall():
                print(f"  - {row[0]}: {row[1]}")
        else:
            result = session.execute(text("PRAGMA table_info(user_configs)"))
            for row in result.fetchall():
                print(f"  - {row[1]}: {row[2]}")
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    print("=" * 60)
    print("API Key字段简化迁移脚本")
    print("=" * 60)
    migrate_api_keys()
