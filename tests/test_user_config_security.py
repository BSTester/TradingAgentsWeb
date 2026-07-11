import asyncio
import importlib.util
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from web.backend.database import Base
from web.backend.models import User, UserConfig


def run(coro):
    return asyncio.run(coro)


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


def load_user_config_routes_module():
    route_path = Path("web/backend/routes/user_config_routes.py")
    module_name = "ws17_user_config_routes"
    spec = importlib.util.spec_from_file_location(module_name, route_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def build_client(tmp_path):
    user_config_routes = load_user_config_routes_module()
    db_path = tmp_path / "user-config.db"
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def setup_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with SessionLocal() as session:
            session.add_all(
                [
                    current_user(),
                    UserConfig(
                        user_id=1,
                        last_ticker="AAPL",
                        last_analysts=["market"],
                        last_research_depth=2,
                        last_llm_provider="openai",
                        last_shallow_thinker="gpt-4o-mini",
                        last_deep_thinker="gpt-4o",
                        last_backend_url="https://api.openai.com/v1",
                        last_api_key="legacy-secret-must-not-leak",
                    ),
                ]
            )
            await session.commit()

    run(setup_db())

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    async def override_current_user():
        return current_user()

    app = FastAPI()
    app.include_router(user_config_routes.router)
    app.dependency_overrides[user_config_routes.get_db] = override_get_db
    app.dependency_overrides[user_config_routes.get_current_active_user] = override_current_user

    return TestClient(app), SessionLocal, engine


def test_user_config_get_does_not_return_legacy_api_key(tmp_path):
    client, _session_factory, engine = build_client(tmp_path)

    response = client.get("/api/user/config")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert "legacy-secret-must-not-leak" not in str(payload)
    assert "last_api_key" not in payload
    assert payload["last_llm_provider"] == "openai"
    assert payload["last_backend_url"] == "https://api.openai.com/v1"

    run(engine.dispose())


def test_user_config_update_ignores_legacy_api_key_writes(tmp_path):
    client, SessionLocal, engine = build_client(tmp_path)

    response = client.put(
        "/api/user/config",
        json={
            "last_ticker": "MSFT",
            "last_api_key": "new-secret-must-not-persist",
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert "new-secret-must-not-persist" not in str(payload)
    assert "last_api_key" not in payload

    async def fetch_config():
        async with SessionLocal() as session:
            return (
                await session.execute(select(UserConfig).where(UserConfig.user_id == 1))
            ).scalars().one()

    config = run(fetch_config())
    assert config.last_ticker == "MSFT"
    assert config.last_api_key == "legacy-secret-must-not-leak"

    run(engine.dispose())
