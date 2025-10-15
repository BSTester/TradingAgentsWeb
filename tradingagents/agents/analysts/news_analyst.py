from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
import time
import json
from tradingagents.agents.utils.agent_utils import get_news, get_global_news
from tradingagents.dataflows.config import get_config
from tradingagents.agents.utils.logger import log_agent_start, log_agent_end, log_agent_info, log_agent_tool


def create_news_analyst(llm):
    def news_analyst_node(state):
        current_date = state["trade_date"]
        ticker = state["company_of_interest"]
        
        log_agent_start("NEWS_ANALYST", ticker, f"分析日期: {current_date}")

        tools = [
            get_news,
            get_global_news,
        ]

        system_message = (
            "You are a news researcher tasked with analyzing recent news and trends over the past week. Please write a comprehensive report of the current state of the world that is relevant for trading and macroeconomics. Use the available tools: get_news(query, start_date, end_date) for company-specific or targeted news searches, and get_global_news(curr_date, look_back_days, limit) for broader macroeconomic news. Do not simply state the trends are mixed, provide detailed and finegrained analysis and insights that may help traders make decisions."
            + """ Make sure to append a Markdown table at the end of the report to organize key points in the report, organized and easy to read. by the way, answer in Chinese."""
        )

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
                    "For your reference, the current date is {current_date}. We are looking at the company {ticker}",
                ),
                MessagesPlaceholder(variable_name="messages"),
            ]
        )

        prompt = prompt.partial(system_message=system_message)
        prompt = prompt.partial(tool_names=", ".join([tool.name for tool in tools]))
        prompt = prompt.partial(current_date=current_date)
        prompt = prompt.partial(ticker=ticker)

        chain = prompt | llm.bind_tools(tools)
        
        log_agent_info("NEWS_ANALYST", "开始调用LLM进行新闻分析", ticker)
        result = chain.invoke(state["messages"])

        # 记录工具调用
        if len(result.tool_calls) > 0:
            for tool_call in result.tool_calls:
                log_agent_tool("NEWS_ANALYST", tool_call.get("name", "unknown"), ticker)
        
        report = ""

        if len(result.tool_calls) == 0:
            report = result.content
            log_agent_info("NEWS_ANALYST", f"生成报告完成，长度: {len(report)} 字符", ticker)

        log_agent_end("NEWS_ANALYST", ticker)
        
        return {
            "messages": [result],
            "news_report": report,
        }

    return news_analyst_node
