#!/usr/bin/env python3
"""
Configuration API Routes
配置相关的 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from web.backend.models import User, LLMProvider, LLMModel
from web.backend.auth_routes import get_current_active_user
from web.backend.database import get_db

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
async def get_config(db: AsyncSession = Depends(get_db)):
    """Get public configuration options for the frontend."""
    
    # 获取LLM供应商和模型配置（从数据库动态获取）
    from sqlalchemy import select
    providers_result = await db.execute(select(LLMProvider).where(LLMProvider.is_active == True))
    providers = providers_result.scalars().all()
    
    # 构建供应商列表
    llm_providers = []
    models = {}
    
    for provider in providers:
        # 添加供应商到列表
        provider_info = {
            "value": provider.provider_name,
            "label": provider.display_name,
            "description": provider.description or f"{provider.display_name}系列模型",
            "url": provider.base_url or ""
        }
        llm_providers.append(provider_info)
        
        # 使用JOIN查询获取该供应商下的模型
        models_result = await db.execute(
            select(LLMModel, LLMProvider).join(
                LLMProvider, LLMModel.provider_id == LLMProvider.id
            ).where(
                LLMModel.provider_id == provider.id,
                LLMModel.is_active == True
            )
        )
        model_rows = models_result.all()
        
        # 按模型类型分组
        shallow_models = []
        deep_models = []
        
        for model, model_provider in model_rows:
            model_info = {
                "value": model.model_name,
                "label": model.display_name,
                "description": model.description or f"{model.display_name}模型"
            }
            
            # 直接比较model_type字符串值
            if model.model_type == "shallow_thinker":
                shallow_models.append(model_info)
            elif model.model_type == "deep_thinker":
                deep_models.append(model_info)
        
        # 添加到models字典
        if shallow_models or deep_models:
            models[provider.provider_name] = {
                "shallow": shallow_models,
                "deep": deep_models
            }
    
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
        "llm_providers": llm_providers,
        "models": models
    }


@router.post("/validate-key")
async def validate_api_key(request: dict, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    """Validate API key for the selected provider by actually calling the LLM API (requires authentication)"""
    from sqlalchemy import select
    
    provider = request.get("provider", "").lower()
    api_key = request.get("api_key", "")
    
    if not provider or not api_key:
        raise HTTPException(status_code=400, detail="需要提供服务商和API密钥")
    
    # Query provider from database to get base_url
    provider_result = await db.execute(
        select(LLMProvider).where(LLMProvider.provider_name == provider)
    )
    provider_info = provider_result.scalars().first()
    
    if not provider_info:
        raise HTTPException(status_code=400, detail=f"不支持的服务商: {provider}")
    
    # 获取base_url的实际值
    base_url = getattr(provider_info, 'base_url', None)
    if not base_url:
        raise HTTPException(status_code=400, detail=f"服务商 {provider} 未配置基础URL")
    
    # Perform actual API validation based on provider type
    if provider == "anthropic":
        # Anthropic API validation
        return await validate_anthropic(api_key, base_url)
    elif provider == "google":
        # Google API validation
        return await validate_google(api_key, base_url)
    else:
        # All other providers use OpenAI-compatible API validation
        return await validate_openai_compatible(api_key, base_url)


async def validate_openai_compatible(api_key: str, base_url: str):
    """Validate OpenAI-compatible API by calling models endpoint"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            
            # Try to call the models endpoint
            models_url = f"{base_url.rstrip('/')}/models"
            response = await client.get(models_url, headers=headers)
            
            # Any response (except 401/403/404) means API is accessible
            if response.status_code == 200:
                return {"valid": True, "message": "API密钥验证成功！连接正常。"}
            elif response.status_code == 401:
                error_body = response.text[:500] if response.text else "No response body"
                return {"valid": False, "message": f"API密钥无效或已过期，请检查密钥是否正确。详情：{error_body}"}
            elif response.status_code == 403:
                error_body = response.text[:500] if response.text else "No response body"
                return {"valid": False, "message": f"API密钥权限不足，无法访问模型列表。详情：{error_body}"}
            elif response.status_code == 404:
                error_body = response.text[:1000] if response.text else ""
                
                # If 404 has any meaningful response body, it means API is accessible
                if error_body and len(error_body.strip()) > 0:
                    # Check if it's JSON or has structured content
                    is_structured = False
                    try:
                        import json
                        json.loads(error_body)
                        is_structured = True
                    except:
                        # Not JSON, but check if it looks like an API error message
                        if not error_body.strip().startswith('<') and any(keyword in error_body.lower() for keyword in ['error', 'message', 'not found', 'invalid']):
                            is_structured = True
                    
                    if is_structured:
                        return {"valid": True, "message": "API密钥验证成功！连接正常（/models端点不存在，但API服务器有响应）。"}
                
                # Empty or HTML 404, try chat completions endpoint
                chat_url = f"{base_url.rstrip('/')}/chat/completions"
                
                try:
                    chat_response = await client.post(
                        chat_url,
                        headers=headers,
                        json={
                            "model": "gpt-3.5-turbo",
                            "messages": [{"role": "user", "content": "hi"}],
                            "max_tokens": 5
                        }
                    )
                    
                    # Any response except 401/403/404 means API is accessible
                    if chat_response.status_code == 401:
                        return {"valid": False, "message": "API密钥无效或已过期。"}
                    elif chat_response.status_code == 403:
                        return {"valid": False, "message": "API密钥权限不足。"}
                    elif chat_response.status_code == 404:
                        # Check if this 404 also has meaningful response
                        chat_error_body = chat_response.text[:1000] if chat_response.text else ""
                        if chat_error_body and len(chat_error_body.strip()) > 0:
                            is_structured = False
                            try:
                                json.loads(chat_error_body)
                                is_structured = True
                            except:
                                if not chat_error_body.strip().startswith('<') and any(keyword in chat_error_body.lower() for keyword in ['error', 'message', 'not found', 'invalid']):
                                    is_structured = True
                            
                            if is_structured:
                                return {"valid": True, "message": "API密钥验证成功！连接正常（端点路径可能需要调整，但API服务器有响应）。"}
                        
                        return {"valid": False, "message": "API端点不存在，请检查基础URL是否正确（例如：https://api.openai.com/v1）。"}
                    else:
                        # 200, 400, 500 etc - all indicate API is responding
                        return {"valid": True, "message": "API密钥验证成功！连接正常。"}
                        
                except Exception as chat_error:
                    logger.error(f"Chat completions request failed: {str(chat_error)}")
                    return {"valid": False, "message": f"API调用失败：无法连接到API端点。请检查基础URL是否正确。"}
            else:
                # Any other status code (400, 500, etc) means API is responding
                return {"valid": True, "message": "API密钥验证成功！连接正常。"}
                
    except httpx.TimeoutException:
        return {"valid": False, "message": f"连接超时：无法在30秒内连接到API服务器（{base_url}）。请检查网络连接和URL是否正确。"}
    except httpx.RequestError as e:
        return {"valid": False, "message": f"连接错误：{str(e)}。请检查基础URL格式是否正确。"}
    except Exception as e:
        logger.error(f"Unexpected error validating API key: {str(e)}", exc_info=True)
        return {"valid": False, "message": f"验证失败：{str(e)}"}


