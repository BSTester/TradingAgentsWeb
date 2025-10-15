#!/usr/bin/env python3
"""
TradingAgents Web Interface
FastAPI backend for the TradingAgents HTML interface
"""

import os
import sys
import asyncio
import json
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, validator
from dotenv import load_dotenv
import uvicorn

# Load environment variables
load_dotenv()

# Import TradingAgents components
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG
from cli.models import AnalystType

# Initialize FastAPI app
app = FastAPI(
    title="TradingAgents Web Interface",
    description="Multi-Agents LLM Financial Trading Framework - Web Interface",
    version="1.0.0"
)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="web/static"), name="static")
templates = Jinja2Templates(directory="web/templates")

# Global storage for analysis results (in production, use a proper database)
analysis_results = {}
active_analyses = {}

class AnalysisRequest(BaseModel):
    """Request model for trading analysis"""
    ticker: str
    analysis_date: str
    analysts: List[str]
    research_depth: int
    llm_provider: str
    backend_url: str
    shallow_thinker: str
    deep_thinker: str
    # API Keys
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    
    @validator('analysis_date')
    def validate_date(cls, v):
        try:
            analysis_date = datetime.strptime(v, '%Y-%m-%d')
            if analysis_date.date() > date.today():
                raise ValueError('Analysis date cannot be in the future')
            return v
        except ValueError as e:
            if 'Analysis date cannot be in the future' in str(e):
                raise e
            raise ValueError('Invalid date format. Use YYYY-MM-DD')
    
    @validator('analysts')
    def validate_analysts(cls, v):
        if not v:
            raise ValueError('At least one analyst must be selected')
        valid_analysts = [analyst.value for analyst in AnalystType]
        for analyst in v:
            if analyst not in valid_analysts:
                raise ValueError(f'Invalid analyst: {analyst}')
        return v

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Render the main interface"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/results/{analysis_id}", response_class=HTMLResponse)
async def results_page(request: Request, analysis_id: str):
    """Render the results page for a specific analysis"""
    return templates.TemplateResponse("results.html", {
        "request": request, 
        "analysis_id": analysis_id
    })

