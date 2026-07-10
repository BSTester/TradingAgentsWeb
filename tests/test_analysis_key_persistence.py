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
from web.backend.models import AnalysisRecord, LLMProvider, ScheduledTask, User, UserConfig


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


def load_scheduled_task_routes_module():
    scheduler_module = "web.backend.services.scheduler_service"
    previous_scheduler_module = sys.modules.get(scheduler_module)
    sys.modules[scheduler_module] = types.SimpleNamespace(get_scheduler_service=lambda: None)
    route_path = Path("web/backend/routes/scheduled_task_routes.py")
    module_name = "ws16_scheduled_task_routes"
    spec = importlib.util.spec_from_file_location(module_name, route_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    finally:
        if previous_scheduler_module is None:
            sys.modules.pop(scheduler_module, None)
        else:
            sys.modules[scheduler_module] = previous_scheduler_module
    return module


class RecordingTaskManager:
    def __init__(self):
        self.submissions = []

    def submit_task(self, *args):
        self.submissions.append(args)
        return False


class FakeScheduler:
    def add_scheduled_task(self, **kwargs):
        self.added = kwargs

    def get_next_run_time(self, job_id):
        return None

    def remove_scheduled_task(self, job_id):
        self.removed = job_id


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


def known_provider(provider_name="openai"):
    return LLMProvider(
        provider_name=provider_name,
        display_name=provider_name.title(),
        base_url=f"https://api.{provider_name}.example/v1",
        is_active=True,
        is_default=False,
    )


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
                    known_provider("openai"),
                ]
            )
            await session.commit()

    run(setup_db())

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    async def override_current_user():
        return current_user()

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


def test_analyze_llm_config_errors_use_stable_error_envelope(tmp_path):
    routes = load_analysis_routes_module()
    db_path = tmp_path / "analysis-error.db"
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def setup_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with SessionLocal() as session:
            session.add(current_user())
            await session.commit()

    run(setup_db())

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    async def override_current_user():
        return current_user()

    routes.init_analysis_routes(RecordingTaskManager(), object())
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = override_get_db
    app.dependency_overrides[routes.get_current_active_user] = override_current_user
    client = TestClient(app)

    response = client.post(
        "/api/analyze",
        json={
            "ticker": "AAPL",
            "analysis_date": "2024-01-01",
            "analysts": ["market"],
            "research_depth": 1,
        },
    )

    assert response.status_code == 409, response.text
    body = response.json()
    assert "detail" not in body
    assert body["error"]["code"] == "SYSTEM_DEFAULT_PROVIDER_NOT_SET"
    assert body["error"]["message"]

    run(engine.dispose())


def test_scheduled_task_creation_does_not_persist_request_api_key(tmp_path):
    routes = load_scheduled_task_routes_module()
    db_path = tmp_path / "scheduled.db"
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def setup_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with SessionLocal() as session:
            session.add_all([current_user(), known_provider("openai")])
            await session.commit()

    run(setup_db())

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    async def override_current_user():
        return current_user()

    routes.get_scheduler_service = lambda: FakeScheduler()
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = override_get_db
    app.dependency_overrides[routes.get_current_active_user] = override_current_user
    client = TestClient(app)

    request_key = "sk-request-only"
    response = client.post(
        "/api/scheduled-tasks",
        json={
            "task_name": "Daily AAPL",
            "ticker": "AAPL",
            "analysts": ["market"],
            "research_depth": 1,
            "llm_provider": "openai",
            "backend_url": "https://api.openai.com/v1",
            "shallow_thinker": "gpt-4o-mini",
            "deep_thinker": "gpt-4o",
            "api_key": request_key,
            "is_public": False,
            "execution_cycle": "daily",
            "execution_time": "09:30",
        },
    )

    assert response.status_code == 201, response.text

    async def fetch_task():
        async with SessionLocal() as session:
            return (
                await session.execute(select(ScheduledTask).where(ScheduledTask.user_id == 1))
            ).scalars().one()

    scheduled_task = run(fetch_task())
    assert scheduled_task.api_key is None

    run(engine.dispose())
