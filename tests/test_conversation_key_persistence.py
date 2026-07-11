import asyncio
import importlib.util
import sys
import types
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from web.backend.database import Base
from web.backend.models import (
    AnalysisRecord,
    ConversationMessage,
    ConversationSession,
    LLMModel,
    LLMProvider,
    User,
    UserConfig,
)


def run(coro):
    return asyncio.run(coro)


def load_conversation_routes_module():
    sys.modules["web.backend.analysis_task"] = types.SimpleNamespace(
        run_analysis_task=lambda *args, **kwargs: None
    )
    route_path = Path("web/backend/routes/conversation_routes.py")
    module_name = "ws17_conversation_routes"
    spec = importlib.util.spec_from_file_location(module_name, route_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class RecordingTaskManager:
    def __init__(self):
        self.submissions = []

    def submit_task(self, *args):
        self.submissions.append(args)
        return False


def current_user():
    return User(
        id=1,
        username="alice",
        email="alice@example.com",
        hashed_password="x",
        role="user",
        is_active=True,
        has_set_password=True,
    )


def test_conversation_analysis_uses_system_default_without_persisting_legacy_key(tmp_path):
    routes = load_conversation_routes_module()
    db_path = tmp_path / "conversation.db"
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    task_manager = RecordingTaskManager()

    async def setup_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with SessionLocal() as session:
            provider = LLMProvider(
                provider_name="openai",
                display_name="OpenAI",
                api_key="sk-system-default",
                base_url="https://api.openai.com/v1",
                is_active=True,
                is_default=True,
            )
            session.add(provider)
            await session.flush()
            session.add_all(
                [
                    current_user(),
                    UserConfig(
                        user_id=1,
                        last_api_key="legacy-secret-must-not-be-used",
                        last_llm_provider="openai",
                        last_backend_url="https://legacy.example/v1",
                        last_research_depth=2,
                    ),
                    LLMModel(
                        provider_id=provider.id,
                        model_name="gpt-4o-mini",
                        display_name="GPT-4o Mini",
                        model_type="shallow_thinker",
                        is_active=True,
                    ),
                    LLMModel(
                        provider_id=provider.id,
                        model_name="gpt-4o",
                        display_name="GPT-4o",
                        model_type="deep_thinker",
                        is_active=True,
                    ),
                    ConversationSession(id="session-1", user_id=1, title="Chat"),
                    ConversationMessage(
                        id="assistant-1",
                        session_id="session-1",
                        user_id=1,
                        role="assistant",
                        content="starting",
                    ),
                ]
            )
            await session.commit()

    run(setup_db())

    async def trigger():
        async with SessionLocal() as session:
            conversation = (
                await session.execute(select(ConversationSession).where(ConversationSession.id == "session-1"))
            ).scalars().one()
            assistant = (
                await session.execute(select(ConversationMessage).where(ConversationMessage.id == "assistant-1"))
            ).scalars().one()
            routes.init_conversation_routes(task_manager, object())
            await routes._trigger_analysis(
                session,
                current_user(),
                conversation,
                assistant,
                "Please analyze AAPL",
            )

    run(trigger())

    assert task_manager.submissions
    submitted_request = task_manager.submissions[0][5]
    assert submitted_request["api_key"] == "sk-system-default"
    assert "legacy-secret-must-not-be-used" not in str(submitted_request)

    async def fetch_record():
        async with SessionLocal() as session:
            return (
                await session.execute(select(AnalysisRecord).where(AnalysisRecord.user_id == 1))
            ).scalars().one()

    record = run(fetch_record())
    assert record.api_key is None
    assert record.llm_provider == "openai"
    assert record.backend_url == "https://api.openai.com/v1"

    run(engine.dispose())
