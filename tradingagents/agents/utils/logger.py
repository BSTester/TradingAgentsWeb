"""
统一的日志工具，用于记录智能体执行过程
"""
import sys
from datetime import datetime
from typing import Optional


class AgentLogger:
    """智能体日志记录器"""
    
    # 角色标识符和颜色代码（用于终端输出）
    ROLES = {
        "FUNDAMENTALS_ANALYST": {"name": "基本面分析师", "prefix": "📊", "color": "\033[94m"},  # 蓝色
        "MARKET_ANALYST": {"name": "市场分析师", "prefix": "📈", "color": "\033[92m"},  # 绿色
        "NEWS_ANALYST": {"name": "新闻分析师", "prefix": "📰", "color": "\033[93m"},  # 黄色
        "SOCIAL_ANALYST": {"name": "社交媒体分析师", "prefix": "💬", "color": "\033[95m"},  # 紫色
        "BULL_RESEARCHER": {"name": "多头研究员", "prefix": "🐂", "color": "\033[92m"},  # 绿色
        "BEAR_RESEARCHER": {"name": "空头研究员", "prefix": "🐻", "color": "\033[91m"},  # 红色
        "TRADER": {"name": "交易员", "prefix": "💼", "color": "\033[96m"},  # 青色
        "INVEST_JUDGE": {"name": "投资评审", "prefix": "⚖️", "color": "\033[95m"},  # 紫色
        "RISKY_ANALYST": {"name": "激进风险分析师", "prefix": "🚀", "color": "\033[91m"},  # 红色
        "NEUTRAL_ANALYST": {"name": "中性风险分析师", "prefix": "⚖️", "color": "\033[94m"},  # 蓝色
        "SAFE_ANALYST": {"name": "保守风险分析师", "prefix": "🛡️", "color": "\033[92m"},  # 绿色
        "RISK_MANAGER": {"name": "风险管理评审", "prefix": "⚠️", "color": "\033[93m"},  # 黄色
        "SYSTEM": {"name": "系统", "prefix": "🔧", "color": "\033[90m"},  # 灰色
    }
    
    RESET_COLOR = "\033[0m"
    
    @classmethod
    def log(cls, role: str, message: str, level: str = "INFO", ticker: Optional[str] = None):
        """
        记录日志
        
        Args:
            role: 角色标识符（如 "FUNDAMENTALS_ANALYST"）
            message: 日志消息
            level: 日志级别（INFO, START, END, DECISION, ERROR）
            ticker: 股票代码（可选）
        """
        role_info = cls.ROLES.get(role, {"name": role, "prefix": "❓", "color": "\033[97m"})
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        ticker_str = f"[{ticker}]" if ticker else ""
        
        # 根据级别选择不同的格式
        level_prefix = {
            "START": "▶️ 开始",
            "END": "✅ 完成",
            "DECISION": "🎯 决策",
            "ERROR": "❌ 错误",
            "INFO": "ℹ️ 信息",
            "TOOL": "🔨 工具调用",
        }.get(level, "ℹ️")
        
        # 构建日志消息
        log_message = (
            f"{role_info['color']}"
            f"[{timestamp}] "
            f"{role_info['prefix']} {role_info['name']}{ticker_str} "
            f"| {level_prefix}: {message}"
            f"{cls.RESET_COLOR}"
        )
        
        print(log_message, flush=True)
    
    @classmethod
    def log_start(cls, role: str, ticker: Optional[str] = None, extra: str = ""):
        """记录智能体开始执行"""
        msg = f"开始执行分析任务"
        if extra:
            msg += f" - {extra}"
        cls.log(role, msg, "START", ticker)
    
    @classmethod
    def log_end(cls, role: str, ticker: Optional[str] = None, extra: str = ""):
        """记录智能体完成执行"""
        msg = f"完成分析任务"
        if extra:
            msg += f" - {extra}"
        cls.log(role, msg, "END", ticker)
    
    @classmethod
    def log_decision(cls, role: str, decision: str, ticker: Optional[str] = None):
        """记录决策"""
        cls.log(role, f"决策: {decision}", "DECISION", ticker)
    
    @classmethod
    def log_tool_call(cls, role: str, tool_name: str, ticker: Optional[str] = None):
        """记录工具调用"""
        cls.log(role, f"调用工具: {tool_name}", "TOOL", ticker)
    
    @classmethod
    def log_error(cls, role: str, error: str, ticker: Optional[str] = None):
        """记录错误"""
        cls.log(role, f"错误: {error}", "ERROR", ticker)


# 便捷函数
def log_agent_start(role: str, ticker: Optional[str] = None, extra: str = ""):
    """记录智能体开始"""
    AgentLogger.log_start(role, ticker, extra)


def log_agent_end(role: str, ticker: Optional[str] = None, extra: str = ""):
    """记录智能体结束"""
    AgentLogger.log_end(role, ticker, extra)


def log_agent_info(role: str, message: str, ticker: Optional[str] = None):
    """记录智能体信息"""
    AgentLogger.log(role, message, "INFO", ticker)


def log_agent_decision(role: str, decision: str, ticker: Optional[str] = None):
    """记录智能体决策"""
    AgentLogger.log_decision(role, decision, ticker)


def log_agent_tool(role: str, tool_name: str, ticker: Optional[str] = None):
    """记录工具调用"""
    AgentLogger.log_tool_call(role, tool_name, ticker)


def log_agent_error(role: str, error: str, ticker: Optional[str] = None):
    """记录错误"""
    AgentLogger.log_error(role, error, ticker)
