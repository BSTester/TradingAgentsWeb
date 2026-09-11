# Report Role-Chain Contract

The report API (`GET /api/reports/{id}`) returns a structured `role_chain`
field that the frontend report page renders as a multi-agent chain. This is the
authoritative backend contract, mirrored 1:1 by the frontend TypeScript types.

## Source

Built by `tradingagents/utils/role_chain.py` from the TradingAgents graph
`final_state`, persisted into `final_state.role_chain` at analysis completion,
and projected by `web/backend/services/report_formatter.py` onto the report API.

## Chain order

1. **Decision** (Risk Judge final verdict, pinned at top)
2. **Analyst Team** — Market / Social / News / Fundamentals
3. **Research Debate** — Bull / Bear / Research Manager
4. **Trading Plan** — Trader (non-executive research guidance)
5. **Risk Debate** — Risky / Safe / Neutral
6. **Summary**

## Shape

```jsonc
{
  "decision": {
    "verdict": "buy",                 // strong_buy|buy|overweight|hold|reduce|watch
    "verdictLabel": "买入",
    "rationale": "...",               // Risk Judge叙述
    "priceBand": { "low": 380, "high": 410, "currency": "HKD", "basis": "示例" },  // nullable
    "riskLevel": "moderate",          // low|moderate|elevated|high
    "horizon": "1-3个月",             // nullable
    "confidence": 72                  // 0-100, nullable
  },
  "analysts": [
    { "role": "market", "code": "MKT", "title": "市场分析师", "stance": "positive", "summary": "...", "evidence": [], "hasContent": true }
    // + social(SOC) / news(NEWS) / fundamentals(FND)
  ],
  "debate": { "bull": {…}, "bear": {…}, "manager": { "summary": "…" } },
  "traderPlan": { "verdict": "…", "verdictLabel": "…", "priceBand": {…}|null, "positionCapPct": null, "note": "研究建议，非下单执行入口", "hasContent": true },
  "riskDebate": { "risky": {…}, "safe": {…}, "neutral": {…} },
  "summary": "…",
  "meta": { "sources": 3, "generatedAt": "…", "disclaimer": "…" }
}
```

## Frontend integration notes

- `priceBand` / `confidence` / `horizon` are heuristic extractions and are
  `null` when the underlying text is absent. Render a **"示例 / 延迟"** badge;
  never invent numbers.
- `traderPlan.note` is the fixed string **"研究建议，非下单执行入口"**. The whole
  site renders no order-execution entry.
- Risk-debate keys are normalized: the fork emits `risky`/`safe`/`neutral`;
  upstream v0.2.5 `aggressive`/`conservative` are accepted on input and
  normalized on output.
- When no agent content exists (early/partial analysis), `role_chain` is
  omitted from the API response — fall back to the legacy `sections` view.
- `report_preview` (list/leaderboard cards) includes a trimmed
  `role_chain: { decision, analysts }` plus a top-level `trading_decision`
  label for card summaries.

