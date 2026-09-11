"""Format AnalysisRecord rows into the locked report API contract."""

from __future__ import annotations

import io
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


def _rec_from_text(text: str) -> str | None:
    """Map a free-text decision to a canonical recommendation (buy/sell/hold)."""
    if not text:
        return None
    t = text.lower()
    if any(k in t for k in ("买入", "买进", "增持", "看多", "strong buy", "accumulate", "buy")):
        return "buy"
    if any(k in t for k in ("卖出", "减持", "看空", "strong sell", "reduce", "sell")):
        return "sell"
    if any(k in t for k in ("持有", "观望", "中性", "hold", "neutral", "watch")):
        return "hold"
    return None


def _verdict(record: Any) -> Dict[str, Any]:
    """Best-effort verdict fields for cards / role-chain header (WS-133)."""
    structured = _structured(record)
    fs = _final_state(record)

    # 优先以「最终交易决策」为准，保证「建议」与「裁决结论」一致；再退回结构化推荐
    rec = _rec_from_text(record.trading_decision or "")
    if rec is None:
        rec = structured.get("recommendation")
    if rec is None:
        text = (structured.get("summary") or "").lower()
        has_buy = any(k in text for k in ("买入", "看多", "buy"))
        has_sell = any(k in text for k in ("卖出", "看空", "sell"))
        rec = "buy" if (has_buy and not has_sell) else ("sell" if has_sell else "hold")

    risk = structured.get("risk_level")
    if not risk:
        rtext = (record.risk_assessment or "").lower()
        if any(k in rtext for k in ("高", "高风险", "high")):
            risk = "high"
        elif any(k in rtext for k in ("低", "低风险", "low")):
            risk = "low"
        elif any(k in rtext for k in ("中", "medium")):
            risk = "medium"

    conf = structured.get("confidence")
    if conf is None:
        rating = int(structured.get("rating") or 3)
        conf = round(rating / 5, 2)

    price_range = structured.get("price_range") or fs.get("price_range")
    if not isinstance(price_range, (list, tuple)) or len(price_range) != 2:
        price_range = None
    holding = structured.get("holding_period") or fs.get("holding_period")

    # 文本兜底：若结构化字段缺失，尝试从结论文本 + trader 计划中提取「价格区间 / 持有期限」
    if price_range is None or not holding:
        search_text = " ".join([
            str(record.final_summary or ""),
            str(record.trading_decision or ""),
            str(record.risk_assessment or ""),
            str(structured.get("summary") or ""),
            str(fs.get("trader_investment_plan") or ""),
            str(fs.get("investment_plan") or ""),
            str(fs.get("final_trade_decision") or ""),
        ])
        if price_range is None:
            price_range = _try_extract_price_range(search_text)
        if not holding:
            holding = _try_extract_holding_period(search_text)

    return {
        "recommendation": rec,
        "risk_level": risk,
        "confidence": conf,
        "price_range": price_range,
        "close_price": structured.get("close_price") or fs.get("close_price"),
        "realtime_price": structured.get("realtime_price") or fs.get("realtime_price"),
        "holding_period": holding,
        "data_source_count": structured.get("data_source_count"),
    }


def _strip_structured_output(text: str) -> str:
    """Remove a trailing STRUCTURED_OUTPUT JSON-ish block from model text."""
    if not text:
        return text
    idx = text.lower().find("structured_output")
    if idx >= 0:
        return text[:idx].rstrip()
    return text


def _clean_md(text: str) -> str:
    return _strip_structured_output(text or "")


def _first_sentence(text: str, max_len: int = 90) -> str:
    """One-sentence conclusion for a card header (no truncated analysis)."""
    import re
    t = (text or "").strip()
    if not t:
        return ""
    # 以句号/感叹号/问号/分号/换行为边界取第一句
    first = re.split(r"(?<=[。！？；])|(?<=\n)", t)[0]
    first = re.split(r"[；\n]", first)[0].strip()
    # 去掉残留的首尾 ** 等 markdown 标记，得到干净的纯文本结论
    first = first.strip().lstrip("*").rstrip("*").strip()
    if len(first) > max_len:
        first = first[:max_len] + "…"
    return first


