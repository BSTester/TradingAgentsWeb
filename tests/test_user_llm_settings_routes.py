import asyncio
import importlib.util
import sys
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from web.backend.database import Base
from web.backend.models import LLMProvider, User, UserConfig


FORBIDDEN_KEY_FIELDS = {"api_key", "has_api_key", "api_key_masked"}


def load_user_llm_settings_module():
    route_path = Path("web/backend/routes/user_llm_settings_routes.py")
    if not route_path.exists():
        pytest.skip("route module is not implemented yet")

    module_name = "ws14_user_llm_settings_routes"
    spec = importlib.util.spec_from_file_location(module_name, route_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def load_user_llm_provider_model():
    try:
        from web.backend.models import UserLLMProviderSetting
    except ImportError as exc:
        raise AssertionError("UserLLMProviderSetting model is missing") from exc
    return UserLLMProviderSetting


def assert_no_user_key_fields(payload):
    if isinstance(payload, dict):
        leaked = FORBIDDEN_KEY_FIELDS.intersection(payload)
        assert not leaked, f"response leaked forbidden user key fields: {sorted(leaked)}"
        for value in payload.values():
            assert_no_user_key_fields(value)
    elif isinstance(payload, list):
        for item in payload:
            assert_no_user_key_fields(item)


def assert_no_secret_text(payload, secret: str):
    assert secret not in str(payload)


def run(coro):
    return asyncio.run(coro)


@pytest.fixture()
def ws14_app(tmp_path, monkeypatch):
    routes = load_user_llm_settings_module()
    UserLLMProviderSetting = load_user_llm_provider_model()

    db_path = tmp_path / "ws14.db"
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
                    User(
                        id=1,
                        username="alice",
                        email="alice@example.com",
                        hashed_password="x",
                        role="user",
                        is_active=True,
                        has_set_password=True,
                    ),
                    User(
                        id=2,
                        username="bob",
                        email="bob@example.com",
                        hashed_password="x",
                        role="user",
                        is_active=True,
                        has_set_password=True,
                    ),
                    UserConfig(
                        user_id=1,
                        last_llm_provider="legacy-openai",
                        last_backend_url="https://legacy.example/v1",
                        last_api_key="legacy-secret-must-not-migrate",
                    ),
                    LLMProvider(
                        id=10,
                        provider_name="openai",
                        display_name="OpenAI",
                        api_key="system-secret",
                        base_url="https://api.openai.com/v1",
                        is_active=True,
                    ),
                ]
            )
            await session.commit()

    run(setup_db())

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    current_user_id = {"value": 1}

    async def override_current_user():
        return User(
            id=current_user_id["value"],
            username=f"user{current_user_id['value']}",
            email=f"user{current_user_id['value']}@example.com",
            hashed_password="x",
            role="user",
            is_active=True,
            has_set_password=True,
        )

    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = override_get_db
    app.dependency_overrides[routes.get_current_active_user] = override_current_user

    @contextmanager
    def as_user(user_id: int):
        previous = current_user_id["value"]
        current_user_id["value"] = user_id
        try:
            yield
        finally:
            current_user_id["value"] = previous

    client = TestClient(app)

    yield {
        "client": client,
        "as_user": as_user,
        "sessionmaker": SessionLocal,
        "engine": engine,
        "model": UserLLMProviderSetting,
        "routes": routes,
    }

    run(engine.dispose())


def test_user_llm_settings_route_module_exists():
    assert Path("web/backend/routes/user_llm_settings_routes.py").exists()


def create_provider(client, **overrides):
    payload = {
        "provider_name": "openai",
        "provider_type": "catalog",
        "catalog_provider_id": 10,
        "display_name": "Alice OpenAI",
        "base_url": "https://api.openai.com/v1",
        "shallow_model": "gpt-4o-mini",
        "deep_model": "gpt-4o",
        "is_enabled": True,
        "is_default": False,
    }
    payload.update(overrides)
    return client.post("/api/user/llm-settings/providers", json=payload)


