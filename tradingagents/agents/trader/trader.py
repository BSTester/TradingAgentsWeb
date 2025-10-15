import functools
import time
import json
from tradingagents.agents.utils.logger import log_agent_start, log_agent_end, log_agent_info, log_agent_decision


def create_trader(llm, memory):
    def trader_node(state, name):
        company_name = state["company_of_interest"]
        log_agent_start("TRADER", company_name, "开始制定交易决策")
        
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

        context = {
            "role": "user",
            "content": f"Based on a comprehensive analysis by a team of analysts, here is an investment plan tailored for {company_name}. This plan incorporates insights from current technical market trends, macroeconomic indicators, and social media sentiment. Use this plan as a foundation for evaluating your next trading decision.\n\nProposed Investment Plan: {investment_plan}\n\nLeverage these insights to make an informed and strategic decision.",
        }

        messages = [
            {
                "role": "system",
                "content": f"""You are a trading agent analyzing market data to make investment decisions. Based on your analysis, provide a specific recommendation to buy, sell, or hold. End with a firm decision and always conclude your response with 'FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL**' to confirm your recommendation. Do not forget to utilize lessons from past decisions to learn from your mistakes. Here is some reflections from similar situatiosn you traded in and the lessons learned: {past_memory_str} Answer in Chinese.""",
            },
            context,
        ]

        log_agent_info("TRADER", "开始生成交易决策", company_name)
        result = llm.invoke(messages)
        
        # 提取决策
        decision_text = result.content
        if "BUY" in decision_text.upper():
            decision = "BUY"
        elif "SELL" in decision_text.upper():
            decision = "SELL"
        elif "HOLD" in decision_text.upper():
            decision = "HOLD"
        else:
            decision = "未明确"
        
        log_agent_decision("TRADER", decision, company_name)
        log_agent_info("TRADER", f"交易计划生成完成，长度: {len(result.content)} 字符", company_name)
        log_agent_end("TRADER", company_name)

        return {
            "messages": [result],
            "trader_investment_plan": result.content,
            "sender": name,
        }

    return functools.partial(trader_node, name="Trader")
