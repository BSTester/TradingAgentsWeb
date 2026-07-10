import asyncio
import importlib.util
import sys
import types
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from web.backend.database import Base
from web.backend.models import AnalysisRecord, User, UserConfig


def run(coro):
    return asyncio.run(coro)


def load_analysis_routes_module():
    sys.modules["web.backend.analysis_task"] = types.SimpleNamespace(
        run_analysis_task=lambda *args, **kwargs: None
    )
    route_path = Path("web/backend/routes/analysis_routes.py")
    module_name = "ws14_analysis_routes"
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


def test_analyze_uses_request_api_key_without_persisting_to_user_config_or_analysis_record(tmp_path):
    routes = load_analysis_routes_module()
    db_path = tmp_path / "analysis.db"
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
            session.add_all(
                [
                    User(
                        id=1,
                        username="alice",
                        email="alice@example.com",
                        hashed_password="x",
                        role="user",
                        is_active=True,
                        has_set_password=True,
                    ),
                    UserConfig(
                        user_id=1,
                        last_api_key="legacy-key-must-not-be-used",
                        last_llm_provider="openai",
                        last_backend_url="https://legacy.example/v1",
                    ),
                ]
            )
            await session.commit()

    run(setup_db())

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    async def override_current_user():
        return User(
            id=1,
            username="alice",
            email="alice@example.com",
            hashed_password="x",
            role="user",
            is_active=True,
            has_set_password=True,
        )

    routes.init_analysis_routes(task_manager, object())
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = override_get_db
    app.dependency_overrides[routes.get_current_active_user] = override_current_user
    client = TestClient(app)

    request_key = "sk-request-only"
    response = client.post(
        "/api/analyze",
        json={
            "ticker": "AAPL",
            "analysis_date": "2024-01-01",
            "analysts": ["market"],
            "research_depth": 1,
            "llm_provider": "openai",
            "backend_url": "https://api.openai.com/v1",
            "shallow_thinker": "gpt-4o-mini",
            "deep_thinker": "gpt-4o",
            "api_key": request_key,
        },
    )

    assert response.status_code == 200, response.text
    assert task_manager.submissions
    submitted_request = task_manager.submissions[0][5]
    assert submitted_request["api_key"] == request_key

    async def fetch_persisted():
        async with SessionLocal() as session:
            config = (
                await session.execute(select(UserConfig).where(UserConfig.user_id == 1))
            ).scalars().one()
            record = (
                await session.execute(select(AnalysisRecord).where(AnalysisRecord.user_id == 1))
            ).scalars().one()
            return config, record

    user_config, analysis_record = run(fetch_persisted())
    assert user_config.last_api_key == "legacy-key-must-not-be-used"
    assert analysis_record.api_key is None

    run(engine.dispose())
