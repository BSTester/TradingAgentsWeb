# Intraday Trader Prompt Structure Visualization

## Complete System Prompt Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM PROMPT                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 1. TRADING STRATEGY (Customizable by User)               │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ ## Trading Strategy                                       │ │
│  │                                                           │ │
│  │ • Role Definition                                         │ │
│  │   - Aggressive Intraday Trader                           │ │
│  │   - High Risk Tolerance with Strategic Discipline        │ │
│  │                                                           │ │
│  │ • Trading Philosophy                                      │ │
│  │   - Long-term Trend Awareness                            │ │
│  │   - Transaction Cost Consciousness                       │ │
│  │   - Quality over Quantity                                │ │
│  │   - Strategic Patience for Strong Stocks                 │ │
│  │                                                           │ │
│  │ • Trading Principles                                      │ │
│  │   - Act decisively, Cut losses fast                      │ │
│  │   - Let winners run, Stay liquid                         │ │
│  │   - Trade the trend, Cost-aware trading                  │ │
│  │                                                           │ │
│  │ • Risk Management (User Customizable)                    │ │
│  │   - Hard stop: -8% on any position                       │ │
│  │   - Soft stop: -5% (evaluate if worth holding)           │ │
│  │   - Portfolio drawdown: -5% from peak → reduce exposure  │ │
│  │                                                           │ │
│  │ • Position Sizing Guidelines (User Customizable)         │ │
│  │   - Single stock: Up to 40% on high-conviction plays     │ │
│  │   - Total exposure: Can go up to 95%                     │ │
│  │   - Cash reserve: Minimum 5%, prefer 10-20%              │ │
│  │                                                           │ │
│  │ • Trading Constraints (User Customizable)                │ │
│  │   - Maximum 3 stocks per session                         │ │
│  │   - Avoid trading in first 5 minutes                     │ │
│  │   - Trade cautiously in last 30 minutes                  │ │
│  │                                                           │ │
│  │ • Report Format                                           │ │
│  │   - Chinese report structure with 5 sections             │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 2. EXECUTION WORKFLOW (Fixed, Not Customizable)          │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ ## Execution Workflow                                     │ │
│  │                                                           │ │
│  │ ### Phase 1: Information Collection                       │ │
│  │   Step 1: Account & Position Overview (3 tools)          │ │
│  │     • get_futu_account_info                              │ │
│  │     • get_futu_positions                                 │ │
│  │     • get_futu_orders                                    │ │
│  │                                                           │ │
│  │   Step 2: Stock Analysis (9 tools per stock)             │ │
│  │     • get_futu_quote                                     │ │
│  │     • get_futu_kline (daily & 5min)                      │ │
│  │     • get_futu_technical_analysis (MACD, RSI, BOLL)      │ │
│  │                                                           │ │
│  │   Step 3: Market Scanning & News (optional, 4 tools)     │ │
│  │     • get_futu_hot_news, get_akshare_news                │ │
│  │     • get_akshare_hot_stocks, get_futu_hot_stocks        │ │
│  │                                                           │ │
│  │ ### Phase 2: Analysis & Decision                          │ │
│  │   • Historical Context Review                            │ │
│  │   • Position Evaluation (trend, frequency, technicals)   │ │
│  │   • Direction Judgment (market restrictions, alignment)  │ │
│  │   • Fund Check                                           │ │
│  │   • Decision Making                                      │ │
│  │                                                           │ │
│  │ ### Phase 3: Execute Trades                               │ │
│  │   • Pre-execution checks                                 │ │
│  │   • Order placement: place_futu_order                    │ │
│  │   • One order per stock rule                             │ │
│  │                                                           │ │
│  │ ### Phase 4: Result Verification                          │ │
│  │   • Verify account, positions, orders (if succeeded)     │ │
│  │                                                           │ │
│  │ ### Phase 5: Generate Report                              │ │
│  │   • Complete Chinese execution report                    │ │
│  │                                                           │ │
│  │ ## Technical Constraints (Fixed)                          │ │
│  │   • One order per stock per session                      │ │
│  │   • No duplicate orders                                  │ │
│  │   • Direction switch must close positions first          │ │
│  │   • HK/CN markets prohibit short selling                 │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 3. CURRENT SESSION CONTEXT (Dynamic)                     │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ ## Current Session Context                                │ │
│  │                                                           │ │
│  │ • Market: US / HK / CN                                    │ │
│  │ • Session ID: session_20241113_143022                     │ │
│  │ • Timestamp: 2024-11-13 14:30:22                          │ │
│  │ • User ID: 1                                              │ │
│  │                                                           │ │
│  │ ## Market Rules                                           │ │
│  │ • US Market: Long/Short, T+0 trading                      │ │
│  │ • HK Market: Long only, T+0 trading                       │ │
│  │ • CN Market: Long only, T+1 trading                       │ │
│  │                                                           │ │
│  │ Current market is {market_type}. Please formulate         │ │
│  │ trading strategy according to market rules.               │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 4. EXECUTION INSTRUCTION                                  │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ Now execute your trading strategy following the workflow  │ │
│  │ above based on current context.                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Information Flow

```
User Strategy (Goals & Philosophy)
         ↓
    What to achieve?
    - Maximize risk-adjusted returns
    - Balance short-term tactics with long-term strategy
    - Manage risk within defined parameters
         ↓
Execution Workflow (Process)
         ↓
    How to execute?
    - Phase 1: Collect information (11 tools)
    - Phase 2: Analyze and decide
    - Phase 3: Execute trades
    - Phase 4: Verify results
    - Phase 5: Generate report
         ↓
Current Context (State)
         ↓
    What's the current situation?
    - Market type and rules
    - Session information
    - Timestamp
         ↓
Execute!
```

## Customization Boundaries

### User Can Customize (Section 1)
```
✅ Trading philosophy and principles
✅ Risk management parameters
   - Stop-loss levels (-8%, -5%)
   - Position sizing (40% single, 95% total)
✅ Trading constraints
   - Max stocks per session (3)
   - Time restrictions (first 5 min, last 30 min)
✅ Report format and structure
```

### System Fixed (Sections 2-4)
```
❌ Workflow execution order (5 phases)
❌ Technical constraints
   - One order per stock
   - No duplicate orders
   - Direction switch rules
❌ Market technical rules
   - HK/CN no short selling
   - CN T+1 restriction
❌ Tool availability (all 11 tools)
❌ Current session context
```

## Token Distribution (Approximate)

| Section | Tokens | Percentage | Customizable |
|---------|--------|------------|--------------|
| 1. Trading Strategy | ~1500 | 30% | ✅ Yes |
| 2. Execution Workflow | ~3658 | 73% | ❌ No |
| 3. Current Context | ~150 | 3% | ❌ No |
| 4. Execution Instruction | ~20 | <1% | ❌ No |
| **Total** | **~5328** | **100%** | **28% customizable** |

## Benefits of This Structure

1. **Natural Flow**: Goal → Process → State
   - LLM first understands "what to achieve"
   - Then learns "how to execute"
   - Finally receives "current situation"

2. **Clear Separation**: 
   - Strategy (customizable) vs Workflow (fixed)
   - Philosophy vs Process
   - Goals vs Constraints

3. **Flexibility**: 
   - Users can customize 28% of the prompt
   - System ensures 72% remains consistent

4. **Safety**: 
   - Critical technical rules cannot be removed
   - Workflow integrity maintained across all users

5. **Efficiency**: 
   - Tool documentation embedded in workflow
   - No redundant information
   - ~215 tokens saved vs previous architecture