async def validate_anthropic(api_key: str, base_url: str):
    """Validate Anthropic API by calling messages endpoint"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "x-api-key": api_key,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            }
            
            # Try to call a simple messages endpoint
            messages_url = f"{base_url.rstrip('/')}/messages"
            response = await client.post(
                messages_url,
                headers=headers,
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 5,
                    "messages": [{"role": "user", "content": "hi"}]
                }
            )
            
            # Any response except 401/403/404 means API is accessible
            if response.status_code == 401:
                error_body = response.text[:500] if response.text else "No response body"
                return {"valid": False, "message": f"Anthropic API密钥无效或已过期，请检查密钥是否正确。详情：{error_body}"}
            elif response.status_code == 403:
                error_body = response.text[:500] if response.text else "No response body"
                return {"valid": False, "message": f"Anthropic API密钥权限不足。详情：{error_body}"}
            elif response.status_code == 404:
                error_body = response.text[:1000] if response.text else ""
                
                # If 404 has any meaningful response body, it means API is accessible
                if error_body and len(error_body.strip()) > 0:
                    is_structured = False
                    try:
                        import json
                        json.loads(error_body)
                        is_structured = True
                    except:
                        if not error_body.strip().startswith('<') and any(keyword in error_body.lower() for keyword in ['error', 'message', 'not found', 'invalid']):
                            is_structured = True
                    
                    if is_structured:
                        return {"valid": True, "message": "Anthropic API密钥验证成功！连接正常（端点路径可能需要调整，但API服务器有响应）。"}
                
                return {"valid": False, "message": f"Anthropic API调用失败：HTTP 404 - 端点不存在。请检查基础URL是否正确（应为：https://api.anthropic.com/v1）。详情：{error_body if error_body else 'No response body'}"}
            else:
                # 200, 400, 500 etc - all indicate API is responding
                return {"valid": True, "message": "Anthropic API密钥验证成功！连接正常。"}
                
    except httpx.TimeoutException:
        return {"valid": False, "message": f"连接超时：无法在30秒内连接到Anthropic API服务器（{base_url}）。"}
    except httpx.RequestError as e:
        return {"valid": False, "message": f"连接错误：{str(e)}"}
    except Exception as e:
        logger.error(f"Unexpected error validating Anthropic API key: {str(e)}", exc_info=True)
        return {"valid": False, "message": f"Anthropic验证失败：{str(e)}"}


async def validate_google(api_key: str, base_url: str):
    """Validate Google API by calling generative language API"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "x-goog-api-key": api_key,
                "Content-Type": "application/json",
            }
            
            # Try to call a simple generative language API endpoint
            models_url = f"{base_url.rstrip('/')}/models"
            response = await client.get(models_url, headers=headers)
            
            # Any response except 401/403/404 means API is accessible
            if response.status_code == 401:
                error_body = response.text[:500] if response.text else "No response body"
                return {"valid": False, "message": f"Google API密钥无效，请检查密钥是否正确。详情：{error_body}"}
            elif response.status_code == 403:
                error_body = response.text[:500] if response.text else "No response body"
                return {"valid": False, "message": f"Google API密钥权限不足或API未启用。详情：{error_body}"}
            elif response.status_code == 404:
                error_body = response.text[:1000] if response.text else ""
                
                # If 404 has any meaningful response body, it means API is accessible
                if error_body and len(error_body.strip()) > 0:
                    is_structured = False
                    try:
                        import json
                        json.loads(error_body)
                        is_structured = True
                    except:
                        if not error_body.strip().startswith('<') and any(keyword in error_body.lower() for keyword in ['error', 'message', 'not found', 'invalid']):
                            is_structured = True
                    
                    if is_structured:
                        return {"valid": True, "message": "Google API密钥验证成功！连接正常（端点路径可能需要调整，但API服务器有响应）。"}
                
                return {"valid": False, "message": f"Google API调用失败：HTTP 404 - 端点不存在。请检查基础URL是否正确。详情：{error_body if error_body else 'No response body'}"}
            else:
                # 200, 400, 500 etc - all indicate API is responding
                return {"valid": True, "message": "Google API密钥验证成功！连接正常。"}
                
    except httpx.TimeoutException:
        return {"valid": False, "message": f"连接超时：无法在30秒内连接到Google API服务器（{base_url}）。"}
    except httpx.RequestError as e:
        return {"valid": False, "message": f"连接错误：{str(e)}"}
    except Exception as e:
        logger.error(f"Unexpected error validating Google API key: {str(e)}", exc_info=True)
        return {"valid": False, "message": f"Google API验证失败：{str(e)}"}


# Ollama validation is handled by validate_openai_compatible as it's OpenAI-compatible
