"""CORS_ORIGINS 环境变量驱动的解析测试（生产环境禁止开放跨域）。

导入 ``web.backend.app`` 会加载完整 FastAPI 应用（含全部路由与图引擎），
但不会启动服务器或建立数据库连接，可作为单元级门禁使用。
"""

from web.backend.app import _resolve_cors_origins

LOCAL_DEV_DEFAULTS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]


def test_picks_up_comma_separated_env(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example.com, https://b.example.com ,")
    assert _resolve_cors_origins() == [
        "https://a.example.com",
        "https://b.example.com",
    ]


def test_falls_back_to_local_dev_defaults_when_unset(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert _resolve_cors_origins() == LOCAL_DEV_DEFAULTS


def test_blank_or_whitespace_only_env_treated_as_unset(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "   ,  ,")
    assert _resolve_cors_origins() == LOCAL_DEV_DEFAULTS


def test_single_origin_env():
    import os

    os.environ["CORS_ORIGINS"] = "https://trading.example.com"
    try:
        assert _resolve_cors_origins() == ["https://trading.example.com"]
    finally:
        os.environ.pop("CORS_ORIGINS", None)