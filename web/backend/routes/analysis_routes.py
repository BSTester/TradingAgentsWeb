#!/usr/bin/env python3
"""
Analysis API Routes
分析相关的 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select, func
from datetime import datetime
from typing import Optional

from web.backend.database import get_db
from web.backend.models import User, AnalysisRecord
from web.backend.schemas import (
    AnalysisRequest, 
    AnalysisResponse, 
    AnalysisStatus
)
from web.backend.auth_routes import get_current_active_user
from web.backend.analysis_task import run_analysis_task
from web.backend.utils.market_detector import normalize_ticker, normalize_ticker_with_suffix, validate_ticker, detect_market

# 这些需要从 app_v2.py 导入
# 暂时使用占位符，稍后会修复
task_manager = None
manager = None

router = APIRouter(prefix="/api", tags=["analysis"])


@router.post("/analyze", response_model=AnalysisResponse)
async def start_analysis(
    request: AnalysisRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Start a new trading analysis (requires authentication)"""
    
    # 检查用户是否已有运行中的任务
    stmt = select(AnalysisRecord).filter(
        AnalysisRecord.user_id == current_user.id,
        AnalysisRecord.status.in_(["initializing", "running"])
    )
    result = await db.execute(stmt)
    running_analysis = result.scalars().first()
    
    if running_analysis:
        # 返回运行中的任务，前端会自动跳转到进度页面
        print(f"⚠️  用户 {current_user.id} 已有运行中的任务: {running_analysis.analysis_id}")
        return AnalysisResponse(
            analysis_id=running_analysis.analysis_id,
            status=running_analysis.status,
            message=f"您已有运行中的分析任务，已自动连接"
        )
    
    # Normalize and validate ticker
    ticker = normalize_ticker(request.ticker)
    
    if not validate_ticker(ticker):
        # 提供详细的错误信息
        error_msg = f"无效的股票代码格式: {request.ticker}\n\n"
        error_msg += "支持的格式：\n"
        error_msg += "• 美股：1-5个字母（如 AAPL、TSLA）\n"
        error_msg += "• 港股：4-5位数字或带.HK后缀（如 0700、00700.HK）\n"
        error_msg += "• A股沪市：600/601/603/605/688开头（如 600519、688001.SH）\n"
        error_msg += "• A股深市：000/001/002/300/301开头（如 000001、300750.SZ）"
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # 标准化股票代码（港股自动添加.HK后缀）
    ticker = normalize_ticker_with_suffix(ticker)
    
    # Detect market
    market = detect_market(ticker)
    
    # Generate analysis ID (use Beijing time)
    from pytz import timezone as pytz_timezone
    beijing_tz = pytz_timezone('Asia/Shanghai')
    now_beijing = datetime.now(beijing_tz)
    analysis_id = f"analysis_{now_beijing.strftime('%Y%m%d_%H%M%S')}_{ticker}_{current_user.id}"
    
    # Create analysis record
    analysis_record = AnalysisRecord(
        analysis_id=analysis_id,
        user_id=current_user.id,
        ticker=ticker,  # Use normalized ticker
        market=market,  # Auto-fill market field
        analysis_date=request.analysis_date,
        analysts=request.analysts,
        research_depth=request.research_depth,
        llm_provider=request.llm_provider,
        shallow_thinker=request.shallow_thinker,
        deep_thinker=request.deep_thinker,
        backend_url=request.backend_url,
        is_public=request.is_public,  # Save privacy setting
        status="queued",
        current_step="Analysis queued",
        progress_percentage=0.0
    )
    
    db.add(analysis_record)
    await db.commit()
    await db.refresh(analysis_record)
    
    # Convert request to dict (use normalized ticker)
    request_data = {
        'ticker': ticker,
        'analysis_date': request.analysis_date,
        'analysts': request.analysts,
        'research_depth': request.research_depth,
        'llm_provider': request.llm_provider,
        'shallow_thinker': request.shallow_thinker,
        'deep_thinker': request.deep_thinker,
        'backend_url': request.backend_url,
        'openai_api_key': request.openai_api_key,
        'anthropic_api_key': request.anthropic_api_key,
        'google_api_key': request.google_api_key,
        'openrouter_api_key': request.openrouter_api_key,
    }
    
    # Submit task to task manager
    submitted = task_manager.submit_task(
        analysis_id,
        current_user.id,
        run_analysis_task,
        analysis_id,
        current_user.id,
        request_data,
        manager,
        task_manager
    )
    
    if not submitted:
        # Task queued
        analysis_record.status = "queued"
        analysis_record.current_step = "等待队列中..."
        await db.commit()
    
    return AnalysisResponse(analysis_id=analysis_id, status="queued")


