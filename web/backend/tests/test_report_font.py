"""PDF 导出字体自包含测试：内置 Noto Sans SC 子集必须存在且可被 reportlab 加载。

reportlab 不支持可变字体（variable font），因此该目录只允许放置静态
TrueType 子集（见 AGENTS.md 警告）。
"""

import os

from web.backend.services import report_formatter

FONTS_DIR = os.path.normpath(
    os.path.join(os.path.dirname(report_formatter.__file__), "..", "assets", "fonts")
)
BUNDLED_SUBSET = os.path.join(FONTS_DIR, "NotoSansSC-subset.ttf")


def test_bundled_subset_exists_and_is_nontrivial():
    assert os.path.exists(BUNDLED_SUBSET)
    assert os.path.getsize(BUNDLED_SUBSET) > 100_000  # 真实字体文件，而非占位


def test_pdf_font_prefers_bundled_subset():
    assert report_formatter._pdf_font() == "NotoSC"


def test_bundled_font_is_loadable_by_reportlab():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    pdfmetrics.registerFont(TTFont("NotoSCTest", BUNDLED_SUBSET))