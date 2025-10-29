import time
import json


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

Guidelines for Decision-Making:
1. **Summarize Key Arguments**: Extract the strongest points from each analyst, focusing on relevance to the context.
2. **Provide Rationale**: Support your recommendation with direct quotes and counterarguments from the debate.
3. **Refine the Trader's Plan**: Start with the trader's original plan, **{trader_plan}**, and adjust it based on the analysts' insights.
4. **Learn from Past Mistakes**: Use lessons from **{past_memory_str}** to address prior misjudgments and improve the decision you are making now to make sure you don't make a wrong BUY/SELL/HOLD call that loses money.

Deliverables:
- A clear and actionable recommendation: Buy, Sell, or Hold.
- Detailed reasoning anchored in the debate and past reflections.

---

**Analysts Debate History:**  
{history}

---

Focus on actionable insights and continuous improvement. Build on past lessons, critically evaluate all perspectives, and ensure each decision advances better outcomes.

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
        company_name = company_name_response.content.strip()

        return {
            "risk_debate_state": new_risk_debate_state,
            "final_trade_decision": response.content,
            "ticker": ticker,
            "company_of_interest": company_name
        }

    return risk_manager_node
