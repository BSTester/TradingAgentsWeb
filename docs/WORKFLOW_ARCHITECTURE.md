# Intraday Trader Workflow Architecture

## Overview

The intraday trader agent uses a layered prompt architecture that separates fixed system instructions from user-customizable strategy content.

## Prompt Assembly Order

The complete system prompt is assembled in the following order:

```
1. User Trading Strategy (Customizable)
   ↓
2. Standard Execution Workflow (Fixed, includes tool usage)
   ↓
3. Current Session Context (Dynamic)
   ↓
4. Execution Instruction
```

**Rationale**: This order ensures the LLM first understands the trading philosophy and goals, then learns the execution process, and finally receives the current session state. This "goal → process → state" flow is more intuitive than "state → process → goal".

**Note**: Tool documentation is embedded within the workflow documentation, eliminating redundancy and reducing token usage.

## Component Details

### 1. User Trading Strategy (Customizable)

**Source**: Database (`user_prompts` table) or default file
**Location**: 
- Database: `web/backend/services/prompt_loader.py`
- Default: `tradingagents/agents/trader/intraday_trader_default_prompt.txt`
**Customizable**: Yes (via frontend UI)
**Position**: First in prompt (establishes trading philosophy and goals)

User can customize:
- Role Definition
- Trading Philosophy
- Trading Principles
- Market Rules awareness
- Risk Management parameters (stop-loss levels, position sizing)
- Trading Constraints (max stocks per session, time restrictions)
- Trading Mindset
- Report Format

### 2. Standard Execution Workflow (Fixed)

**Source**: `tradingagents/agents/trader/intraday_trader_workflow.txt`
**Location**: Loaded in `intraday_trader.py`
**Customizable**: No (system-level, not exposed to users)
**Position**: Second in prompt (defines how to execute the strategy)

Defines the mandatory 5-phase workflow with embedded tool usage instructions:

#### Phase 1: Information Collection
- Step 1: Account & Position Overview (3 tools in parallel)
  * `get_futu_account_info`, `get_futu_positions`, `get_futu_orders`
- Step 2: Stock Analysis (9 tools per stock in parallel)
  * `get_futu_quote`, `get_futu_kline` (daily & 5min), `get_futu_technical_analysis` (MACD, RSI, BOLL for daily & 5min)
- Step 3: Market Scanning & News Analysis (optional, 4 tools in parallel)
  * `get_futu_hot_news`, `get_akshare_news`, `get_akshare_hot_stocks`, `get_futu_hot_stocks`

#### Phase 2: Analysis & Decision
- Historical Context Review
- Position Evaluation (holding period, long-term trend, trading frequency, technical analysis)
- Direction Judgment (market restrictions, trend alignment)
- Fund Check
- Decision Making (prioritize top 3 stocks)

#### Phase 3: Execute Trades
- Pre-execution checks
- Execute according to trading rules
- Order placement: `place_futu_order` (one order per stock rule)

#### Phase 4: Result Verification
- Verify account info, positions, and orders (only if trade succeeded)
  * `get_futu_account_info`, `get_futu_positions`, `get_futu_orders`

#### Phase 5: Generate Report
- Generate comprehensive Chinese report

Also includes:
- Historical Context guidelines
- Parallel Tool Execution instructions
- Trading Constraints (9 critical rules)
- Decision-Making Authority

**All 11 tools are documented within the workflow phases above, eliminating the need for a separate tool list.**

### 3. Current Session Context (Dynamic)

**Source**: Generated from runtime state
**Location**: `tradingagents/agents/trader/intraday_trader.py`
**Customizable**: No
**Position**: Third in prompt (provides current session state)

Includes:
- Market type (US/HK/CN)
- Session ID
- Timestamp
- User ID
- Market-specific trading rules

### 4. Execution Instruction

**Source**: Hardcoded string
**Location**: `tradingagents/agents/trader/intraday_trader.py`
**Customizable**: No
**Position**: Last in prompt (triggers execution)

Instruction: "Now execute your trading strategy following the workflow above based on current context."

## File Structure

```
tradingagents/agents/trader/
├── intraday_trader.py                    # Main agent implementation
├── intraday_trader_default_prompt.txt    # Default user strategy (customizable)
└── intraday_trader_workflow.txt          # Fixed workflow (not customizable)
```

## Customization Flow

### For Users (via Frontend)

1. Navigate to Intraday Trading page
2. Click "Prompt Configuration" tab
3. Edit the core strategy prompt (role, philosophy, principles, report format)
4. Save changes to database
5. Agent loads custom prompt on next execution

**What users CAN customize**:
- Trading philosophy and principles
- Risk tolerance and position sizing preferences
- Report format and structure
- Trading mindset and decision criteria

**What users CANNOT customize**:
- Tool availability (all 11 tools always available, documented in workflow)
- Standard 5-phase workflow
- Technical constraints (one order per stock, no duplicate orders, direction switch rules)
- Market technical rules (HK/CN no short selling, CN T+1 restriction)
- Tool usage instructions (embedded in workflow phases)
- Parallel execution behavior

**What users CAN customize** (in their strategy prompt):
- Risk management parameters (stop-loss levels, position sizing limits)
- Trading constraints (max stocks per session, time restrictions)
- Trading philosophy and decision criteria
- Report format and structure

### For Developers (via Code)

To modify the fixed workflow:
1. Edit `tradingagents/agents/trader/intraday_trader_workflow.txt`
2. Changes apply to all users immediately
3. No database migration needed

To modify tool documentation:
1. Edit tool usage instructions in `intraday_trader_workflow.txt`
2. Tools are documented within workflow phases (no separate tool list)

## Benefits of This Architecture

1. **Separation of Concerns**: System instructions vs user preferences
2. **Consistency**: All users follow the same proven workflow
3. **Flexibility**: Users can customize strategy without breaking the system
4. **Maintainability**: Workflow updates don't require database migrations
5. **Safety**: Critical constraints cannot be accidentally removed by users
6. **Clarity**: Clear distinction between "how to execute" (fixed) and "what to prioritize" (customizable)
7. **Token Efficiency**: Tool documentation embedded in workflow eliminates redundancy (~215 tokens saved per request)

## Migration from Previous Architecture

**Before**: Single comprehensive prompt with tools, workflow, and strategy mixed together
**After**: Layered architecture with clear separation

**Changes**:
1. Extracted workflow into separate file (`intraday_trader_workflow.txt`)
2. Simplified default prompt to only include user-customizable content
3. Modified agent code to load and inject workflow at runtime
4. Removed separate tool documentation list - tools now documented within workflow phases
5. Reduced token usage by ~215 tokens per request through elimination of redundant tool list

**Backward Compatibility**: Existing user prompts in database continue to work. The workflow is automatically injected regardless of prompt content.
