<p align="center">
  <img src="assets/TauricResearch.png" style="width: 60%; height: auto;">
</p>

<div align="center" style="line-height: 1;">
  <a href="https://arxiv.org/abs/2412.20138" target="_blank"><img alt="arXiv" src="https://img.shields.io/badge/arXiv-2412.20138-B31B1B?logo=arxiv"/></a>
  <a href="https://discord.com/invite/hk9PGKShPK" target="_blank"><img alt="Discord" src="https://img.shields.io/badge/Discord-TradingResearch-7289da?logo=discord&logoColor=white&color=7289da"/></a>
  <a href="./assets/wechat.png" target="_blank"><img alt="WeChat" src="https://img.shields.io/badge/WeChat-TauricResearch-brightgreen?logo=wechat&logoColor=white"/></a>
  <a href="https://x.com/TauricResearch" target="_blank"><img alt="X Follow" src="https://img.shields.io/badge/X-TauricResearch-white?logo=x&logoColor=white"/></a>
  <br>
  <a href="https://github.com/TauricResearch/" target="_blank"><img alt="Community" src="https://img.shields.io/badge/Join_GitHub_Community-TauricResearch-14C290?logo=discourse"/></a>
</div>

<div align="center">
  <!-- 请保留这些链接。翻译版本会随 README 自动更新。 -->
  <a href="https://www.readme-i18n.com/TauricResearch/TradingAgents?lang=de">Deutsch</a> | 
  <a href="https://www.readme-i18n.com/TauricResearch/TradingAgents?lang=es">Español</a> | 
  <a href="https://www.readme-i18n.com/TauricResearch/TradingAgents?lang=fr">français</a> | 
  <a href="https://www.readme-i18n.com/TauricResearch/TradingAgents?lang=ja">日本語</a> | 
  <a href="https://www.readme-i18n.com/TauricResearch/TradingAgents?lang=ko">한국어</a> | 
  <a href="https://www.readme-i18n.com/TauricResearch/TradingAgents?lang=pt">Português</a> | 
  <a href="https://www.readme-i18n.com/TauricResearch/TradingAgents?lang=ru">Русский</a> | 
  <a href="https://www.readme-i18n.com/TauricResearch/TradingAgents?lang=zh">中文</a>
</div>

---

# TradingAgents：多智能体 LLM 金融交易框架

> 🎉 TradingAgents 正式开源！我们收到了很多关于该工作的询问，感谢社区的热情关注。
>
> 因此我们决定完全开源该框架。期待与大家一起共建有影响力的项目！

<div align="center">
<a href="https://www.star-history.com/#TauricResearch/TradingAgents&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=TauricResearch/TradingAgents&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=TauricResearch/TradingAgents&type=Date" />
   <img alt="TradingAgents Star History" src="https://api.star-history.com/svg?repos=TauricResearch/TradingAgents&type=Date" style="width: 80%; height: auto;" />
 </picture>
</a>
</div>

<div align="center">

🚀 `<a href="#tradingagents-框架概览">`TradingAgents 框架 `</a>` | ⚡ `<a href="#安装与-cli">`安装与 CLI `</a>` | 🎬 `<a href="https://www.youtube.com/watch?v=90gr5lwjIho" target="_blank">`演示视频 `</a>` | 📦 `<a href="#作为-package-使用">`包用法 `</a>` | 🧭 `<a href="#部署">`部署 `</a>` | 🤝 `<a href="#参与贡献">`参与贡献 `</a>` | 📄 `<a href="#引用">`引用 `</a>`

</div>

## TradingAgents 框架概览

TradingAgents 是一个模拟真实交易公司协作方式的多智能体交易框架。通过部署专业的、由大语言模型驱动的智能体（基本面分析师、情绪分析师、新闻分析师、技术分析师、交易员、风险管理团队等），平台以协作方式评估市场状况并为交易决策提供依据。上述智能体还会进行动态讨论，以凝聚最优策略。

