# TradingAgentsWeb 文档

## 实时排名功能文档

本目录包含实时排名功能的完整文档。

### 📚 文档索引

#### 快速开始
- **[LEADERBOARD_README.md](LEADERBOARD_README.md)** - 文档导航和快速命令
- **[LEADERBOARD_QUICK_REFERENCE.md](LEADERBOARD_QUICK_REFERENCE.md)** - 快速参考卡片
- **[LEADERBOARD_QUICKFIX.md](LEADERBOARD_QUICKFIX.md)** - 5分钟快速修复指南

#### 部署指南
- **[LEADERBOARD_DEPLOYMENT_GUIDE.md](LEADERBOARD_DEPLOYMENT_GUIDE.md)** - 完整部署指南

#### 技术文档
- **[实时排名功能完成报告.md](实时排名功能完成报告.md)** - 完整工作报告和技术细节
- **[实时排名功能实现报告.md](实时排名功能实现报告.md)** - 原始实现报告
- **[实时排名功能查缺补漏报告.md](实时排名功能查缺补漏报告.md)** - 问题分析报告
- **[实时排名功能修复总结.md](实时排名功能修复总结.md)** - 修复工作总结
- **[LEADERBOARD_TOGGLE_FIX.md](LEADERBOARD_TOGGLE_FIX.md)** - 排名开关状态同步问题修复
- **[UI_FIXES_20241117.md](UI_FIXES_20241117.md)** - UI问题修复（开关和密钥显示）
- **[CLEANUP_SUMMARY.md](CLEANUP_SUMMARY.md)** - 文档整理和清理总结

### 🚀 快速开始

```bash
# 1. 启动后端
python web/backend/app.py

# 2. 启动前端（新终端）
cd web/frontend && npm run dev

# 3. 访问排名页面
# http://localhost:3000/leaderboard
```

### 📖 推荐阅读顺序

1. **LEADERBOARD_README.md** - 了解全貌
2. **LEADERBOARD_QUICK_REFERENCE.md** - 快速参考
3. **LEADERBOARD_DEPLOYMENT_GUIDE.md** - 详细部署
4. **实时排名功能完成报告.md** - 技术细节

### ✅ 功能状态

- ✅ 数据库迁移完成
- ✅ 趋势图完整实现
- ✅ 持仓价格实时计算
- ✅ WebSocket实时推送
- ✅ HTTP轮询降级
- ✅ 完整文档和工具

### 📞 获取帮助

查看相关文档或访问项目主README。
