# TradingAgents/graph/propagation.py

from typing import Dict, Any, Optional
from tradingagents.agents.utils.agent_states import (
    AgentState,
    InvestDebateState,
    RiskDebateState,
)


class Propagator:
    """Handles state initialization and propagation through the graph."""

    def __init__(self, max_recur_limit=100):
        """Initialize with configuration parameters."""
        self.max_recur_limit = max_recur_limit

    def create_initial_state(
        self,
        company_name: str,
        trade_date: str,
        user_id: Optional[int] = None,
        previous_decision_reflection: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create the initial state for the agent graph.
        
        Args:
            company_name: Company name or ticker to analyze
            trade_date: Date of analysis
            user_id: Optional user ID for accessing user-specific configurations
        """
        state = {
            "messages": [("human", company_name)],
            "company_of_interest": company_name,
            "ticker": company_name,  # Initially same as company_name, will be updated by risk_manager
            "trade_date": str(trade_date),
            "investment_debate_state": InvestDebateState(
                {"history": "", "current_response": "", "count": 0}
            ),
            "risk_debate_state": RiskDebateState(
                {
                    "history": "",
                    "current_risky_response": "",
                    "current_safe_response": "",
                    "current_neutral_response": "",
                    "count": 0,
                }
            ),
            "market_report": "",
            "fundamentals_report": "",
            "sentiment_report": "",
            "news_report": "",
            "grounded_evidence": [],
            "stage_log": [],
            "structured_report": {},
            "reflection": {},
            "previous_decision_reflection": previous_decision_reflection,
        }
        
        # Add user_id to state if provided
        if user_id is not None:
            state["user_id"] = user_id
        
        return state

    def get_graph_args(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get arguments for the graph invocation.
        
        Args:
            user_id: Optional user ID to pass to tools for database queries
            
        Returns:
            dict: Configuration for graph execution
        """
        config = {
            "recursion_limit": self.max_recur_limit
        }
        
        # Add user_id to configurable if provided
        if user_id is not None:
            config["configurable"] = {"user_id": user_id}
        
        return {
            "stream_mode": "values",
            "config": config,
        }
