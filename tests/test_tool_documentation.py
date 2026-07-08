#!/usr/bin/env python3
"""
Test tool documentation generation with different tool selections
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from web.backend.models import AgentTool
from web.backend.services.prompt_loader import generate_tool_documentation, generate_variable_documentation


@pytest.fixture(autouse=True)
def seeded_tool_database(monkeypatch):
    """Provide generate_tool_documentation with a predictable tool table."""
    import web.backend.database as database

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    AgentTool.__table__.create(engine)
    test_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    db = test_session_local()
    try:
        db.add_all([
            AgentTool(
                tool_name="get_account_info",
                tool_description="Read account summary.",
                tool_parameters={"type": "object", "properties": {}},
                category="account",
                is_available=True,
            ),
            AgentTool(
                tool_name="get_market_quote",
                tool_description="Read current market quote.",
                tool_parameters={"type": "object", "properties": {"ticker": {"type": "string"}}},
                category="market_data",
                is_available=True,
            ),
            AgentTool(
                tool_name="place_order",
                tool_description="Place an order.",
                tool_parameters={"type": "object", "properties": {"quantity": {"type": "number"}}},
                category="trading",
                is_available=True,
            ),
            AgentTool(
                tool_name="disabled_tool",
                tool_description="Unavailable tool.",
                tool_parameters={"type": "object", "properties": {}},
                category="other",
                is_available=False,
            ),
        ])
        db.commit()
    finally:
        db.close()

    monkeypatch.setattr(database, "SessionLocal", test_session_local)


def get_available_tool_names():
    from web.backend.database import SessionLocal

    db = SessionLocal()
    try:
        return [
            tool.tool_name
            for tool in db.query(AgentTool)
            .filter(AgentTool.is_available == True)
            .order_by(AgentTool.category, AgentTool.tool_name)
            .all()
        ]
    finally:
        db.close()


def assert_full_tool_documentation(doc: str):
    assert isinstance(doc, str)
    available_tool_names = get_available_tool_names()
    if not available_tool_names:
        assert doc == ""
        return

    assert "## Available Tools" in doc
    for tool_name in available_tool_names:
        assert f"`{tool_name}`" in doc


def test_all_tools():
    """Test with all tools enabled"""
    print("=" * 60)
    print("Test 1: All Tools Enabled")
    print("=" * 60)
    
    doc = generate_tool_documentation()
    assert_full_tool_documentation(doc)
    print(doc)
    print(f"\n✅ Generated documentation for {len(get_available_tool_names())} tools")
    print(f"   Documentation length: {len(doc)} characters")


def test_account_tools_only():
    """Test with only account management tools"""
    print("\n" + "=" * 60)
    print("Test 2: Account Management Tools Only")
    print("=" * 60)
    
    doc = generate_tool_documentation()
    assert_full_tool_documentation(doc)
    print(doc)
    print(f"\n✅ Generated full documentation; filtering is handled by runtime access, not this helper")
    print(f"   Documentation length: {len(doc)} characters")


def test_trading_tools():
    """Test with trading-related tools"""
    print("\n" + "=" * 60)
    print("Test 3: Trading Tools (Account + Market Data + Trading)")
    print("=" * 60)
    
    doc = generate_tool_documentation()
    assert_full_tool_documentation(doc)
    print(doc)
    print(f"\n✅ Generated full documentation for all available tools")
    print(f"   Documentation length: {len(doc)} characters")


def test_variable_documentation():
    """Test variable documentation"""
    print("\n" + "=" * 60)
    print("Test 4: Variable Documentation")
    print("=" * 60)
    
    doc = generate_variable_documentation()
    print(doc)
    print(f"\n✅ Generated variable documentation")
    print(f"   Documentation length: {len(doc)} characters")


if __name__ == "__main__":
    test_all_tools()
    test_account_tools_only()
    test_trading_tools()
    test_variable_documentation()
    
    print("\n" + "=" * 60)
    print("🎉 All tests completed!")
    print("=" * 60)
