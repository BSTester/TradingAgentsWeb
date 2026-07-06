import os


def _env(primary: str, legacy: str | None, default: str) -> str:
    """Read TRADINGAGENTS_* first, then legacy env names for compatibility."""
    if primary in os.environ:
        return os.environ[primary]
    if legacy and legacy in os.environ:
        return os.environ[legacy]
    return default

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
    "llm_provider": _env("TRADINGAGENTS_LLM_PROVIDER", "LLM_PROVIDER", "openai"),
    "deep_think_llm": _env("TRADINGAGENTS_DEEP_LLM", "DEEP_THINK_LLM", "gpt-5.5"),
    "quick_think_llm": _env("TRADINGAGENTS_QUICK_LLM", "QUICK_THINK_LLM", "gpt-5.5"),
    "embedding_llm": _env("TRADINGAGENTS_EMBEDDING_LLM", "EMBEDDING_LLM", "text-embedding-3-small"),
    "backend_url": _env("TRADINGAGENTS_OPENAI_BASE_URL", "OPENAI_BASE_URL", "https://api.oneinfinityai.com/v1"),
    "embedding_backend_url": _env("TRADINGAGENTS_EMBEDDING_BASE_URL", "EMBEDDING_BASE_URL", _env("TRADINGAGENTS_OPENAI_BASE_URL", "OPENAI_BASE_URL", "https://api.oneinfinityai.com/v1")),
    "openai_api_key": _env("TRADINGAGENTS_OPENAI_API_KEY", "OPENAI_API_KEY", ""),
    "anthropic_api_key": _env("TRADINGAGENTS_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY", ""),
    "google_api_key": _env("TRADINGAGENTS_GOOGLE_API_KEY", "GOOGLE_API_KEY", ""),
    "embedding_api_key": _env("TRADINGAGENTS_EMBEDDING_API_KEY", "EMBEDDING_API_KEY", _env("TRADINGAGENTS_OPENAI_API_KEY", "OPENAI_API_KEY", "")),
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
}
