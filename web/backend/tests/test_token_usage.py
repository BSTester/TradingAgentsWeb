"""Token 用量收集器测试：usage 解析器 + 累加 + 入库（内存 SQLite，fail-open）。"""

from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from web.backend.models import AnalysisLog, AnalysisRecord, Base, User
from web.backend.services.token_usage import TokenUsageCollector, extract_llm_usage


# ---------------------------------------------------------------------------
# extract_llm_usage 解析器
# ---------------------------------------------------------------------------

def _response_with_usage_metadata(input_tokens, output_tokens):
    message = SimpleNamespace(
        usage_metadata={
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
        }
    )
    generation = SimpleNamespace(message=message, generation_info={})
    return SimpleNamespace(
        generations=[[generation]], response_metadata={}, llm_output=None
    )


def test_extract_prefers_message_usage_metadata():
    assert extract_llm_usage(_response_with_usage_metadata(120, 45)) == {
        "input": 120,
        "output": 45,
    }


def test_extract_from_response_metadata_token_usage():
    response = SimpleNamespace(
        generations=[],
        response_metadata={"token_usage": {"prompt_tokens": 7, "completion_tokens": 3}},
        llm_output=None,
    )
    assert extract_llm_usage(response) == {"input": 7, "output": 3}


def test_extract_from_llm_output_usage():
    response = SimpleNamespace(
        generations=[],
        response_metadata={},
        llm_output={"usage": {"input_tokens": 5, "output_tokens": 2}},
    )
    assert extract_llm_usage(response) == {"input": 5, "output": 2}


def test_extract_from_legacy_generation_info():
    generation = SimpleNamespace(
        message=None,
        generation_info={"token_usage": {"prompt_tokens": 9, "completion_tokens": 4}},
    )
    response = SimpleNamespace(
        generations=[[generation]], response_metadata={}, llm_output={}
    )
    assert extract_llm_usage(response) == {"input": 9, "output": 4}


def test_extract_returns_none_without_usage():
    response = SimpleNamespace(
        generations=[[]], response_metadata={"model": "gpt-x"}, llm_output={}
    )
    assert extract_llm_usage(response) is None
    assert extract_llm_usage(None) is None


def test_no_double_counting_when_multiple_sources_present():
    # usage_metadata 与 response_metadata 同时存在时，只取首个命中，绝不重复计数
    message = SimpleNamespace(
        usage_metadata={"input_tokens": 1, "output_tokens": 1}
    )
    generation = SimpleNamespace(message=message, generation_info={})
    response = SimpleNamespace(
        generations=[[generation]],
        response_metadata={"token_usage": {"prompt_tokens": 99, "completion_tokens": 99}},
        llm_output=None,
    )
    assert extract_llm_usage(response) == {"input": 1, "output": 1}


# ---------------------------------------------------------------------------
# 累加 + persist（内存 SQLite）
# ---------------------------------------------------------------------------

@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


def _seed_record(db_session, analysis_id="an-usage-1"):
    db_session.add(
        User(
            username="usage-tester",
            email="usage-tester@example.com",
            hashed_password="x",
        )
    )
    db_session.commit()
    user = db_session.query(User).first()
    record = AnalysisRecord(
        analysis_id=analysis_id,
        user_id=user.id,
        ticker="600519",
        analysis_date="2026-07-01",
        analysts=["market", "news"],
        research_depth=1,
        llm_provider="openai",
        shallow_thinker="gpt-fast",
        deep_thinker="reasoning",
        backend_url="http://localhost:8000",
        status="running",
    )
    db_session.add(record)
    db_session.commit()
    return user


def test_collector_accumulates_and_persists(db_session):
    _seed_record(db_session)

    collector = TokenUsageCollector()
    collector.on_llm_end(_response_with_usage_metadata(100, 10))
    collector.on_llm_end(_response_with_usage_metadata(50, 5))
    # 无用量信息的调用不计入
    collector.on_llm_end(
        SimpleNamespace(generations=[[]], response_metadata={}, llm_output={})
    )

    assert collector.llm_call_count == 2
    assert collector.input_tokens == 150
    assert collector.output_tokens == 15
    assert collector.total_tokens == 165
    assert collector.has_usage is True

    assert collector.persist(db_session, "an-usage-1") is True

    logs = db_session.query(AnalysisLog).filter(AnalysisLog.agent == "usage").all()
    assert len(logs) == 1
    assert logs[0].level == "info"
    assert logs[0].step == "Token用量"
    assert logs[0].input_tokens == 150
    assert logs[0].output_tokens == 15
    assert logs[0].log_metadata["total_tokens"] == 165
    assert logs[0].log_metadata["llm_call_count"] == 2
    assert "Token 用量" in logs[0].message


def test_persist_skips_when_no_usage(db_session):
    _seed_record(db_session)

    collector = TokenUsageCollector()
    assert collector.persist(db_session, "an-usage-1") is False
    assert db_session.query(AnalysisLog).count() == 0


def test_persist_is_fail_open_for_unknown_analysis_id(db_session):
    _seed_record(db_session, analysis_id="an-real")

    collector = TokenUsageCollector()
    collector.on_llm_end(_response_with_usage_metadata(10, 1))
    # 分析记录不存在：返回 False 且不抛异常
    assert collector.persist(db_session, "an-missing") is False