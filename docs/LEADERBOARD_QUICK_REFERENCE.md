# 实时排名功能 - 快速参考卡片

## ⚡ 5分钟快速部署

```bash
# 1. 数据库迁移（已完成✅）
python db/migrate_add_leaderboard_flag.py

# 2. 启动后端（终端1）
python web/backend/app.py

# 3. 启动前端（终端2）
cd web/frontend && npm run dev

# 4. 设置演示数据（终端3）
python scripts/setup_leaderboard_demo.py

# 5. 验证功能
python scripts/verify_leaderboard_setup.py

# 6. 访问页面
# http://localhost:3000/leaderboard
```

---

## 📋 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| 数据库字段 | ✅ | participate_in_leaderboard |
| 排名开关 | ✅ | 智能盯盘页面 |
| 趋势图 | ✅ | Canvas完整实现 |
| 持仓价格 | ✅ | 实时计算 |
| 决策历史 | ✅ | 完整展示 |
| WebSocket | ✅ | 实时推送 |
| HTTP降级 | ✅ | 自动切换 |

---

## 🔧 常用命令

### 验证
```bash
python scripts/verify_leaderboard_setup.py
```

### 演示数据
```bash
python scripts/setup_leaderboard_demo.py
```

### 查看数据库
```bash
sqlite3 db/tradingagents.db
SELECT * FROM users WHERE participate_in_leaderboard = 1;
```

---

## 🐛 快速故障排查

### 问题1: 趋势图空白
```bash
python scripts/setup_leaderboard_demo.py
```

### 问题2: 价格为0
```bash
pip install yfinance
```

### 问题3: WebSocket失败
- 检查后端是否运行
- 系统会自动降级到HTTP轮询

### 问题4: 无参与用户
- 登录 → 智能盯盘 → 开启"参加排名"

---

## 📚 文档索引

| 文档 | 用途 |
|------|------|
| [README](LEADERBOARD_README.md) | 📖 文档导航 |
| [QUICKFIX](LEADERBOARD_QUICKFIX.md) | ⚡ 快速修复 |
| [DEPLOYMENT](LEADERBOARD_DEPLOYMENT_GUIDE.md) | 🚀 完整部署 |
| [完成报告](实时排名功能完成报告.md) | 📊 技术细节 |

---

## 🎯 核心文件

### 后端
- `web/backend/routes/public_leaderboard_routes.py` - 排名API
- `web/backend/routes/user_leaderboard_routes.py` - 用户开关
- `web/backend/models.py` - 数据模型

### 前端
- `web/frontend/src/app/leaderboard/page.tsx` - 排名页面
- `web/frontend/src/components/leaderboard/LeaderboardChart.tsx` - 趋势图
- `web/frontend/src/hooks/useLeaderboardWebSocket.ts` - WebSocket

---

## ✅ 验收检查

- [ ] 数据库迁移完成
- [ ] 后端服务运行
- [ ] 前端服务运行
- [ ] 演示数据创建
- [ ] 排名页面可访问
- [ ] 趋势图正常显示
- [ ] 用户交互正常
- [ ] 实时更新工作

---

## 📞 获取帮助

1. 运行验证脚本
2. 查看相关文档
3. 检查日志输出
4. 查看浏览器控制台

---

**状态**: ✅ 已完成  
**版本**: v1.0.0  
**更新**: 2024-11-17
