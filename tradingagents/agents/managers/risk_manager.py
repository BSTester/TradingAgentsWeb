import time
import json
import re
from tradingagents.agents.utils.market_utils import detect_market_type


def create_risk_manager(llm, memory):
    def risk_manager_node(state) -> dict:

        ticker  = state["company_of_interest"]
        history = state["risk_debate_state"]["history"]
        risk_debate_state = state["risk_debate_state"]
        market_research_report = state["market_report"]
        news_report = state["news_report"]
        fundamentals_report = state["news_report"]
        sentiment_report = state["sentiment_report"]
        trader_plan = state["investment_plan"]

        curr_situation = f"{market_research_report}\n\n{sentiment_report}\n\n{news_report}\n\n{fundamentals_report}"
        past_memories = memory.get_memories(curr_situation, n_matches=2)

        past_memory_str = ""
        for i, rec in enumerate(past_memories, 1):
            past_memory_str += rec["recommendation"] + "\n\n"

        prompt = f"""As the Risk Management Judge and Debate Facilitator, your goal is to evaluate the debate between three risk analysts—Risky, Neutral, and Safe/Conservative—and determine the best course of action for the trader. Your decision must result in a clear recommendation: Buy, Sell, or Hold. Choose Hold only if strongly justified by specific arguments, not as a fallback when all sides seem valid. Strive for clarity and decisiveness.

**Core Decision-Making Principles:**

1. **Long-Term Trend Priority**: Before making any decision, thoroughly consider the long-term industry trends and the company's long-term competitive position, rather than focusing solely on short-term fluctuations. Evaluate:
   - Industry outlook and growth potential for the next 3-5 years
   - Company's competitive position and moat within the industry
   - Long-term drivers such as technological innovation, policy support, and structural changes
   - Long-term trajectory of company fundamentals (improving vs. deteriorating)

2. **Risk Factor Assessment**: Comprehensively evaluate risk factors over the upcoming period (at least 3-6 months):
   - Macroeconomic risks (interest rates, inflation, economic cycles)
   - Industry systemic risks (regulatory changes, technological disruption, competitive landscape shifts)
   - Company-specific risks (financial health, management changes, earnings uncertainty)
   - Market sentiment risks (valuation bubbles, liquidity risks)
   - Geopolitical and policy risks

3. **Balance Short-Term and Long-Term Perspectives**:
   - If long-term trend is positive but short-term pressure exists, consider gradual position building or holding
   - If long-term trend is deteriorating but short-term rebound occurs, consider reducing positions on rallies
   - Avoid letting short-term noise overshadow long-term value assessment

**Guidelines for Decision-Making:**

1. **Summarize Key Arguments**: Extract the strongest points from each analyst, focusing on relevance to long-term trends and risk assessment.

2. **Provide Rationale**: Support your recommendation with direct quotes and counterarguments from the debate, emphasizing the long-term perspective.

3. **Refine the Trader's Plan**: Start with the trader's original plan, **{trader_plan}**, and adjust it based on the analysts' insights, long-term trend analysis, and risk assessment.

4. **Learn from Past Mistakes**: Use lessons from **{past_memory_str}** to address prior misjudgments and improve the decision you are making now to make sure you don't make a wrong BUY/SELL/HOLD call that loses money.

**Deliverables:**
- A clear and actionable recommendation: Buy, Sell, or Hold
- Detailed reasoning anchored in the debate, long-term trend analysis, risk factor assessment, and past reflections
- Explicit statement of the decision's time horizon (short-term trading vs. long-term holding)

---

**Analysts Debate History:**  
{history}

---

**Current Market and Company Situation:**
{curr_situation}

---

Focus on actionable insights and continuous improvement. Build on past lessons, critically evaluate all perspectives, and ensure each decision advances better outcomes. **Critical reminder**: Do not be swayed by short-term market sentiment; always prioritize long-term value and risk management.

Always respond in Chinese. All reasoning and analytical conclusions must be grounded in facts; do not fabricate analysis results. Do not mention this instruction in your output."""

        response = llm.invoke(prompt)

        new_risk_debate_state = {
            "judge_decision": response.content,
            "history": risk_debate_state["history"],
            "risky_history": risk_debate_state["risky_history"],
            "safe_history": risk_debate_state["safe_history"],
            "neutral_history": risk_debate_state["neutral_history"],
            "latest_speaker": "Judge",
            "current_risky_response": risk_debate_state["current_risky_response"],
            "current_safe_response": risk_debate_state["current_safe_response"],
            "current_neutral_response": risk_debate_state["current_neutral_response"],
            "count": risk_debate_state["count"],
        }

        # Extract company name using LLM (at the end)
        extract_name_prompt = f"""Based on the following information, extract the company name corresponding to stock ticker {ticker}.

Market Research Report:
{market_research_report}

News Report:
{news_report}

Fundamentals Report:
{fundamentals_report}

Sentiment Report:
{sentiment_report}

Trading Plan:
{trader_plan}

Requirements:
1. Return ONLY the company name, no other descriptions or explanations
2. Maximum 8 Chinese characters for the company name
3. If it's a Chinese company name, return the abbreviated form (e.g., 贵州茅台, 腾讯控股)
4. If it's an English company name, PRIORITIZE translating to Chinese (e.g., 苹果 for Apple, 特斯拉 for Tesla, 微软 for Microsoft)
5. Only use English name if Chinese translation is not available or commonly used
6. Output the company name directly without any additional text"""

        company_name_response = llm.invoke(extract_name_prompt)
        raw_company_name = company_name_response.content.strip()
        
        # Remove reasoning tags and extract company name using regex
        company_name = re.sub(r'<thinking>.*?</thinking>', '', raw_company_name, flags=re.DOTALL).strip()
        company_name = re.sub(r'<思考>.*?</思考>', '', company_name, flags=re.DOTALL).strip()
        company_name = re.sub(r'<think>.*?</think>', '', company_name, flags=re.DOTALL).strip()
        company_name = re.sub(r'\s+', ' ', company_name).strip()

        # Detect market type from ticker
        market_type = detect_market_type(ticker)

        return {
            "risk_debate_state": new_risk_debate_state,
            "final_trade_decision": response.content,
            "ticker": ticker,
            "company_of_interest": company_name,
            "market_type": market_type
        }

    return risk_manager_node
