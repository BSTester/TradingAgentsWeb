#!/usr/bin/env python3
"""
Configuration API Routes
配置相关的 API 路由

注意：本项目不维护任何后端 LLM 配置（无 Provider/模型目录、无系统默认 Provider、
无用户级持久化设置）。LLM 配置由前端本地保存（浏览器 keyVault 保存密钥，
localStorage 保存自定义 Base URL/模型），并发起分析时随请求提交。

因此本模块只暴露与分析无关的公开选项（分析师、研究深度）与人机验证配置。
"""

from fastapi import APIRouter

from web.backend.services.turnstile import turnstile_site_key, turnstile_enabled

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
async def get_config():
    """Get public configuration options for the frontend."""
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
        "turnstile_site_key": turnstile_site_key(),
        "turnstile_enabled": turnstile_enabled(),
    }
