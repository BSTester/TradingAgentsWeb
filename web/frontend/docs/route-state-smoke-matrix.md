# Route data-state smoke matrix

`RouteDataState` covers client-side data states independently from Next route boundaries.

| Route | Data surface | Normal | Loading | Empty | Error / recovery |
| --- | --- | --- | --- | --- | --- |
| `/history` | `AnalysisHistory` | Analysis cards | Query pending | No analyses; create action | Retry refetches history |
| `/analysis?id=<id>` | `AnalysisResults` | Report sections | Query pending | Missing payload | Reload retry |
| `/history/detail?id=<id>` | `AnalysisResults` | Report sections | Query pending | Missing payload | Reload retry |
| `/admin/users` | User directory | Table or cards | Query pending | No users | Retry refetches users |

For the other business routes, retain their existing route loading/error boundaries and verify their data-owning child component before widening this focused repair.
