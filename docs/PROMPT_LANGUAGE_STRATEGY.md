# Prompt Language Strategy

## Overview

The Trading Executor uses a bilingual prompt strategy: English prompts with Chinese responses.

---

## Strategy

### Prompt Language: English
All system prompts, instructions, and tool descriptions are in English.

**Reasons:**
1. **Better LLM Understanding**: Most LLMs are trained primarily on English data
2. **Clearer Instructions**: Technical terms and tool names are more precise in English
3. **Consistency**: Tool names and parameters are in English
4. **International Compatibility**: Easier for non-Chinese developers to understand

### Response Language: Chinese
All agent responses, analysis, and reports are in Chinese.

**Reasons:**
1. **User Preference**: Target users are Chinese-speaking traders
2. **Domain Terminology**: Financial terms are more natural in Chinese for Chinese markets
3. **Report Readability**: Analysis reports are easier to read in native language
4. **Market Context**: Better expression of market sentiment and news in Chinese

---

## Implementation

### System Prompt Structure

```python
prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a helpful AI assistant working with other assistants."
        " Use the provided tools to progress on the task."
        " ... [English instructions] ..."
        "\n\nIMPORTANT: You MUST respond in Chinese (中文) for all analysis, reasoning, and reports.",
    ),
    MessagesPlaceholder(variable_name="messages"),
])
```

### Key Components

#### 1. Main Instructions (English)
```
You are a helpful AI assistant working with other assistants.
Use the provided tools to progress on the task.
If you are unable to fully answer, that's OK; another assistant with different tools will help where you left off.
Execute what you can to make progress.
```

#### 2. Completion Signal (English)
```
If you or any of the other assistants have completed the trading execution or final deliverable,
prefix your response with EXECUTION_COMPLETE so the team knows to stop.
```

#### 3. Tool Access (English)
```
You have access to the following tools: {tool_names}.
```

#### 4. Context Information (English)
```
Current date is {current_date}.
The stock we are trading is {ticker}, market type is {market_type}.
```

#### 5. Response Language Requirement (English + Chinese)
```
IMPORTANT: You MUST respond in Chinese (中文) for all analysis, reasoning, and reports.
```

### Detailed Instructions (English)

The main system message contains detailed instructions in English:

```python
system_message = f"""You are a professional stock trading execution agent. The current time is {current_date}. Below, we provide you with trading recommendations, risk management decisions, and tools to execute trades. You must gather real-time market data, verify account status, and execute orders based on the analysis.

ALL PRICE AND INDICATOR DATA MUST BE ORDERED: OLDEST → NEWEST

═══════════════════════════════════════════════════════════════
TRADING TARGET: {ticker}
MARKET TYPE: {market_type} (auto-detected)
TRADING DATE: {current_date}
═══════════════════════════════════════════════════════════════

TRADING STRATEGY RECOMMENDATION:
{trader_plan}

RISK MANAGEMENT TEAM FINAL DECISION:
{risk_decision}

... [Detailed workflow in English] ...

═══════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS
═══════════════════════════════════════════════════════════════
1. ALL price and indicator data MUST be ordered: OLDEST → NEWEST
2. ALL reasoning and conclusions MUST be based on actual tool-returned data, DO NOT fabricate
3. Always respond in Chinese, maintain professional and objective tone
4. When trade execution or final report is complete, prefix your response with EXECUTION_COMPLETE
5. Prioritize LIMIT orders to control execution price and avoid slippage
6. Strictly follow risk management principles: single trade risk ≤ 5% of net asset value
"""
```

### Past Memories (English)

```python
past_memories = memory.get_memories(trader_plan, n_matches=2)
past_memory_str = ""
if past_memories:
    for i, rec in enumerate(past_memories, 1):
        past_memory_str += f"Past Trading Experience {i}:\n{rec.get('recommendation', '')}\n\n"
else:
    past_memory_str = "No past trading execution records available."
```

