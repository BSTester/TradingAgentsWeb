"""导出层 PDF 测试（上游 role-chain 契约：手写 PDF + 标准 CID 字体）。

历史背景：PDF 曾由 reportlab 渲染并依赖内置 Noto Sans SC 字体（子集化）。
上游新实现（PR #31 起的 role-chain 报告契约）改为直接构造 PDF 对象、用
``<FEFF...>`` UTF-16BE 十六进制串写文本，并使用标准 CID 字体 ``STSong-Light``，
因此仓库不再需要打包任何字体文件（原 ``NotoSansSC-subset.ttf`` 已移除）。
"""

from datetime import datetime
from types import SimpleNamespace

from web.backend.services import report_formatter


def _record(**overrides):
    base = dict(
        analysis_id="an-pdf-1",
        ticker="600519",
        company_name="贵州茅台",
        market="CN",
        status="completed",
        created_at=datetime(2026, 7, 1, 9, 30),
        updated_at=datetime(2026, 7, 1, 9, 45),
        trading_decision="买入",
        final_summary="综合评级偏积极，建议逢低配置。",
        deep_thinker="",
        shallow_thinker="",
        final_state={
            "structured_report": {
                "rating": 4,
                "summary": "基本面稳健，估值合理。",
                "sections": {
                    "market_technical": {
                        "title": "市场技术分析",
                        "summary": "均线多头排列。",
                        "details": "MACD 金叉，量能温和放大。",
                    },
                    "risk": {"key_points": ["注意流动性风险"]},
                },
                "grounded_evidence": [
                    {
                        "source": "eastmoney",
                        "excerpt": "股吧情绪偏正面",
                        "captured_at": "2026-07-01T09:00:00",
                    }
                ],
                "stage_log": [{"id": "market", "status": "completed"}],
            }
        },
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_pdf_bytes_are_structurally_valid():
    data = report_formatter.report_pdf_bytes(_record())
    assert data.startswith(b"%PDF-1.4")
    assert data.rstrip().endswith(b"%%EOF")
    assert b"/Type /Catalog" in data
    assert b"/Type /Pages" in data


def test_pdf_uses_standard_cid_font_without_bundled_font_files():
    data = report_formatter.report_pdf_bytes(_record())
    # 中文依赖标准 CID 字体 STSong-Light（无需内置字体文件/字体嵌入）
    assert b"/STSong-Light" in data
    assert b"/FontFile" not in data


def test_pdf_encodes_cjk_text_as_utf16be_hex():
    record = _record()
    data = report_formatter.report_pdf_bytes(record)
    # 行内文本以 UTF-16BE hex 写入内容流（BOM 只在每行开头出现一次，
    # 故此处比对不含 BOM 的 hex 片段）
    for snippet in ("分析报告", "偏积极", "MACD"):
        assert snippet.encode("utf-16-be").hex().upper().encode("ascii") in data
    assert b"FEFF" in data


def test_pdf_text_hex_prefixes_bom_and_uses_utf16be():
    assert report_formatter._pdf_text_hex("中") == "FEFF" + "中".encode("utf-16-be").hex().upper()
    assert report_formatter._pdf_text_hex("AB") == "FEFF00410042"


def test_wrapped_pdf_lines_wraps_by_width_and_keeps_blank_lines():
    assert report_formatter._wrapped_pdf_lines("abcdef", width=3) == ["abc", "def"]
    assert report_formatter._wrapped_pdf_lines("a\n\nb") == ["a", "", "b"]
    # 制表符展开为 4 空格并去除行尾空白
    assert report_formatter._wrapped_pdf_lines("a\t ") == ["a"]