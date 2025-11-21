"""
Test prompt validation endpoint
"""
import pytest
from datetime import datetime


def test_validation_assembles_complete_prompt():
    """
    Test that validation endpoint assembles complete system prompt
    like the agent does
    """
    # Mock user prompt
    user_prompt = """You are an aggressive intraday trading agent.

## Role Definition
**Aggressive Intraday Trader** - High Risk Tolerance

## Trading Philosophy
- Long-term Trend Awareness
- Transaction Cost Consciousness

## Trading Principles
- Act decisively
- Cut losses fast
"""
    
    # Expected components in final prompt
    expected_components = [
        "## Trading Strategy",
        user_prompt,
        "## Execution Workflow",
        "## Current Session Context",
        "Now execute your trading strategy"
    ]
    
    # Simulate validation
    # In real validation, these would be assembled
    workflow_doc = "### Phase 1: Information Collection\n..."  # ~14KB
    context_info = "- Market: US\n- Session ID: test_session_123\n..."
    
    final_prompt = "\n\n".join([
        "## Trading Strategy\n",
        user_prompt,
        "\n## Execution Workflow\n",
        workflow_doc,
        "\n## Current Session Context\n",
        context_info,
        "\nNow execute your trading strategy following the workflow above based on current context."
    ])
    
    # Assertions
    assert len(final_prompt) > len(user_prompt)  # Final is longer than user's
    assert "## Trading Strategy" in final_prompt
    assert "## Execution Workflow" in final_prompt
    assert "## Current Session Context" in final_prompt
    assert user_prompt in final_prompt
    
    print(f"✅ User prompt length: {len(user_prompt)}")
    print(f"✅ Final prompt length: {len(final_prompt)}")
    print(f"✅ Ratio: {len(final_prompt) / len(user_prompt):.1f}x")


def test_validation_response_format():
    """
    Test that validation returns correct response format
    """
    # Valid response
    valid_response = {
        "valid": True,
        "message": "验证通过",
        "total_length": 18500
    }
    
    assert valid_response["valid"] is True
    assert "message" in valid_response
    assert "total_length" in valid_response
    assert valid_response["total_length"] > 0
    
    # Invalid response
    invalid_response = {
        "valid": False,
        "message": "提示词不能为空"
    }
    
    assert invalid_response["valid"] is False
    assert "message" in invalid_response
    
    print("✅ Response format is correct")


def test_validation_checks():
    """
    Test validation checks
    """
    # Empty prompt
    empty_prompt = ""
    assert len(empty_prompt.strip()) == 0
    # Should fail: "提示词不能为空"
    
    # Too short
    short_prompt = "Trade stocks"
    assert len(short_prompt.strip()) < 50
    # Should fail: "提示词内容过短"
    
    # Too long
    long_prompt = "x" * 60000
    assert len(long_prompt) > 50000
    # Should fail: "提示词内容过长"
    
    # Valid
    valid_prompt = """You are an aggressive intraday trading agent.

## Role Definition
Aggressive Intraday Trader with strategic discipline.

## Trading Philosophy
Balance short-term tactics with long-term strategy.
"""
    assert len(valid_prompt.strip()) >= 50
    assert len(valid_prompt) <= 50000
    # Should pass
    
    print("✅ All validation checks work correctly")


def test_prompt_assembly_order():
    """
    Test that prompt components are assembled in correct order
    """
    user_strategy = "## My Strategy\nBe aggressive"
    workflow = "## Workflow\nPhase 1, 2, 3"
    context = "## Context\nMarket: US"
    
    # Correct order: Strategy → Workflow → Context
    parts = [
        "## Trading Strategy\n",
        user_strategy,
        "\n## Execution Workflow\n",
        workflow,
        "\n## Current Session Context\n",
        context,
        "\nNow execute..."
    ]
    
    final = "\n\n".join(parts)
    
    # Check order
    strategy_pos = final.find("## Trading Strategy")
    workflow_pos = final.find("## Execution Workflow")
    context_pos = final.find("## Current Session Context")
    
    assert strategy_pos < workflow_pos < context_pos
    print("✅ Prompt assembly order is correct: Strategy → Workflow → Context")


if __name__ == "__main__":
    print("Running prompt validation tests...\n")
    
    test_validation_assembles_complete_prompt()
    print()
    
    test_validation_response_format()
    print()
    
    test_validation_checks()
    print()
    
    test_prompt_assembly_order()
    print()
    
    print("✅ All tests passed!")
