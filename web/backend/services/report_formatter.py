"""Format AnalysisRecord rows into the locked report API contract."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List


RATING_LABELS = {
    1: "高风险",
    2: "谨慎",
    3: "中性",
    4: "偏积极",
    5: "高置信积极",
}


SECTION_TITLES = {
    "market_technical": "市场技术分析",
    "fundamentals": "基本面分析",
    "sentiment": "舆情分析",
    "news_macro": "新闻宏观分析",
    "risk": "风险评估",
}


def _iso(value: Any) -> str | None:
    return value.isoformat() if value else None


def _final_state(record: Any) -> Dict[str, Any]:
    return record.final_state if isinstance(record.final_state, dict) else {}


def _structured(record: Any) -> Dict[str, Any]:
    final_state = _final_state(record)
    structured = final_state.get("structured_report")
    return structured if isinstance(structured, dict) else {}


def _section_list(record: Any) -> List[Dict[str, Any]]:
    structured = _structured(record)
    sections = structured.get("sections") if isinstance(structured.get("sections"), dict) else {}
    result = []
    for key, title in SECTION_TITLES.items():
        data = sections.get(key) or {}
        result.append({
            "key": key,
            "title": data.get("title") or title,
            "summary": data.get("summary") or "",
            "content": data.get("details") or data.get("content") or "",
            "grounded_evidence": "; ".join(
                evidence.get("excerpt", "")
                for evidence in structured.get("grounded_evidence", [])
                if key == "sentiment" and isinstance(evidence, dict)
            ) or None,
            "data_sources": [
                {
                    "name": evidence.get("source", "unknown"),
                    "snapshot_time": evidence.get("captured_at") or evidence.get("as_of"),
                }
                for evidence in structured.get("grounded_evidence", [])
                if isinstance(evidence, dict)
            ],
            "indicators": [],
            "financials": {},
            "news_sources": [],
            "risk_factors": data.get("key_points", []) if key == "risk" else [],
        })
    return result


def report_id(record: Any) -> str:
    return record.analysis_id


def report_preview(record: Any, source_session_id: str | None = None) -> Dict[str, Any]:
    structured = _structured(record)
    rating = int(structured.get("rating") or 3)
    sections = structured.get("sections") if isinstance(structured.get("sections"), dict) else {}
    return {
        "id": report_id(record),
        "ticker": record.ticker,
        "company_name": record.company_name or record.ticker,
        "market": record.market,
        "rating": rating,
        "rating_label": RATING_LABELS.get(rating, "中性"),
        "summary": structured.get("summary") or record.final_summary or record.trading_decision or "",
        "section_summaries": {
            key: (sections.get(key) or {}).get("summary", "")
            for key in SECTION_TITLES
        },
        "source": {"type": "conversation" if source_session_id else "scheduled_task", "session_id": source_session_id},
        "status": _status(record.status),
        "created_at": _iso(record.created_at),
    }


def report_detail(record: Any, source_session_id: str | None = None, task_id: int | None = None) -> Dict[str, Any]:
    structured = _structured(record)
    rating = int(structured.get("rating") or 3)
    reflection = structured.get("reflection") if isinstance(structured.get("reflection"), dict) else {}
    return {
        "id": report_id(record),
        "ticker": record.ticker,
        "company_name": record.company_name or record.ticker,
        "market": record.market,
        "source": {"type": "conversation" if source_session_id else "scheduled_task", "session_id": source_session_id, "task_id": task_id},
        "conclusion": {
            "rating": rating,
            "rating_label": RATING_LABELS.get(rating, "中性"),
            "summary": structured.get("summary") or record.trading_decision or "",
            "key_points": [
                item
                for section in (structured.get("sections") or {}).values()
                if isinstance(section, dict)
                for item in section.get("key_points", [])[:1]
            ][:3],
        },
        "sections": _section_list(record),
        "stage_log": structured.get("stage_log") or _final_state(record).get("stage_log") or [],
        "reflection": {
            "previous_decisions": reflection.get("decision_log"),
            "alpha_vs_benchmark": reflection.get("alpha"),
        },
        "status": _status(record.status),
        "created_at": _iso(record.created_at),
        "updated_at": _iso(record.updated_at),
    }


def report_markdown(record: Any) -> str:
    detail = report_detail(record)
    parts = [
        f"# {detail['ticker']} 分析报告",
        "",
        f"**评级**：{detail['conclusion']['rating']} / 5（{detail['conclusion']['rating_label']}）",
        "",
        detail["conclusion"]["summary"],
    ]
    for section in detail["sections"]:
        parts.extend(["", f"## {section['title']}", "", section.get("content") or section.get("summary") or ""])
    return "\n".join(parts)


def report_json_bytes(record: Any) -> bytes:
    return json.dumps(report_detail(record), ensure_ascii=False, indent=2, default=str).encode("utf-8")


def _status(status: str) -> str:
    if status == "completed":
        return "completed"
    if status in {"error", "interrupted"}:
        return "failed"
    return "partial"