def test_create_list_and_delete_keep_user_keys_out_and_enforce_single_default(ws14_app):
    client = ws14_app["client"]

    rejected = create_provider(client, provider_name="leaky", api_key="sk-user-secret")
    assert rejected.status_code == 422

    first_response = create_provider(client, provider_name="openai", is_default=True)
    assert first_response.status_code == 201, first_response.text
    first = first_response.json()
    assert_no_user_key_fields(first)
    assert first["provider_name"] == "openai"
    assert first["provider_type"] == "catalog"
    assert first["is_default"] is True
    assert first["last_validation_status"] == "untested"

    duplicate = create_provider(client, provider_name="openai")
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "USER_LLM_PROVIDER_DUPLICATE"

    second_response = create_provider(
        client,
        provider_name="custom-openai",
        provider_type="custom",
        catalog_provider_id=None,
        display_name="Custom OpenAI",
        base_url="https://llm.example.com/v1",
        is_default=True,
    )
    assert second_response.status_code == 201, second_response.text
    second = second_response.json()
    assert second["is_default"] is True

    listed = client.get("/api/user/llm-settings")
    assert listed.status_code == 200
    body = listed.json()
    assert_no_user_key_fields(body)
    assert body["default_provider_id"] == second["id"]
    assert body["has_legacy_config"] is True
    assert body["legacy_config"]["last_llm_provider"] == "legacy-openai"
    defaults = [provider for provider in body["providers"] if provider["is_default"]]
    assert [provider["id"] for provider in defaults] == [second["id"]]

    deleted = client.delete(f"/api/user/llm-settings/providers/{second['id']}")
    assert deleted.status_code == 204

    after_delete = client.get("/api/user/llm-settings").json()
    assert after_delete["default_provider_id"] == first["id"]
    remaining = after_delete["providers"][0]
    assert remaining["id"] == first["id"]
    assert remaining["is_default"] is True


def test_users_cannot_access_each_others_provider_metadata(ws14_app):
    client = ws14_app["client"]
    as_user = ws14_app["as_user"]

    created = create_provider(client, provider_name="openai", is_default=True).json()

    with as_user(2):
        assert client.get("/api/user/llm-settings").json()["providers"] == []

        denied_update = client.patch(
            f"/api/user/llm-settings/providers/{created['id']}",
            json={"display_name": "Bob tries to edit Alice"},
        )
        assert denied_update.status_code == 404
        assert denied_update.json()["error"]["code"] == "USER_LLM_PROVIDER_NOT_FOUND"

        denied_delete = client.delete(f"/api/user/llm-settings/providers/{created['id']}")
        assert denied_delete.status_code == 404

        same_slug_for_different_user = create_provider(
            client,
            provider_name="openai",
            display_name="Bob OpenAI",
        )
        assert same_slug_for_different_user.status_code == 201


def test_connection_test_updates_validation_state_without_echoing_or_storing_key(ws14_app, monkeypatch):
    client = ws14_app["client"]
    SessionLocal = ws14_app["sessionmaker"]
    UserLLMProviderSetting = ws14_app["model"]
    routes = ws14_app["routes"]

    created = create_provider(client, provider_name="openai").json()
    seen = {}

    async def fake_validator(provider_name, api_key, base_url, model=None):
        seen.update(
            {
                "provider_name": provider_name,
                "api_key": api_key,
                "base_url": base_url,
                "model": model,
            }
        )
        return {
            "valid": False,
            "message": f"upstream rejected {api_key}",
            "details": {"Authorization": f"Bearer {api_key}", "safe_hint": "check quota"},
        }

    monkeypatch.setattr(routes, "validate_user_llm_provider_connection", fake_validator)

    secret = "sk-live-user-secret"
    response = client.post(
        f"/api/user/llm-settings/providers/{created['id']}/test",
        json={"api_key": secret, "base_url": "https://override.example/v1", "model": "gpt-test"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["valid"] is False
    assert payload["last_validation_status"] == "failed"
    assert_no_secret_text(payload, secret)
    assert seen == {
        "provider_name": "openai",
        "api_key": secret,
        "base_url": "https://override.example/v1",
        "model": "gpt-test",
    }

    async def fetch_provider():
        async with SessionLocal() as session:
            result = await session.execute(
                select(UserLLMProviderSetting).where(UserLLMProviderSetting.id == created["id"])
            )
            return result.scalars().one()

    provider = run(fetch_provider())
    assert provider.last_validation_status == "failed"
    assert provider.last_validated_at is not None
    assert not any("api_key" in column.name for column in UserLLMProviderSetting.__table__.columns)
