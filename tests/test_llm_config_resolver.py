import unittest

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from web.backend.database import Base
from web.backend.models import LLMModel, LLMProvider, UserLLMProviderSetting
from web.backend.services.llm_config_resolver import resolve_llm_config


class LLMConfigResolverTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
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

    async def _system_default(self) -> LLMProvider:
        provider = LLMProvider(
            provider_name="openai",
            display_name="OpenAI",
            api_key="sk-system",
            base_url="https://api.openai.com/v1",
            is_active=True,
            is_default=True,
        )
        self.db.add(provider)
        await self.db.flush()
        self.db.add_all(
            [
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
            ]
        )
        await self.db.commit()
        await self.db.refresh(provider)
        return provider

    async def test_request_level_key_uses_request_config(self):
        await self._system_default()

        resolved = await resolve_llm_config(
            self.db,
            user_id=1,
            llm_provider="deepseek",
            backend_url="https://api.deepseek.com/v1",
            shallow_thinker="deepseek-chat",
            deep_thinker="deepseek-reasoner",
            api_key="sk-request",
        )

        self.assertEqual(resolved.source, "request")
        self.assertEqual(resolved.llm_provider, "deepseek")
        self.assertEqual(resolved.backend_url, "https://api.deepseek.com/v1")
        self.assertEqual(resolved.shallow_thinker, "deepseek-chat")
        self.assertEqual(resolved.deep_thinker, "deepseek-reasoner")
        self.assertEqual(resolved.api_key, "sk-request")

    async def test_missing_key_uses_system_default_when_no_user_provider_matches(self):
        await self._system_default()

        resolved = await resolve_llm_config(
            self.db,
            user_id=1,
            llm_provider="openai",
            backend_url="",
            shallow_thinker="",
            deep_thinker="",
            api_key=None,
        )

        self.assertEqual(resolved.source, "system_default")
        self.assertEqual(resolved.llm_provider, "openai")
        self.assertEqual(resolved.backend_url, "https://api.openai.com/v1")
        self.assertEqual(resolved.shallow_thinker, "gpt-4o-mini")
        self.assertEqual(resolved.deep_thinker, "gpt-4o")
        self.assertEqual(resolved.api_key, "sk-system")

    async def test_missing_key_without_system_default_is_actionable_error(self):
        with self.assertRaises(HTTPException) as raised:
            await resolve_llm_config(
                self.db,
                user_id=1,
                llm_provider="openai",
                backend_url="",
                shallow_thinker="",
                deep_thinker="",
                api_key=None,
            )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("系统默认 provider", raised.exception.detail)

    async def test_explicit_user_provider_without_request_key_does_not_fallback(self):
        await self._system_default()
        self.db.add(
            UserLLMProviderSetting(
                user_id=1,
                provider_name="deepseek",
                provider_type="custom",
                display_name="My DeepSeek",
                base_url="https://api.deepseek.com/v1",
                shallow_model="deepseek-chat",
                deep_model="deepseek-reasoner",
                is_enabled=True,
                is_default=True,
            )
        )
        await self.db.commit()

        with self.assertRaises(HTTPException) as raised:
            await resolve_llm_config(
                self.db,
                user_id=1,
                llm_provider="deepseek",
                backend_url="https://api.deepseek.com/v1",
                shallow_thinker="deepseek-chat",
                deep_thinker="deepseek-reasoner",
                api_key="",
            )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("当前浏览器未随请求提供 KEY", raised.exception.detail)

    async def test_request_level_key_rejects_invalid_base_url(self):
        with self.assertRaises(HTTPException) as raised:
            await resolve_llm_config(
                self.db,
                user_id=1,
                llm_provider="openai",
                backend_url="not-a-url",
                shallow_thinker="gpt-4o-mini",
                deep_thinker="gpt-4o",
                api_key="sk-request",
            )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("base URL 无效", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()
