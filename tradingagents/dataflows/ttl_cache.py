"""数据层文件型 TTL 缓存。

所有供应商取数最终汇入 `route_to_vendor()`（见 interface.py；
WS-133 的技能注册表 web/backend/services/skills/registry.py 也走该入口），
因此在此统一缓存即可覆盖全部供应商与全部智能体工具，无需逐个改造。

设计要点：
- 缓存键：SHA1(method, args, kwargs)，按 method 分子目录存放
- 存储：pickle 文件（兼容 str / DataFrame / 混合结果），原子写入（tmp + os.replace）
- TTL 策略：历史行情/财务数据不可变 → 长 TTL；实时行情 → 短 TTL；新闻 → 中等 TTL
- 环境变量 DATA_CACHE_TTL_SECONDS：>0 时全局覆盖单方法 TTL；=0 时整体禁用缓存
- 读失败/过期/反序列化异常一律 fail-open，回落到原始供应商逻辑
"""

from __future__ import annotations

import hashlib
import os
import pickle
import threading
import time

# 缓存目录：tradingagents/dataflows/data_cache（已在 .gitignore 排除）
_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data_cache")

# 各方法默认 TTL（秒）
METHOD_TTL = {
    # 历史行情/技术指标：数据不可变，缓存 1 天
    "get_stock_data": 86400,
    "get_indicators": 86400,
    # 基本面/财报：按季度更新，缓存 7 天
    "get_fundamentals": 7 * 86400,
    "get_balance_sheet": 7 * 86400,
    "get_cashflow": 7 * 86400,
    "get_income_statement": 7 * 86400,
    # 实时行情：保持新鲜度，仅缓存 5 分钟（主要避免同一分析内重复请求）
    "get_realtime_quote": 300,
    # 新闻：1 小时
    "get_news": 3600,
    "get_global_news": 3600,
    # 内部人交易/情绪：相对稳定，1 天
    "get_insider_sentiment": 86400,
    "get_insider_transactions": 86400,
}
DEFAULT_TTL = 3600

_create_lock = threading.Lock()


def _env_override() -> int | None:
    """DATA_CACHE_TTL_SECONDS：>0 全局覆盖；<=0 禁用缓存；未设置返回 None。"""
    raw = os.getenv("DATA_CACHE_TTL_SECONDS")
    if raw is None:
        return None
    try:
        v = int(raw.strip())
    except ValueError:
        return None
    return v


def ttl_for(method: str) -> int:
    """返回某方法当前生效的 TTL（秒）；0 表示缓存禁用。"""
    override = _env_override()
    if override is not None:
        return max(0, override)
    return METHOD_TTL.get(method, DEFAULT_TTL)


def cache_enabled(method: str) -> bool:
    return ttl_for(method) > 0


def _key_path(method: str, args: tuple, kwargs: dict) -> str:
    payload = repr((method, tuple(args), tuple(sorted((k, repr(v)) for k, v in kwargs.items()))))
    digest = hashlib.sha1(payload.encode("utf-8", "replace")).hexdigest()
    sub = os.path.join(_CACHE_DIR, method)
    with _create_lock:
        os.makedirs(sub, exist_ok=True)
    return os.path.join(sub, digest + ".pkl")


def cache_get(method: str, *args, **kwargs):
    """读取缓存；未命中/过期/损坏返回 None（fail-open）。"""
    if not cache_enabled(method):
        return None
    try:
        path = _key_path(method, args, kwargs)
        st = os.stat(path)
    except OSError:
        return None

    ttl = ttl_for(method)
    if time.time() - st.st_mtime > ttl:
        try:
            os.remove(path)
        except OSError:
            pass
        return None

    try:
        with open(path, "rb") as f:
            value = pickle.load(f)
        print(f"📦 [data_cache] HIT {method}（缓存命中，跳过供应商请求）")
        return value
    except Exception as e:  # noqa: BLE001 - 缓存损坏必须 fail-open
        print(f"⚠️ [data_cache] {method} 缓存读取失败，回落到供应商: {e}")
        try:
            os.remove(path)
        except OSError:
            pass
        return None


def cache_set(method: str, value, *args, **kwargs) -> None:
    """写入缓存（原子替换）；失败静默，不影响主流程。"""
    if not cache_enabled(method) or value is None:
        return
    try:
        path = _key_path(method, args, kwargs)
        tmp = f"{path}.tmp-{os.getpid()}-{threading.get_ident()}"
        with open(tmp, "wb") as f:
            pickle.dump(value, f, protocol=pickle.HIGHEST_PROTOCOL)
        os.replace(tmp, path)
    except Exception as e:  # noqa: BLE001
        print(f"⚠️ [data_cache] {method} 缓存写入失败: {e}")


def cache_stats() -> dict:
    """统计当前缓存目录占用情况（用于监控/调试）。"""
    total_files = 0
    total_bytes = 0
    if not os.path.isdir(_CACHE_DIR):
        return {"files": 0, "bytes": 0}
    for root, _dirs, files in os.walk(_CACHE_DIR):
        for name in files:
            if name.endswith(".pkl"):
                total_files += 1
                try:
                    total_bytes += os.path.getsize(os.path.join(root, name))
                except OSError:
                    pass
    return {"files": total_files, "bytes": total_bytes}