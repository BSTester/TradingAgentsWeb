"""Skill provider contracts and health DTOs."""

from __future__ import annotations

import os
import queue
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Protocol


_EVENT_CONTEXT = threading.local()


class SkillProviderExecutionError(RuntimeError):
    """Raised when a strict skill action cannot return degraded data."""


class SkillProviderTimeoutError(SkillProviderExecutionError):
    """Raised when a skill action exceeds its configured timeout."""


def _default_timeout_seconds() -> float:
    raw_value = os.getenv("TRADINGAGENTS_SKILL_TIMEOUT_SECONDS", "20")
    try:
        return max(0.1, float(raw_value))
    except (TypeError, ValueError):
        return 20.0


def set_skill_event_sink(sink: Callable[[Dict[str, Any]], None] | None) -> None:
    """Register a per-thread sink for skill warning/error events."""
    _EVENT_CONTEXT.sink = sink


def clear_skill_event_sink() -> None:
    if hasattr(_EVENT_CONTEXT, "sink"):
        delattr(_EVENT_CONTEXT, "sink")


def _emit_skill_event(event: Dict[str, Any]) -> None:
    sink = getattr(_EVENT_CONTEXT, "sink", None)
    if not sink:
        return
    try:
        sink(event)
    except Exception as exc:
        print(f"WARNING: skill event sink failed: {exc}")


class SkillProvider(Protocol):
    name: str
    display_name: str
    description: str
    input_schema: Dict[str, Any]
    providers: List[str]
    markets: List[str]

    def health(self) -> Dict[str, Any]:
        ...

    def execute(self, action: str, **kwargs: Any) -> Any:
        ...


@dataclass
class RoutedSkillProvider:
    name: str
    display_name: str
    description: str
    input_schema: Dict[str, Any]
    providers: List[str]
    markets: List[str]
    actions: Dict[str, Callable[..., Any]]
    primary_source: str
    fallback_source: str | None = None
    timeout_seconds: float = field(default_factory=_default_timeout_seconds)
    fallback_message: str | None = (
        "[DATA_SOURCE_DEGRADED] Skill '{skill}' action '{action}' is temporarily unavailable. "
        "Continue with available context and lower confidence. Error: {error}"
    )
    last_error: str | None = None
    last_checked_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def health(self) -> Dict[str, Any]:
        self.last_checked_at = datetime.now(timezone.utc).isoformat()
        status = "healthy" if self.actions else "unavailable"
        if self.last_error and self.actions:
            status = "degraded"
        return {
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "status": status,
            "primary_source": self.primary_source,
            "fallback_source": self.fallback_source,
            "markets": self.markets,
            "last_error": self.last_error,
            "last_checked_at": self.last_checked_at,
            "input_schema": self.input_schema,
            "providers": self.providers,
        }

    def execute(self, action: str, **kwargs: Any) -> Any:
        if action not in self.actions:
            raise ValueError(f"Skill '{self.name}' does not support action '{action}'")
        action_func = self.actions[action]
        try:
            result = self._run_with_timeout(action, action_func, kwargs)
            self.last_error = None
            return result
        except Exception as exc:
            self.last_error = str(exc)
            if self.fallback_message is None:
                self._emit_failure_event(action, exc, severity="error", partial=False)
                if isinstance(exc, SkillProviderExecutionError):
                    raise
                raise SkillProviderExecutionError(str(exc)) from exc

            self._emit_failure_event(action, exc, severity="warning", partial=True)
            return self._fallback_text(action, exc)

    def _run_with_timeout(self, action: str, action_func: Callable[..., Any], kwargs: Dict[str, Any]) -> Any:
        timeout = self.timeout_seconds
        if timeout <= 0:
            return action_func(**kwargs)

        result_queue: queue.Queue[tuple[str, Any]] = queue.Queue(maxsize=1)

        def worker() -> None:
            try:
                result_queue.put(("result", action_func(**kwargs)))
            except BaseException as exc:
                result_queue.put(("error", exc))

        thread = threading.Thread(
            target=worker,
            name=f"skill-{self.name}-{action}",
            daemon=True,
        )
        thread.start()
        thread.join(timeout)

        if thread.is_alive():
            raise SkillProviderTimeoutError(
                f"Skill '{self.name}' action '{action}' timed out after {timeout:.1f}s"
            )

        try:
            kind, payload = result_queue.get_nowait()
        except queue.Empty as exc:
            raise SkillProviderExecutionError(
                f"Skill '{self.name}' action '{action}' finished without a result"
            ) from exc

        if kind == "error":
            raise payload
        return payload

    def _fallback_text(self, action: str, exc: Exception) -> str:
        fallback = self.fallback_message or (
            "[DATA_SOURCE_DEGRADED] Skill '{skill}' action '{action}' is temporarily unavailable. "
            "Continue with available context and lower confidence. Error: {error}"
        )
        try:
            return fallback.format(skill=self.name, action=action, error=str(exc))
        except Exception:
            return fallback

    def _emit_failure_event(self, action: str, exc: Exception, *, severity: str, partial: bool) -> None:
        message = (
            f"Skill '{self.name}' action '{action}' degraded: {exc}"
            if severity == "warning"
            else f"Skill '{self.name}' action '{action}' failed: {exc}"
        )
        _emit_skill_event({
            "severity": severity,
            "skill": self.name,
            "action": action,
            "message": message,
            "error": str(exc),
            "error_type": type(exc).__name__,
            "partial": partial,
            "retryable": True,
            "primary_source": self.primary_source,
            "fallback_source": self.fallback_source,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        })
