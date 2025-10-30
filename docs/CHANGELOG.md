# 更新日志

## [v1.1.0] - 2025-01-XX

### 新增功能
- ✅ **公司名称显示功能**
  - 在 trader 节点完成后自动提取中文公司名称
  - 历史记录页面显示格式：`TSLA (特斯拉)`
  - 结果详情页面显示格式：`US | 英伟达`
  - 排行榜接口支持公司名称字段

### 数据库变更
- ✅ 添加 `company_name` 字段到 `analysis_records` 表
- ✅ 添加 `company_name` 索引以提升查询性能

### 改进
- ✅ 统一使用应用启动时的异步数据库初始化
- ✅ 删除独立的 `init_db.py` 脚本
- ✅ 优化数据库初始化流程（Leader 选举机制）
- ✅ 整理项目文档到 `docs/` 目录

### 文档更新
- ✅ 创建 `docs/` 目录统一管理文档
- ✅ 新增 `COMPANY_NAME_FEATURE.md` - 功能实现说明
- ✅ 新增 `DATABASE_INIT_SUMMARY.md` - 数据库初始化说明
- ✅ 更新 `DATABASE_SETUP.md` - 数据库设置指南
- ✅ 更新 `DEPLOYMENT_CHECKLIST.md` - 部署检查清单
- ✅ 新增 `docs/README.md` - 文档目录索引

### 删除
- ❌ 删除 `web/backend/init_db.py` - 统一使用应用启动初始化
- ❌ 删除 `test_company_name_extraction.py` - 测试脚本
- ❌ 删除 `web/backend/test_user_role.py` - 测试脚本
- ❌ 删除 `web/backend/test_output/` - 测试输出目录

### 技术细节
- 使用 LLM 从股票代码提取中文公司名称
- 提示词优化，确保返回中文简称
- 错误处理：提取失败时使用原始 ticker
- 性能影响：每次分析增加约 1-2 秒

### 迁移指南
- **新安装**：直接启动应用，自动创建包含新字段的表
- **现有数据库**：运行 `python web/backend/migrations/apply_migration.py`

---

## [v1.0.0] - 2024-XX-XX

### 初始版本
- ✅ 多智能体分析框架
- ✅ 支持美股、港股、A股
- ✅ FastAPI 后端 + Next.js 前端
- ✅ 用户认证和权限管理
- ✅ 实时分析进度推送
- ✅ 分析结果导出（PDF/Markdown/图片）
- ✅ 公开排行榜
- ✅ 分析历史管理

### 核心功能
- 市场分析师（技术指标）
- 社交媒体分析师（情绪分析）
- 新闻分析师（新闻情绪）
- 基本面分析师（财务数据）
- 研究团队（多空辩论）
- 交易员（策略生成）
- 风险管理（风险评估）

### 技术栈
- 后端：FastAPI + SQLAlchemy + JWT
- 前端：Next.js 15 + React 19 + Tailwind
- 数据库：SQLite / MySQL / PostgreSQL
- LLM：OpenAI / Anthropic / Google / OpenRouter / Ollama
- 数据源：AKShare / YFinance / Alpha Vantage / BaoStock

---

## 版本规范

### 版本号格式
- 主版本号.次版本号.修订号 (Major.Minor.Patch)
- 例如：1.1.0

### 版本号说明
- **主版本号**：重大架构变更或不兼容的 API 修改
- **次版本号**：新增功能，向后兼容
- **修订号**：Bug 修复和小改进

### 标签说明
- ✅ 新增功能
- 🔧 改进优化
- 🐛 Bug 修复
- 📝 文档更新
- ⚠️ 重要变更
- ❌ 删除功能
- 🔒 安全更新

---

## 贡献指南

### 提交变更
1. 创建功能分支
2. 提交代码和测试
3. 更新相关文档
4. 在本文件中添加变更记录
5. 提交 Pull Request

### 变更记录格式
```markdown
### 类别
- 标签 **功能名称**
  - 详细说明
  - 相关文件
  - 影响范围
```

---

## 未来计划

### v1.2.0 (计划中)
- [ ] 公司名称数据库缓存（减少 LLM 调用）
- [ ] 多语言支持（英文/中文公司名称）
- [ ] 公司名称编辑功能
- [ ] 排行榜卡片显示公司名称
- [ ] 分析报告模板自定义

### v1.3.0 (计划中)
- [ ] 回测功能增强
- [ ] 策略组合管理
- [ ] 风险指标可视化
- [ ] 移动端适配

### v2.0.0 (远期规划)
- [ ] 微服务架构重构
- [ ] 实时行情推送
- [ ] 社区分享功能
- [ ] AI 策略生成器

---

## 联系方式

- GitHub Issues: https://github.com/BSTester/TradingAgentsWeb/issues
- 项目主页: https://github.com/BSTester/TradingAgentsWeb

---

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](../LICENSE)
