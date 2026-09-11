"""市场自动识别测试：identify_market 的代码格式 → 市场映射。"""

import pytest

try:
    from tradingagents.dataflows.interface import identify_market
except Exception:  # pragma: no cover - 数据层依赖不完整时整体跳过
    pytest.skip("tradingagents.dataflows 不可用", allow_module_level=True)


@pytest.mark.parametrize(
    ("symbol", "expected"),
    [
        ("600519", "A_STOCK"),  # 沪市主板（贵州茅台）
        ("000001", "A_STOCK"),  # 深市主板
        ("300750", "A_STOCK"),  # 创业板
        ("688981", "A_STOCK"),  # 科创板
        ("600519.SH", "A_STOCK"),  # 显式交易所后缀
        ("0700", "HK_STOCK"),  # 4 位港股（腾讯）
        ("9988.HK", "HK_STOCK"),  # 显式港股后缀
        ("AAPL", "US_STOCK"),  # 纯字母美股
        ("BRK.A", "US_STOCK"),  # 含点号（伯克希尔 A/B 类）
        ("TSLA.US", "US_STOCK"),  # 显式美股后缀
        ("", "UNKNOWN"),
    ],
)
def test_identify_market(symbol, expected):
    assert identify_market(symbol) == expected


def test_identify_market_is_case_insensitive():
    assert identify_market("aapl") == "US_STOCK"
    assert identify_market("600519.sh") == "A_STOCK"