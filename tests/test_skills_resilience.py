import time
import unittest

from web.backend.services.skills.base import (
    RoutedSkillProvider,
    SkillProviderExecutionError,
    clear_skill_event_sink,
    set_skill_event_sink,
)


def _provider(action, *, timeout_seconds=0.05, fallback_message="degraded data"):
    return RoutedSkillProvider(
        name="market-data",
        display_name="Market data",
        description="test provider",
        input_schema={},
        providers=["test"],
        markets=["US"],
        actions={"fetch": action},
        primary_source="test",
        fallback_source="fallback",
        timeout_seconds=timeout_seconds,
        fallback_message=fallback_message,
    )


class SkillsResilienceTests(unittest.TestCase):
    def tearDown(self):
        clear_skill_event_sink()

    def test_timeout_returns_degraded_result_and_emits_warning(self):
        events = []
        set_skill_event_sink(events.append)

        def slow_fetch(**_kwargs):
            time.sleep(0.2)
            return "late result"

        provider = _provider(slow_fetch)
        started_at = time.monotonic()
        result = provider.execute("fetch", symbol="AAPL")

        self.assertLess(time.monotonic() - started_at, 0.15)
        self.assertEqual(result, "degraded data")
        self.assertIn("timed out", provider.last_error)
        self.assertEqual(events[0]["severity"], "warning")
        self.assertEqual(events[0]["skill"], "market-data")
        self.assertTrue(events[0]["partial"])
        self.assertTrue(events[0]["retryable"])

    def test_failure_returns_degraded_result_and_emits_warning(self):
        events = []
        set_skill_event_sink(events.append)

        def failing_fetch(**_kwargs):
            raise RuntimeError("provider down")

        provider = _provider(failing_fetch)
        result = provider.execute("fetch", symbol="AAPL")

        self.assertEqual(result, "degraded data")
        self.assertIn("provider down", provider.last_error)
        self.assertEqual(events[0]["severity"], "warning")
        self.assertIn("provider down", events[0]["message"])

    def test_strict_failure_emits_error_and_raises(self):
        events = []
        set_skill_event_sink(events.append)

        def failing_fetch(**_kwargs):
            raise RuntimeError("provider down")

        provider = _provider(failing_fetch, fallback_message=None)

        with self.assertRaises(SkillProviderExecutionError):
            provider.execute("fetch", symbol="AAPL")

        self.assertEqual(events[0]["severity"], "error")
        self.assertFalse(events[0]["partial"])


if __name__ == "__main__":
    unittest.main()
