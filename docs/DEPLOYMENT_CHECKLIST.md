# 公司名称功能部署检查清单

## 部署前准备

### 1. 数据库迁移
- [ ] 备份现有数据库
- [ ] 应用迁移脚本
  ```bash
  cd web/backend/migrations
  python apply_migration.py
  ```
- [ ] 验证字段已添加
  ```sql
  \d analysis_records  -- 查看表结构
  SELECT column_name, data_type FROM information_schema.columns 
  WHERE table_name = 'analysis_records' AND column_name = 'company_name';
  ```

### 2. 代码部署
- [ ] 拉取最新代码
- [ ] 检查所有修改的文件：
  - `web/backend/models.py`
  - `web/backend/routes/analysis_routes.py`
  - `web/backend/routes/leaderboard_routes.py`
  - `web/backend/analysis_task.py`
  - `tradingagents/agents/trader/trader.py`
  - `web/frontend/src/components/analysis/AnalysisHistory.tsx`
  - `web/frontend/src/components/analysis/AnalysisResults.tsx`
  - `web/frontend/src/app/page.tsx`
  - `web/frontend/src/components/leaderboard/AnalysisCardsGrid.tsx`

### 3. 环境检查
- [ ] 确认 LLM API 密钥配置正确
- [ ] 确认数据库连接正常
- [ ] 确认前端构建环境正常

## 部署步骤

### 后端部署

1. **停止后端服务**
   ```bash
   # 如果使用 systemd
   sudo systemctl stop tradingagents-backend
   
   # 或者直接 kill 进程
   pkill -f "uvicorn.*app_v2"
   ```

2. **应用数据库迁移（仅现有数据库需要）**
   ```bash
   cd web/backend/migrations
   python apply_migration.py
   ```
   
   **注意**：如果是全新安装，跳过此步骤，应用启动时会自动创建包含新字段的表。

3. **重启后端服务**
   ```bash
   # 如果使用 systemd
   sudo systemctl start tradingagents-backend
   
   # 或者手动启动
   cd web/backend
   uvicorn app_v2:app --host 0.0.0.0 --port 8000
   ```
   
   应用启动时会：
   - 自动初始化数据库（如果是新数据库）
   - 确保第一个用户是管理员
   - 清理遗留的运行中任务

4. **检查后端日志**
   ```bash
   # 查看是否有错误
   tail -f /var/log/tradingagents/backend.log
   
   # 或者查看 systemd 日志
   sudo journalctl -u tradingagents-backend -f
   ```
   
   应该看到：
   ```
   ✅ Database tables initialized successfully
   ✅ Running tasks cleaned up
   ✅ Task monitor started (leader)
   ```

### 前端部署

1. **构建前端**
   ```bash
   cd web/frontend
   npm run build
   ```

2. **重启前端服务**
   ```bash
   # 如果使用 PM2
   pm2 restart tradingagents-frontend
   
   # 如果使用 systemd
   sudo systemctl restart tradingagents-frontend
   ```

3. **检查前端日志**
   ```bash
   pm2 logs tradingagents-frontend
   ```

## 部署后验证

### 1. API 测试

#### 测试历史记录接口
```bash
curl -X GET "http://localhost:8000/api/analyses?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.analyses[0] | {ticker, company_name, market}'
```

期望输出：
```json
{
  "ticker": "AAPL",
  "company_name": "苹果",
  "market": "US"
}
```

#### 测试排行榜接口
```bash
curl -X GET "http://localhost:8000/api/leaderboard" \
  | jq '.US[0] | {ticker, company_name, market}'
```

### 2. 功能测试

#### 测试新建分析
1. [ ] 登录系统
2. [ ] 创建新的分析（选择任意股票代码）
3. [ ] 等待分析完成
4. [ ] 检查历史记录页面是否显示公司名称
5. [ ] 检查结果详情页面是否显示市场类别和公司名称

#### 测试不同市场
- [ ] 美股：AAPL, TSLA, NVDA
- [ ] 港股：0700.HK, 00700.HK
- [ ] A股：600519, 000001

#### 测试显示格式
- [ ] 历史记录：`TSLA (特斯拉)`
- [ ] 结果详情：`US | 英伟达`
- [ ] 排行榜：数据正常加载

### 3. 边界情况测试

#### 测试现有记录
- [ ] 查看迁移前的分析记录
- [ ] 确认 company_name 为 NULL 时不影响显示
- [ ] 确认只显示股票代码，不显示括号

#### 测试提取失败
- [ ] 使用不常见的股票代码
- [ ] 确认提取失败时使用 ticker 作为备选
- [ ] 确认不会导致分析失败

### 4. 性能测试
- [ ] 测试分析时间是否增加（预期增加 1-2 秒）
- [ ] 测试 API 响应时间是否正常
- [ ] 测试数据库查询性能

## 回滚计划

如果部署出现问题，按以下步骤回滚：

### 1. 回滚代码
```bash
git revert HEAD
git push
```

### 2. 回滚数据库（可选）
```sql
-- 如果需要删除 company_name 字段
ALTER TABLE analysis_records DROP COLUMN IF EXISTS company_name;
DROP INDEX IF EXISTS idx_analysis_records_company_name;
```

### 3. 重启服务
```bash
# 后端
sudo systemctl restart tradingagents-backend

# 前端
pm2 restart tradingagents-frontend
```

## 监控指标

部署后持续监控以下指标：

- [ ] 错误率：检查是否有新的错误日志
- [ ] 响应时间：API 响应时间是否正常
- [ ] 成功率：分析完成率是否正常
- [ ] 用户反馈：是否有用户报告显示问题

## 常见问题

### Q1: 数据库迁移失败
**A**: 检查数据库连接和权限，确保有 ALTER TABLE 权限

### Q2: 公司名称显示为 NULL
**A**: 这是正常的，只有新的分析才会有公司名称

### Q3: 公司名称提取不准确
**A**: 这依赖于 LLM 的理解能力，可以考虑使用股票代码数据库

### Q4: 分析时间明显增加
**A**: 检查 LLM API 响应时间，考虑使用更快的模型

## 联系方式

如有问题，请联系：
- 技术负责人：[姓名]
- 邮箱：[email]
- 紧急联系：[电话]

## 完成确认

- [ ] 所有检查项已完成
- [ ] 功能测试通过
- [ ] 性能测试通过
- [ ] 用户验收通过
- [ ] 文档已更新
- [ ] 团队已通知

部署完成时间：__________
部署人员签名：__________
