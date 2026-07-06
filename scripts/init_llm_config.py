#!/usr/bin/env python3
"""
LLM Configuration Database Initialization Script
根据 config_routes.py 中的配置初始化 LLM 供应商和模型数据

使用方法:
    python scripts/init_llm_config.py

环境变量:
    DATABASE_URL - 数据库连接字符串（可选，默认使用 SQLite）
"""

import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from web.backend.database import DATABASE_URL
from web.backend.models import Base, LLMProvider, LLMModel


# 从 config_routes.py 中提取的配置数据
LLM_PROVIDERS_CONFIG = [
    {
        "provider_name": "openai",
        "display_name": "OneInfinity OpenAI Compatible",
        "description": "OneInfinity OpenAI兼容模型",
        "base_url": "https://api.oneinfinityai.com/v1",
        "is_active": True
    },
    {
        "provider_name": "anthropic",
        "display_name": "Anthropic",
        "description": "Claude系列模型",
        "base_url": "https://api.anthropic.com/",
        "is_active": True
    },
    {
        "provider_name": "google",
        "display_name": "Google",
        "description": "Gemini系列模型",
        "base_url": "https://generativelanguage.googleapis.com/v1",
        "is_active": True
    },
    {
        "provider_name": "openrouter",
        "display_name": "OpenRouter",
        "description": "多模型聚合平台",
        "base_url": "https://openrouter.ai/api/v1",
        "is_active": True
    },
    {
        "provider_name": "deepseek",
        "display_name": "DeepSeek",
        "description": "DeepSeek系列模型",
        "base_url": "https://api.deepseek.com/v1",
        "is_active": True
    },
    {
        "provider_name": "qwen",
        "display_name": "Qwen",
        "description": "阿里千问系列模型",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "is_active": True
    },
    {
        "provider_name": "oneai",
        "display_name": "OneAI",
        "description": "多模型聚合平台",
        "base_url": "https://api.bstester.com/v1",
        "is_active": True
    },
    {
        "provider_name": "ollama",
        "display_name": "Ollama",
        "description": "本地模型服务",
        "base_url": "http://localhost:11434/v1",
        "is_active": False  # 默认禁用
    }
]

