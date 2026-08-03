# WS-86 改动清单

分支：`perf/frontend-first-screen`（基于 `main`）。只动前端 `web/frontend/`，不涉及后端 / API 契约 / 框架 / SSR。

## 任务 1：Font Awesome 非阻塞化（自托管）

- `web/frontend/src/app/layout.tsx` — 删除 `<head>` 里指向 `cdnjs.cloudflare.com` 的渲染阻塞外链 `<link>`，改为自托管 `/lib/font-awesome/css/all.min.css`，用 `media="print"` + `onload` 切 `all` 的内联脚本非阻塞加载（`<noscript>` 兜底）。首屏不再被跨域 FA CSS 阻塞。
- `web/frontend/public/lib/font-awesome/` *(新增)* — 自托管 FA 6.4.0：`css/all.min.css`（已裁掉 ttf 源，仅留 woff2）+ `webfonts/`（fa-solid-900 / fa-regular-400 / fa-brands-400 / fa-v4compatibility，woff2）。`README.md` 注明来源与 License。

## 任务 2：重页面骨架屏 + 路由级代码分块

- `web/frontend/src/components/analysis/AnalysisResultsSkeleton.tsx` *(新增)* — 分析结果页骨架屏（标题卡 + 阶段 tab + 内容块，`animate-pulse`，带 `aria-busy`）。
- `web/frontend/src/app/analysis/page.tsx` — `AnalysisResults` 由静态 import 改为 `next/dynamic` 代码分块，`loading` 用骨架屏；路由切换不再“白屏再弹出”。
- `web/frontend/src/app/history/detail/page.tsx` — 同上。
- `web/frontend/src/components/analysis/AnalysisResults.tsx` — 数据加载态由双圈 spinner 改为复用同一骨架屏（避免 骨架→spinner→内容 闪烁）。

## 任务 3：react-markdown 链懒加载

- `web/frontend/src/components/common/Markdown.tsx` *(新增)* — 封装 `react-markdown` + remark/rehype 插件为 preset（`gfm` = remark-gfm + remark-breaks；`sanitize` = rehype-sanitize），支持 `components` 透传。这是会被懒加载的重模块。
- `web/frontend/src/components/common/LazyMarkdown.tsx` *(新增)* — 用 `next/dynamic({ ssr:false })` 懒加载 `Markdown`，带轻量 `loading` 占位；模块解析一次后缓存，流式消息/多次渲染只付一次成本。
- `web/frontend/src/components/conversation/MessageBubble.tsx` — `ReactMarkdown` → `LazyMarkdown`（2 处）。
- `web/frontend/src/components/analysis/ReportCard.tsx` — `ReactMarkdown` → `LazyMarkdown`（1 处）。
- `web/frontend/src/components/analysis/AnalysisResults.tsx` — `ReactMarkdown` → `LazyMarkdown`（6 处，含 PDF 自定义 `components` 的那处，preset+components 均保留）。

## 测试 / 文档

- `web/frontend/src/components/common/Markdown.test.tsx` *(新增)* — 锁定 gfm / sanitize / 表格 / 默认 preset 的渲染行为。
- `web/frontend/src/components/analysis/AnalysisResultsSkeleton.test.tsx` *(新增)* — 骨架屏可访问性与渲染。
- `web/frontend/issues/WS-86/perf-data.md` *(新增)* — before/after 数据与 QA 复测步骤。
- `web/frontend/issues/WS-86/CHANGES.md` *(本文件)*。

## 验证

- `npm run build` ✓（`next.config.ts` 关闭了构建期 lint/type 检查，与 main 一致）
- `npm run typecheck`：本次新增/修改文件 0 报错（仓库内既有的、与本任务无关的 `auth.tsx` / `marketTime.ts` 等报错为 main 上已存在，未触碰）
- `npm run test:run` ✓ 38 passed（原 33 + 新增 5）
- 运行时 Lighthouse 未能采集（沙箱 Chromium 无法连 localhost，详见 `perf-data.md`），已附 QA 复测步骤
