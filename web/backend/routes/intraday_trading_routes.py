#!/usr/bin/env python3
"""
Intraday Trading API Routes
短线交易系统相关�?API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from web.backend.database import get_db
from web.backend.models import User, IntradayDecisionRecord, PositionRecord, TradingHistory
from web.backend.auth_routes import get_current_active_user, require_intraday_access
from pydantic import BaseModel, Field

# Get logger for this module
logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/intraday", tags=["intraday-trading"])


# ============================================================================
# Pydantic Models for Request/Response
# ============================================================================

class SchedulerControlRequest(BaseModel):
    """Request to control scheduler"""
    action: str  # "start" or "stop"


class SchedulerConfigRequest(BaseModel):
    """Request to configure scheduler"""
    interval_minutes: int = Field(..., ge=5, le=120, description="分析间隔（分钟），范围：5-120，默认60")
    market_type: Optional[str] = "US,HK,CN"  # Single market (US/HK/CN) or comma-separated (US,HK,CN)


class SchedulerStatusResponse(BaseModel):
    """Scheduler status response"""
    is_running: bool
    interval_minutes: int
    market_type: str
    market_status: str
    market_is_open: bool
    next_run_time: Optional[str]
    current_time: str


class DecisionRecordResponse(BaseModel):
    """Decision record response"""
    id: int
    session_id: str
    start_time: datetime
    end_time: Optional[datetime]
    status: str
    market_type: str
    positions_analyzed: list
    account_snapshot: Optional[dict] = None
    decision_report: Optional[str] = None
    trades_executed: Optional[list] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class PositionRecordResponse(BaseModel):
    """Position record response"""
    id: int
    stock_code: str
    market_type: str
    first_open_time: datetime
    first_open_price: float
    initial_quantity: int
    current_quantity: int
    last_update_time: datetime
    is_closed: bool
    holding_days: Optional[int] = None
    
    class Config:
        from_attributes = True


class TradingHistoryResponse(BaseModel):
    """Trading history response"""
    id: int
    position_record_id: int
    trade_time: datetime
    trade_type: str
    quantity: int
    price: float
    order_id: Optional[str]
    decision_reason: Optional[str]
    
    class Config:
        from_attributes = True


# ============================================================================
# Helper Functions
# ============================================================================

async def sync_positions_to_db(
    db: AsyncSession,
    user_id: int,
    futu_positions: list,
    market: str
):
    """
    Sync Futu API positions to database.
    
    - Creates new position records for new positions
    - Updates existing position records if quantity changed
    - Marks positions as closed if they no longer exist in Futu API
    """
    from sqlalchemy import select
    
    # Get current positions from database for this market
    result = await db.execute(
        select(PositionRecord).where(
            PositionRecord.user_id == user_id,
            PositionRecord.market_type == market,
            PositionRecord.is_closed == False
        )
    )
    db_positions = {pos.stock_code: pos for pos in result.scalars().all()}
    
    # Get stock codes from Futu API
    futu_stock_codes = {pos.get('stock_code', '') for pos in futu_positions}
    
    # Process each Futu position
    for futu_pos in futu_positions:
        stock_code = futu_pos.get('stock_code', '')
        if not stock_code:
            continue
        
        quantity = int(float(futu_pos.get('quantity', 0)))
        cost_price = float(futu_pos.get('cost_price', 0))
        
        if stock_code in db_positions:
            # Update existing position
            db_pos = db_positions[stock_code]
            
            # Check if quantity changed
            if db_pos.current_quantity != quantity:
                db_pos.current_quantity = quantity
                db_pos.last_update_time = datetime.now()
                
                # If quantity is 0, mark as closed
                if quantity == 0:
                    db_pos.is_closed = True
        else:
            # Create new position record
            if quantity > 0:  # Only create if there's actual quantity
                new_position = PositionRecord(
                    user_id=user_id,
                    stock_code=stock_code,
                    market_type=market,
                    first_open_time=datetime.now(),
                    first_open_price=cost_price,
                    initial_quantity=quantity,
                    current_quantity=quantity,
                    last_update_time=datetime.now(),
                    is_closed=False
                )
                db.add(new_position)
    
    # Mark positions as closed if they no longer exist in Futu API
    for stock_code, db_pos in db_positions.items():
        if stock_code not in futu_stock_codes and not db_pos.is_closed:
            db_pos.is_closed = True
            db_pos.current_quantity = 0
            db_pos.last_update_time = datetime.now()
    
    # Commit all changes
    await db.commit()


# ============================================================================
# Scheduler Control Endpoints
# ============================================================================

@router.post("/scheduler/control")
async def control_scheduler(
    request: SchedulerControlRequest,
    current_user: User = Depends(require_intraday_access),
    app_request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Start or stop the intraday trading scheduler for current user.
    
    Requires authentication and Futu API configuration.
    """
    try:
        from web.backend.services.user_intraday_scheduler import get_manager
        from web.backend.models import UserConfig
        from sqlalchemy import select
        
        manager = get_manager()
        user_id = current_user.id
        
        # Get user config
        result = await db.execute(
            select(UserConfig).where(UserConfig.user_id == user_id)
        )
        user_config = result.scalar_one_or_none()
        
        if request.action == "start":
            logger.info(f"Starting scheduler for user {user_id}")
            
            # Get or create user config
            if not user_config:
                user_config = UserConfig(user_id=user_id)
                db.add(user_config)
                await db.commit()
                await db.refresh(user_config)
            
            # Check if Futu API is configured (fallback to analysis config)
            futu_api_url = user_config.intraday_futu_api_url or user_config.futu_api_base_url
            
            if not futu_api_url:
                logger.error(f"No Futu API URL configured for user {user_id}")
                raise HTTPException(
                    status_code=400,
                    detail="请先配置富途API地址"
                )
            
            # Create scheduler if doesn't exist
            if not manager.has_scheduler(user_id):
                # Get market type, default to all markets if not set
                market_type = user_config.intraday_market_type
                if not market_type:
                    market_type = "US,HK,CN"
                    user_config.intraday_market_type = "US,HK,CN"
                    await db.commit()
                
                await manager.create_scheduler(
                    user_id=user_id,
                    interval_minutes=user_config.intraday_interval_minutes or 60,
                    market_type=market_type,
                    futu_api_url=futu_api_url,
                )
            
            # Start scheduler
            success = await manager.start_scheduler(user_id)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to start scheduler")
            
            # Update user config
            user_config.intraday_scheduler_enabled = True
            user_config.intraday_scheduler_auto_start = True  # Mark for auto-restart on service restart
            await db.commit()
            
            # Broadcast status update via WebSocket
            try:
                status = manager.get_scheduler_status(user_id)
                if status:
                    from web.backend.app import manager as ws_manager
                    import asyncio
                    channel_id = f"intraday_user_{user_id}"
                    
                    # Send action confirmation message
                    asyncio.create_task(ws_manager.send_message({
                        'type': 'scheduler_started',
                        'timestamp': status.get('current_time'),
                        'status': status,
                        'message': 'Scheduler started successfully',
                    }, channel_id))
                    
    
            except Exception as ws_error:
                logger.warning(f"Failed to broadcast scheduler status: {ws_error}")
            
            return {"status": "success", "message": "Scheduler started"}
        
        elif request.action == "stop":
            # Stop scheduler
            success = await manager.stop_scheduler(user_id)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to stop scheduler")
            
            # Update user config
            if user_config:
                user_config.intraday_scheduler_enabled = False
                user_config.intraday_scheduler_auto_start = False  # Clear auto-restart flag (manual stop)
                await db.commit()
            
            # Broadcast stopped status via WebSocket
            try:
                # Get stopped status
                status = manager.get_scheduler_status(user_id)
                
                # If scheduler was removed, create stopped status
                if not status:
                    status = {
                        "is_running": False,
                        "interval_minutes": user_config.intraday_interval_minutes if user_config else 60,
                        "market_type": user_config.intraday_market_type if user_config else "US,HK,CN",
                        "market_status": "Scheduler stopped",
                        "market_is_open": False,
                        "markets_status": {},
                        "next_run_time": None,
                        "current_time": datetime.now().isoformat(),
                    }
                
                from web.backend.app import manager as ws_manager
                import asyncio
                channel_id = f"intraday_user_{user_id}"
                
                # Send action confirmation message
                asyncio.create_task(ws_manager.send_message({
                    'type': 'scheduler_stopped',
                    'timestamp': status.get('current_time'),
                    'status': status,
                    'message': 'Scheduler stopped successfully',
                }, channel_id))
                

            except Exception as ws_error:
                logger.warning(f"Failed to broadcast scheduler stopped status: {ws_error}")
            
            return {"status": "success", "message": "Scheduler stopped"}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Use 'start' or 'stop'")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# DEPRECATED: This endpoint has been replaced by WebSocket 'scheduler_status_sync' message