# 模型配置（provider_name -> model_type -> models）
MODELS_CONFIG = {
    "openai": {
        "shallow_thinker": [
            {"model_name": "gpt-5.5", "display_name": "GPT-5.5", "description": "OneInfinity quick档默认模型；若提供方确认轻量档再切换"},
        ],
        "deep_thinker": [
            {"model_name": "gpt-5.5", "display_name": "GPT-5.5", "description": "OneInfinity deep档默认模型"},
        ]
    },
    "oneai": {
        "shallow_thinker": [
            {"model_name": "openai/gpt-4o-mini", "display_name": "GPT-4o-mini", "description": "快速高效，适合快速任务"},
            {"model_name": "openai/gpt-4.1-nano", "display_name": "GPT-4.1-nano", "description": "超轻量模型，适合基本操作"},
            {"model_name": "openai/gpt-4.1-mini", "display_name": "GPT-4.1-mini", "description": "紧凑模型，性能良好"},
            {"model_name": "openai/gpt-4o", "display_name": "GPT-4o", "description": "标准模型，能力稳定"},
            {"model_name": "x-ai/grok-4-fast", "display_name": "Grok-4-fast", "description": "快速高效，适合快速任务"},
            {"model_name": "x-ai/grok-4", "display_name": "Grok-4", "description": "高级推理模型"}
        ],
        "deep_thinker": [
            {"model_name": "openai/gpt-4.1-nano", "display_name": "GPT-4.1-nano", "description": "超轻量模型，适合基本操作"},
            {"model_name": "openai/gpt-4.1-mini", "display_name": "GPT-4.1-mini", "description": "紧凑模型，性能良好"},
            {"model_name": "openai/gpt-4o", "display_name": "GPT-4o", "description": "标准模型，能力稳定"},
            {"model_name": "openai/o4-mini", "display_name": "o4-mini", "description": "专业推理模型（紧凑版）"},
            {"model_name": "openai/o3-mini", "display_name": "o3-mini", "description": "高级推理模型（轻量级）"},
            {"model_name": "openai/o3", "display_name": "o3", "description": "完整高级推理模型"},
            {"model_name": "openai/o1", "display_name": "o1", "description": "首屈一指的推理和问题解决模型"},
            {"model_name": "x-ai/grok-4", "display_name": "Grok-4", "description": "高级推理模型"},
            {"model_name": "qwen3-max-preview", "display_name": "Qwen3-max", "description": "通义千问高级推理模型"}
        ]
    },
    "deepseek": {
        "shallow_thinker": [
            {"model_name": "deepseek-chat", "display_name": "DeepSeek Chat", "description": "DeepSeek-V3.2-Exp 的非思考模式"},
        ],
        "deep_thinker": [
            {"model_name": "deepseek-reasoner", "display_name": "DeepSeek Reasoner", "description": "DeepSeek-V3.2-Exp 的思考模式"},
        ]
    },
    "qwen": {
        "shallow_thinker": [
            {"model_name": "qwen3-max", "display_name": "Qwen3-max", "description": "通义千问高级推理模型"},
        ],
        "deep_thinker": [
            {"model_name": "qwen3-max", "display_name": "Qwen3-max", "description": "通义千问高级推理模型"},
        ]
    },
    "anthropic": {
        "shallow_thinker": [
            {"model_name": "claude-3-5-haiku-latest", "display_name": "Claude Haiku 3.5", "description": "快速推理，标准能力"},
            {"model_name": "claude-3-5-sonnet-latest", "display_name": "Claude Sonnet 3.5", "description": "高能力标准模型"},
            {"model_name": "claude-3-7-sonnet-latest", "display_name": "Claude Sonnet 3.7", "description": "卓越的混合推理和智能体能力"},
            {"model_name": "claude-sonnet-4-0", "display_name": "Claude Sonnet 4", "description": "高性能和卓越推理"}
        ],
        "deep_thinker": [
            {"model_name": "claude-3-5-haiku-latest", "display_name": "Claude Haiku 3.5", "description": "快速推理，标准能力"},
            {"model_name": "claude-3-5-sonnet-latest", "display_name": "Claude Sonnet 3.5", "description": "高能力标准模型"},
            {"model_name": "claude-3-7-sonnet-latest", "display_name": "Claude Sonnet 3.7", "description": "卓越的混合推理和智能体能力"},
            {"model_name": "claude-sonnet-4-0", "display_name": "Claude Sonnet 4", "description": "高性能和卓越推理"},
            {"model_name": "claude-opus-4-0", "display_name": "Claude Opus 4", "description": "最强大的Anthropic模型"}
        ]
    },
    "google": {
        "shallow_thinker": [
            {"model_name": "gemini-2.0-flash-lite", "display_name": "Gemini 2.0 Flash-Lite", "description": "成本效益和低延迟"},
            {"model_name": "gemini-2.0-flash", "display_name": "Gemini 2.0 Flash", "description": "下一代功能、速度和思维"},
            {"model_name": "gemini-2.5-flash-preview-05-20", "display_name": "Gemini 2.5 Flash", "description": "自适应思维，成本效益"}
        ],
        "deep_thinker": [
            {"model_name": "gemini-2.0-flash-lite", "display_name": "Gemini 2.0 Flash-Lite", "description": "成本效益和低延迟"},
            {"model_name": "gemini-2.0-flash", "display_name": "Gemini 2.0 Flash", "description": "下一代功能、速度和思维"},
            {"model_name": "gemini-2.5-flash-preview-05-20", "display_name": "Gemini 2.5 Flash", "description": "自适应思维，成本效益"},
            {"model_name": "gemini-2.5-pro-preview-06-05", "display_name": "Gemini 2.5 Pro", "description": "高级推理能力"}
        ]
    },
    "openrouter": {
        "shallow_thinker": [
            {"model_name": "deepseek/deepseek-chat-v3.1:free", "display_name": "DeepSeek V3.1 (免费)", "description": "混合专家模型"},
            {"model_name": "deepseek/deepseek-chat-v3.1", "display_name": "DeepSeek V3.1", "description": "混合专家模型"},
            {"model_name": "google/gemini-2.0-flash-exp:free", "display_name": "Gemini Flash 2.0 (免费)", "description": "更快的响应时间"},
            {"model_name": "google/gemini-2.5-flash", "display_name": "Gemini 2.5 Flash", "description": "Google 最先进的主力模型"},
            {"model_name": "qwen/qwen3-max", "display_name": "Qwen-3 Max", "description": "Qwen 最先进的模型"},
            {"model_name": "openai/gpt-4.1", "display_name": "GPT-4.1", "description": "旗舰大型语言模型"},
            {"model_name": "anthropic/claude-3.7-sonnet", "display_name": "Claude 3.7 Sonnet", "description": "对话和推理的强大模型"},
            {"model_name": "anthropic/claude-3.5-sonnet", "display_name": "Claude 3.5 Sonnet", "description": "对话和推理的强大模型"},
            {"model_name": "x-ai/grok-4-fast", "display_name": "Grok 4 Fast", "description": "xAI 最新的多模态模型"},
            {"model_name": "x-ai/grok-3-mini", "display_name": "Grok 3 Mini", "description": "轻量级思考模型"}
        ],
        "deep_thinker": [
            {"model_name": "deepseek/deepseek-v3.2-exp", "display_name": "DeepSeek V3.2", "description": "增强版混合专家模型"},
            {"model_name": "deepseek/deepseek-r1", "display_name": "Deepseek R1", "description": "旗舰聊天模型最新迭代"},
            {"model_name": "google/gemini-2.5-pro", "display_name": "Gemini 2.5 Pro", "description": "Google 最先进的AI模型"},
            {"model_name": "qwen/qwen3-max", "display_name": "Qwen-3 Max", "description": "Qwen 最先进的模型"},
            {"model_name": "openai/gpt-5", "display_name": "GPT-5", "description": "OpenAI 最先进的模型"},
            {"model_name": "openai/o1-pro", "display_name": "o1 Pro", "description": "首屈一指的推理和问题解决模型"},
            {"model_name": "openai/o3", "display_name": "o3", "description": "完整高级推理模型"},
            {"model_name": "anthropic/claude-sonnet-4", "display_name": "Claude Sonnet 4", "description": "增强版 Sonnet 3.7"},
            {"model_name": "anthropic/claude-opus-4.1", "display_name": "Claude Opus 4.1", "description": "Anthropic 旗舰模型更新版"},
            {"model_name": "x-ai/grok-4", "display_name": "Grok 4", "description": "xAI 最新推理模型"},
            {"model_name": "x-ai/grok-3", "display_name": "Grok 3", "description": "xAI 先进的AI模型"}
        ]
    },
    "ollama": {
        "shallow_thinker": [
            {"model_name": "llama3.1", "display_name": "Llama 3.1", "description": "本地部署"},
            {"model_name": "llama3.2", "display_name": "Llama 3.2", "description": "本地部署"}
        ],
        "deep_thinker": [
            {"model_name": "llama3.1", "display_name": "Llama 3.1", "description": "本地部署"},
            {"model_name": "qwen3", "display_name": "Qwen3", "description": "本地部署"}
        ]
    }
}