@router.post("/analysis/{analysis_id}/stop")
async def stop_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Stop a running analysis (requires authentication and ownership)"""
    stmt = select(AnalysisRecord).filter(
        AnalysisRecord.analysis_id == analysis_id,
        AnalysisRecord.user_id == current_user.id
    )
    result = await db.execute(stmt)
    analysis = result.scalars().first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析未找到")
    
    # 打印当前状态用于调试
    print(f"🛑 尝试停止分析: {analysis_id}, 当前状态: {analysis.status}")
    
    if analysis.status in ["completed", "error", "interrupted"]:
        raise HTTPException(status_code=400, detail=f"分析已结束，状态: {analysis.status}")
    
    # Stop the task
    stopped = task_manager.stop_task(analysis_id)
    
    if stopped:
        # 发送中断消息到 WebSocket
        import asyncio
        # Use Beijing time for timestamp
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone('Asia/Shanghai')
        now_beijing = datetime.now(beijing_tz)
        
        asyncio.create_task(manager.send_message({
            "type": "interrupted",
            "timestamp": now_beijing.isoformat(),
            "data": {
                "message": "分析已被用户中断"
            }
        }, analysis_id))
        
        # 关闭该分析的所有 WebSocket 连接
        asyncio.create_task(manager.close_connections(analysis_id))
        
        return {"message": "分析任务已中断", "analysis_id": analysis_id}
    else:
        raise HTTPException(status_code=404, detail="任务未找到或已完成")


@router.get("/analysis/{analysis_id}/status", response_model=AnalysisStatus)
async def get_analysis_status(
    analysis_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the status of an analysis (requires authentication and ownership)"""
    stmt = select(AnalysisRecord).filter(
        AnalysisRecord.analysis_id == analysis_id,
        AnalysisRecord.user_id == current_user.id
    )
    result = await db.execute(stmt)
    analysis = result.scalars().first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析未找到")
    
    return AnalysisStatus(
        analysis_id=analysis.analysis_id,
        status=analysis.status,
        current_step=analysis.current_step,
        progress_percentage=analysis.progress_percentage,
        started_at=analysis.started_at,
        updated_at=analysis.updated_at
    )