<p align="center">
  <img src="assets/schema.png" style="width: 100%; height: auto;">
</p>

> TradingAgents 框架用于研究目的。交易表现受多种因素影响，包括所选底座模型、模型温度、交易区间、数据质量及其他非确定性因素。该项目不构成任何金融/投资/交易建议：https://tauric.ai/disclaimer/

我们的框架将复杂的交易任务分解到专业角色，获得稳健、可扩展的市场分析与决策流程。

### 分析师团队（Analyst Team）

- 基本面分析师：评估公司财务与经营指标，识别内在价值与潜在风险。
- 情绪分析师：使用情感评分算法分析社交媒体与舆情，把握短期市场情绪。
- 新闻分析师：监控全球新闻与宏观指标，解读事件对市场的影响。
- 技术分析师：利用技术指标（如 MACD、RSI）识别交易形态并预测价格走势。

<p align="center">
  <img src="assets/analyst.png" width="100%" style="display: inline-block; margin: 0 2%;">
</p>

### 研究团队（Researcher Team）

- 由多空研究员组成，对分析师团队的观点进行批判性评估。通过结构化辩论，在潜在收益与内在风险之间取得平衡。

<p align="center">
  <img src="assets/researcher.png" width="70%" style="display: inline-block; margin: 0 2%;">
</p>

### 交易智能体（Trader Agent）

- 汇总分析师与研究员的结论，形成交易决策；据此确定交易时机与仓位规模。

<p align="center">
  <img src="assets/trader.png" width="70%" style="display: inline-block; margin: 0 2%;">
</p>

### 风险管理与投资组合经理（Risk Management & PM）

- 持续评估投资组合风险（波动率、流动性等）；风险团队提出评估报告，交由投资组合经理最终裁决。
- 投资组合经理批准/驳回交易提案；若批准，指令将发送至模拟交易所执行。

<p align="center">
  <img src="assets/risk.png" width="70%" style="display: inline-block; margin: 0 2%;">
</p>

## 安装与 CLI

### 安装

克隆仓库：

```bash
git clone https://github.com/TauricResearch/TradingAgents.git
cd TradingAgents
```

创建虚拟环境（示例使用 conda）：

```bash
conda create -n tradingagents python=3.13
conda activate tradingagents
```

安装依赖：

```bash
pip install -r requirements.txt
```

### 必需的 API

需要为智能体提供 OpenAI API；默认配置下，基本面与新闻数据使用 Alpha Vantage API（可在配置中替换）。

```bash
export OPENAI_API_KEY=$YOUR_OPENAI_API_KEY
export ALPHA_VANTAGE_API_KEY=$YOUR_ALPHA_VANTAGE_API_KEY
```

也可以在项目根目录创建 `.env`（参考 `.env.example`）：

```bash
cp .env.example .env
# 编辑 .env 填入真实 API Key
```

注：我们与 Alpha Vantage 合作，TradingAgents 源请求拥有更高的速率限制（每分钟 60 次，无日配额）。默认配置也支持使用 OpenAI 作为数据源，你可在 `tradingagents/default_config.py` 调整数据供应商。

### CLI 用法

直接运行 CLI：

```bash
python -m cli.main
```

你将看到可选择标的、日期、LLM、研究深度等的界面，并可实时查看各智能体的运行进度与输出。

<p align="center">
  <img src="assets/cli/cli_init.png" width="100%" style="display: inline-block; margin: 0 2%;">
</p>

<p align="center">
  <img src="assets/cli/cli_news.png" width="100%" style="display: inline-block; margin: 0 2%;">
</p>

<p align="center">
  <img src="assets/cli/cli_transaction.png" width="100%" style="display: inline-block; margin: 0 2%;">
</p>

## 作为 Package 使用

### 实现要点

我们基于 LangGraph 构建 TradingAgents 以保证灵活与模块化。实验中使用了不同类型的模型作为“深度思考/快速思考”LLM。为节省成本，建议在本地测试时使用轻量模型，因为框架在一次完整流程中会进行较多 API 调用。