def _try_extract_price_range(text: str) -> Optional[List[float]]:
    """Best-effort extraction of a price range like 区间 330–360 / PRICE RANGE: 330-360.
    Only matches with price/range context and excludes % position budgets."""
    import re
    if not text:
        return None
    num = r"\d[\d,]*\.?\d*"
    pats = [
        re.compile(r"(?:价格区间|参考区间|入场区间|交易区间|价格带|建议区间|PRICE\s*RANGE)\s*[:：]?\s*" + num + r"\s*[~\-–—]\s*" + num),
        re.compile(num + r"\s*[~\-–—]\s*" + num + r"\s*(?:元|股|USD|HKD|CNY|美元|港币|人民币|/股|per share)"),
    ]
    for pat in pats:
        for m in pat.finditer(text):
            if "%" in m.group(0):
                continue
            nums = re.findall(num, m.group(0))
            if len(nums) >= 2:
                a = float(nums[-2].replace(",", ""))
                b = float(nums[-1].replace(",", ""))
                if 1800 <= a <= 2100 and 1 <= b <= 12:
                    continue
                if 1800 <= b <= 2100:
                    continue
                return [a, b]
    return None


def _try_extract_holding_period(text: str) -> Optional[str]:
    """Best-effort extraction of a holding period like 持有 6–12 个月 / 建议持有 12个月."""
    import re
    if not text:
        return None
    m = re.search(r"(?:持有|建议持有|期限|持有期限)[^\n]{0,10}?(\d{1,3})(?:\s*[-~—]\s*(\d{1,3}))?\s*个月", text)
    if m:
        a = m.group(1)
        b = m.group(2)
        return f"{a}-{b}" if b else a
    return None


def _verdict_fields(record: Any) -> Dict[str, Any]:
    """A few more best-effort verdict fields (price range / holding period)."""
    structured = _structured(record)
    fs = _final_state(record)
    price_range = structured.get("price_range") or fs.get("price_range")
    if not isinstance(price_range, (list, tuple)) or len(price_range) != 2:
        price_range = None
    holding = structured.get("holding_period") or fs.get("holding_period")
    return {
        "price_range": price_range,
        "holding_period": holding,
    }


def _role_chain(record: Any) -> List[Dict[str, Any]]:
    """Build a role-chain node list for the report detail page (WS-133)."""
    structured = _structured(record)
    fs = _final_state(record)
    verdict = _verdict(record)
    vfields = _verdict_fields(record)

    chain: List[Dict[str, Any]] = []

    # 1. 风险评审裁决（置顶）
    chain.append({
        "id": "risk-judge",
        "type": "risk-judge",
        "title": "风险评审裁决",
        "summary": _first_sentence(record.trading_decision or structured.get("summary") or ""),
        "content": _clean_md(record.final_summary or record.trading_decision or ""),
        "decision": verdict["recommendation"],
        "price_range": vfields["price_range"],
        "holding_period": vfields["holding_period"],
    })

    # 2. 分析师团队（分角色，供前端拆成折叠子卡片）
    analysts_agents: List[Dict[str, str]] = []
    analyst_fields = [
        ("market_analysis", "市场分析师"),
        ("fundamentals_analysis", "基本面分析师"),
        ("news_analysis", "新闻分析师"),
        ("sentiment_analysis", "舆情分析师"),
    ]
    for field, name in analyst_fields:
        val = getattr(record, field, None) or fs.get(field)
        if val and isinstance(val, str) and val.strip():
            analysts_agents.append({"name": name, "result": _clean_md(val)})
    if not analysts_agents:
        # fall back to phases
        phases = record.phases if isinstance(record.phases, list) else []
        for phase in phases:
            for agent in phase.get("agents", []) if isinstance(phase, dict) else []:
                if isinstance(agent, dict) and agent.get("result"):
                    analysts_agents.append({"name": agent.get("name", "分析师"), "result": _clean_md(agent["result"])})
    if analysts_agents:
        chain.append({
            "id": "analysts",
            "type": "analysts",
            "title": "分析师团队",
            "summary": "；".join(a["name"] for a in analysts_agents),
            "content": "\n\n".join(f"【{a['name']}】\n{a['result']}" for a in analysts_agents),
            "agents": analysts_agents,  # 前端分角色展示
        })

    # 3. 多空辩论
    bull = structured.get("bull_case") or fs.get("bull_case")
    bear = structured.get("bear_case") or fs.get("bear_case")
    if bull or bear:
        _bull = _clean_md(str(bull or ""))
        _bear = _clean_md(str(bear or ""))
        chain.append({
            "id": "bull",
            "type": "bull",
            "title": "看多依据（Bull）",
            "summary": _first_sentence(_bull),
            "content": _bull,
        })
        chain.append({
            "id": "bear",
            "type": "bear",
            "title": "看空依据（Bear）",
            "summary": _first_sentence(_bear),
            "content": _bear,
        })

    # 4. Trader 计划（建议，非执行）
    plan = structured.get("trading_plan") or fs.get("trading_strategy") or fs.get("trading_plan")
    phases = record.phases if isinstance(record.phases, list) else []
    if not plan:
        for phase in phases:
            if isinstance(phase, dict) and "交易" in (phase.get("name") or ""):
                agents = phase.get("agents", []) if isinstance(phase.get("agents"), list) else []
                if agents and isinstance(agents[0], dict):
                    plan = agents[0].get("result", "")
    if plan:
        _plan = _clean_md(str(plan))
        chain.append({
            "id": "trader",
            "type": "trader",
            "title": "Trader 交易计划（建议）",
            "summary": _first_sentence(_plan),
            "content": _plan,
        })

    # 5. 风险辩论
    risk = record.risk_assessment or fs.get("risk_assessment") or structured.get("risk_review")
    if risk:
        _risk = _clean_md(str(risk))
        chain.append({
            "id": "risk-review",
            "type": "risk-review",
            "title": "风险辩论（Risk Review）",
            "summary": _first_sentence(_risk),
            "content": _risk,
        })

    # 6. 总结
    summary = record.final_summary or structured.get("summary")
    if summary:
        _summary = _clean_md(str(summary))
        chain.append({
            "id": "summary",
            "type": "summary",
            "title": "总结",
            "summary": _first_sentence(_summary),
            "content": _summary,
        })

    return chain


