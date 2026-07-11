# WS-86 前端性能优化 — before/after 数据

> 分支：`perf/frontend-first-screen`
> 测量方式：确定性构建产物分析（Next 15 `output:'export'` 路由体积 + chunk 归属 + 渲染阻塞资源分析 + 真实 CDN 计时）。
>
> **运行时 Lighthouse/CDP 未能采集**：本沙箱里的 Chromium 无法建立到 localhost 的 TCP 连接（已验证：chrome 发出 `Network.requestWillBeSent` 后请求永远到不了本地静态服务器，而 curl 同一地址 6ms 返回 200；`data:` URL 则可正常加载）。因此 FCP/LCP/TBT 运行时数值请 QA 在无网络限制的环境用 Lighthouse 复测——复测步骤见文末。下面的数据全部是确定性、可复现的。

## 基线（main，改动前）

### `next build` 路由体积（First Load JS）
| 路由 | Size | First Load JS |
|---|---|---|
| `/`（首页/对话，含 MessageBubble→react-markdown） | 12.6 kB | **183 kB** |
| `/login` | 2.56 kB | 143 kB |
| `/analysis`（含 AnalysisResults 2230 行 + react-markdown） | 1.56 kB | **196 kB** |
| `/history/detail`（同 AnalysisResults） | 1.46 kB | **196 kB** |
| `/history` | 7.79 kB | 147 kB |
| `/profile/ai-settings` | 7.63 kB | 147 kB |
| shared by all | — | 102 kB |

### react-markdown 归属（基线）
react-markdown / remark / micromark / mdast 被打进 3 个 chunk：
- `chunks/831-*.js` = **117 kB**（unified/micromark 核心）
- `chunks/679-*.js` = 53 kB
- `chunks/745-*.js` = 36 kB

**首页 `/` 的首屏 HTML 已预加载 `chunks/831`（117 kB 的 markdown 核心）**——即 react-markdown 当前在首页首屏 JS 里。`/analysis`、`/history/detail` 三个 chunk 全部吃下。

### Font Awesome 渲染阻塞（基线）
`src/app/layout.tsx` 在 `<head>` 用渲染阻塞外链加载 cdnjs 的 FA：
```
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```
真实计时（`curl -w`，本机到 cdnjs.cloudflare.com，3 次）：
| | dns | connect | tls | ttfb | total | size |
|---|---|---|---|---|---|---|
| run1 | 0.02s | 0.04s | 1.15s | 1.33s | **3.28s** | 102 kB |
| run2 | 0.01s | 0.07s | 0.25s | 0.62s | **16.14s** | 102 kB |
| run3 | 0.01s | 0.17s | 0.37s | 1.09s | **12.94s** | 102 kB |

→ 首屏被这 102 kB 的跨域外链 CSS 阻塞 **0.6–16s**（中位 ~13s）。这就是“首屏白屏”主因之一。渲染阻塞外链样式表数量：**1**。

## 改动后

### `next build` 路由体积（First Load JS，before → after）
| 路由 | before | after | Δ |
|---|---|---|---|
| `/`（首页/对话） | 183 kB | **147 kB** | **−36 kB (−20%)** |
| `/login` | 143 kB | 143 kB | 0（FA 改为非阻塞自托管，体积不变但不再阻塞首屏）|
| `/analysis` | 196 kB | **139 kB** | **−57 kB (−29%)** |
| `/history/detail` | 196 kB | **139 kB** | **−57 kB (−29%)** |
| `/history` | 147 kB | 147 kB | 0 |
| `/profile/ai-settings` | 147 kB | 147 kB | 0（未受影响）|

> 共享层 `First Load JS shared by all` 102 kB 不变；减少的全是路由自有/按需部分。

### react-markdown 归属（after）
- react-markdown / remark / rehype 全部移进**按需 chunk** `chunks/462.*.js`：
  **150 kB 原始 / 45 kB gzip**。
- 首页 `/` 的首屏 HTML 已**不再**预加载旧的 `chunks/831`（117 kB 的 markdown 核心）——
  `index.html` 对 markdown chunk 的 eager 引用数 = **0**（改动前为 1）。
  即 45 kB(gzip) 的 markdown 解析栈只在真正要渲染 markdown 时才下载，不再进首屏。
- `/analysis`、`/history/detail` 的 `AnalysisResults`（≈2k 行）改为 `next/dynamic` 代码分块，
  路由自有体积从 1.56 kB 升到 3.27 kB（多了 dynamic 胶水），但 First Load JS 净降 57 kB。

### Font Awesome（after）
- `out/login/index.html` 中 cdnjs 外链 `<link>` 数量：**1 → 0**（渲染阻塞外链样式表清零）。
- 改为自托管 `/lib/font-awesome/`（woff2-only，4 个字体共 288 kB，首屏仅 `fa-solid-900` 150 kB 按需加载），
  通过 `media="print"` + `onload` 切 `all` 的内联脚本非阻塞加载（`<noscript>` 兜底）。
- 收益：首屏不再等待 cdnjs 的跨域 CSS（基线 0.6–16s、中位 ~13s）——同源 + 非阻塞，
  关键渲染路径上不再有任何跨域样式表。

### 关于运行时 FCP/LCP/TBT（未能采集）
本沙箱的 Chromium 无法建立到 localhost 的 TCP 连接（已验证：chrome 发出
`Network.requestWillBeSent` 后请求到不了本地静态服务器，`curl` 同址 6ms 返回 200；
`data:` URL 可正常加载），因此无法用 Lighthouse/CDP 采运行时数值。上述全部为确定性、
可复现的构建产物数据。QA 请在无网络限制环境复测运行时指标，步骤：

1. `cd web/frontend && npm run build`（已验证通过）
2. 静态托管 `out/`，例如 `npx serve out -l 8000`
3. 对 `http://localhost:8000/login/` 与 `http://localhost:8000/` 跑 Lighthouse（移动端节流），
   对比 main 与 `perf/frontend-first-screen` 的 FCP/LCP/TBT；
4. 路由切换白屏：登录后从 `/` 跳 `/analysis?id=<某历史id>`，用 Performance 录制
   “点击 → 骨架屏出现”的时长（after 应≈0，骨架立即出现）。

