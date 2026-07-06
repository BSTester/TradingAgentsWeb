"""JSON checkpoint persistence for long analysis runs."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from tradingagents.utils.security import safe_join


def checkpoint_path(base_dir: str | Path, user_id: int, ticker: str, analysis_id: str) -> Path:
    return safe_join(base_dir, "checkpoints", f"user_{user_id}", ticker, f"{analysis_id}.json")


def load_checkpoint(base_dir: str | Path, user_id: int, ticker: str, analysis_id: str) -> Dict[str, Any]:
    path = checkpoint_path(base_dir, user_id, ticker, analysis_id)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, dict) else {}


def save_checkpoint(
    base_dir: str | Path,
    user_id: int,
    ticker: str,
    analysis_id: str,
    stage: str,
    report_sections: Dict[str, Any],
) -> Path:
    path = checkpoint_path(base_dir, user_id, ticker, analysis_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "analysis_id": analysis_id,
        "user_id": user_id,
        "ticker": ticker,
        "last_successful_stage": stage,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "report_sections": report_sections,
    }
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, default=str)
    return path
