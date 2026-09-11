"""Format AnalysisRecord rows into the locked report API contract."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List

try:  # role_chain lives in the tradingagents package; keep formatter import-safe
    from tradingagents.utils.role_chain import build_role_chain, role_chain_is_empty
except Exception:  # pragma: no cover - import guard for environments without the package
    build_role_chain = None  # type: ignore
    role_chain_is_empty = None  # type: ignore


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

def _role_chain(record: Any, source_session_id: str | None = None) -> Dict[str, Any] | None:
    """Build the structured role-chain view from the stored final_state.
    
    Returns None when the role-chain module is unavailable or the analysis
    produced no agent content yet (so the frontend can fall back to the legacy
    section view without rendering empty scaffolding).
    """
    if build_role_chain is None:
        return None
    final_state = _final_state(record)
    chain = build_role_chain(
        final_state,
        ticker=record.ticker,
        company=record.company_name or record.ticker,
        market=record.market,
        published_at=_iso(record.created_at),
        model_id=getattr(record, "deep_thinker", "") or getattr(record, "shallow_thinker", ""),
        summary=record.final_summary or record.trading_decision or "",
    )
    chain["id"] = report_id(record)
    chain["source"] = {"type": "conversation" if source_session_id else "scheduled_task", "session_id": source_session_id}
    if role_chain_is_empty and role_chain_is_empty(chain):
        return None
    return chain


def report_preview(record: Any, source_session_id: str | None = None) -> Dict[str, Any]:
    structured = _structured(record)
    rating = int(structured.get("rating") or 3)
    sections = structured.get("sections") if isinstance(structured.get("sections"), dict) else {}
    preview = {
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
    chain = _role_chain(record, source_session_id)
    if chain:
        preview["role_chain"] = {"decision": chain.get("decision"), "analysts": chain.get("analysts")}
        preview["trading_decision"] = chain.get("decision", {}).get("verdictLabel")
    return preview


def report_detail(record: Any, source_session_id: str | None = None, task_id: int | None = None) -> Dict[str, Any]:
    structured = _structured(record)
    rating = int(structured.get("rating") or 3)
    reflection = structured.get("reflection") if isinstance(structured.get("reflection"), dict) else {}
    detail = {
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
    chain = _role_chain(record, source_session_id)
    if chain:
        detail["role_chain"] = chain
    return detail


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


def report_pdf_bytes(record: Any) -> bytes:
    """Generate a simple multi-page PDF from the report markdown."""
    lines = _wrapped_pdf_lines(report_markdown(record))
    if not lines:
        lines = ["Report is empty."]

    lines_per_page = 45
    pages = [lines[index:index + lines_per_page] for index in range(0, len(lines), lines_per_page)]
    total_pages = len(pages)
    font_id = 3 + total_pages * 2
    cid_font_id = font_id + 1
    descriptor_id = font_id + 2
    max_object_id = descriptor_id
    objects: Dict[int, bytes] = {}

    page_ids = [3 + index * 2 for index in range(total_pages)]
    content_ids = [4 + index * 2 for index in range(total_pages)]
    objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[2] = (
        f"<< /Type /Pages /Kids [{' '.join(f'{page_id} 0 R' for page_id in page_ids)}] "
        f"/Count {total_pages} >>"
    ).encode("ascii")

    for index, page_lines in enumerate(pages):
        content = _pdf_page_content(page_lines, page_number=index + 1, total_pages=total_pages)
        content_id = content_ids[index]
        page_id = page_ids[index]
        objects[content_id] = (
            f"<< /Length {len(content)} >>\nstream\n".encode("ascii")
            + content
            + b"\nendstream"
        )
        objects[page_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 {font_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        ).encode("ascii")

    objects[font_id] = (
        f"<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light "
        f"/Encoding /UniGB-UCS2-H /DescendantFonts [{cid_font_id} 0 R] >>"
    ).encode("ascii")
    objects[cid_font_id] = (
        f"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light "
        f"/CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> "
        f"/FontDescriptor {descriptor_id} 0 R /DW 1000 >>"
    ).encode("ascii")
    objects[descriptor_id] = (
        b"<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 "
        b"/FontBBox [0 -120 1000 880] /ItalicAngle 0 /Ascent 880 "
        b"/Descent -120 /CapHeight 700 /StemV 80 >>"
    )

    return _build_pdf(objects, max_object_id)


def _status(status: str) -> str:
    if status == "completed":
        return "completed"
    if status in {"error", "interrupted"}:
        return "failed"
    return "partial"


def _wrapped_pdf_lines(markdown: str, width: int = 52) -> List[str]:
    wrapped: List[str] = []
    for raw_line in markdown.splitlines():
        line = raw_line.replace("\t", "    ").strip()
        if not line:
            wrapped.append("")
            continue
        while len(line) > width:
            wrapped.append(line[:width])
            line = line[width:]
        wrapped.append(line)
    return wrapped


def _pdf_text_hex(text: str) -> str:
    return "FEFF" + text.encode("utf-16-be", errors="replace").hex().upper()


def _pdf_page_content(lines: List[str], *, page_number: int, total_pages: int) -> bytes:
    commands = ["BT", "/F1 11 Tf", "50 790 Td", "16 TL"]
    for index, line in enumerate(lines):
        if index:
            commands.append("T*")
        commands.append(f"<{_pdf_text_hex(line)}> Tj")
    commands.extend([
        "ET",
        "BT",
        "/F1 9 Tf",
        "50 32 Td",
        f"<{_pdf_text_hex(f'Page {page_number} / {total_pages}')}> Tj",
        "ET",
    ])
    return "\n".join(commands).encode("ascii")


def _build_pdf(objects: Dict[int, bytes], max_object_id: int) -> bytes:
    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for object_id in range(1, max_object_id + 1):
        offsets.append(len(output))
        output.extend(f"{object_id} 0 obj\n".encode("ascii"))
        output.extend(objects[object_id])
        output.extend(b"\nendobj\n")

    xref_offset = len(output)
    output.extend(f"xref\n0 {max_object_id + 1}\n".encode("ascii"))
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.extend(
        f"trailer\n<< /Size {max_object_id + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
        .encode("ascii")
    )
    return bytes(output)