@app.get("/api/config")
async def get_config():
    """Get configuration options for the frontend"""
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
            {"value": "OpenAI", "label": "OpenAI", "url": "https://api.bstester.com/v1"},
            {"value": "Anthropic", "label": "Anthropic", "url": "https://api.anthropic.com/"},
            {"value": "Google", "label": "Google", "url": "https://generativelanguage.googleapis.com/v1"},
            {"value": "Openrouter", "label": "OpenRouter", "url": "https://openrouter.ai/api/v1"},
            {"value": "Ollama", "label": "Ollama", "url": "http://localhost:11434/v1"}
        ],
        "models": {
            "openai": {
                "shallow": [
                    {"value": "gpt-4o-mini", "label": "GPT-4o-mini - 快速高效，适合快速任务"},
                    {"value": "gpt-4.1-nano", "label": "GPT-4.1-nano - 超轻量模型，适合基本操作"},
                    {"value": "gpt-4.1-mini", "label": "GPT-4.1-mini - 紧凑模型，性能良好"},
                    {"value": "gpt-4o", "label": "GPT-4o - 标准模型，能力稳定"}
                ],
                "deep": [
                    {"value": "gpt-4.1-nano", "label": "GPT-4.1-nano - 超轻量模型，适合基本操作"},
                    {"value": "gpt-4.1-mini", "label": "GPT-4.1-mini - 紧凑模型，性能良好"},
                    {"value": "gpt-4o", "label": "GPT-4o - 标准模型，能力稳定"},
                    {"value": "o4-mini", "label": "o4-mini - 专业推理模型（紧凑版）"},
                    {"value": "o3-mini", "label": "o3-mini - 高级推理模型（轻量级）"},
                    {"value": "o3", "label": "o3 - 完整高级推理模型"},
                    {"value": "o1", "label": "o1 - 首屈一指的推理和问题解决模型"}
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
            "ollama": {
                "shallow": [
                    {"value": "llama3.1", "label": "llama3.1 本地"},
                    {"value": "llama3.2", "label": "llama3.2 本地"}
                ],
                "deep": [
                    {"value": "llama3.1", "label": "llama3.1 本地"},
                    {"value": "qwen3", "label": "qwen3"}
                ]
            }
        }
    }

@app.post("/api/validate-key")
async def validate_api_key(request: dict):
    """Validate API key for the selected provider"""
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

async def run_trading_analysis(analysis_id: str, request_data: AnalysisRequest):
    """Run the trading analysis in background"""
    try:
        # Update status
        active_analyses[analysis_id]["status"] = "initializing"
        active_analyses[analysis_id]["current_step"] = "设置配置"
        
        # Set API keys as environment variables based on the selected provider
        if request_data.openai_api_key and request_data.llm_provider.lower() == "openai":
            os.environ["OPENAI_API_KEY"] = request_data.openai_api_key
        elif request_data.anthropic_api_key and request_data.llm_provider.lower() == "anthropic":
            os.environ["ANTHROPIC_API_KEY"] = request_data.anthropic_api_key
        elif request_data.google_api_key and request_data.llm_provider.lower() == "google":
            os.environ["GOOGLE_API_KEY"] = request_data.google_api_key
        elif request_data.openrouter_api_key and request_data.llm_provider.lower() == "openrouter":
            os.environ["OPENROUTER_API_KEY"] = request_data.openrouter_api_key
        
        # Prepare config
        config = DEFAULT_CONFIG.copy()
        config["llm_provider"] = request_data.llm_provider.lower()
        config["deep_think_llm"] = request_data.deep_thinker
        config["quick_think_llm"] = request_data.shallow_thinker
        config["backend_url"] = request_data.backend_url
        config["max_debate_rounds"] = request_data.research_depth
        config["max_risk_discuss_rounds"] = request_data.research_depth
        
        # Convert analyst strings to AnalystType values
        analyst_types = []
        for analyst_str in request_data.analysts:
            for analyst_type in AnalystType:
                if analyst_type.value == analyst_str:
                    analyst_types.append(analyst_type.value)
                    break
        
        active_analyses[analysis_id]["status"] = "running"
        active_analyses[analysis_id]["current_step"] = "初始化TradingAgents图"
        
        # Initialize the graph
        graph = TradingAgentsGraph(analyst_types, config=config, debug=True)
        
        active_analyses[analysis_id]["current_step"] = "运行分析管道"
        
        # Run the analysis
        final_state, decision = graph.propagate(request_data.ticker, request_data.analysis_date)
        
        # Store results with better formatting
        formatted_final_state = {}
        if final_state:
            # Convert any complex objects to strings for JSON serialization
            for key, value in final_state.items():
                if isinstance(value, (str, int, float, bool, type(None))):
                    formatted_final_state[key] = value
                else:
                    formatted_final_state[key] = str(value)
        
        analysis_results[analysis_id] = {
            "status": "completed",
            "timestamp": datetime.now().isoformat(),
            "request": request_data.dict(),
            "final_state": formatted_final_state,
            "decision": str(decision) if decision else "No decision available",
            "error": None
        }
        
        # Update active analysis status
        active_analyses[analysis_id]["status"] = "completed"
        active_analyses[analysis_id]["current_step"] = "分析成功完成"
        
    except Exception as e:
        # Store error with full traceback for debugging
        import traceback
        error_details = {
            "message": str(e),
            "traceback": traceback.format_exc()
        }
        
        analysis_results[analysis_id] = {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "request": request_data.dict(),
            "final_state": None,
            "decision": None,
            "error": error_details
        }
        
        # Update active analysis status
        active_analyses[analysis_id]["status"] = "error"
        active_analyses[analysis_id]["current_step"] = f"错误: {str(e)}"

@app.post("/api/analyze")
async def start_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Start a new trading analysis"""
    
    # Generate analysis ID
    analysis_id = f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{request.ticker}"
    
    # Initialize tracking
    active_analyses[analysis_id] = {
        "status": "queued",
        "current_step": "分析已排队",
        "started_at": datetime.now().isoformat(),
        "request": request.dict()
    }
    
    # Start analysis in background
    background_tasks.add_task(run_trading_analysis, analysis_id, request)
    
    return {"analysis_id": analysis_id, "status": "queued"}

@app.get("/api/analysis/{analysis_id}/status")
async def get_analysis_status(analysis_id: str):
    """Get the status of an analysis"""
    if analysis_id in active_analyses:
        return active_analyses[analysis_id]
    elif analysis_id in analysis_results:
        return {"status": analysis_results[analysis_id]["status"]}
    else:
        raise HTTPException(status_code=404, detail="分析未找到")

@app.get("/api/analysis/{analysis_id}/results")
async def get_analysis_results(analysis_id: str):
    """Get the results of a completed analysis"""
    if analysis_id not in analysis_results:
        raise HTTPException(status_code=404, detail="分析未找到")
    
    result = analysis_results[analysis_id]
    if result["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"分析状态: {result['status']}")
    
    return result

@app.get("/api/analyses")
async def list_analyses():
    """List all analyses"""
    all_analyses = {}
    
    # Add completed analyses
    for analysis_id, result in analysis_results.items():
        all_analyses[analysis_id] = {
            "id": analysis_id,
            "status": result["status"],
            "timestamp": result["timestamp"],
            "ticker": result["request"]["ticker"],
            "analysis_date": result["request"]["analysis_date"]
        }
    
    # Add active analyses
    for analysis_id, analysis in active_analyses.items():
        if analysis_id not in all_analyses:
            all_analyses[analysis_id] = {
                "id": analysis_id,
                "status": analysis["status"],
                "timestamp": analysis["started_at"],
                "ticker": analysis["request"]["ticker"],
                "analysis_date": analysis["request"]["analysis_date"]
            }
    
    return {"analyses": list(all_analyses.values())}

if __name__ == "__main__":
    uvicorn.run(
        "web.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