# The status is now pushed via WebSocket on connection and updates
# Keeping this commented for reference only
#
# @router.get("/scheduler/status", response_model=SchedulerStatusResponse)
# async def get_scheduler_status(
#     current_user: User = Depends(get_current_active_user),
#     db: AsyncSession = Depends(get_db),
# ):
#     """
#     DEPRECATED: Use WebSocket 'scheduler_status_sync' message instead.
#     This endpoint is no longer used by the frontend.
#     """
#     pass


class IntradayConfigRequest(BaseModel):
    """Request to configure intraday trading"""
    futu_api_url: Optional[str] = None
    futu_api_key: Optional[str] = None
    interval_minutes: Optional[int] = None
    market_type: Optional[str] = None
    llm_provider: Optional[str] = None
    api_key: Optional[str] = None
    llm_model: Optional[str] = None  # Single model (uses deep thinker options from analysis config)
    backend_url: Optional[str] = None


@router.get("/scheduler/config")
async def get_scheduler_config(
    current_user: User = Depends(require_intraday_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get intraday trading configuration for current user.
    
    If no separate intraday config exists, falls back to analysis config.
    
    Requires authentication.
    """
    try:
        from web.backend.models import UserConfig
        from sqlalchemy import select
        
        # Get user config
        result = await db.execute(
            select(UserConfig).where(UserConfig.user_id == current_user.id)
        )
        user_config = result.scalar_one_or_none()
        
        if not user_config:
            # Return default config
            return {
                "futu_api_url": None,
                "futu_api_key": None,
                "interval_minutes": 5,
                "market_type": "US,HK,CN",  # Default to all markets (comma-separated)
                "llm_provider": None,
                "api_key": None,
                "backend_url": None,
                "is_using_analysis_config": False,
            }
        
        # Priority: Use saved intraday config first, fallback to analysis config
        # For each field, check if intraday config exists, if not use analysis config
        futu_api_url = user_config.intraday_futu_api_url or user_config.futu_api_base_url
        futu_api_key = user_config.intraday_futu_api_key or user_config.futu_api_key
        llm_provider = user_config.intraday_llm_provider or user_config.last_llm_provider
        api_key = user_config.intraday_api_key or user_config.last_api_key
        llm_model = user_config.intraday_llm_model or user_config.last_deep_thinker
        backend_url = user_config.intraday_backend_url or user_config.last_backend_url
        
        # Determine if using analysis config (all intraday fields are empty)
        is_using_analysis_config = not any([
            user_config.intraday_futu_api_url,
            user_config.intraday_futu_api_key,
            user_config.intraday_llm_provider,
            user_config.intraday_api_key,
            user_config.intraday_llm_model,
            user_config.intraday_backend_url
        ])
        
        return {
            "futu_api_url": futu_api_url,
            "futu_api_key": futu_api_key,  # Return actual key for validation
            "has_futu_api_key": bool(futu_api_key),  # Indicate if key exists
            "interval_minutes": user_config.intraday_interval_minutes or 60,
            "market_type": user_config.intraday_market_type or "US,HK,CN",  # Default to all markets (comma-separated)
            "llm_provider": llm_provider,
            "api_key": api_key,
            "has_api_key": bool(api_key),
            "llm_model": llm_model,  # Single model (deep thinker options)
            "backend_url": backend_url,
            "is_using_analysis_config": is_using_analysis_config,  # Indicates if using fallback config
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduler/config")
async def configure_scheduler(
    config: IntradayConfigRequest,
    current_user: User = Depends(require_intraday_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Configure intraday trading settings for current user.
    
    Requires authentication.
    """
    try:
        from web.backend.services.user_intraday_scheduler import get_manager
        from web.backend.models import UserConfig
        from sqlalchemy import select
        
        manager = get_manager()
        user_id = current_user.id
        
        # Get or create user config
        result = await db.execute(
            select(UserConfig).where(UserConfig.user_id == user_id)
        )
        user_config = result.scalar_one_or_none()
        
        if not user_config:
            user_config = UserConfig(user_id=user_id)
            db.add(user_config)
        
        # Validate and update configuration
        if config.interval_minutes is not None:
            if config.interval_minutes < 5 or config.interval_minutes > 120:
                raise HTTPException(
                    status_code=400,
                    detail="分析间隔必须在5-120分钟之间"
                )
            user_config.intraday_interval_minutes = config.interval_minutes
        
        if config.market_type is not None:
            # Validate market type: single market or comma-separated markets
            if "," in config.market_type:
                # Validate comma-separated markets
                markets = [m.strip() for m in config.market_type.split(",")]
                invalid_markets = [m for m in markets if m not in ["US", "HK", "CN"]]
                if invalid_markets:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid market(s): {', '.join(invalid_markets)}. Must be US, HK, or CN"
                    )
                user_config.intraday_market_type = config.market_type
            elif config.market_type in ["US", "HK", "CN"]:
                user_config.intraday_market_type = config.market_type
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Market type must be US, HK, CN, or comma-separated markets (e.g., US,HK,CN)"
                )
        
        if config.futu_api_url is not None:
            user_config.intraday_futu_api_url = config.futu_api_url
        
        if config.futu_api_key is not None:
            user_config.intraday_futu_api_key = config.futu_api_key
        
        # Update LLM configuration
        if config.llm_provider is not None:
            user_config.intraday_llm_provider = config.llm_provider
        
        if config.api_key is not None:
            user_config.intraday_api_key = config.api_key
        
        if config.llm_model is not None:
            user_config.intraday_llm_model = config.llm_model
        
        if config.backend_url is not None:
            user_config.intraday_backend_url = config.backend_url
        
        await db.commit()
        
        # Update scheduler if exists
        if manager.has_scheduler(user_id):
            manager.update_scheduler_config(
                user_id=user_id,
                interval_minutes=config.interval_minutes,
                market_type=config.market_type,
                futu_api_url=config.futu_api_url,
            )
        
        return {
            "status": "success",
            "message": "Configuration saved",
            "futu_api_url": user_config.intraday_futu_api_url,
            "futu_api_key": "***" if user_config.intraday_futu_api_key else None,  # Masked for security
            "interval_minutes": user_config.intraday_interval_minutes,
            "market_type": user_config.intraday_market_type,
            "llm_provider": user_config.intraday_llm_provider,
            "api_key": "***" if user_config.intraday_api_key else None,  # Masked for security
            "llm_model": user_config.intraday_llm_model,
            "backend_url": user_config.intraday_backend_url,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Decision History Endpoints
# ============================================================================

# DEPRECATED: This endpoint has been replaced by WebSocket 'decisions_initial' message
# The decisions list is now pushed via WebSocket on connection and updated via 'intraday_session_complete'
# Keeping this commented for reference only
#
# @router.get("/decisions", response_model=List[DecisionRecordResponse])
# async def get_decision_records(
#     limit: int = 20,
#     offset: int = 0,
#     status: Optional[str] = None,
#     market_type: Optional[str] = None,
#     current_user: User = Depends(get_current_active_user),
#     db: AsyncSession = Depends(get_db),
# ):
#     """
#     DEPRECATED: Use WebSocket 'decisions_initial' message instead.
#     This endpoint is no longer used by the frontend.
#     """
#     pass


@router.get("/decisions/{decision_id}", response_model=DecisionRecordResponse)
async def get_decision_record(
    decision_id: int,
    current_user: User = Depends(require_intraday_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed information for a specific decision record.
    
    Requires authentication.
    """
    try:
        logger.info(f"Fetching decision record: id={decision_id}, user_id={current_user.id}")
        
        # First check if record exists at all
        check_result = await db.execute(
            select(IntradayDecisionRecord).where(
                IntradayDecisionRecord.id == decision_id
            )
        )
        any_record = check_result.scalar_one_or_none()
        
        if not any_record:
            logger.warning(f"Decision record {decision_id} does not exist in database")
            raise HTTPException(status_code=404, detail=f"Decision record {decision_id} not found")
        
        # Check if it belongs to current user
        if any_record.user_id != current_user.id:
            logger.warning(f"Decision record {decision_id} belongs to user {any_record.user_id}, not {current_user.id}")
            raise HTTPException(status_code=404, detail="Decision record not found")
        
        logger.info(f"Successfully found decision record {decision_id}")
        return any_record
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching decision record {decision_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/decisions/by-date-range")
async def get_decisions_by_date_range(
    start_date: str,  # YYYY-MM-DD format
    end_date: str,  # YYYY-MM-DD format
    current_user: User = Depends(require_intraday_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get decision records within a date range.
    
    Requires authentication.
    """
    try:
        # Parse dates
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        
        # Query
        result = await db.execute(
            select(IntradayDecisionRecord).where(
                IntradayDecisionRecord.user_id == current_user.id,
                IntradayDecisionRecord.start_time >= start_dt,
                IntradayDecisionRecord.start_time < end_dt,
            ).order_by(desc(IntradayDecisionRecord.start_time))
        )
        records = result.scalars().all()
        
        return records
    
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Position Information Endpoints
# ============================================================================

@router.get("/positions")
async def get_positions(
    market: str = "US",  # Market parameter for Futu API
    include_closed: bool = False,
    current_user: User = Depends(require_intraday_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current positions from Futu API and sync to database.
    
    Requires authentication and Futu API configuration.
    """
    try:
        import httpx
        from web.backend.models import UserConfig
        from sqlalchemy import select
        
        # Get user config
        result = await db.execute(
            select(UserConfig).where(UserConfig.user_id == current_user.id)
        )
        user_config = result.scalar_one_or_none()
        
        # Priority: Use intraday config first, fallback to analysis config
        futu_api_url = None
        futu_api_key = None
        
        if user_config:
            futu_api_url = user_config.intraday_futu_api_url or user_config.futu_api_base_url
            futu_api_key = user_config.intraday_futu_api_key or user_config.futu_api_key
        
        if not futu_api_url:
            return []
        
        # Call Futu API to get positions
        base_url = futu_api_url.rstrip('/')
        positions_url = f"{base_url}/api/positions?market_type={market}"
        
        headers = {
            'Content-Type': 'application/json'
        }
        if futu_api_key:
            headers['X-API-Key'] = futu_api_key
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(positions_url, headers=headers)
            
            if response.status_code == 200:
                positions_data = response.json()
                
                # Handle different response formats
                if isinstance(positions_data, dict) and 'positions' in positions_data:
                    positions = positions_data['positions']
                elif isinstance(positions_data, list):
                    positions = positions_data
                else:
                    positions = []
                
                # Sync positions to database
                await sync_positions_to_db(
                    db=db,
                    user_id=current_user.id,
                    futu_positions=positions,
                    market=market
                )
                
                # Get account info to calculate position ratios
                account_url = f"{base_url}/api/account?market_type={market}"
                account_response = await client.get(account_url, headers=headers)
                
                total_assets = 0.0
                if account_response.status_code == 200:
                    account_data = account_response.json()
                    total_assets = account_data.get("net_asset", 0.0)
                
                # Determine currency symbol based on market
                currency_map = {
                    "US": "$",      # US Dollar
                    "HK": "HK$",    # Hong Kong Dollar
                    "CN": "¥"       # Chinese Yuan
                }
                currency = currency_map.get(market, "$")
                
                # Query database for position records to get open time
                from datetime import datetime, date
                position_records_query = await db.execute(
                    select(PositionRecord).where(
                        PositionRecord.user_id == current_user.id,
                        PositionRecord.market_type == market,
                        PositionRecord.is_closed == False
                    )
                )
                position_records = {rec.stock_code: rec for rec in position_records_query.scalars().all()}
                
                # Get today's date for calculating holding days
                today = date.today()
                
                # Build result
                result_positions = []
                for pos in positions:
                    stock_code = pos.get('stock_code', '')
                    stock_name = pos.get('stock_name', '')
                    quantity = float(pos.get('quantity', 0))
                    cost_price = float(pos.get('cost_price', 0))
                    current_price = float(pos.get('current_price', 0))
                    market_value = float(pos.get('market_value', 0))
                    profit_loss = float(pos.get('profit_loss', 0))
                    profit_loss_ratio = float(pos.get('profit_loss_ratio', 0))
                    
                    # Calculate position ratio
                    position_ratio = (market_value / total_assets * 100) if total_assets > 0 else 0
                    
                    # Get holding days from database (only calculate date difference, not time)
                    holding_days = 0
                    first_open_time = None
                    if stock_code in position_records:
                        record = position_records[stock_code]
                        first_open_time = record.first_open_time
                        if first_open_time:
                            # Convert to date only (ignore time component)
                            open_date = first_open_time.date() if hasattr(first_open_time, 'date') else first_open_time
                            holding_days = (today - open_date).days
                    
                    result_positions.append({
                        "stock_code": stock_code,
                        "stock_name": stock_name,
                        "market_type": pos.get('market_type', market),
                        "quantity": int(quantity),
                        "cost_price": cost_price,
                        "current_price": current_price,
                        "pnl": profit_loss,
                        "pnl_percent": profit_loss_ratio * 100,
                        "position_value": market_value,
                        "position_ratio": round(position_ratio, 2),
                        "holding_days": holding_days,
                        "first_open_time": first_open_time.isoformat() if first_open_time else None,
                        "currency": currency,
                    })
                
                return result_positions
            else:
                return []
    
    except httpx.TimeoutException:
        return []
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        return []


@router.get("/positions/{stock_code}/history", response_model=List[TradingHistoryResponse])
async def get_position_history(
    stock_code: str,
    current_user: User = Depends(require_intraday_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get trading history for a specific stock.
    
    Requires authentication.
    """
    try:
        # Find position
        result = await db.execute(
            select(PositionRecord).where(
                PositionRecord.user_id == current_user.id,
                PositionRecord.stock_code == stock_code,
            )
        )
        position = result.scalar_one_or_none()
        
        if not position:
            raise HTTPException(status_code=404, detail="Position not found")
        
        # Get trading history
        result = await db.execute(
            select(TradingHistory).where(
                TradingHistory.position_record_id == position.id
            ).order_by(desc(TradingHistory.trade_time))
        )
        history = result.scalars().all()
        
        return history
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trading-history", response_model=List[TradingHistoryResponse])
async def get_all_trading_history(
    limit: int = 50,
    offset: int = 0,
    trade_type: Optional[str] = None,
    current_user: User = Depends(require_intraday_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all trading history for the user with pagination.
    
    Requires authentication.
    """
    try:
        # Get user's position IDs
        result = await db.execute(
            select(PositionRecord.id).where(
                PositionRecord.user_id == current_user.id
            )
        )
        position_ids = [row[0] for row in result.all()]
        
        if not position_ids:
            return []
        
        # Build query
        query = select(TradingHistory).where(
            TradingHistory.position_record_id.in_(position_ids)
        )
        
        # Filter by trade type
        if trade_type:
            query = query.where(TradingHistory.trade_type == trade_type)
        
        # Order and paginate
        query = query.order_by(desc(TradingHistory.trade_time)).limit(limit).offset(offset)
        
        # Execute query
        result = await db.execute(query)
        history = result.scalars().all()
        
        return history
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ============================================================================
# Account Endpoint
# ============================================================================

@router.get("/account")
async def get_account_info(
    market: str = "US",  # Default to US market
    current_user: User = Depends(require_intraday_access),
    db: AsyncSession = Depends(get_db),
):
    """
    Get account information for current user by market.
    
    Requires authentication and Futu API configuration.
    """
    try:
        import httpx
        from web.backend.models import UserConfig
        from sqlalchemy import select
        
        # Get user config
        result = await db.execute(
            select(UserConfig).where(UserConfig.user_id == current_user.id)
        )
        user_config = result.scalar_one_or_none()
        
        # Priority: Use intraday config first, fallback to analysis config
        futu_api_url = None
        futu_api_key = None
        
        if user_config:
            futu_api_url = user_config.intraday_futu_api_url or user_config.futu_api_base_url
            futu_api_key = user_config.intraday_futu_api_key or user_config.futu_api_key
        
        # Determine currency symbol based on market
        currency_map = {
            "US": "$",      # US Dollar
            "HK": "HK$",    # Hong Kong Dollar
            "CN": "¥"       # Chinese Yuan
        }
        currency = currency_map.get(market, "$")
        
        if not futu_api_url:
            # Return empty account info if not configured
            return {
                "total_assets": 0.0,
                "cash": 0.0,
                "position_value": 0.0,
                "market": market,
                "currency": currency,
                "configured": False,
            }
        
        # Call Futu API to get account info
        # According to API docs: GET /api/account?market_type=US
        base_url = futu_api_url.rstrip('/')
        account_url = f"{base_url}/api/account?market_type={market}"
        
        headers = {
            'Content-Type': 'application/json'
        }
        if futu_api_key:
            headers['X-API-Key'] = futu_api_key
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(account_url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Map Futu API response fields to our format
                # Actual API response format:
                # {
                #   "net_asset": 96890.672,
                #   "cash": 75066.397,
                #   "market_value": 21824.275,
                #   "buying_power": 171957.069,
                #   "profit_loss": -3109.328,
                #   ...
                # }
                
                return {
                    "total_assets": data.get("net_asset", 0.0),
                    "cash": data.get("cash", 0.0),
                    "position_value": data.get("market_value", 0.0),
                    "today_profit_loss": data.get("today_profit_loss", 0.0),
                    "today_profit_loss_ratio": data.get("today_profit_loss_ratio", 0.0),
                    "market": market,
                    "currency": currency,
                    "configured": True,
                }
            else:
                # Log error for debugging
                error_text = response.text if hasattr(response, 'text') else str(response.content)
                logger.error(f"Futu API Error: {response.status_code} - {error_text}")
                
                # Return empty data with error info
                return {
                    "total_assets": 0.0,
                    "cash": 0.0,
                    "position_value": 0.0,
                    "market": market,
                    "currency": currency,
                    "configured": True,
                    "error": f"API返回错误: {response.status_code}"
                }
    
    except httpx.TimeoutException:
        return {
            "total_assets": 0.0,
            "cash": 0.0,
            "position_value": 0.0,
            "market": market,
            "currency": currency,
            "configured": True,
            "error": "连接超时"
        }
    except Exception as e:
        return {
            "total_assets": 0.0,
            "cash": 0.0,
            "position_value": 0.0,
            "market": market,
            "currency": currency,
            "configured": True,
            "error": str(e)
        }


@router.post("/scheduler/validate-config")
async def validate_futu_config(
    config: IntradayConfigRequest,
    current_user: User = Depends(require_intraday_access),
):
    """
    Validate Futu API configuration by testing connection.
    
    Requires authentication.
    """
    try:
        import httpx
        
        if not config.futu_api_url:
            raise HTTPException(
                status_code=400,
                detail="请提供富途API地址"
            )
        
        # Test connection to Futu API
        base_url = config.futu_api_url.rstrip('/')
        test_url = f"{base_url}/api/hot-news?lang=en-us"
        
        headers = {
            'Content-Type': 'application/json'
        }
        if config.futu_api_key:
            headers['X-API-Key'] = config.futu_api_key  # Use X-API-Key header
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(test_url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                # Check if response has valid data structure
                if data and (isinstance(data, list) or 'data' in data):
                    return {
                        "valid": True,
                        "message": "富途API配置验证成功"
                    }
                else:
                    return {
                        "valid": False,
                        "message": "富途API返回数据格式不正确"
                    }
            else:
                return {
                    "valid": False,
                    "message": f"富途API验证失败: HTTP {response.status_code}"
                }
    
    except httpx.TimeoutException:
        return {
            "valid": False,
            "message": "连接超时，请检查API地址是否正确"
        }
    except httpx.ConnectError:
        return {
            "valid": False,
            "message": "无法连接到富途API，请检查地址和网络"
        }
    except Exception as e:
        return {
            "valid": False,
            "message": f"验证失败: {str(e)}"
        }

