#!/usr/bin/env python3
"""
Migration: Add LLM Providers and Models tables
为 LLM 供应商和模型管理添加数据库表
"""

from sqlalchemy import create_engine, text, MetaData, Table, Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import sync_engine, Base


def upgrade():
    """Create llm_providers and llm_models tables"""
    print("🔄 Creating LLM Providers and Models tables...")
    
    # Create metadata
    metadata = MetaData()
    
    # Define llm_providers table
    llm_providers = Table(
        'llm_providers',
        metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('provider_name', String(100), unique=True, nullable=False, index=True, comment='供应商名称（唯一标识）'),
        Column('display_name', String(200), nullable=False, comment='显示名称'),
        Column('api_key', String(500), nullable=True, comment='API密钥（加密存储）'),
        Column('base_url', String(500), nullable=True, comment='API基础URL'),
        Column('description', Text, nullable=True, comment='供应商描述'),
        Column('is_active', Boolean, default=True, nullable=False, index=True, comment='是否启用'),
        Column('config_json', JSON, nullable=True, comment='额外配置参数（JSON格式）'),
        Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
        Column('updated_at', DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
    )
    
    # Define llm_models table
    llm_models = Table(
        'llm_models',
        metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('provider_id', Integer, ForeignKey('llm_providers.id', ondelete='CASCADE'), nullable=False, index=True),
        Column('model_name', String(200), nullable=False, index=True, comment='模型名称'),
        Column('model_type', String(50), nullable=False, index=True, comment='模型类型：shallow_thinker/deep_thinker'),
        Column('display_name', String(200), nullable=False, comment='显示名称'),
        Column('description', Text, nullable=True, comment='模型描述'),
        Column('is_active', Boolean, default=True, nullable=False, index=True, comment='是否启用'),
        Column('config_json', JSON, nullable=True, comment='模型配置参数（JSON格式）'),
        Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
        Column('updated_at', DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
    )
    
    # Create tables
    try:
        llm_providers.create(sync_engine, checkfirst=True)
        print("✅ Created llm_providers table")
        
        llm_models.create(sync_engine, checkfirst=True)
        print("✅ Created llm_models table")
        
        # Insert default providers and models
        insert_default_data()
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        raise


def insert_default_data():
    """插入默认的供应商和模型数据"""
    print("🔄 Inserting default LLM providers and models...")
    
    with sync_engine.connect() as conn:
        # 检查是否已有数据
        result = conn.execute(text("SELECT COUNT(*) FROM llm_providers"))
        count = result.scalar()
        
        if count > 0:
            print("ℹ️  Default data already exists, skipping...")
            return
        
        # 插入默认供应商
        providers_data = [
            {
                'provider_name': 'openai',
                'display_name': 'OneInfinity OpenAI Compatible',
                'base_url': 'https://api.oneinfinityai.com/v1',
                'description': 'OneInfinity OpenAI兼容模型',
                'is_active': True,
            },
            {
                'provider_name': 'anthropic',
                'display_name': 'Anthropic',
                'base_url': 'https://api.anthropic.com/v1',
                'description': 'Anthropic Claude系列模型',
                'is_active': True,
            },
            {
                'provider_name': 'deepseek',
                'display_name': 'DeepSeek',
                'base_url': 'https://api.deepseek.com/v1',
                'description': 'DeepSeek系列模型',
                'is_active': True,
            },
            {
                'provider_name': 'custom',
                'display_name': '自定义供应商',
                'base_url': '',
                'description': '自定义LLM服务供应商',
                'is_active': True,
            }
        ]
        
        provider_ids = {}
        for provider in providers_data:
            result = conn.execute(
                text("""
                    INSERT INTO llm_providers 
                    (provider_name, display_name, base_url, description, is_active)
                    VALUES (:provider_name, :display_name, :base_url, :description, :is_active)
                """),
                provider
            )
            # 获取插入的ID（SQLite方式）
            provider_id = result.lastrowid
            provider_ids[provider['provider_name']] = provider_id
            print(f"  ✅ Inserted provider: {provider['display_name']}")
        
        # 插入默认模型
        models_data = [
            # OneInfinity OpenAI-compatible models
            {'provider': 'openai', 'model_name': 'gpt-5.5', 'type': 'deep_thinker', 'display_name': 'GPT-5.5', 'description': 'OneInfinity deep档默认模型'},
            {'provider': 'openai', 'model_name': 'gpt-5.5', 'type': 'shallow_thinker', 'display_name': 'GPT-5.5', 'description': 'OneInfinity quick档默认模型；若提供方确认轻量档再切换'},
            
            # Anthropic models
            {'provider': 'anthropic', 'model_name': 'claude-3-5-sonnet-20241022', 'type': 'deep_thinker', 'display_name': 'Claude 3.5 Sonnet', 'description': 'Anthropic最强推理模型'},
            {'provider': 'anthropic', 'model_name': 'claude-3-5-haiku-20241022', 'type': 'shallow_thinker', 'display_name': 'Claude 3.5 Haiku', 'description': 'Anthropic快速响应模型'},
            {'provider': 'anthropic', 'model_name': 'claude-3-opus-20240229', 'type': 'deep_thinker', 'display_name': 'Claude 3 Opus', 'description': 'Anthropic顶级性能模型'},
            
            # DeepSeek models
            {'provider': 'deepseek', 'model_name': 'deepseek-chat', 'type': 'deep_thinker', 'display_name': 'DeepSeek Chat', 'description': 'DeepSeek对话模型'},
            {'provider': 'deepseek', 'model_name': 'deepseek-reasoner', 'type': 'deep_thinker', 'display_name': 'DeepSeek Reasoner', 'description': 'DeepSeek推理模型'},
        ]
        
        for model in models_data:
            provider_id = provider_ids.get(model['provider'])
            if provider_id:
                conn.execute(
                    text("""
                        INSERT INTO llm_models 
                        (provider_id, model_name, model_type, display_name, description, is_active)
                        VALUES (:provider_id, :model_name, :model_type, :display_name, :description, :is_active)
                    """),
                    {
                        'provider_id': provider_id,
                        'model_name': model['model_name'],
                        'model_type': model['type'],
                        'display_name': model['display_name'],
                        'description': model['description'],
                        'is_active': True,
                    }
                )
                print(f"  ✅ Inserted model: {model['display_name']}")
        
        conn.commit()
        print("✅ Default data inserted successfully")


def downgrade():
    """Drop llm_providers and llm_models tables"""
    print("🔄 Dropping LLM Providers and Models tables...")
    
    with sync_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS llm_models"))
        conn.execute(text("DROP TABLE IF EXISTS llm_providers"))
        conn.commit()
    
    print("✅ Tables dropped successfully")


if __name__ == "__main__":
    print("=" * 60)
    print("LLM Providers and Models Migration")
    print("=" * 60)
    
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
    
    print("=" * 60)
    print("Migration completed!")
    print("=" * 60)
