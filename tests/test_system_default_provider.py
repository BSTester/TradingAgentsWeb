import unittest
import asyncio
import importlib.util
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from web.backend.database import Base
from web.backend.models import LLMModel, LLMProvider
from web.backend.services.system_default_provider import (
    get_public_system_default_provider,
    set_system_default_provider,
)


def _load_config_routes_module():
    module_path = Path(__file__).resolve().parents[1] / "web/backend/routes/config_routes.py"
    spec = importlib.util.spec_from_file_location("config_routes_under_test", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


get_config = _load_config_routes_module().get_config


class SystemDefaultProviderTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        asyncio.get_running_loop().slow_callback_duration = 1.0
        self.engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        self.session_factory = async_sessionmaker(
            self.engine,
            expire_on_commit=False,
        )
        self.db = self.session_factory()

    async def asyncTearDown(self):
        await self.db.close()
        await self.engine.dispose()

    async def _provider(
        self,
        provider_name: str,
        *,
        is_active: bool = True,
        is_default: bool = False,
        api_key: str | None = "sk-test-secret",
        base_url: str | None = "https://api.example.test/v1",
    ) -> LLMProvider:
        provider = LLMProvider(
            provider_name=provider_name,
            display_name=provider_name.title(),
            api_key=api_key,
            base_url=base_url,
            is_active=is_active,
            is_default=is_default,
        )
        self.db.add(provider)
        await self.db.commit()
        await self.db.refresh(provider)
        return provider

    async def test_set_default_switches_uniquely_and_returns_no_secret(self):
        old_default = await self._provider("old", is_default=True)
        new_default = await self._provider("new")
        self.db.add_all(
            [
                LLMModel(
                    provider_id=new_default.id,
                    model_name="quick-model",
                    model_type="shallow_thinker",
                    display_name="Quick Model",
                    is_active=True,
                ),
                LLMModel(
                    provider_id=new_default.id,
                    model_name="deep-model",
                    model_type="deep_thinker",
                    display_name="Deep Model",
                    is_active=True,
                ),
            ]
        )
        await self.db.commit()

        summary = await set_system_default_provider(self.db, new_default.id)

        await self.db.refresh(old_default)
        await self.db.refresh(new_default)
        self.assertFalse(old_default.is_default)
        self.assertTrue(new_default.is_default)
        self.assertEqual(summary["provider_id"], new_default.id)
        self.assertEqual(summary["provider_name"], "new")
        self.assertEqual(summary["shallow_model"], "quick-model")
        self.assertEqual(summary["deep_model"], "deep-model")
        self.assertTrue(summary["credential_configured"])
        self.assertNotIn("api_key", summary)
        self.assertNotIn("api_key_masked", summary)

    async def test_set_default_rejects_inactive_provider_and_preserves_current_default(self):
        current_default = await self._provider("current", is_default=True)
        inactive = await self._provider("inactive", is_active=False)

        with self.assertRaises(HTTPException) as raised:
            await set_system_default_provider(self.db, inactive.id)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(
            raised.exception.detail["error"]["code"],
            "SYSTEM_DEFAULT_PROVIDER_INACTIVE",
        )

        await self.db.refresh(current_default)
        await self.db.refresh(inactive)
        self.assertTrue(current_default.is_default)
        self.assertFalse(inactive.is_default)

    async def test_set_default_rejects_provider_without_backend_credential(self):
        provider = await self._provider("missing-key", api_key="  ")

        with self.assertRaises(HTTPException) as raised:
            await set_system_default_provider(self.db, provider.id)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(
            raised.exception.detail["error"]["code"],
            "SYSTEM_DEFAULT_PROVIDER_CREDENTIAL_MISSING",
        )
        await self.db.refresh(provider)
        self.assertFalse(provider.is_default)

    async def test_public_summary_excludes_all_credential_material(self):
        default = await self._provider("public", is_default=True)

        summary = await get_public_system_default_provider(self.db)

        self.assertEqual(summary["provider_id"], default.id)
        self.assertEqual(summary["provider_name"], "public")
        self.assertNotIn("api_key", summary)
        self.assertNotIn("api_key_masked", summary)
        self.assertNotIn("credential_configured", summary)

    async def test_config_response_includes_public_system_default_summary(self):
        default = await self._provider("config", is_default=True)

        config = await get_config(db=self.db)

        self.assertEqual(config["system_default"]["provider_id"], default.id)
        self.assertEqual(config["system_default"]["provider_name"], "config")
        self.assertNotIn("api_key", config["system_default"])

        providers = await self.db.execute(select(LLMProvider))
        self.assertEqual(len(providers.scalars().all()), 1)


if __name__ == "__main__":
    unittest.main()
