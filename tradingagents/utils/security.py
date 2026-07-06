"""Security helpers for filesystem-safe analysis artifacts."""

import re
from pathlib import Path


_SAFE_COMPONENT = re.compile(r"[^A-Za-z0-9._-]+")


def safe_path_component(value: object, fallback: str = "unknown") -> str:
    """Return a filesystem-safe single path component."""
    text = str(value or "").strip()
    text = text.replace("/", "_").replace("\\", "_")
    text = _SAFE_COMPONENT.sub("_", text)
    text = text.strip("._-")
    if not text or text in {".", ".."}:
        return fallback
    return text[:120]


def safe_join(base_dir: str | Path, *components: object) -> Path:
    """Join components under base_dir and reject traversal."""
    base = Path(base_dir).resolve()
    candidate = base
    for component in components:
        candidate = candidate / safe_path_component(component)
    resolved = candidate.resolve()
    if base != resolved and base not in resolved.parents:
        raise ValueError(f"Unsafe path outside base directory: {resolved}")
    return resolved
