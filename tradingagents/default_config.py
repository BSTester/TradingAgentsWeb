import os

DEFAULT_CONFIG = {
    "project_dir": os.path.abspath(os.path.join(os.path.dirname(__file__), ".")),
    "results_dir": os.getenv("TRADINGAGENTS_RESULTS_DIR", "./results"),
    "data_dir": os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), ".")),
        "ScAI/FR1-data",
    ),
    "data_cache_dir": os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), ".")),
        "dataflows/data_cache",
    ),
    # LLM settings
    "llm_provider": os.getenv("LLM_PROVIDER", "openai"),
    "deep_think_llm": os.getenv("DEEP_THINK_LLM", "o4-mini"),
    "quick_think_llm": os.getenv("QUICK_THINK_LLM", "gpt-4o-mini"),
    "embedding_llm": os.getenv("EMBEDDING_LLM", "text-embedding-3-small"),
    "backend_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    "embedding_backend_url": os.getenv("EMBEDDING_BASE_URL", os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")),
    "embedding_api_key": os.getenv("EMBEDDING_API_KEY", os.getenv("OPENAI_API_KEY", "")),
    # Debate and discussion settings
    "max_debate_rounds": 1,
    "max_risk_discuss_rounds": 1,
    "max_recur_limit": 100,
    # Data vendor configuration
    # Category-level configuration (default for all tools in category)
    "data_vendors": {
        "core_stock_apis": "yfinance",       # Options: yfinance, alpha_vantage, local
        "technical_indicators": "yfinance",  # Options: yfinance, alpha_vantage, local
        "fundamental_data": "alpha_vantage", # Options: openai, alpha_vantage, local
        "news_data": "alpha_vantage",        # Options: openai, alpha_vantage, google, local
    },
    # Tool-level configuration (takes precedence over category-level)
    "tool_vendors": {
        # Example: "get_stock_data": "alpha_vantage",  # Override category default
        # Example: "get_news": "openai",               # Override category default
    },
    # Futu Trading API configuration
    "futu_api_base_url": os.getenv("FUTU_API_BASE_URL", "http://localhost:8000"),
    "futu_api_timeout": int(os.getenv("FUTU_API_TIMEOUT", "30")),
    # Auto-execute trading configuration
    "auto_execute_trading": os.getenv("AUTO_EXECUTE_TRADING", "false").lower() == "true",
}