def report_preview(record: Any, source_session_id: str | None = None) -> Dict[str, Any]:
    structured = _structured(record)
    rating = int(structured.get("rating") or 3)
    sections = structured.get("sections") if isinstance(structured.get("sections"), dict) else {}
    verdict = _verdict(record)
    return {
        "id": report_id(record),
        "analysis_id": report_id(record),
        "ticker": record.ticker,
        "company_name": record.company_name or record.ticker,
        "market": record.market,
        "analysis_date": record.analysis_date,
        "rating": rating,
        "rating_label": RATING_LABELS.get(rating, "中性"),
        "confidence": verdict["confidence"],
        "recommendation": verdict["recommendation"],
        "risk_level": verdict["risk_level"],
        "price_range": verdict["price_range"],
        "close_price": verdict["close_price"],
        "realtime_price": verdict["realtime_price"],
        "model": record.deep_thinker or record.shallow_thinker,
        "is_public": record.is_public,
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
    verdict = _verdict(record)
    return {
        "id": report_id(record),
        "analysis_id": report_id(record),
        "ticker": record.ticker,
        "company_name": record.company_name or record.ticker,
        "market": record.market,
        "analysis_date": record.analysis_date,
        "model": record.deep_thinker or record.shallow_thinker,
        "is_public": record.is_public,
        "confidence": verdict["confidence"],
        "recommendation": verdict["recommendation"],
        "risk_level": verdict["risk_level"],
        "price_range": verdict["price_range"],
        "close_price": verdict["close_price"],
        "realtime_price": verdict["realtime_price"],
        "holding_period": verdict["holding_period"],
        "data_source_count": verdict["data_source_count"],
        "trading_decision": record.trading_decision,
        "final_summary": record.final_summary,
        "role_chain": _role_chain(record),
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


def _report_pdf_bytes_raw(record: Any) -> bytes:
    """Legacy fallback: simple multi-page text PDF (no cover)."""
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


def _pdf_font() -> str:
    """Register and return an embedded TrueType font covering both Latin + CJK.

    Prefers the bundled Noto Sans SC subset (GB2312 + Latin + common symbols,
    ~3.5 MB instead of the original 17.8 MB variable font; TrueType outlines
    -> embeddable, renders Chinese + English correctly everywhere); falls back
    to the Adobe CID font when the subset file is unavailable.
    """
    import os
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    font_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
    bundled = os.path.join(font_dir, "NotoSansSC-subset.ttf")
    if os.path.exists(bundled):
        try:
            pdfmetrics.registerFont(TTFont("NotoSC", bundled))
            return "NotoSC"
        except Exception:
            pass
    try:
        from reportlab.pdfbase.cidfonts import UnicodeCIDFont
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    except Exception:
        pass
    return "STSong-Light"


def _pdfstyles() -> Dict[str, Any]:
    """Paragraph styles for the dark-theme, readable professional research-report PDF."""
    from reportlab.lib.colors import HexColor
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
    from reportlab.lib.styles import ParagraphStyle
    b = _pdf_font()
    return {
        "h1": ParagraphStyle("h1", fontName=b, fontSize=18, leading=26,
                             textColor=HexColor("#ffffff"), spaceBefore=18, spaceAfter=8),
        "h2": ParagraphStyle("h2", fontName=b, fontSize=15, leading=22,
                             textColor=HexColor("#93c5fd"), spaceBefore=16, spaceAfter=8),
        "h3": ParagraphStyle("h3", fontName=b, fontSize=12.5, leading=18,
                             textColor=HexColor("#ffffff"), spaceBefore=12, spaceAfter=5),
        "body": ParagraphStyle("body", fontName=b, fontSize=11, leading=18,
                               textColor=HexColor("#ffffff"), spaceAfter=8, alignment=TA_JUSTIFY),
        "bullet": ParagraphStyle("bullet", fontName=b, fontSize=11, leading=17,
                                 textColor=HexColor("#ffffff"), leftIndent=14,
                                 bulletIndent=2, spaceAfter=3, alignment=TA_JUSTIFY),
        "cell": ParagraphStyle("cell", fontName=b, fontSize=10, leading=15, textColor=HexColor("#ffffff")),
        "cellHead": ParagraphStyle("cellHead", fontName=b, fontSize=10, leading=15,
                                   textColor=HexColor("#ffffff")),
    }


def _md_flowables(markdown: str, st: Dict[str, Any]) -> List[Any]:
    """Parse markdown (headings / bullets / tables / bold) into dark-theme flowables."""
    import re
    from reportlab.lib.colors import HexColor
    from reportlab.lib.units import cm
    from reportlab.platypus import HRFlowable, Paragraph, Spacer, Table, TableStyle

    def inline(text: str) -> str:
        return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)

    flow: List[Any] = []
    lines = markdown.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            i += 1
            continue
        if line.startswith("|"):
            rows: List[List[str]] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if all(re.match(r"^:?-+:?$", c) for c in cells if c):
                    i += 1
                    continue
                rows.append([inline(c) for c in cells if c.strip() != ""])
                i += 1
            if rows:
                data = [[Paragraph(c, st["cellHead"] if r == 0 else st["cell"]) for c in row] for r, row in enumerate(rows)]
                cols = max(len(r) for r in rows)
                avail = 17.0 / cols
                t = Table(data, hAlign="LEFT", repeatRows=1,
                          colWidths=[avail * cm for _ in range(cols)])
                style = [
                    ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1e3a8a")),
                    ("GRID", (0, 0), (-1, -1), 0.55, HexColor("#334155")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                    ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LINEBEFORE", (0, 0), (0, -1), 0.55, HexColor("#334155")),
                    ("LINEAFTER", (-1, 0), (-1, -1), 0.55, HexColor("#334155")),
                ]
                for ridx in range(1, len(rows)):
                    style.append(("BACKGROUND", (0, ridx), (-1, ridx), HexColor("#111827") if ridx % 2 else HexColor("#0f172a")))
                t.setStyle(TableStyle(style))
                flow.append(Spacer(1, 6)); flow.append(t); flow.append(Spacer(1, 8))
            continue
        if line.startswith("### "):
            flow.append(Paragraph(inline(line[4:]), st["h3"])); i += 1; continue
        if line.startswith("## "):
            flow.append(HRFlowable(width="100%", thickness=1.0, color=HexColor("#1e40af"),
                                   spaceBefore=8, spaceAfter=6))
            flow.append(Paragraph(inline(line[3:]), st["h2"])); i += 1; continue
        if line.startswith("# "):
            flow.append(HRFlowable(width="100%", thickness=1.6, color=HexColor("#3b82f6"),
                                   spaceBefore=10, spaceAfter=6))
            flow.append(Paragraph(inline(line[2:]), st["h1"])); i += 1; continue
        if line.startswith("- ") or line.startswith("* "):
            flow.append(Paragraph("• " + inline(line[2:]), st["bullet"])); i += 1; continue
        para = line
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(("#", "|", "- ", "* ")):
            para += " " + lines[i].strip()
            i += 1
        flow.append(Paragraph(inline(para), st["body"]))
    return flow


def _report_pdf_bytes_pro(record: Any) -> bytes:
    """Generate a dark-theme professional research-report PDF with an elegant cover."""
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from reportlab.platypus import PageBreak, SimpleDocTemplate

    F = _pdf_font()

    detail = report_detail(record)
    verdict = _verdict(record)
    st = _pdfstyles()

    ticker = detail.get("ticker", "") or ""
    company = detail.get("company_name") or ticker
    market = detail.get("market") or "US"
    date = detail.get("analysis_date") or ""
    model = detail.get("model") or ""
    rec = verdict.get("recommendation")
    risk = verdict.get("risk_level")
    conf = verdict.get("confidence")
    pr = verdict.get("price_range")
    hold = verdict.get("holding_period")
    conclusion = detail.get("conclusion") or {}
    rating = conclusion.get("rating")
    rating_label = conclusion.get("rating_label", "中性")
    rec_cn = {"buy": "买入", "sell": "卖出", "hold": "持仓"}.get(rec, rec or "—")
    rec_color = {"buy": "#22c55e", "sell": "#ef4444", "hold": "#f59e0b"}.get(rec, "#e5e7eb")
    risk_cn = {"high": "高风险", "medium": "中风险", "low": "低风险"}.get(risk, risk or "—")
    pr_str = f"{pr[0]:,.2f} – {pr[1]:,.2f}" if pr else "—"
    conf_str = f"{round(conf * 100)}%" if conf is not None else "—"

    BG = HexColor("#0b1120"); CARD = HexColor("#111827"); BAND = HexColor("#1e293b")
    BORDER = HexColor("#334155"); ACCENT = HexColor("#3b82f6"); ACCENT2 = HexColor("#60a5fa")
    TEXT = HexColor("#ffffff"); TEXT2 = HexColor("#ffffff"); MUT = HexColor("#e2e8f0")
    WHITE = HexColor("#ffffff")

    def _cover(canvas: Any, doc: Any) -> None:
        W, H = A4
        canvas.saveState()
        canvas.setFillColor(BG); canvas.rect(0, 0, W, H, fill=1, stroke=0)
        # 顶部品牌带 + 蓝色强调线
        canvas.setFillColor(BAND); canvas.rect(0, H - 3.6 * cm, W, 3.6 * cm, fill=1, stroke=0)
        canvas.setFillColor(ACCENT); canvas.rect(0, H - 3.6 * cm, W, 0.16 * cm, fill=1, stroke=0)
        canvas.setFillColor(WHITE); canvas.setFont(F, 18)
        canvas.drawString(2.2 * cm, H - 2.1 * cm, "TradingAgents")
        canvas.setFont(F, 10); canvas.setFillColor(TEXT2)
        canvas.drawString(2.2 * cm, H - 2.9 * cm, "多智能体研究报告")
        canvas.setFont(F, 9); canvas.setFillColor(MUT)
        canvas.drawRightString(W - 2.2 * cm, H - 2.5 * cm, f"报告日期：{date or '—'}")
        # 标题块
        canvas.setFillColor(WHITE); canvas.setFont(F, 32)
        canvas.drawCentredString(W / 2, H - 6.9 * cm, ticker)
        canvas.setFillColor(HexColor("#e2e8f0")); canvas.setFont(F, 18)
        canvas.drawCentredString(W / 2, H - 8.6 * cm, company)
        canvas.setFillColor(TEXT2); canvas.setFont(F, 11)
        canvas.drawCentredString(W / 2, H - 9.6 * cm, f"{market} 市场 · 分析日期 {date or '—'}")
        # 蓝色强调条
        canvas.setFillColor(ACCENT); canvas.rect(W / 2 - 1.6 * cm, H - 10.6 * cm, 3.2 * cm, 0.12 * cm, fill=1, stroke=0)
        # 摘要卡片
        card_w = 14.4 * cm; card_h = 7.0 * cm; card_x = (W - card_w) / 2
        card_bottom = H - 11.8 * cm - card_h
        canvas.setFillColor(CARD); canvas.roundRect(card_x, card_bottom, card_w, card_h, 7, fill=1, stroke=0)
        canvas.setStrokeColor(BORDER); canvas.setLineWidth(0.7)
        canvas.roundRect(card_x, card_bottom, card_w, card_h, 7, fill=0, stroke=1)
        canvas.setFillColor(ACCENT); canvas.rect(card_x, card_bottom, 0.2 * cm, card_h, fill=1, stroke=0)
        rows = [
            ("综合建议", rec_cn, rec_color),
            ("风险等级", risk_cn, None),
            ("置信度", conf_str, None),
            ("参考价格区间", pr_str, None),
            ("建议持有期限", hold or "—", None),
            ("综合评级", f"{rating} / 5（{rating_label}）", None),
        ]
        label_x = card_x + 1.2 * cm
        value_x = card_x + 1.2 * cm + 6.0 * cm
        row_h = card_h / len(rows)
        for idx, (label, value, color) in enumerate(rows):
            # 文本垂直居中于各自单元格
            center_y = card_bottom + card_h - (idx + 0.5) * row_h
            text_y = center_y - 0.13 * cm
            # 行间分隔线放在两条文字正中间（单元格边界处）
            if idx > 0:
                sep_y = card_bottom + card_h - idx * row_h
                canvas.setStrokeColor(BORDER); canvas.setLineWidth(0.5)
                canvas.line(card_x + 0.8 * cm, sep_y, card_x + card_w - 0.8 * cm, sep_y)
            canvas.setFont(F, 10); canvas.setFillColor(TEXT2)
            canvas.drawString(label_x, text_y, label)
            canvas.setFont(F, 11.5); canvas.setFillColor(HexColor(color) if color else WHITE)
            canvas.drawString(value_x, text_y, value)
        # 模型 + 免责声明
        canvas.setFont(F, 10); canvas.setFillColor(TEXT2)
        canvas.drawCentredString(W / 2, card_bottom - 1.4 * cm, f"分析模型：{model}" if model else "分析模型：—")
        canvas.setFont(F, 8.5); canvas.setFillColor(MUT)
        canvas.drawCentredString(W / 2, 2.8 * cm,
                                 "本报告由 TradingAgents 多智能体系统自动生成，仅供研究参考，不构成任何投资建议。")
        # 底部强调条
        canvas.setFillColor(ACCENT); canvas.rect(0, 0, W, 0.3 * cm, fill=1, stroke=0)
        canvas.restoreState()

    def _page_bg(canvas: Any, doc: Any) -> None:
        W, H = A4
        canvas.saveState()
        canvas.setFillColor(BG); canvas.rect(0, 0, W, H, fill=1, stroke=0)
        # 顶部页头条 + 蓝色线
        canvas.setFillColor(BAND); canvas.rect(0, H - 1.7 * cm, W, 1.7 * cm, fill=1, stroke=0)
        canvas.setFillColor(ACCENT); canvas.rect(0, H - 1.7 * cm, W, 0.12 * cm, fill=1, stroke=0)
        canvas.setFont(F, 9); canvas.setFillColor(WHITE)
        canvas.drawString(2 * cm, H - 1.1 * cm, f"{ticker} 多智能体研究报告")
        canvas.setFillColor(TEXT2)
        canvas.drawRightString(W - 2 * cm, H - 1.1 * cm, "TradingAgents")
        # 底部页脚条 + 蓝色线
        canvas.setFillColor(BAND); canvas.rect(0, 0, W, 1.5 * cm, fill=1, stroke=0)
        canvas.setFillColor(ACCENT); canvas.rect(0, 1.5 * cm, W, 0.1 * cm, fill=1, stroke=0)
        canvas.setFont(F, 9); canvas.setFillColor(TEXT2)
        canvas.drawString(2 * cm, 0.85 * cm, "本报告仅供研究参考，不构成投资建议")
        canvas.drawRightString(W - 2 * cm, 0.85 * cm, f"第 {doc.page - 1} 页")
        canvas.restoreState()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2.4 * cm, bottomMargin=2.2 * cm,
                            leftMargin=2 * cm, rightMargin=2 * cm,
                            title=f"{ticker} 多智能体研究报告", author="TradingAgents")
    story: List[Any] = [PageBreak()]
    story.extend(_md_flowables(report_markdown(record), st))
    doc.build(story, onFirstPage=_cover, onLaterPages=_page_bg)
    return buf.getvalue()



def report_pdf_bytes(record: Any) -> bytes:
    """Generate a professional PDF with a cover page; falls back to plain text PDF."""
    try:
        return _report_pdf_bytes_pro(record)
    except Exception:
        return _report_pdf_bytes_raw(record)


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
