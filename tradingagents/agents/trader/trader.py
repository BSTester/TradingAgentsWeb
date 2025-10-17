import functools
import time
import json
from datetime import datetime, timedelta
from typing import Any, cast
import csv
from io import StringIO
from tradingagents.agents.utils.logger import log_agent_start, log_agent_end, log_agent_info, log_agent_decision
from tradingagents.agents.utils.agent_utils import get_stock_data


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
        # Re-query memory to retrieve ticker and analysis date (do not use previous results)
        extracted_ticker = None
        extracted_analysis_date = None
        try:
            # A targeted query to surface records mentioning ticker/code and analysis date
            query = f"{company_name} ticker, stock code, symbol; analysis date, trade date, as-of date, 分析日期, 交易日期 in YYYY-MM-DD"
            more_memories = memory.get_memories(query, n_matches=3)
            import re
            date_pat = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
            # Common ticker patterns: digits/letters with optional dot suffix (e.g., 0700, 0700.HK, 02150, 02150.HK, AAPL, 603777, CRCL)
            ticker_pat = re.compile(r"\b([A-Z]{1,10}(?:\.[A-Z]{2,4})?|\d{3,6}(?:\.[A-Z]{2,4})?)\b")
            if more_memories:
                # Prefer the first record that contains both a plausible ticker and date
                for rec in more_memories:
                    text = (rec.get("recommendation") or rec.get("content") or rec.get("text") or "") or ""
                    # Heuristic: only consider tokens that look like tickers and exclude obvious words
                    cand_tickers = [t for t in ticker_pat.findall(text) if t.upper() not in {"USD","CNY","HKD","BUY","SELL","HOLD"}]
                    cand_dates = date_pat.findall(text)
                    if cand_tickers and cand_dates:
                        extracted_ticker = cand_tickers[0]
                        extracted_analysis_date = cand_dates[0]
                        break
                # If still missing, try to take whichever is available
                if not extracted_ticker:
                    for rec in more_memories:
                        text = (rec.get("recommendation") or rec.get("content") or rec.get("text") or "") or ""
                        cand_tickers = [t for t in ticker_pat.findall(text) if t.upper() not in {"USD","CNY","HKD","BUY","SELL","HOLD"}]
                        if cand_tickers:
                            extracted_ticker = cand_tickers[0]
                            break
                if not extracted_analysis_date:
                    for rec in more_memories:
                        text = (rec.get("recommendation") or rec.get("content") or rec.get("text") or "") or ""
                        cand_dates = date_pat.findall(text)
                        if cand_dates:
                            extracted_analysis_date = cand_dates[0]
                            break
        except Exception:
            pass
        # Fallbacks
        ticker_symbol = extracted_ticker or company_name
        today_str = time.strftime("%Y-%m-%d", time.localtime())
        analysis_date = extracted_analysis_date or state.get("trade_date") or today_str
        if (not extracted_analysis_date) and (not state.get("trade_date")) and analysis_date == today_str:
            log_agent_info("TRADER", f"No analysis date found in memory or state; defaulting to today: {today_str}", company_name)
        # Fetch 1-month window price data [analysis_date - 31 days, analysis_date]
        price_data_block = ""
        try:
            end_dt = datetime.strptime(analysis_date, "%Y-%m-%d")
            start_dt = end_dt - timedelta(days=31)
            start_date = start_dt.strftime("%Y-%m-%d")
            end_date = end_dt.strftime("%Y-%m-%d")
            log_agent_info("TRADER", f"Fetching 1-month price data for {ticker_symbol}: {start_date} - {end_date}", company_name)
            stock_csv = cast(Any, get_stock_data).invoke({"symbol": ticker_symbol, "start_date": start_date, "end_date": end_date})
            # Sort CSV by date in descending order for clarity
            try:
                _csv_text = stock_csv if isinstance(stock_csv, str) else str(stock_csv)
                f = StringIO(_csv_text.strip())
                reader = csv.DictReader(f)
                rows = list(reader)
                date_col = None
                if reader.fieldnames:
                    for k in reader.fieldnames:
                        if k and k.lower() in ("date", "trade_date"):
                            date_col = k
                            break
                if date_col and rows:
                    rows.sort(key=lambda r: datetime.strptime(str(r.get(date_col, "")).strip()[:10], "%Y-%m-%d"), reverse=True)
                    out = StringIO()
                    writer = csv.DictWriter(out, fieldnames=reader.fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
                    sorted_csv = out.getvalue()
                else:
                    sorted_csv = _csv_text
            except Exception:
                sorted_csv = _csv_text
            price_data_block = (
                "\n\nRecent 1-month price data for context (do not re-fetch):\n"
                f"- Ticker: {ticker_symbol}\n"
                f"- Period: {start_date} to {end_date} (inclusive)\n"
                "- CSV Data (sorted by date descending):\n"
                f"{sorted_csv}\n"
                "\nBased on this data, provide a reasonable buy/sell price range near the current market price, and justify it briefly."
            )
        except Exception as e:
            log_agent_info("TRADER", f"Failed to fetch 1-month price data: {e}", company_name)

        past_memory_str = ""
        if past_memories:
            for i, rec in enumerate(past_memories, 1):
                past_memory_str += rec["recommendation"] + "\n\n"
        else:
            past_memory_str = "No past memories found."

        context = {
            "role": "user",
            "content": f"Based on a comprehensive analysis by a team of analysts, here is an investment plan tailored for {company_name}. This plan incorporates insights from current technical market trends, macroeconomic indicators, and social media sentiment. Use this plan as a foundation for evaluating your next trading decision.\n\nProposed Investment Plan: {investment_plan}\n\nLeverage these insights to make an informed and strategic decision."
                       f"{price_data_block}",
        }

        messages = [
            {
                "role": "system",
                "content": f"""You are a trading agent analyzing market data to make investment decisions. Based on your analysis, provide a specific recommendation to buy, sell, or hold. End with a firm decision and always conclude your response with 'FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL**' to confirm your recommendation. Do not forget to utilize lessons from past decisions to learn from your mistakes. Here are reflections from similar situations you traded in and the lessons learned: {past_memory_str} Answer in Chinese.

Additionally, provide explicit price and position suggestions based on the current market price:
- Suggested per-share price range to BUY or SELL: specify a range with currency (e.g., "14.80–15.30 USD/share", "118–123 HKD/股", "34.50–35.50 CNY/股"); always provide a clear entry/exit range aligned with the current market price
- Suggested position size: percentage of total capital (e.g., "15%")
- Briefly justify the price and position (risk tolerance, volatility, liquidity, recent support/resistance, etc.)

Data requirement for price recommendations:
- All price recommendations must be based on recent real market transaction data for the specific stock. If the user specifies a date, you must use the actual price data for that date.
- You may use web search to retrieve recent or date-specific prices. If you cannot obtain the current market price or other reliable real price data, do NOT provide a specific buy/sell price or price range; explicitly state the limitation.
- Ensure the recommended per-share price or price range stays reasonably close to the current market price, avoiding large deviations. If volatility is high, specify an appropriate tolerance band (e.g., within 1–3% for large caps, 3–8% for small caps) and justify.
- When giving a price recommendation, include the reference price timestamp and data source (e.g., exchange or reputable site).

You must end with a standardized summary including decision, price range, and position:
FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL** | PRICE RANGE: <min>-<max> <currency>/share | POSITION: <percent>""",
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
