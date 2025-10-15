#!/usr/bin/env python3
"""
Configuration API Routes
配置相关的 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException
from web.backend.models import User
from web.backend.auth_routes import get_current_active_user

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
async def get_config(current_user: User = Depends(get_current_active_user)):
    """Get configuration options for the frontend (requires authentication)"""
    return {
        "analysts": [
            {"value": "market", "label": "市场分析师", "description": "分析市场趋势和技术指标"},
            {"value": "social", "label": "社交媒体分析师", "description": "分析社交情绪和讨论"},
            {"value": "news", "label": "新闻分析师", "description": "分析新闻情绪和市场影响"},
            {"value": "fundamentals", "label": "基本面分析师", "description": "分析公司财务和基本面"}
        ],
        "research_depths": [
            {"value": 1, "label": "浅层", "description": "快速研究，较少的辨论和策略讨论轮次"},
            {"value": 3, "label": "中等", "description": "中间地带，适中的辨论轮次和策略讨论"},
            {"value": 5, "label": "深入", "description": "全面研究，深入的辨论和策略讨论"}
        ],
        "llm_providers": [
            {"value": "openai", "label": "OpenAI", "description": "GPT系列模型", "url": "https://api.openai.com/v1"},
            # {"value": "anthropic", "label": "Anthropic", "description": "Claude系列模型", "url": "https://api.anthropic.com/"},
            # {"value": "google", "label": "Google", "description": "Gemini系列模型", "url": "https://generativelanguage.googleapis.com/v1"},
            # {"value": "openrouter", "label": "OpenRouter", "description": "多模型聚合平台", "url": "https://openrouter.ai/api/v1"},
            # {"value": "ollama", "label": "Ollama", "description": "本地模型服务", "url": "http://localhost:11434/v1"}
        ],
        "models": {
            "openai": {
                "shallow": [
                    {"value": "gpt-4o-mini", "label": "GPT-4o-mini - 快速高效，适合快速任务"},
                    {"value": "gpt-4.1-nano", "label": "GPT-4.1-nano - 超轻量模型，适合基本操作"},
                    {"value": "gpt-4.1-mini", "label": "GPT-4.1-mini - 紧凑模型，性能良好"},
                    {"value": "gpt-4o", "label": "GPT-4o - 标准模型，能力稳定"},
                ],
                "deep": [
                    {"value": "gpt-4.1-nano", "label": "GPT-4.1-nano - 超轻量模型，适合基本操作"},
                    {"value": "gpt-4.1-mini", "label": "GPT-4.1-mini - 紧凑模型，性能良好"},
                    {"value": "gpt-4o", "label": "GPT-4o - 标准模型，能力稳定"},
                    {"value": "o4-mini", "label": "o4-mini - 专业推理模型（紧凑版）"},
                    {"value": "o3-mini", "label": "o3-mini - 高级推理模型（轻量级）"},
                    {"value": "o3", "label": "o3 - 完整高级推理模型"},
                    {"value": "o1", "label": "o1 - 首屈一指的推理和问题解决模型"},
                ]
            },
            "anthropic": {
                "shallow": [
                    {"value": "claude-3-5-haiku-latest", "label": "Claude Haiku 3.5 - 快速推理，标准能力"},
                    {"value": "claude-3-5-sonnet-latest", "label": "Claude Sonnet 3.5 - 高能力标准模型"},
                    {"value": "claude-3-7-sonnet-latest", "label": "Claude Sonnet 3.7 - 卓越的混合推理和智能体能力"},
                    {"value": "claude-sonnet-4-0", "label": "Claude Sonnet 4 - 高性能和卓越推理"}
                ],
                "deep": [
                    {"value": "claude-3-5-haiku-latest", "label": "Claude Haiku 3.5 - 快速推理，标准能力"},
                    {"value": "claude-3-5-sonnet-latest", "label": "Claude Sonnet 3.5 - 高能力标准模型"},
                    {"value": "claude-3-7-sonnet-latest", "label": "Claude Sonnet 3.7 - 卓越的混合推理和智能体能力"},
                    {"value": "claude-sonnet-4-0", "label": "Claude Sonnet 4 - 高性能和卓越推理"},
                    {"value": "claude-opus-4-0", "label": "Claude Opus 4 - 最强大的Anthropic模型"}
                ]
            },
            "google": {
                "shallow": [
                    {"value": "gemini-2.0-flash-lite", "label": "Gemini 2.0 Flash-Lite - 成本效益和低延迟"},
                    {"value": "gemini-2.0-flash", "label": "Gemini 2.0 Flash - 下一代功能、速度和思维"},
                    {"value": "gemini-2.5-flash-preview-05-20", "label": "Gemini 2.5 Flash - 自适应思维，成本效益"}
                ],
                "deep": [
                    {"value": "gemini-2.0-flash-lite", "label": "Gemini 2.0 Flash-Lite - 成本效益和低延迟"},
                    {"value": "gemini-2.0-flash", "label": "Gemini 2.0 Flash - 下一代功能、速度和思维"},
                    {"value": "gemini-2.5-flash-preview-05-20", "label": "Gemini 2.5 Flash - 自适应思维，成本效益"},
                    {"value": "gemini-2.5-pro-preview-06-05", "label": "Gemini 2.5 Pro"}
                ]
            },
            "openrouter": {
                "shallow": [
                    {"value": "meta-llama/llama-4-scout:free", "label": "Meta: Llama 4 Scout"},
                    {"value": "meta-llama/llama-3.3-8b-instruct:free", "label": "Meta: Llama 3.3 8B Instruct - 轻量级和超快速变体"},
                    {"value": "google/gemini-2.0-flash-exp:free", "label": "Gemini Flash 2.0 提供显著更快的首个令牌响应时间"}
                ],
                "deep": [
                    {"value": "deepseek/deepseek-chat-v3-0324:free", "label": "DeepSeek V3 - 685B参数，混合专家模型"},
                    {"value": "deepseek/deepseek-chat-v3-0324:free", "label": "Deepseek - 旗舰聊天模型系列的最新迭代"}
                ]
            },
            # "ollama": {
            #     "shallow": [
            #         {"value": "llama3.1", "label": "llama3.1 本地"},
            #         {"value": "llama3.2", "label": "llama3.2 本地"}
            #     ],
            #     "deep": [
            #         {"value": "llama3.1", "label": "llama3.1 本地"},
            #         {"value": "qwen3", "label": "qwen3"}
            #     ]
            # }
        }
    }


@router.post("/validate-key")
async def validate_api_key(request: dict, current_user: User = Depends(get_current_active_user)):
    """Validate API key for the selected provider (requires authentication)"""
    provider = request.get("provider", "").lower()
    api_key = request.get("api_key", "")
    
    if not provider or not api_key:
        raise HTTPException(status_code=400, detail="需要提供服务商和API密钥")
    
    try:
        # Basic validation - just check if key format looks valid
        if provider == "openai":
            if not api_key.startswith("sk-"):
                raise HTTPException(status_code=400, detail="无效的OpenAI API密钥格式")
        elif provider == "anthropic":
            if not api_key.startswith("sk-ant-"):
                raise HTTPException(status_code=400, detail="无效的Anthropic API密钥格式")
        elif provider == "google":
            if len(api_key) < 20:
                raise HTTPException(status_code=400, detail="无效的Google API密钥格式")
        elif provider == "openrouter":
            if not api_key.startswith("sk-or-"):
                raise HTTPException(status_code=400, detail="无效的OpenRouter API密钥格式")
        elif provider == "ollama":
            # Ollama doesn't require API key validation
            pass
        else:
            raise HTTPException(status_code=400, detail="不支持的服务商")
            
        return {"valid": True, "message": "API密钥格式有效"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"验证错误: {str(e)}")
