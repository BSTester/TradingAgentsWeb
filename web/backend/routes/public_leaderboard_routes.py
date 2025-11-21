"""
Public Leaderboard Routes

公开的排名API接口，无需鉴权即可访问
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from typing import List, Dict, Tuple
from datetime import datetime, timedelta

from web.backend.database import get_db
from web.backend.models import User, AccountSnapshot, PositionRecord, IntradayDecisionRecord
from web.backend.auth_routes import get_current_user

router = APIRouter(prefix="/api/public/leaderboard", tags=["public-leaderboard"])

# 价格缓存（避免频繁请求）
# 注意：当前持仓数据从快照中读取，不使用实时价格
# 此函数保留以备将来需要实时价格时使用
_price_cache: Dict[str, Tuple[float, datetime]] = {}
_cache_duration = timedelta(minutes=5)  # 缓存5分钟


async def get_current_price(stock_code: str, market_type: str) -> float:
    """
    获取股票当前价格（带缓存）
    注意：当前未使用，持仓数据从快照中读取
    """
    cache_key = f"{stock_code}_{market_type}"
    
    # 检查缓存
    if cache_key in _price_cache:
        price, timestamp = _price_cache[cache_key]
        if datetime.now() - timestamp < _cache_duration:
            return price
    
    try:
        import yfinance as yf
        
        # 根据市场类型调整股票代码格式
        if market_type == 'HK':
            ticker = f"{stock_code}.HK"
        elif market_type == 'CN':
            # A股需要添加后缀
            if stock_code.startswith('6'):
                ticker = f"{stock_code}.SS"  # 上海
            else:
                ticker = f"{stock_code}.SZ"  # 深圳
        else:
            ticker = stock_code
        
        # 使用yfinance获取价格
        stock = yf.Ticker(ticker)
        
        # 方法1: 尝试从info获取
        try:
            info = stock.info
            price = (
                info.get('currentPrice') or 
                info.get('regularMarketPrice') or 
                info.get('previousClose') or
                info.get('ask') or
                info.get('bid') or
                0.0
            )
            if price > 0:
                _price_cache[cache_key] = (float(price), datetime.now())
                return float(price)
        except Exception as e:
            print(f"从info获取价格失败 {ticker}: {e}")
        
        # 方法2: 尝试从历史数据获取最新价格
        try:
            hist = stock.history(period='1d', interval='1m')
            if not hist.empty:
                price = hist['Close'].iloc[-1]
                if price > 0:
                    _price_cache[cache_key] = (float(price), datetime.now())
                    return float(price)
        except Exception as e:
            print(f"从历史数据获取价格失败 {ticker}: {e}")
        
        # 方法3: 尝试获取5天的历史数据
        try:
            hist = stock.history(period='5d')
            if not hist.empty:
                price = hist['Close'].iloc[-1]
                if price > 0:
                    _price_cache[cache_key] = (float(price), datetime.now())
                    return float(price)
        except Exception as e:
            print(f"从5天历史数据获取价格失败 {ticker}: {e}")
        
        print(f"⚠️ 无法获取价格 {ticker}，返回0")
        return 0.0
        
    except Exception as e:
        print(f"❌ 获取价格失败 {stock_code}: {e}")
        return 0.0


@router.get("/users")
async def get_leaderboard_users(
    market: str = None,
    db: AsyncSession = Depends(get_db)
):
    """
    获取所有参加排名的用户列表
    可选参数: market (US/HK/CN) - 按市场过滤
    """
    from web.backend.models import UserConfig
    
    # Query users who participate in leaderboard
    query = select(
        User.id,
        User.username,
        AccountSnapshot.market_type,
        AccountSnapshot.total_assets,
        AccountSnapshot.snapshot_date
    ).join(
        AccountSnapshot,
        User.id == AccountSnapshot.user_id
    ).where(
        User.participate_in_leaderboard == True
    )
    
    # 如果指定了市场，添加过滤条件
    if market:
        query = query.where(AccountSnapshot.market_type == market)
    
    query = query.order_by(
        AccountSnapshot.snapshot_date.desc()
    )

    result = await db.execute(query)
    rows = result.fetchall()

    # Group by user and market, get latest snapshot for each user-market combination
    users_dict = {}
    for row in rows:
        user_id = row[0]
        market_type = row[2]
        key = f"{user_id}_{market_type}"
        
        if key not in users_dict:
            users_dict[key] = {
                'user_id': user_id,
                'username': row[1],
                'market_type': market_type,
                'total_assets': float(row[3]) if row[3] else 0,
                'latest_snapshot_date': row[4].strftime('%Y-%m-%d') if row[4] else ''
            }
    
    # Get user configs to fetch model information
    user_ids = list(set([row[0] for row in rows]))
    if user_ids:
        config_query = select(UserConfig).where(UserConfig.user_id.in_(user_ids))
        config_result = await db.execute(config_query)
        configs = {config.user_id: config for config in config_result.scalars().all()}
        
        # Add model information to users (only intraday model)
        for key, user_data in users_dict.items():
            user_id = user_data['user_id']
            if user_id in configs:
                config = configs[user_id]
                # Only use intraday model
                model_name = config.intraday_llm_model if config.intraday_llm_model else None
                user_data['model_name'] = model_name
                print(f"[Leaderboard] User {user_data['username']} (ID: {user_id}): model_name = {model_name}")
            else:
                user_data['model_name'] = None
                print(f"[Leaderboard] User {user_data['username']} (ID: {user_id}): no config found")
    else:
        # No user_ids, set all model_name to None
        for key, user_data in users_dict.items():
            user_data['model_name'] = None

    result_list = list(users_dict.values())
    print(f"[Leaderboard] Returning {len(result_list)} users with model info")
    return result_list


@router.get("/user/{user_id}/trend")
async def get_user_trend(
    user_id: int,
    days: int = 7,
    market: str = None,
    db: AsyncSession = Depends(get_db)
):
    """
    获取用户资产趋势（5分钟粒度）
    返回最近7天内按5分钟间隔的快照数据
    可选参数: market (US/HK/CN) - 按市场过滤
    """
    # Get user
    user_query = select(User).where(User.id == user_id, User.participate_in_leaderboard == True)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or not participating in leaderboard"
        )

    # Get snapshots for the user (最近N天)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    # Build query with optional market filter
    conditions = [
        AccountSnapshot.user_id == user_id,
        AccountSnapshot.snapshot_date >= start_date,
        AccountSnapshot.snapshot_date <= end_date
    ]
    
    if market:
        conditions.append(AccountSnapshot.market_type == market)
    
    query = select(AccountSnapshot).where(
        and_(*conditions)
    ).order_by(AccountSnapshot.snapshot_date.asc())

    result = await db.execute(query)
    snapshots = result.scalars().all()

    # 按5分钟间隔分组
    # 将时间戳向下取整到5分钟
    interval_snapshots = {}
    for snapshot in snapshots:
        # 将时间戳转换为5分钟间隔的key
        timestamp = snapshot.snapshot_date
        # 向下取整到5分钟
        minutes = (timestamp.hour * 60 + timestamp.minute) // 5 * 5
        rounded_time = timestamp.replace(hour=minutes // 60, minute=minutes % 60, second=0, microsecond=0)
        time_key = rounded_time.isoformat()
        
        # 保留每个5分钟间隔内最新的快照
        if time_key not in interval_snapshots or snapshot.snapshot_date > interval_snapshots[time_key].snapshot_date:
            interval_snapshots[time_key] = snapshot

    # 转换为排序列表
    trend_data = []
    for time_key in sorted(interval_snapshots.keys()):
        snapshot = interval_snapshots[time_key]
        trend_data.append({
            "date": snapshot.snapshot_date.strftime("%Y-%m-%d %H:%M:%S"),
            "total_assets": float(snapshot.total_assets),
        })

    return trend_data


@router.get("/user/{user_id}/positions")
async def get_user_positions(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取用户最新持仓信息（从Futu API获取实时数据，与智能盯盘一致）
    """
    # Verify user participates in leaderboard
    user_query = select(User).where(
        User.id == user_id,
        User.participate_in_leaderboard == True
    )
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or not participating in leaderboard"
        )

    # Get positions from all markets using async wrapper - parallel execution
    from web.backend.services.futu_async_wrapper import get_positions_async
    from datetime import datetime
    import asyncio
    
    # Fetch positions from all markets in parallel
    markets = ['US', 'HK', 'CN']
    positions_tasks = [
        get_positions_async(market_type=market, user_id=user_id)
        for market in markets
    ]
    
    # Wait for all tasks to complete
    positions_results = await asyncio.gather(*positions_tasks, return_exceptions=True)
    
    all_positions = []
    
    # Process results from all markets
    for market, positions in zip(markets, positions_results):
        # Skip if error or no positions
        if isinstance(positions, Exception) or not positions:
            continue
        
        # Format positions for leaderboard
        for pos in positions:
            first_open_time = pos.get('first_open_time')
            if first_open_time and isinstance(first_open_time, str):
                first_open_time_iso = first_open_time
            else:
                first_open_time_iso = datetime.now().isoformat()
            
            all_positions.append({
                "stock_code": pos.get('stock_code', ''),
                "stock_name": pos.get('stock_name', ''),
                "market_type": market,
                "quantity": int(float(pos.get('quantity', 0))),
                "cost_price": round(float(pos.get('cost_price', 0)), 2),
                "current_price": round(float(pos.get('current_price', 0)), 2),
                "market_value": round(float(pos.get('market_value', 0)), 2),
                "unrealized_pnl": round(float(pos.get('profit_loss', 0)), 2),
                "pnl_percentage": round(float(pos.get('profit_loss_ratio', 0)) * 100, 2),
                "first_open_price": round(float(pos.get('cost_price', 0)), 2),
                "first_open_time": first_open_time_iso,
                "holding_days": pos.get('holding_days', 0),
            })
    
    return all_positions


@router.get("/user/{user_id}/decisions")
async def get_user_decisions(
    user_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """
    获取用户决策历史
    """
    # Verify user participates in leaderboard
    user_query = select(User).where(
        User.id == user_id,
        User.participate_in_leaderboard == True
    )
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or not participating in leaderboard"
        )

    # Get recent decisions
    query = select(IntradayDecisionRecord).where(
        IntradayDecisionRecord.user_id == user_id
    ).order_by(
        desc(IntradayDecisionRecord.start_time)
    ).limit(limit)

    result = await db.execute(query)
    decisions = result.scalars().all()

    # Format decisions
    decisions_data = []
    for decision in decisions:
        decisions_data.append({
            "id": decision.id,
            "start_time": decision.start_time.isoformat() if decision.start_time else None,
            "end_time": decision.end_time.isoformat() if decision.end_time else None,
            "status": decision.status,
            "market_type": decision.market_type,
            "decision_report": decision.decision_report,
            "trades_executed": decision.trades_executed,
        })

    return decisions_data
