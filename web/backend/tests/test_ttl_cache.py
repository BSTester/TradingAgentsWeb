"""数据层文件型 TTL 缓存测试：命中/未命中、过期清理、损坏 fail-open、环境变量开关。"""

import os
import time

import pytest

from tradingagents.dataflows import ttl_cache


@pytest.fixture(autouse=True)
def isolated_cache(tmp_path, monkeypatch):
    """把缓存目录重定向到临时目录，并确保未设置全局 TTL 覆盖。"""
    monkeypatch.setattr(ttl_cache, "_CACHE_DIR", str(tmp_path))
    monkeypatch.delenv("DATA_CACHE_TTL_SECONDS", raising=False)
    yield


def test_roundtrip_hit_and_miss():
    ttl_cache.cache_set("get_news", {"price": 1.23}, "AAPL")
    assert ttl_cache.cache_get("get_news", "AAPL") == {"price": 1.23}
    # 不同参数 → 未命中
    assert ttl_cache.cache_get("get_news", "TSLA") is None


def test_kwargs_are_part_of_key():
    ttl_cache.cache_set("get_stock_data", [1, 2, 3], "AAPL", start_date="2026-01-01")
    assert ttl_cache.cache_get("get_stock_data", "AAPL", start_date="2026-01-01") == [
        1,
        2,
        3,
    ]
    assert (
        ttl_cache.cache_get("get_stock_data", "AAPL", start_date="2026-01-02")
        is None
    )


def test_expired_entry_is_discarded_and_removed():
    ttl_cache.cache_set("get_news", "x", "AAPL")
    path = ttl_cache._key_path("get_news", ("AAPL",), {})
    past = time.time() - 10_000  # 远早于默认 1h TTL
    os.utime(path, (past, past))

    assert ttl_cache.cache_get("get_news", "AAPL") is None
    assert not os.path.exists(path)  # 过期文件被清理


def test_corrupt_cache_fails_open():
    path = ttl_cache._key_path("get_news", ("AAPL",), {})
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"not a pickle")
    # 缓存损坏绝不抛异常，回落到供应商逻辑
    assert ttl_cache.cache_get("get_news", "AAPL") is None


def test_env_zero_disables_cache(monkeypatch):
    monkeypatch.setenv("DATA_CACHE_TTL_SECONDS", "0")
    assert ttl_cache.cache_enabled("get_news") is False
    assert ttl_cache.cache_get("get_news", "AAPL") is None
    ttl_cache.cache_set("get_news", "x", "AAPL")
    assert ttl_cache.cache_stats()["files"] == 0


def test_env_positive_value_overrides_all_ttls(monkeypatch):
    monkeypatch.setenv("DATA_CACHE_TTL_SECONDS", "123")
    assert ttl_cache.ttl_for("get_news") == 123
    assert ttl_cache.ttl_for("some_unknown_method") == 123


def test_default_ttls():
    assert ttl_cache.ttl_for("get_news") == 3600
    assert ttl_cache.ttl_for("get_stock_data") == 86400
    # 未登记的方法回退到默认 TTL
    assert ttl_cache.ttl_for("some_unknown_method") == ttl_cache.DEFAULT_TTL