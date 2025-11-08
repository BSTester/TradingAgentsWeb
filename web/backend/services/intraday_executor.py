#!/usr/bin/env python3
"""
Intraday Trading Executor

This module executes a single intraday trading analysis session.
It creates a decision record, invokes the LangGraph agent, and saves results.

Architecture:
    IntradayScheduler (intraday_scheduler.py)
        └── Calls execute_intraday_analysis() (this file)
            └── Invokes LangGraph agent (intraday_trader.py)
                └── Agent autonomously calls tools and makes decisions
                    └── Returns decision report and trades

Workflow:
    1. Create decision record in database
    2. Get user's LLM configuration
    3. Create LLM instance
    4. Create and invoke LangGraph agent
    5. Extract decision report and trades from agent result
    6. Update decision record with results
    7. Send WebSocket notification

Usage:
    from web.backend.services.intraday_executor import execute_intraday_analysis
    
    result = await execute_intraday_analysis(
        market_type="US",
        user_id=1
    )
"""

import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

# Import will be done at runtime to avoid circular dependencies
# from web.backend.database import SessionLocal
# from web.backend.models import IntradayDecisionRecord, PositionRecord, TradingHistory


async def execute_intraday_analysis(
    market_type: str = "US",
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute intraday trading analysis for a user.
    
    Args:
        market_type: Market to analyze (US/HK/CN)
        user_id: User ID (None for system-wide analysis)
        
    Returns:
        Dict with execution results
    """
    session_id = f"intraday_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    
    logging.info(f"Starting intraday analysis: session={session_id}, market={market_type}, user={user_id}")

    # WebSocket: announce session start
    try:
        from web.backend.app import manager as ws_manager
        import asyncio
        asyncio.create_task(ws_manager.send_message({
            'type': 'intraday_session_start',
            'timestamp': datetime.utcnow().isoformat(),
            'message': 'Intraday session started',
        }, session_id))
    except Exception:
        pass
    
    try:
        # Import here to avoid circular dependencies
        from web.backend.database import SessionLocal
        from web.backend.models import IntradayDecisionRecord, PositionRecord
        from tradingagents.default_config import DEFAULT_CONFIG
        from tradingagents.agents.trader.intraday_trader import create_intraday_trader
        from langchain_openai import ChatOpenAI
        from langchain_anthropic import ChatAnthropic
        from langchain_google_genai import ChatGoogleGenerativeAI
        import os
        
        # Create database session
        db = SessionLocal()
        
        try:
            # Create decision record
            decision_record = IntradayDecisionRecord(
                user_id=user_id or 1,  # Default to user 1 if not specified
                session_id=session_id,
                start_time=datetime.now(),
                status="running",
                market_type=market_type,
                positions_analyzed=[],
                account_snapshot={},
            )
            db.add(decision_record)
            db.commit()
            
            # Get user's LLM configuration (with fallback to analysis config)
            from web.backend.models import UserConfig
            from sqlalchemy import select
            
            user_config = None
            if user_id:
                result = db.execute(
                    select(UserConfig).where(UserConfig.user_id == user_id)
                )
                user_config = result.scalar_one_or_none()
            
            # Determine LLM configuration (intraday config -> analysis config -> env/default)
            if user_config and user_config.intraday_llm_provider:
                llm_provider = user_config.intraday_llm_provider
                api_key = user_config.intraday_api_key
                model_name = user_config.intraday_llm_model or user_config.last_deep_thinker
                backend_url = user_config.intraday_backend_url
            elif user_config and user_config.last_llm_provider:
                llm_provider = user_config.last_llm_provider
                api_key = user_config.last_api_key
                model_name = user_config.last_deep_thinker
                backend_url = user_config.last_backend_url
            else:
                llm_provider = DEFAULT_CONFIG.get("llm_provider", "openai")
                api_key = None
                model_name = DEFAULT_CONFIG.get("deep_think_llm", "gpt-4o-mini")
                backend_url = DEFAULT_CONFIG.get("backend_url")
            
            # Create LLM instance
            if llm_provider in ("openai", "ollama", "openrouter", "oneai", "deepseek", "qwen"):
                llm = ChatOpenAI(
                    model=model_name,
                    temperature=0.1,
                    api_key=api_key or os.getenv("OPENAI_API_KEY"),
                    base_url=backend_url or DEFAULT_CONFIG.get("backend_url"),
                )
            elif llm_provider == "anthropic":
                llm = ChatAnthropic(
                    model=model_name,
                    temperature=0.1,
                    api_key=api_key or os.getenv("ANTHROPIC_API_KEY"),
                )
            elif llm_provider == "google":
                llm = ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=0.1,
                    google_api_key=api_key or os.getenv("GOOGLE_API_KEY"),
                )
            else:
                raise ValueError(f"Unsupported LLM provider: {llm_provider}")
            
            # Create intraday trader agent
            logging.info(f"Creating LangGraph agent with provider={llm_provider}, model={model_name}")
            
            memory = None  # Can add memory if needed
            trader_agent = create_intraday_trader(llm, memory)
            
            # Prepare initial state
            # Note: Agent has comprehensive system prompt with detailed instructions
            # We only need a simple trigger message to start the conversation
            from langchain_core.messages import HumanMessage
            
            initial_state = {
                "user_id": user_id,
                "market_type": market_type,
                "session_id": session_id,
                "messages": [
                    HumanMessage(content="开始分析")  # Simple trigger - agent knows what to do from system prompt
                ],
            }
            
            # Execute agent - it will autonomously call tools and make decisions
            logging.info(f"Invoking intraday trader agent for session {session_id}, market={market_type}")
            # Set recursion limit to 100 to allow more tool calls
            # Default is 25, but intraday trading may need more iterations
            result = trader_agent.invoke(
                initial_state,
                config={"recursion_limit": 100}
            )
            
            # Extract results from agent execution
            decision_report = result.get("decision_report", "")
            trades_executed = result.get("trades_executed", [])
            
            logging.info(f"Agent execution completed. Report length: {len(decision_report)} chars")
            logging.info(f"Trades executed: {len(trades_executed) if trades_executed else 0}")
            
            # If decision_report is empty, try to extract from messages
            if not decision_report:
                messages = result.get("messages", [])
                logging.warning(f"Decision report is empty. Checking {len(messages)} messages...")
                
                # Find the last AI message (should be the final report)
                for msg in reversed(messages):
                    if hasattr(msg, 'content') and isinstance(msg.content, str):
                        # Check if this looks like a report (has markdown headers or substantial content)
                        if any(marker in msg.content for marker in ["#", "##", "Analysis", "Summary", "Decision"]):
                            decision_report = msg.content
                            logging.info(f"Extracted decision report from message (length: {len(decision_report)} chars)")
                            break
                
                # If still empty, use the last message content
                if not decision_report and messages:
                    last_msg = messages[-1]
                    if hasattr(last_msg, 'content'):
                        decision_report = last_msg.content
                        logging.info(f"Using last message as decision report (length: {len(decision_report)} chars)")
            
            # Extract account and position info from agent's tool calls if available
            # The agent will have called these tools during execution
            account_info = {}
            positions = []
            
            # Try to extract from messages/tool results in the state
            messages = result.get("messages", [])
            for msg in messages:
                if hasattr(msg, 'content'):
                    content = msg.content
                    # Try to parse tool results from message content
                    if isinstance(content, str):
                        if "total_assets" in content.lower() or "available_funds" in content.lower():
                            # This might be account info
                            try:
                                import re
                                # Simple extraction - could be enhanced
                                if "Total Assets" in content:
                                    match = re.search(r'Total Assets:\s*\$?([\d,]+\.?\d*)', content)
                                    if match:
                                        account_info['total_assets'] = float(match.group(1).replace(',', ''))
                            except:
                                pass
                        if "positions" in content.lower() or "stock" in content.lower():
                            # This might contain position info
                            # For now, just note that positions were analyzed
                            pass

            # Update decision record
            decision_record.end_time = datetime.now()
            decision_record.status = "completed"
            decision_record.decision_report = decision_report
            decision_record.trades_executed = trades_executed if trades_executed else []

            # Persist snapshots if available from agent execution
            decision_record.positions_analyzed = positions if isinstance(positions, list) else []
            decision_record.account_snapshot = account_info if account_info else {}

            # Log what we're saving
            logging.info(f"Saving decision record:")
            logging.info(f"  - Report length: {len(decision_report)} chars")
            logging.info(f"  - Trades: {len(trades_executed) if trades_executed else 0}")
            logging.info(f"  - Positions analyzed: {len(positions) if positions else 0}")
            logging.info(f"  - Account snapshot keys: {list(account_info.keys()) if account_info else []}")
            
            # Verify report is not empty
            if not decision_report or len(decision_report) < 100:
                logging.warning(f"Decision report seems too short or empty: '{decision_report[:200]}'")

            db.commit()
            logging.info(f"Decision record saved to database (ID: {decision_record.id})")

            # WebSocket: announce session complete with summary only (not full report)
            try:
                from web.backend.app import manager as ws_manager
                import asyncio
                
                # Extract summary from report (first few lines or key metrics)
                report_summary = ""
                if decision_report:
                    # Get first 200 characters or first paragraph
                    lines = decision_report.split('\n')
                    summary_lines = []
                    char_count = 0
                    for line in lines:
                        if char_count > 200:
                            break
                        summary_lines.append(line)
                        char_count += len(line)
                    report_summary = '\n'.join(summary_lines[:5])  # Max 5 lines
                    if len(decision_report) > 200:
                        report_summary += "\n..."
                
                # Prepare lightweight decision record data for WebSocket
                # Only include summary information, not the full report
                decision_summary = {
                    'id': decision_record.id,
                    'session_id': decision_record.session_id,
                    'start_time': decision_record.start_time.isoformat(),
                    'end_time': decision_record.end_time.isoformat() if decision_record.end_time else None,
                    'status': decision_record.status,
                    'market_type': decision_record.market_type,
                    'positions_count': len(decision_record.positions_analyzed) if decision_record.positions_analyzed else 0,
                    'trades_count': len(decision_record.trades_executed) if decision_record.trades_executed else 0,
                    'report_summary': report_summary,  # Brief summary only
                    'created_at': decision_record.created_at.isoformat(),
                }
                
                # Send to user-specific channel
                channel_id = f"intraday_user_{user_id}"
                asyncio.create_task(ws_manager.send_message({
                    'type': 'intraday_session_complete',
                    'timestamp': datetime.utcnow().isoformat(),
                    'message': f'分析完成 - {decision_summary["trades_count"]} 笔交易',
                    'decision_record': decision_summary,  # Summary only, not full report
                }, channel_id))
            except Exception as ws_error:
                logging.warning(f"Failed to send WebSocket notification: {ws_error}")
            
            logging.info(f"Analysis completed successfully: session_id={session_id}")
            
            return {
                "status": "success",
                "session_id": session_id,
                "decision_record_id": decision_record.id,
                "trades_count": len(trades_executed) if trades_executed else 0,
            }
        
        finally:
            db.close()
    
    except Exception as e:
        logging.error(f"Error executing intraday analysis: {e}", exc_info=True)
        
        # Try to update decision record with error
        try:
            from web.backend.database import SessionLocal
            from web.backend.models import IntradayDecisionRecord
            
            db = SessionLocal()
            try:
                decision_record = db.query(IntradayDecisionRecord).filter(
                    IntradayDecisionRecord.session_id == session_id
                ).first()
                
                if decision_record:
                    decision_record.end_time = datetime.now()
                    decision_record.status = "failed"
                    decision_record.decision_report = f"Error: {str(e)}"
                    db.commit()
            finally:
                db.close()
        except Exception as db_error:
            logging.error(f"Error updating decision record: {db_error}")
        
        # WebSocket: announce session error
        try:
            from web.backend.app import manager as ws_manager
            import asyncio
            
            # Send to user-specific channel
            channel_id = f"intraday_user_{user_id}"
            asyncio.create_task(ws_manager.send_message({
                'type': 'intraday_session_error',
                'timestamp': datetime.utcnow().isoformat(),
                'message': f'Intraday session error: {str(e)}',
                'session_id': session_id,
            }, channel_id))
        except Exception:
            pass

        return {
            "status": "error",
            "session_id": session_id,
            "error": str(e),
        }


def update_position_records(db: Session, user_id: int, trades: list):
    """
    Update position records based on executed trades.
    
    Args:
        db: Database session
        user_id: User ID
        trades: List of trade dictionaries
    """
    from web.backend.models import PositionRecord, TradingHistory
    
    for trade in trades:
        stock_code = trade.get("stock_code")
        trade_type = trade.get("trade_type")  # BUY/SELL
        quantity = trade.get("quantity")
        price = trade.get("price")
        market_type = trade.get("market_type")
        
        if not all([stock_code, trade_type, quantity, price]):
            logging.warning(f"Incomplete trade data: {trade}")
            continue
        
        # Find or create position record
        position = db.query(PositionRecord).filter(
            PositionRecord.user_id == user_id,
            PositionRecord.stock_code == stock_code,
            PositionRecord.is_closed == False,
        ).first()
        
        if trade_type == "BUY":
            if position is None:
                # Create new position
                position = PositionRecord(
                    user_id=user_id,
                    stock_code=stock_code,
                    market_type=market_type,
                    first_open_time=datetime.now(),
                    first_open_price=price,
                    initial_quantity=quantity,
                    current_quantity=quantity,
                    last_update_time=datetime.now(),
                )
                db.add(position)
            else:
                # Add to existing position
                position.current_quantity += quantity
                position.last_update_time = datetime.now()
        
        elif trade_type == "SELL":
            if position is None:
                logging.warning(f"Trying to sell non-existent position: {stock_code}")
                continue
            
            # Reduce position
            position.current_quantity -= quantity
            position.last_update_time = datetime.now()
            
            # Close position if fully sold
            if position.current_quantity <= 0:
                position.is_closed = True
                position.current_quantity = 0
        
        # Create trading history record
        history = TradingHistory(
            position_record_id=position.id if position.id else None,
            trade_time=datetime.now(),
            trade_type=trade_type,
            quantity=quantity,
            price=price,
            order_id=trade.get("order_id"),
            decision_reason=trade.get("reason"),
            technical_signals=trade.get("technical_signals"),
            news_sentiment=trade.get("news_sentiment"),
        )
        db.add(history)
    
    db.commit()
    logging.info(f"Updated position records for {len(trades)} trades")