### Python 代码示例

在你的代码中引入 `tradingagents` 模块并初始化 `TradingAgentsGraph()`；`.propagate()` 会返回一次决策。你也可以直接运行 `main.py`。

```python
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

ta = TradingAgentsGraph(debug=True, config=DEFAULT_CONFIG.copy())

# forward propagate
_, decision = ta.propagate("NVDA", "2024-05-10")
print(decision)
```

可复制默认配置并定制 LLM、辩论轮数、数据供应商等：

```python
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

# 自定义配置
config = DEFAULT_CONFIG.copy()
config["deep_think_llm"] = "gpt-4.1-nano"
config["quick_think_llm"] = "gpt-4.1-nano"
config["max_debate_rounds"] = 1

# 配置数据供应商（默认：yfinance + Alpha Vantage）
config["data_vendors"] = {
    "core_stock_apis": "yfinance",      # 可选：yfinance, alpha_vantage, local
    "technical_indicators": "yfinance", # 可选：yfinance, alpha_vantage, local
    "fundamental_data": "alpha_vantage",# 可选：openai, alpha_vantage, local
    "news_data": "alpha_vantage",       # 可选：openai, alpha_vantage, google, local
}

ta = TradingAgentsGraph(debug=True, config=config)

# forward propagate
_, decision = ta.propagate("NVDA", "2024-05-10")
print(decision)
```

> 默认使用 yfinance 获取行情与技术指标，Alpha Vantage 获取基本面与新闻。若用于生产或遇到限速，建议升级到 Alpha Vantage Premium 以获得更稳定的数据。我们也在打磨本地数据源（Tauric TradingDB）以支持离线实验，敬请期待。

完整配置见 `tradingagents/default_config.py`。

## 部署WEB版

提示：使用 Docker Compose 启动的是“Web 多用户版本”（内置用户注册/登录、JWT 鉴权、每用户分析历史、受保护 API、任务管理与结果导出），适合团队/多用户场景。若只需单机 CLI，可直接运行 python -m cli.main 或以容器方式运行 CLI。

本节整合 docker-compose.yml 与 README.Docker.md 的实际配置，提供本地与生产环境的推荐做法。

### 1. 准备环境

- 复制并编辑环境变量：

```bash
cp .env.example .env
cp web/frontend/.env.local.example web/frontend/.env.local
```

- 按需填写：

```env
# .env（后台使用）
OPENAI_API_KEY=your_openai_api_key_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
# 下列为可选
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here

# web/frontend/.env.local（前端使用）
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 2. 使用 Docker Compose（建议）

一键启动前后端（前端为 Nginx 静态托管并反代 /api 到后端）：

```bash
docker-compose up -d
```

- 访问前端 UI（Nginx）：http://localhost:8000
- 访问后端 API（FastAPI）：http://localhost:8080
- OpenAPI 文档：http://localhost:8080/docs

查看日志：

```bash
docker-compose logs -f       # 全部
docker-compose logs -f backend
docker-compose logs -f frontend
```

停止：

```bash
docker-compose down
```

端口与卷（来自 docker-compose.yml）：

- frontend: 8000 -> 80（Nginx 提供静态前端与反向代理）
- backend: 8080 -> 8000（FastAPI）
- 挂载卷：
  - ./tradingagents.db:/app/tradingagents.db
  - ./eval_results:/app/eval_results
- env_file: ./.env（加载后端所需密钥等）

如发生端口冲突，可在 docker-compose.yml 修改主机映射，例如：

```yaml
services:
  backend:
    ports:
      - "18080:8000"
  frontend:
    ports:
      - "18000:80"
```

### 3. 分别构建并运行（非 Compose）

后端：

```bash
docker build -t tradingagents-backend:latest .
docker run -d \
  --name tradingagents-backend \
  -p 8000:8000 \
  -v $(pwd)/.env:/app/.env \
  -v $(pwd)/tradingagents.db:/app/tradingagents.db \
  -v $(pwd)/eval_results:/app/eval_results \
  tradingagents-backend:latest
