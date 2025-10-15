import os

DEFAULT_CONFIG = {
    "project_dir": os.path.abspath(os.path.join(os.path.dirname(__file__), ".")),
    "results_dir": os.getenv("TRADINGAGENTS_RESULTS_DIR", "./results"),
    "data_dir": os.getenv("TRADINGAGENTS_RESULTS_DIR", "./FR1-data"), 
    "data_cache_dir": os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), ".")),
        "dataflows/data_cache",
    ),
    # LLM settings
    "llm_provider": "openai",
    "deep_think_llm": "o4-mini",
    "quick_think_llm": "gpt-4o",
    "backend_url": "https://api.bstester.com/v1",
    # Debate and discussion settings
    "max_debate_rounds": 3,
    "max_risk_discuss_rounds": 3,
    "max_recur_limit": 100,
    # Data vendor configuration
    # Category-level configuration (default for all tools in category)
    "data_vendors": {
        "core_stock_apis": "akshare",       # Options: yfinance, alpha_vantage, akshare, baostock, local
        "technical_indicators": "akshare",  # Options: yfinance, alpha_vantage, akshare, local
        "fundamental_data": "akshare", # Options: openai, alpha_vantage, akshare, baostock, local
        "news_data": "akshare",              # Options: akshare, openai, alpha_vantage, google, local
    },
    # Tool-level configuration (takes precedence over category-level)
    "tool_vendors": {
        "get_stock_data": "akshare",  # Override category default
        "get_indicators": "yfinance,akshare",  # Primary: yfinance, Fallback: akshare
        "get_global_news": "openai,akshare", 
        "get_news": "akshare,openai"    
    },
    # Market-specific vendor preferences (auto-selected based on stock symbol)
    "market_vendors": {
        "A_STOCK": {
            "primary": "akshare",           # Primary vendor for A-shares
            "fallback": "baostock,yfinance" # Fallback vendors
        },
        "HK_STOCK": {
            "primary": "akshare",           # Primary vendor for Hong Kong stocks
            "fallback": "yfinance"          # Fallback vendors
        },
        "US_STOCK": {
            "primary": "akshare",           # Primary vendor for US stocks (yfinance优先，失败后降级到akshare)
            "fallback": "yfinance,alpha_vantage"  # Fallback vendors
        }
    },
}
