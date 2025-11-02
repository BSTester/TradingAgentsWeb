# State Flow Summary

## State Fields Evolution Through the Graph

### Initial State (Propagator)
```python
{
    "company_of_interest": "AAPL",  # Stock code input
    "trade_date": "2025-11-02",
    "messages": [("human", "AAPL")],
    # ... other fields
}
```

### After Risk Manager Node
```python
{
    "ticker": "AAPL",                    # Original stock code
    "company_of_interest": "苹果",       # Company name (Chinese)
    "market_type": "US",                 # Auto-detected market type
    "final_trade_decision": "...",       # Risk team's decision
    # ... other fields
}
```

### Trading Executor Node (Current)
```python
# Extract from state
ticker = state.get("ticker", "")                    # Stock code: AAPL, 00700, 600519
company_name = state.get("company_of_interest", "") # Company name: 苹果, 腾讯, 贵州茅台
market_type = state.get("market_type")              # Market type: US, HK, CN

# Fallback: Auto-detect if market_type not in state
if not market_type:
    market_type = detect_market_type(ticker)
```

## Key Points

1. **company_of_interest** changes meaning:
   - Before risk_manager: Stock code (e.g., "AAPL", "00700")
   - After risk_manager: Company name (e.g., "苹果", "腾讯")

2. **ticker** is added by risk_manager:
   - Preserves the original stock code
   - Used for trading operations

3. **market_type** is added by risk_manager:
   - Auto-detected from ticker
   - Used to route to correct market API

4. **Trading executor** uses:
   - `ticker` for trading operations (API calls)
   - `company_name` for display/reporting
   - `market_type` for market-specific logic

## State Field Usage

| Field | Type | Set By | Used By | Purpose |
|-------|------|--------|---------|---------|
| `company_of_interest` | str | Propagator → Risk Manager | All nodes | Stock code → Company name |
| `ticker` | str | Risk Manager | Trading Executor | Stock code for trading |
| `market_type` | str | Risk Manager | Trading Executor | Market routing (US/HK/CN) |
| `trade_date` | str | Propagator | All nodes | Trading date |
| `investment_plan` | str | Trader | Risk Manager, Trading Executor | Trading strategy |
| `final_trade_decision` | str | Risk Manager | Trading Executor | Final decision |

## Example Flow

```
Input: "AAPL"
  ↓
Propagator: company_of_interest = "AAPL"
  ↓
Analysts: Analyze "AAPL"
  ↓
Trader: Generate investment_plan for "AAPL"
  ↓
Risk Manager:
  - ticker = "AAPL" (preserve original)
  - company_of_interest = "苹果" (extract name)
  - market_type = "US" (auto-detect)
  - final_trade_decision = "BUY 100 shares at $180"
  ↓
Trading Executor:
  - Use ticker="AAPL" for API calls
  - Use company_name="苹果" for display
  - Use market_type="US" for routing
  - Execute based on final_trade_decision
```

## Market Type Detection

The `market_type` field is automatically detected by `risk_manager` using the `detect_market_type()` function:

```python
from tradingagents.agents.utils.market_utils import detect_market_type

# Examples
detect_market_type("AAPL")      # → "US"
detect_market_type("00700")     # → "HK"
detect_market_type("0700.HK")   # → "HK"
detect_market_type("600519")    # → "CN"
detect_market_type("600519.SH") # → "CN"
```

If `market_type` is not present in state (e.g., when running trading_executor standalone), it will auto-detect from the ticker.