```

前端（Next.js 开发/独立运行，端口 3000）：

```bash
cd web/frontend
docker build -t tradingagents-frontend:latest .
docker run -d \
  --name tradingagents-frontend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 \
  tradingagents-frontend:latest
```

访问：

- 前端（独立 Next.js）：http://localhost:3000
- 后端（FastAPI）：http://localhost:8000
- API 文档：http://localhost:8000/docs

### 4. CLI / 脚本模式（容器内运行）

CLI：

```bash
docker run -it --rm \
  -v $(pwd)/.env:/app/.env \
  -v $(pwd)/eval_results:/app/eval_results \
  tradingagents-backend:latest \
  python cli/main.py
```

自定义脚本：

```bash
docker run -it --rm \
  -v $(pwd)/.env:/app/.env \
  tradingagents-backend:latest \
  python main.py
```

### 5. 生产环境要点

- 反向代理与 HTTPS：可使用外部 Nginx/Traefik/Caddy；如使用仓库内 `nginx.conf`，请为证书准备 `ssl/` 目录并启用相应段落。
- 外部数据库：在 docker-compose.yml 增加 PostgreSQL，并将后端 `DATABASE_URL` 指向该服务。
- Redis 缓存：按需启用 Redis 服务，用于加速热点数据。
- 资源限制与日志轮转：为各服务配置 CPU/内存限制与日志滚动策略。
- 健康检查/监控：暴露健康检查端点（后端 /health），配合容器编排监控指标与日志。

示例（截取）：

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: tradingagents
      POSTGRES_USER: tradingagents
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres-data:/var/lib/postgresql/data

  backend:
    environment:
      - DATABASE_URL=postgresql://tradingagents:your_password@postgres:5432/tradingagents
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 6. 故障排查

- 日志：

```bash
docker-compose logs -f --tail=100
```

- 进入容器：

```bash
docker exec -it tradingagents-backend bash
docker exec -it tradingagents-frontend sh
```

- 重建镜像：

```bash
docker-compose build --no-cache
docker-compose up -d
```

- 健康检查：

```bash
curl http://localhost:8080/health   # 后端（Compose 映射）
curl http://localhost:8080/docs     # 后端文档
curl http://localhost:8000          # 前端（Compose 映射）
```

### 7. 环境变量摘要

后端（.env）：

- OPENAI_API_KEY（必需）
- ALPHA_VANTAGE_API_KEY（可选，默认配置使用）
- ANTHROPIC_API_KEY（可选）
- GOOGLE_API_KEY（可选）
- DATABASE_URL（可选，默认 sqlite:///./tradingagents.db）

前端（web/frontend/.env.local）：

- NEXT_PUBLIC_API_BASE_URL（必需，默认 http://localhost:8000）

### 8. 端口对照

- Compose：
  - 前端（Nginx）：8000 -> 80
  - 后端（FastAPI）：8080 -> 8000
- 独立容器：
  - 前端（Next.js）：3000
  - 后端（FastAPI）：8000

## 参与贡献

欢迎以任何方式参与贡献：修复 Bug、改进文档、提出新特性建议等。若你对这条研究方向感兴趣，欢迎加入我们的开源金融 AI 社区 `<a href="https://tauric.ai/" target="_blank">`Tauric Research `</a>`。

## 引用

如果 TradingAgents 对你的工作有帮助，欢迎引用我们的论文：

```
@misc{xiao2025tradingagentsmultiagentsllmfinancial,
      title={TradingAgents: Multi-Agents LLM Financial Trading Framework}, 
      author={Yijia Xiao and Edward Sun and Di Luo and Wei Wang},
      year={2025},
      eprint={2412.20138},
      archivePrefix={arXiv},
      primaryClass={q-fin.TR},
      url={https://arxiv.org/abs/2412.20138}, 
}
```