def get_sync_database_url():
    """获取同步数据库 URL"""
    url = DATABASE_URL
    # 转换为同步数据库 URL
    if url.startswith("sqlite+aiosqlite"):
        return url.replace("sqlite+aiosqlite", "sqlite")
    elif url.startswith("mysql+aiomysql"):
        return url.replace("mysql+aiomysql", "mysql+pymysql")
    return url


def init_llm_config(force=False):
    """
    初始化 LLM 配置数据
    
    Args:
        force: 如果为 True，会删除现有数据后重新初始化
    """
    print("=" * 70)
    print("LLM 配置数据库初始化")
    print("=" * 70)
    
    # 获取数据库连接
    sync_db_url = get_sync_database_url()
    print(f"\n数据库: {sync_db_url.split('@')[-1] if '@' in sync_db_url else sync_db_url}")
    
    # 创建引擎和会话
    engine = create_engine(sync_db_url, echo=False)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # 检查表是否存在
        from sqlalchemy import inspect
        inspector = inspect(engine)
        
        if 'llm_providers' not in inspector.get_table_names():
            print("\n⚠️  LLM 配置表不存在，请先运行数据库迁移:")
            print("   python web/backend/migrations/add_llm_providers_models.py")
            return
        
        # 如果 force=True，删除现有数据
        if force:
            print("\n🗑️  删除现有数据...")
            session.query(LLMModel).delete()
            session.query(LLMProvider).delete()
            session.commit()
            print("   ✅ 现有数据已删除")
        
        # 检查是否已有数据
        existing_providers = session.query(LLMProvider).count()
        if existing_providers > 0 and not force:
            print(f"\n⚠️  数据库中已有 {existing_providers} 个供应商")
            print("   如需重新初始化，请使用 --force 参数")
            return
        
        # 初始化供应商
        print("\n📦 初始化 LLM 供应商...")
        providers_map = {}
        
        for provider_config in LLM_PROVIDERS_CONFIG:
            provider = LLMProvider(**provider_config)
            session.add(provider)
            session.flush()  # 获取 ID
            providers_map[provider.provider_name] = provider
            
            status = "✅ 已启用" if provider.is_active else "⚪ 已禁用"
            print(f"   {status} {provider.display_name} ({provider.provider_name})")
        
        session.commit()
        print(f"\n   ✅ 已创建 {len(LLM_PROVIDERS_CONFIG)} 个供应商")
        
        # 初始化模型
        print("\n🤖 初始化 LLM 模型...")
        total_models = 0
        
        for provider_name, model_types in MODELS_CONFIG.items():
            if provider_name not in providers_map:
                print(f"   ⚠️  跳过未知供应商: {provider_name}")
                continue
            
            provider = providers_map[provider_name]
            provider_total = 0
            
            for model_type, models in model_types.items():
                for model_config in models:
                    model = LLMModel(
                        provider_id=provider.id,
                        model_type=model_type,
                        is_active=provider.is_active,  # 继承供应商的激活状态
                        **model_config
                    )
                    session.add(model)
                    provider_total += 1
                    total_models += 1
            
            session.commit()
            print(f"   ✅ {provider.display_name}: {provider_total} 个模型")
        
        print(f"\n   ✅ 总计创建 {total_models} 个模型")
        
        # 统计信息
        print("\n" + "=" * 70)
        print("📊 初始化完成统计")
        print("=" * 70)
        
        shallow_count = session.query(LLMModel).filter_by(model_type='shallow_thinker').count()
        deep_count = session.query(LLMModel).filter_by(model_type='deep_thinker').count()
        active_providers = session.query(LLMProvider).filter_by(is_active=True).count()
        active_models = session.query(LLMModel).filter_by(is_active=True).count()
        
        print(f"\n供应商总数: {len(LLM_PROVIDERS_CONFIG)}")
        print(f"  - 已启用: {active_providers}")
        print(f"  - 已禁用: {len(LLM_PROVIDERS_CONFIG) - active_providers}")
        
        print(f"\n模型总数: {total_models}")
        print(f"  - 快速响应 (shallow_thinker): {shallow_count}")
        print(f"  - 深度思考 (deep_thinker): {deep_count}")
        print(f"  - 已启用: {active_models}")
        print(f"  - 已禁用: {total_models - active_models}")
        
        print("\n" + "=" * 70)
        print("✅ LLM 配置初始化成功！")
        print("=" * 70)
        print("\n💡 提示:")
        print("   - 访问 /admin/llm-config 页面查看和管理配置")
        print("   - 记得为每个供应商配置 API Key")
        print("\n")
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ 初始化失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="初始化 LLM 配置数据")
    parser.add_argument(
        "--force",
        action="store_true",
        help="强制重新初始化（会删除现有数据）"
    )
    
    args = parser.parse_args()
    
    init_llm_config(force=args.force)