@router.get("/analysis/{analysis_id}/results")
async def get_analysis_results(
    analysis_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the results of a completed analysis (requires authentication and ownership)"""
    stmt = select(AnalysisRecord).filter(
        AnalysisRecord.analysis_id == analysis_id,
        AnalysisRecord.user_id == current_user.id
    )
    result = await db.execute(stmt)
    analysis = result.scalars().first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析未找到")
    
    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail=f"分析状态: {analysis.status}")
    
    # 构建 phases 数据结构（包含4个阶段）
    phases = []
    
    # 从 final_state 中提取数据（健壮化：统一解析为 dict）
    final_state = analysis.final_state or {}
    if isinstance(final_state, str):
        try:
            import json
            final_state = json.loads(final_state)
        except Exception:
            final_state = {}
    if not isinstance(final_state, dict):
        final_state = {}
    
    # 阶段1：分析师团队
    analyst_agents = []
    if analysis.market_analysis:
        analyst_agents.append({"name": "市场分析师", "result": analysis.market_analysis})
    if analysis.sentiment_analysis:
        analyst_agents.append({"name": "社交媒体分析师", "result": analysis.sentiment_analysis})
    if analysis.news_analysis:
        analyst_agents.append({"name": "新闻分析师", "result": analysis.news_analysis})
    if analysis.fundamentals_analysis:
        analyst_agents.append({"name": "基本面分析师", "result": analysis.fundamentals_analysis})
    
    if analyst_agents:
        phases.append({
            "id": 1,
            "name": "分析师团队",
            "icon": "fa-users",
            "color": "blue",
            "agents": analyst_agents
        })
    
    # 阶段2：研究团队
    research_agents = []
    if final_state.get("investment_debate_state"):
        debate_state = final_state["investment_debate_state"]
        # 从 history 中提取多头和空头的观点
        if debate_state.get("bull_history"):
            research_agents.append({"name": "多头研究员", "result": debate_state["bull_history"]})
        if debate_state.get("bear_history"):
            research_agents.append({"name": "空头研究员", "result": debate_state["bear_history"]})
        if debate_state.get("judge_decision"):
            research_agents.append({"name": "投资评审", "result": debate_state["judge_decision"]})
    
    if research_agents:
        phases.append({
            "id": 2,
            "name": "研究团队",
            "icon": "fa-search",
            "color": "green",
            "agents": research_agents
        })
    
    # 阶段3：交易团队
    if final_state.get("trader_investment_plan"):
        phases.append({
            "id": 3,
            "name": "交易团队",
            "icon": "fa-chart-line",
            "color": "purple",
            "agents": [
                {"name": "交易员", "result": final_state["trader_investment_plan"]}
            ]
        })
    
    # 阶段4：风险管理
    risk_agents = []
    if final_state.get("risk_debate_state"):
        risk_state = final_state["risk_debate_state"]
        # 从 history 中提取风险分析师的观点
        if risk_state.get("risky_history"):
            risk_agents.append({"name": "激进风险分析师", "result": risk_state["risky_history"]})
        if risk_state.get("neutral_history"):
            risk_agents.append({"name": "中性风险分析师", "result": risk_state["neutral_history"]})
        if risk_state.get("safe_history"):
            risk_agents.append({"name": "保守风险分析师", "result": risk_state["safe_history"]})
        if risk_state.get("judge_decision"):
            risk_agents.append({"name": "风险管理评审", "result": risk_state["judge_decision"]})
    
    if risk_agents:
        phases.append({
            "id": 4,
            "name": "风险管理",
            "icon": "fa-shield-alt",
            "color": "red",
            "agents": risk_agents
        })
    
    # 构建最终摘要（综合所有阶段的结论）
    final_summary = analysis.final_summary
    if not final_summary:
        # 如果没有 final_summary，从 final_state 构建完整摘要
        summary_parts = []
        
        # 添加投资决策
        if final_state.get("investment_plan"):
            summary_parts.append(f"## 投资决策\n\n{final_state['investment_plan']}")
        elif final_state.get("investment_debate_state", {}).get("judge_decision"):
            summary_parts.append(f"## 投资决策\n\n{final_state['investment_debate_state']['judge_decision']}")
        
        # 添加交易策略
        if final_state.get("trader_investment_plan"):
            summary_parts.append(f"## 交易策略\n\n{final_state['trader_investment_plan']}")
        
        # 添加风险评估
        if final_state.get("final_trade_decision"):
            summary_parts.append(f"## 最终交易决策\n\n{final_state['final_trade_decision']}")
        elif final_state.get("risk_debate_state", {}).get("judge_decision"):
            summary_parts.append(f"## 风险评估\n\n{final_state['risk_debate_state']['judge_decision']}")
        
        # 如果还是没有内容，使用各阶段的简要信息
        if not summary_parts:
            if analysis.market_analysis:
                summary_parts.append(f"**市场分析：**\n{analysis.market_analysis[:300]}...")
            if final_state.get("investment_debate_state", {}).get("judge_decision"):
                summary_parts.append(f"**投资建议：**\n{final_state['investment_debate_state']['judge_decision'][:300]}...")
            if final_state.get("trader_investment_plan"):
                summary_parts.append(f"**交易策略：**\n{final_state['trader_investment_plan'][:300]}...")
        
        final_summary = "\n\n".join(summary_parts) if summary_parts else analysis.trading_decision or "暂无分析摘要"
    
    # Return results in the format expected by frontend
    return {
        "ticker": analysis.ticker,
        "company_name": analysis.company_name,
        "market": analysis.market,
        "analysis_date": analysis.analysis_date,
        "trading_decision": analysis.trading_decision,
        "final_summary": final_summary,
        "phases": phases,
        "created_at": analysis.created_at,
        "completed_at": analysis.completed_at
    }


@router.get("/analyses")
async def list_analyses(
    page: int = 1,
    limit: int = 10,
    status_filter: Optional[str] = None,
    ticker_filter: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List user's analyses with pagination and filtering"""
    stmt = select(AnalysisRecord).filter(AnalysisRecord.user_id == current_user.id)
    
    # Apply filters
    if status_filter:
        stmt = stmt.filter(AnalysisRecord.status == status_filter)
    if ticker_filter:
        stmt = stmt.filter(AnalysisRecord.ticker.ilike(f"%{ticker_filter}%"))
    
    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * limit
    stmt = stmt.order_by(AnalysisRecord.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    analyses = result.scalars().all()
    
    return {
        "analyses": [
            {
                "id": analysis.analysis_id,
                "ticker": analysis.ticker,
                "company_name": analysis.company_name,
                "market": analysis.market,
                "analysis_date": analysis.analysis_date,
                "status": analysis.status,
                "progress_percentage": analysis.progress_percentage,
                "created_at": analysis.created_at,
                "updated_at": analysis.updated_at,
                "completed_at": analysis.completed_at,
                "is_public": analysis.is_public,
                "summary": {
                    "recommendation": analysis.trading_decision
                } if analysis.trading_decision else None
            }
            for analysis in analyses
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": offset + limit < total
    }


@router.get("/analysis/{analysis_id}/markdown")
async def get_analysis_markdown(
    analysis_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get analysis results in Markdown format - 包含所有阶段"""
    stmt = select(AnalysisRecord).filter(
        AnalysisRecord.analysis_id == analysis_id,
        AnalysisRecord.user_id == current_user.id
    )
    result = await db.execute(stmt)
    analysis = result.scalars().first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析未找到")
    
    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail=f"分析状态: {analysis.status}")
    
    final_state = analysis.final_state or {}
    if isinstance(final_state, str):
        try:
            import json
            final_state = json.loads(final_state)
        except Exception:
            final_state = {}
    if not isinstance(final_state, dict):
        final_state = {}
    
    # 构建完整的 Markdown 内容，按阶段顺序
    markdown_parts = []
    
    # 标题
    markdown_parts.append(f"# 股票分析报告 - {analysis.ticker}")
    markdown_parts.append(f"\n**分析日期**: {analysis.analysis_date}")
    markdown_parts.append(f"**完成时间**: {analysis.completed_at}")
    markdown_parts.append(f"**最终决策**: {analysis.trading_decision or '暂无'}\n")
    markdown_parts.append("---\n")
    
    # 阶段1：分析师团队
    markdown_parts.append("# 📊 分析师团队\n")
    
    if analysis.market_analysis:
        markdown_parts.append("## 市场分析师\n")
        markdown_parts.append(analysis.market_analysis + "\n")
    
    if analysis.sentiment_analysis:
        markdown_parts.append("## 社交媒体分析师\n")
        markdown_parts.append(analysis.sentiment_analysis + "\n")
    
    if analysis.news_analysis:
        markdown_parts.append("## 新闻分析师\n")
        markdown_parts.append(analysis.news_analysis + "\n")
    
    if analysis.fundamentals_analysis:
        markdown_parts.append("## 基本面分析师\n")
        markdown_parts.append(analysis.fundamentals_analysis + "\n")
    
    # 阶段2：研究团队
    if final_state.get("investment_debate_state"):
        markdown_parts.append("\n---\n\n# 🔍 研究团队\n")
        debate_state = final_state["investment_debate_state"]
        
        if debate_state.get("bull_history"):
            markdown_parts.append("## 多头研究员\n")
            markdown_parts.append(debate_state["bull_history"] + "\n")
        
        if debate_state.get("bear_history"):
            markdown_parts.append("## 空头研究员\n")
            markdown_parts.append(debate_state["bear_history"] + "\n")
        
        if debate_state.get("judge_decision"):
            markdown_parts.append("## 投资评审\n")
            markdown_parts.append(debate_state["judge_decision"] + "\n")
    
    # 阶段3：交易团队
    if final_state.get("trader_investment_plan"):
        markdown_parts.append("\n---\n\n# 📈 交易团队\n")
        markdown_parts.append("## 交易员\n")
        markdown_parts.append(final_state["trader_investment_plan"] + "\n")
    
    # 阶段4：风险管理
    if final_state.get("risk_debate_state"):
        markdown_parts.append("\n---\n\n# 🛡️ 风险管理\n")
        risk_state = final_state["risk_debate_state"]
        
        if risk_state.get("risky_history"):
            markdown_parts.append("## 激进风险分析师\n")
            markdown_parts.append(risk_state["risky_history"] + "\n")
        
        if risk_state.get("neutral_history"):
            markdown_parts.append("## 中性风险分析师\n")
            markdown_parts.append(risk_state["neutral_history"] + "\n")
        
        if risk_state.get("safe_history"):
            markdown_parts.append("## 保守风险分析师\n")
            markdown_parts.append(risk_state["safe_history"] + "\n")
        
        if risk_state.get("judge_decision"):
            markdown_parts.append("## 风险管理评审\n")
            markdown_parts.append(risk_state["judge_decision"] + "\n")
    
    # 最后：交易决策分析（final_summary）
    if final_state.get("investment_plan") or final_state.get("final_trade_decision"):
        markdown_parts.append("\n---\n\n# 📋 交易决策分析\n")
        
        if final_state.get("investment_plan"):
            markdown_parts.append("## 投资决策\n")
            markdown_parts.append(final_state["investment_plan"] + "\n")
        
        if final_state.get("trader_investment_plan"):
            markdown_parts.append("## 交易策略\n")
            markdown_parts.append(final_state["trader_investment_plan"] + "\n")
        
        if final_state.get("final_trade_decision"):
            markdown_parts.append("## 最终交易决策\n")
            markdown_parts.append(final_state["final_trade_decision"] + "\n")
    
    # 报告来源说明
    markdown_parts.append("\n---\n\n## 📌 报告来源说明\n")
    markdown_parts.append("**生成系统**: TradingAgents 多智能体分析系统\n")
    markdown_parts.append("**分析方法**: 本报告由多个专业智能体协同分析生成，包括基本面分析师、市场分析师、新闻分析师、社交媒体分析师、多空研究员、风险管理团队等。\n")
    
    # 免责声明
    markdown_parts.append("\n---\n\n## ⚠️ 免责声明\n")
    markdown_parts.append("本报告由AI智能体系统生成，仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。")
    markdown_parts.append("投资者应当根据自身风险承受能力、投资目标和财务状况，独立做出投资决策并自行承担投资风险。")
    markdown_parts.append("过往业绩不代表未来表现，市场波动可能导致本金损失。\n")
    
    markdown_content = "\n".join(markdown_parts)
    
    return {
        "content": markdown_content,
        "ticker": analysis.ticker,
        "analysis_date": analysis.analysis_date,
        "trading_decision": analysis.trading_decision
    }


@router.delete("/analysis/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an analysis record (requires authentication and ownership)"""
    stmt = select(AnalysisRecord).filter(
        AnalysisRecord.analysis_id == analysis_id,
        AnalysisRecord.user_id == current_user.id
    )
    result = await db.execute(stmt)
    analysis = result.scalars().first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析未找到")
    
    # 不允许删除正在运行的分析
    if analysis.status in ["initializing", "running"]:
        raise HTTPException(status_code=400, detail="无法删除正在运行的分析，请先停止")
    
    # 删除分析记录
    await db.delete(analysis)
    await db.commit()
    
    return {"message": "分析已删除", "analysis_id": analysis_id}


@router.get("/public/analysis/{analysis_id}/results")
async def get_public_analysis_results(
    analysis_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get the results of a completed analysis (public access for leaderboard)"""
    # 不需要鉴权，但只能查看公开的已完成分析
    stmt = select(AnalysisRecord).filter(
        AnalysisRecord.analysis_id == analysis_id,
        AnalysisRecord.status == "completed",  # 只允许查看已完成的分析
        AnalysisRecord.is_public == True  # 只允许查看公开的分析
    )
    result = await db.execute(stmt)
    analysis = result.scalars().first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="分析未找到、未完成或未公开")
    
    # 构建 phases 数据结构（与私有接口相同的逻辑）
    phases = []
    
    # 从 final_state 中提取数据
    final_state = analysis.final_state or {}
    if isinstance(final_state, str):
        try:
            import json
            final_state = json.loads(final_state)
        except Exception:
            final_state = {}
    if not isinstance(final_state, dict):
        final_state = {}
    
    # 阶段1：分析师团队
    analyst_agents = []
    if analysis.market_analysis:
        analyst_agents.append({"name": "市场分析师", "result": analysis.market_analysis})
    if analysis.sentiment_analysis:
        analyst_agents.append({"name": "社交媒体分析师", "result": analysis.sentiment_analysis})
    if analysis.news_analysis:
        analyst_agents.append({"name": "新闻分析师", "result": analysis.news_analysis})
    if analysis.fundamentals_analysis:
        analyst_agents.append({"name": "基本面分析师", "result": analysis.fundamentals_analysis})
    
    if analyst_agents:
        phases.append({
            "id": 1,
            "name": "分析师团队",
            "icon": "fa-users",
            "color": "blue",
            "agents": analyst_agents
        })
    
    # 阶段2：研究团队
    research_agents = []
    if final_state.get("investment_debate_state"):
        debate_state = final_state["investment_debate_state"]
        if debate_state.get("bull_history"):
            research_agents.append({"name": "多头研究员", "result": debate_state["bull_history"]})
        if debate_state.get("bear_history"):
            research_agents.append({"name": "空头研究员", "result": debate_state["bear_history"]})
        if debate_state.get("judge_decision"):
            research_agents.append({"name": "投资评审", "result": debate_state["judge_decision"]})
    
    if research_agents:
        phases.append({
            "id": 2,
            "name": "研究团队",
            "icon": "fa-search",
            "color": "green",
            "agents": research_agents
        })
    
    # 阶段3：交易团队
    if final_state.get("trader_investment_plan"):
        phases.append({
            "id": 3,
            "name": "交易团队",
            "icon": "fa-chart-line",
            "color": "purple",
            "agents": [
                {"name": "交易员", "result": final_state["trader_investment_plan"]}
            ]
        })
    
    # 阶段4：风险管理
    risk_agents = []
    if final_state.get("risk_debate_state"):
        risk_state = final_state["risk_debate_state"]
        if risk_state.get("risky_history"):
            risk_agents.append({"name": "激进风险分析师", "result": risk_state["risky_history"]})
        if risk_state.get("neutral_history"):
            risk_agents.append({"name": "中性风险分析师", "result": risk_state["neutral_history"]})
        if risk_state.get("safe_history"):
            risk_agents.append({"name": "保守风险分析师", "result": risk_state["safe_history"]})
        if risk_state.get("judge_decision"):
            risk_agents.append({"name": "风险管理评审", "result": risk_state["judge_decision"]})
    
    if risk_agents:
        phases.append({
            "id": 4,
            "name": "风险管理",
            "icon": "fa-shield-alt",
            "color": "red",
            "agents": risk_agents
        })
    
    # 构建最终摘要
    final_summary = analysis.final_summary
    if not final_summary:
        summary_parts = []
        
        if final_state.get("investment_plan"):
            summary_parts.append(f"## 投资决策\n\n{final_state['investment_plan']}")
        elif final_state.get("investment_debate_state", {}).get("judge_decision"):
            summary_parts.append(f"## 投资决策\n\n{final_state['investment_debate_state']['judge_decision']}")
        
        if final_state.get("trader_investment_plan"):
            summary_parts.append(f"## 交易策略\n\n{final_state['trader_investment_plan']}")
        
        if final_state.get("final_trade_decision"):
            summary_parts.append(f"## 最终交易决策\n\n{final_state['final_trade_decision']}")
        elif final_state.get("risk_debate_state", {}).get("judge_decision"):
            summary_parts.append(f"## 风险评估\n\n{final_state['risk_debate_state']['judge_decision']}")
        
        if not summary_parts:
            if analysis.market_analysis:
                summary_parts.append(f"**市场分析：**\n{analysis.market_analysis[:300]}...")
            if final_state.get("investment_debate_state", {}).get("judge_decision"):
                summary_parts.append(f"**投资建议：**\n{final_state['investment_debate_state']['judge_decision'][:300]}...")
            if final_state.get("trader_investment_plan"):
                summary_parts.append(f"**交易策略：**\n{final_state['trader_investment_plan'][:300]}...")
        
        final_summary = "\n\n".join(summary_parts) if summary_parts else analysis.trading_decision or "暂无分析摘要"
    
    # Return results
    return {
        "ticker": analysis.ticker,
        "company_name": analysis.company_name,
        "market": analysis.market,
        "analysis_date": analysis.analysis_date,
        "trading_decision": analysis.trading_decision,
        "final_summary": final_summary,
        "phases": phases,
        "created_at": analysis.created_at,
        "completed_at": analysis.completed_at
    }


def init_analysis_routes(app_task_manager, app_manager):
    """Initialize routes with dependencies from main app"""
    global task_manager, manager
    task_manager = app_task_manager
    manager = app_manager
