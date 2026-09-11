from langchain_core.messages import HumanMessage, RemoveMessage

# Import tools from separate utility files
from tradingagents.agents.utils.core_stock_tools import (
    get_stock_data
)
from tradingagents.agents.utils.technical_indicators_tools import (
    get_indicators
)
from tradingagents.agents.utils.fundamental_data_tools import (
    get_fundamentals,
    get_balance_sheet,
    get_cashflow,
    get_income_statement
)
from tradingagents.agents.utils.news_data_tools import (
    get_news,
    get_insider_sentiment,
    get_insider_transactions,
    get_global_news
)
from tradingagents.agents.utils.realtime_quote_tools import (
    get_realtime_quote
)

def create_msg_delete(key: str = "messages"):
    """创建一个清除指定消息通道的节点工厂。

    分析师并行化后，每个分析师分支使用独立的消息通道
    （market_messages / social_messages / ...），清除节点必须只清
    自己分支的通道，否则会抹掉并行兄弟分支进行中的消息。
    """
    def delete_messages(state):
        """Clear branch messages and add placeholder for Anthropic compatibility"""
        messages = state[key]
        
        # Remove all messages in this channel
        removal_operations = [RemoveMessage(id=m.id) for m in messages]
        
        # Add a minimal placeholder message
        placeholder = HumanMessage(content="Continue")
        
        return {key: removal_operations + [placeholder]}
    
    return delete_messages


        