---

## Expected Response Format

### Agent Response (Chinese)

```
当前市场状态 - AAPL
当前价格 = 180.50, 当前RSI = 65.2, 当前MACD = 1.23

分时数据（5分钟，最旧 → 最新）：
价格: [178.50, 179.20, 179.80, 180.10, 180.50]
MACD指标: [0.98, 1.05, 1.12, 1.18, 1.23]
RSI指标: [62.3, 63.5, 64.2, 64.8, 65.2]

账户信息与表现
可用现金: 50,000
当前账户价值: 150,000
当前持仓: [列出持仓详情]

执行决策
决策依据: [引用风险管理团队的关键结论]
市场时机: [为什么选择此时执行]

交易执行详情
操作: 买入 AAPL
订单ID: 123456789
数量: 100股
价格: 180.50（限价单）
订单状态: 已成交
成交金额: 18,050

... [更多中文分析] ...

EXECUTION_COMPLETE
```

---

## Benefits

### 1. Better LLM Performance
- English prompts leverage LLM's strongest training data
- More precise understanding of technical instructions
- Better tool usage and parameter handling

### 2. User-Friendly Output
- Chinese responses are natural for target users
- Financial terminology is more appropriate in Chinese
- Reports are easier to read and understand

### 3. Developer-Friendly
- English prompts are easier for international developers to understand
- Tool names and parameters remain consistent
- Easier to debug and maintain

### 4. Flexibility
- Easy to switch response language by changing one line
- Can support multiple languages in the future
- Maintains consistency across different markets

---

## Language Switching

### To Change Response Language

Simply modify the language requirement in the prompt:

```python
# For English responses
"\n\nIMPORTANT: You MUST respond in English for all analysis, reasoning, and reports."

# For Chinese responses (current)
"\n\nIMPORTANT: You MUST respond in Chinese (中文) for all analysis, reasoning, and reports."

# For bilingual responses
"\n\nIMPORTANT: You MUST respond in both English and Chinese for all analysis, reasoning, and reports."
```

---

## Best Practices

### 1. Keep Instructions Clear
- Use simple, direct English in prompts
- Avoid ambiguous phrasing
- Be explicit about requirements

### 2. Maintain Consistency
- All tool names in English
- All parameters in English
- All technical terms in English

### 3. Enforce Response Language
- Explicitly state response language requirement
- Place requirement at the end of prompt for emphasis
- Use both English and Chinese in the requirement statement

### 4. Test Both Languages
- Verify LLM understands English instructions
- Verify LLM produces correct Chinese responses
- Check for language mixing issues

---

## Examples

### Good Prompt (Current Implementation)
```
You are a professional stock trading execution agent.
Use the following tools: get_futu_quote, place_futu_order, ...
IMPORTANT: You MUST respond in Chinese (中文) for all analysis, reasoning, and reports.
```

### Bad Prompt (Avoid)
```
你是一个专业的股票交易执行代理。
使用以下工具: get_futu_quote, place_futu_order, ...
重要提示：你必须用中文回复所有分析、推理和报告。
```
**Problem**: Mixed language in instructions, tool names in English but instructions in Chinese, confusing for LLM.

---

## Future Enhancements

### Multi-Language Support
- Add language parameter to agent initialization
- Support English, Chinese, Japanese, Korean responses
- Maintain English prompts for consistency

### Language Detection
- Auto-detect user's preferred language from input
- Switch response language accordingly
- Keep prompts in English

### Localization
- Translate financial terms appropriately
- Use market-specific terminology
- Maintain technical accuracy

---

## Summary

✅ **Prompts**: English (for better LLM understanding)
✅ **Responses**: Chinese (for better user experience)
✅ **Tools**: English (for consistency)
✅ **Flexibility**: Easy to switch languages
✅ **Performance**: Optimal for both LLM and users

This strategy provides the best balance between LLM performance and user experience!
