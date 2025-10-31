"""
健康检查端点
用于 Docker 容器健康检查和负载均衡器探测
"""

from fastapi import APIRouter, Response, status
from datetime import datetime
import sys

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """
    健康检查端点
    返回服务状态和基本信息
    """
    # Use Beijing time
    from pytz import timezone as pytz_timezone
    beijing_tz = pytz_timezone('Asia/Shanghai')
    now_beijing = datetime.now(beijing_tz)
    
    return {
        "status": "healthy",
        "timestamp": now_beijing.isoformat(),
        "service": "TradingAgents Backend",
        "version": "1.0.0",
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    }


@router.get("/health/ready")
async def readiness_check():
    """
    就绪检查端点
    检查服务是否准备好接收请求
    """
    # 这里可以添加更多检查，例如：
    # - 数据库连接
    # - 外部 API 可用性
    # - 必要的配置是否加载
    
    try:
        # 示例：检查配置是否加载
        from tradingagents.default_config import DEFAULT_CONFIG
        
        if not DEFAULT_CONFIG:
            return Response(
                content="Configuration not loaded",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Use Beijing time
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone('Asia/Shanghai')
        now_beijing = datetime.now(beijing_tz)
        
        return {
            "status": "ready",
            "timestamp": now_beijing.isoformat(),
            "checks": {
                "config": "ok"
            }
        }
    except Exception as e:
        return Response(
            content=f"Service not ready: {str(e)}",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )


@router.get("/health/live")
async def liveness_check():
    """
    存活检查端点
    检查服务是否还在运行
    """
    # Use Beijing time
    from pytz import timezone as pytz_timezone
    beijing_tz = pytz_timezone('Asia/Shanghai')
    now_beijing = datetime.now(beijing_tz)
    
    return {
        "status": "alive",
        "timestamp": now_beijing.isoformat()
    }
