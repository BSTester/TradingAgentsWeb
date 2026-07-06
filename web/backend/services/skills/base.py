"""Skill provider contracts and health DTOs."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Protocol


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
        try:
            result = self.actions[action](**kwargs)
            self.last_error = None
            return result
        except Exception as exc:
            self.last_error = str(exc)
            raise
