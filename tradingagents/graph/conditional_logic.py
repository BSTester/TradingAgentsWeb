# TradingAgents/graph/conditional_logic.py

from tradingagents.agents.utils.agent_states import AgentState


class ConditionalLogic:
    """Handles conditional logic for determining graph flow."""

    def __init__(self, max_debate_rounds=1, max_risk_discuss_rounds=1):
        """Initialize with configuration parameters."""
        self.max_debate_rounds = max_debate_rounds
        self.max_risk_discuss_rounds = max_risk_discuss_rounds

    def _should_continue_branch(self, state: AgentState, key: str, tools_node: str, clear_node: str):
        """Shared logic: inspect the branch's own message channel for pending tool calls.

        并行化后每个分析师在自己的消息通道（如 market_messages）内完成工具循环，
        因此必须检查本分支通道的最后一条消息，而不是共享的 state["messages"]。
        """
        messages = state[key]
        last_message = messages[-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return tools_node
        return clear_node

    def should_continue_market(self, state: AgentState):
        """Determine if market analysis should continue."""
        return self._should_continue_branch(
            state, "market_messages", "tools_market", "Msg Clear Market"
        )

    def should_continue_social(self, state: AgentState):
        """Determine if social media analysis should continue."""
        return self._should_continue_branch(
            state, "social_messages", "tools_social", "Msg Clear Social"
        )

    def should_continue_news(self, state: AgentState):
        """Determine if news analysis should continue."""
        return self._should_continue_branch(
            state, "news_messages", "tools_news", "Msg Clear News"
        )

    def should_continue_fundamentals(self, state: AgentState):
        """Determine if fundamentals analysis should continue."""
        return self._should_continue_branch(
            state,
            "fundamentals_messages",
            "tools_fundamentals",
            "Msg Clear Fundamentals",
        )

    def should_continue_trader(self, state: AgentState):
        """Determine if trader should continue with tool calls."""
        messages = state["messages"]
        last_message = messages[-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools_trader"
        return "Msg Clear Trader"

    def should_continue_debate(self, state: AgentState) -> str:
        """Determine if debate should continue."""

        if (
            state["investment_debate_state"]["count"] >= 2 * self.max_debate_rounds
        ):  # 3 rounds of back-and-forth between 2 agents
            return "Research Manager"
        if state["investment_debate_state"]["current_response"].startswith("Bull"):
            return "Bear Researcher"
        return "Bull Researcher"

    def should_continue_risk_analysis(self, state: AgentState) -> str:
        """Determine if risk analysis should continue."""
        if (
            state["risk_debate_state"]["count"] >= 3 * self.max_risk_discuss_rounds
        ):  # 3 rounds of back-and-forth between 3 agents
            return "Risk Judge"
        if state["risk_debate_state"]["latest_speaker"].startswith("Risky"):
            return "Safe Analyst"
        if state["risk_debate_state"]["latest_speaker"].startswith("Safe"):
            return "Neutral Analyst"
        return "Risky Analyst"
