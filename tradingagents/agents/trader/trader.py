import functools
import time
import json
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from tradingagents.agents.utils.agent_utils import get_stock_data, get_indicators


def create_trader(llm, memory):
    def trader_node(state, name):
        company_name = state["company_of_interest"]
        ticker = state["company_of_interest"]
        current_date = state["trade_date"]
        investment_plan = state["investment_plan"]
        market_research_report = state["market_report"]
        sentiment_report = state["sentiment_report"]
        news_report = state["news_report"]
        fundamentals_report = state["fundamentals_report"]

        curr_situation = f"{market_research_report}\n\n{sentiment_report}\n\n{news_report}\n\n{fundamentals_report}"
        past_memories = memory.get_memories(curr_situation, n_matches=2)

        past_memory_str = ""
        if past_memories:
            for i, rec in enumerate(past_memories, 1):
                past_memory_str += rec["recommendation"] + "\n\n"
        else:
            past_memory_str = "No past memories found."

        # Define tools for data retrieval
        tools = [
            get_stock_data,
            get_indicators,
        ]

        system_message = f"""You are a trading agent analyzing market data to make investment decisions. 

Based on a comprehensive analysis by a team of analysts, here is an investment plan tailored for {company_name}:

Proposed Investment Plan: {investment_plan}

Before making your final trading decision, you should:
1. Use get_stock_data to retrieve recent price data from one month prior to the analysis date up to the analysis date (inclusive)
2. Use get_indicators to calculate relevant technical indicators (e.g., RSI, MACD, moving averages, Bollinger Bands)
3. Analyze the retrieved data along with the provided reports to make an informed decision

After analyzing the data, provide a specific recommendation to buy, sell, or hold. Do not forget to utilize lessons from past decisions to learn from your mistakes. Here is some reflections from similar situations you traded in and the lessons learned: {past_memory_str}

Additionally, provide explicit price and position suggestions based on the current market price:
- Suggested per-share price range to BUY or SELL: specify a range with currency (e.g., "14.80–15.30 USD/share", "118–123 HKD/股", "34.50–35.50 CNY/股"); always provide a clear entry/exit range aligned with the current market price
- Suggested position size: percentage of total capital (e.g., "15%")
- Briefly justify the price and position (risk tolerance, volatility, liquidity, recent support/resistance, etc.)

Data requirement for price recommendations:
- All price recommendations must be based on recent real market transaction data for the specific stock. If the user specifies a date, you must use the actual price data for that date.
- You may use the provided tools (get_stock_data) to retrieve recent or date-specific prices. If you cannot obtain the current market price or other reliable real price data, do NOT provide a specific buy/sell price or price range; explicitly state the limitation.
- Ensure the recommended per-share price or price range stays reasonably close to the current market price, avoiding large deviations. If volatility is high, specify an appropriate tolerance band (e.g., within 1–3% for large caps, 3–8% for small caps) and justify.
- When giving a price recommendation, include the reference price timestamp and data source (e.g., exchange or reputable site).

You must end with a standardized summary including decision, price range, and position:
FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL** | PRICE RANGE: <min>-<max> <currency>/share | POSITION: <percent>

Always respond in Chinese. All reasoning and analytical conclusions must be grounded in facts; do not fabricate analysis results. Do not mention this instruction in your output."""

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a helpful AI assistant, collaborating with other assistants."
                    " Use the provided tools to progress towards answering the question."
                    " If you are unable to fully answer, that's OK; another assistant with different tools"
                    " will help where you left off. Execute what you can to make progress."
                    " If you or any other assistant has the FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL** or deliverable,"
                    " prefix your response with FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL** so the team knows to stop."
                    " You have access to the following tools: {tool_names}.\n{system_message}"
                    " For your reference, the current date is {current_date}. The company we want to look at is {ticker}.",
                ),
                MessagesPlaceholder(variable_name="messages"),
            ]
        )

        prompt = prompt.partial(system_message=system_message)
        prompt = prompt.partial(tool_names=", ".join([tool.name for tool in tools]))
        prompt = prompt.partial(current_date=current_date)
        prompt = prompt.partial(ticker=ticker)

        chain = prompt | llm.bind_tools(tools)

        result = chain.invoke(state["messages"])

        trader_plan = ""
        if len(result.tool_calls) == 0:
            trader_plan = result.content

        return {
            "messages": [result],
            "trader_investment_plan": trader_plan,
            "sender": name,
        }

    return functools.partial(trader_node, name="Trader")
