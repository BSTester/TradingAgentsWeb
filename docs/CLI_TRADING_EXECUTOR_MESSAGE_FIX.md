# CLI Trading Executor Message Display Fix

## Problem

When Trading Executor node was running, the CLI's "Messages & Tools" panel was not showing the tool calls and messages from Trading Executor. It continued to display messages from the previous Risk Management team.

## Root Cause

### 1. LangGraph Stream Format Misunderstanding

LangGraph's `stream()` method returns chunks in the format:
```python
{
  "node_name": {
    "messages": [...],
    "sender": "...",
    "execution_report": "...",
    ...
  }
}
```

But the CLI code was treating chunks as if they had a flat structure:
```python
# WRONG - assumes flat structure
chunk["messages"]
chunk["sender"]
```

### 2. Nested Structure Not Handled

The actual structure is:
```python
{
  "Trading Executor": {
    "messages": [AIMessage(...)],
    "sender": "TradingExecutor",
    "execution_report": ""
  }
}
```

Or for tool nodes:
```python
{
  "tools_trading_executor": {
    "messages": [ToolMessage(...)]
  }
}
```

## Solution

### 1. Extract Nested Data

Added code to extract the nested data structure:

```python
# Extract chunk data (handle nested structure)
chunk_data = chunk
if len(chunk) > 0:
    first_key = list(chunk.keys())[0]
    if isinstance(chunk[first_key], dict):
        chunk_data = chunk[first_key]
```

### 2. Use Extracted Data Throughout

Changed all references from `chunk[...]` to `chunk_data[...]`:

```python
# Before
if chunk.get("sender") == "TradingExecutor":
    execution_report = chunk.get("execution_report", "")

# After
if chunk_data.get("sender") == "TradingExecutor":
    execution_report = chunk_data.get("execution_report", "")
```

### 3. Handle Messages from Nested Structure

```python
# Extract messages from chunk (handle both formats)
messages = chunk.get("messages", [])
if not messages and len(chunk) > 0:
    # Try to get messages from nested structure
    for key, value in chunk.items():
        if isinstance(value, dict) and "messages" in value:
            messages = value["messages"]
            break

if len(messages) > 0:
    last_message = messages[-1]
    # Process message...
```

### 4. Added Debug Logging

Added comprehensive debug logging to track Trading Executor chunks:

```python
# Debug: Print all chunk info to understand structure
chunk_node_name = list(chunk.keys())[0] if chunk else "unknown"
if "Trading Executor" in chunk_node_name or "tools_trading_executor" in chunk_node_name:
    print(f"\n[CLI DEBUG] Chunk from node: {chunk_node_name}")
    print(f"  - Chunk keys: {list(chunk.keys())}")
    chunk_data = chunk.get(chunk_node_name, chunk)
    if isinstance(chunk_data, dict):
        print(f"  - Data keys: {list(chunk_data.keys())}")
        print(f"  - Has messages: {len(chunk_data.get('messages', []))}")
        print(f"  - Has sender: {chunk_data.get('sender')}")
```

## Changes Made

### File: `cli/main.py`

1. **Lines ~905-925**: Added chunk structure extraction logic
2. **Lines ~960-970**: Extract `chunk_data` from nested structure
3. **Lines ~973-1090**: Updated all `chunk[...]` references to `chunk_data[...]`
4. **Lines ~1173-1200**: Updated Trading Executor processing to use `chunk_data`
5. **Lines ~910-925**: Added debug logging for Trading Executor chunks

## Testing

To verify the fix works:

1. Run CLI with auto-execute trading enabled
2. Watch for debug output:
   ```
   [CLI DEBUG] Chunk from node: Trading Executor
     - Chunk keys: ['Trading Executor']
     - Data keys: ['messages', 'sender', 'execution_report']
     - Has messages: 1
     - Has sender: TradingExecutor
   
   [CLI DEBUG] Trading Executor tool call: get_futu_quote
   [CLI DEBUG] Trading Executor tool call: get_futu_kline
   ```

3. Verify "Messages & Tools" panel shows:
   - Tool calls from Trading Executor (e.g., "get_futu_quote", "get_futu_kline")
   - Reasoning messages from Trading Executor
   - Proper timestamps for each message

## Expected Behavior After Fix

### Before Fix
```
Messages & Tools panel shows:
- 10:30:15 | Reasoning | Portfolio Manager: ...
- 10:30:20 | Tool | get_fundamentals: ...
(No Trading Executor messages visible)
```

### After Fix
```
Messages & Tools panel shows:
- 10:30:15 | Reasoning | Portfolio Manager: ...
- 10:30:25 | Tool | get_futu_quote: stock_code=AAPL
- 10:30:26 | Tool | get_futu_kline: symbol=AAPL, interval=daily
- 10:30:27 | Tool | get_futu_technical_analysis: indicator=rsi
- 10:30:28 | Reasoning | Trading Executor: 当前市场状态...
```

## Related Files

- `cli/main.py` - Main CLI implementation with message handling
- `tradingagents/agents/trader/trading_executor.py` - Trading Executor node
- `tradingagents/graph/setup.py` - Graph setup with node connections

## Future Improvements

1. Create a helper function to extract chunk data consistently
2. Add type hints for chunk structure
3. Consider using LangGraph's `astream_events()` for more structured event handling
4. Add unit tests for chunk data extraction logic
