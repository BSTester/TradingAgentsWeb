"""LLM token 用量收集与入库。

将 :class:`TokenUsageCollector` 注入 LangGraph 运行配置的 callbacks
（``args["config"]["callbacks"] = [collector]``），LangGraph 会将其传播给图内
每一次 LLM 调用（含并行分析师分支与工具链）。收集器线程安全地累加每次调用的
输入/输出 token；任务结束时调用 :meth:`TokenUsageCollector.persist`，把累计值
写成一条 ``AnalysisLog``（``agent='usage'`` / ``step='Token用量'``，
``input_tokens`` / ``output_tokens`` 列同时落库），便于后续按任务统计与计费。

单次调用的 token 提取优先级（首个命中即返回，绝不重复计数）：

1. ``generation.message.usage_metadata``（langchain-openai / anthropic / google 新协议）
2. ``response.response_metadata`` 的 ``token_usage`` / ``usage``（OpenAI 兼容）
3. ``response.llm_output`` 的 ``token_usage`` / ``usage``
4. ``generation.generation_info`` 的 ``token_usage`` / ``usage``（旧协议兜底）

设计原则：任何环节失败（依赖缺失、解析失败、DB 异常）一律 fail-open，
绝不影响分析主流程。
"""

from __future__ import annotations

import threading
from typing import Any, Dict, Optional

try:  # langchain 缺失时退化为 no-op handler，保证本模块始终可导入
    from langchain_core.callbacks.base import BaseCallbackHandler as _HandlerBase

    LANGCHAIN_AVAILABLE = True
except Exception:  # pragma: no cover - 依赖缺失时的降级分支
    LANGCHAIN_AVAILABLE = False

    class _HandlerBase:  # type: ignore[no-redef]
        """无操作回调 handler 占位（langchain_core 不可用时）。"""

        def on_llm_end(self, *args: Any, **kwargs: Any) -> None:
            return None


def _as_int(value: Any) -> Optional[int]:
    """宽松地把任意值转成 int；无法转换返回 None。"""
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _first_int(*values: Any) -> Optional[int]:
    """返回第一个非负整数；都无效时返回 None。"""
    for value in values:
        parsed = _as_int(value)
        if parsed is not None and parsed >= 0:
            return parsed
    return None


def _usage_from_mapping(mapping: Any) -> Optional[Dict[str, int]]:
    """从 ``{prompt_tokens|input_tokens, completion_tokens|output_tokens}`` 映射提取。"""
    if not isinstance(mapping, dict):
        return None
    prompt = _first_int(mapping.get("prompt_tokens"), mapping.get("input_tokens"))
    completion = _first_int(mapping.get("completion_tokens"), mapping.get("output_tokens"))
    if prompt is None and completion is None:
        return None
    return {"input": prompt or 0, "output": completion or 0}


def extract_llm_usage(response: Any) -> Optional[Dict[str, int]]:
    """从单次 LLM 调用结果提取 ``{"input": n, "output": n}``。

    解析不到任何用量信息时返回 ``None``（表示"该调用无用量数据"，而非错误）。
    """
    if response is None:
        return None

    # 1) 标准 usage_metadata（挂在 message 对象上）
    for generations in getattr(response, "generations", None) or []:
        for generation in generations or []:
            message = getattr(generation, "message", None)
            if message is None:
                continue
            meta = getattr(message, "usage_metadata", None)
            usage = _usage_from_mapping(meta)
            if usage is not None:
                return usage

    # 2) response_metadata.token_usage / usage
    response_metadata = getattr(response, "response_metadata", None)
    if isinstance(response_metadata, dict):
        for key in ("token_usage", "usage"):
            usage = _usage_from_mapping(response_metadata.get(key))
            if usage is not None:
                return usage

    # 3) llm_output.token_usage / usage
    llm_output = getattr(response, "llm_output", None)
    if isinstance(llm_output, dict):
        for key in ("token_usage", "usage"):
            usage = _usage_from_mapping(llm_output.get(key))
            if usage is not None:
                return usage

    # 4) generation_info.token_usage / usage（旧协议兜底）
    for generations in getattr(response, "generations", None) or []:
        for generation in generations or []:
            gen_info = getattr(generation, "generation_info", None)
            if not isinstance(gen_info, dict):
                continue
            for key in ("token_usage", "usage"):
                usage = _usage_from_mapping(gen_info.get(key))
                if usage is not None:
                    return usage

    return None


class TokenUsageCollector(_HandlerBase):
    """累计分析图全部 LLM 调用的 token 用量。

    作为 LangChain callback 注入 ``config["callbacks"]`` 后，LangGraph 会把它
    传播给每一次 LLM 调用（包括 4 个并行分析师分支）；累加操作带锁，
    并行分支回调并发到达时也安全。
    """

    def __init__(self) -> None:
        self.input_tokens: int = 0
        self.output_tokens: int = 0
        self.llm_call_count: int = 0
        self._lock = threading.Lock()

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def has_usage(self) -> bool:
        return self.input_tokens > 0 or self.output_tokens > 0

    def on_llm_end(self, response: Any, *args: Any, **kwargs: Any) -> None:  # type: ignore[override]
        """每次 LLM 调用结束时的回调（由 LangGraph 传播触发）。"""
        usage = extract_llm_usage(response)
        if usage is None:
            return
        with self._lock:
            self.llm_call_count += 1
            self.input_tokens += usage["input"]
            self.output_tokens += usage["output"]

    def snapshot(self) -> Dict[str, int]:
        """返回当前累计值的线程安全快照。"""
        with self._lock:
            return {
                "input_tokens": self.input_tokens,
                "output_tokens": self.output_tokens,
                "total_tokens": self.total_tokens,
                "llm_call_count": self.llm_call_count,
            }

    def persist(self, db: Any, analysis_id: str) -> bool:
        """把累计用量写成一条 AnalysisLog（fail-open，绝不抛异常）。

        - 无任何用量时跳过（不写空记录）；
        - 分析记录不存在时跳过；
        - 任何 DB 异常仅打印并回滚。
        """
        try:
            stats = self.snapshot()
            if stats["input_tokens"] <= 0 and stats["output_tokens"] <= 0:
                return False

            from web.backend.models import AnalysisLog, AnalysisRecord

            record = (
                db.query(AnalysisRecord)
                .filter(AnalysisRecord.analysis_id == analysis_id)
                .first()
            )
            if record is None:
                print(f"⚠️ 保存 token 用量失败: 未找到分析记录 {analysis_id}")
                return False

            log = AnalysisLog(
                analysis_record_id=record.id,
                level="info",
                message=(
                    f"Token 用量: 输入 {stats['input_tokens']:,} / "
                    f"输出 {stats['output_tokens']:,} / "
                    f"合计 {stats['total_tokens']:,}（LLM 调用 {stats['llm_call_count']} 次）"
                ),
                agent="usage",
                step="Token用量",
                input_tokens=stats["input_tokens"],
                output_tokens=stats["output_tokens"],
                log_metadata={
                    "input_tokens": stats["input_tokens"],
                    "output_tokens": stats["output_tokens"],
                    "total_tokens": stats["total_tokens"],
                    "llm_call_count": stats["llm_call_count"],
                },
            )
            db.add(log)
            db.commit()
            return True
        except Exception as exc:
            try:
                db.rollback()
            except Exception:
                pass
            print(f"⚠️ 保存 token 用量失败（可忽略）: {exc}")
            return False