# 资产快照功能更新说明

## 更新日期
2025-11-13

## 更新内容

### 1. 持仓概览盈亏显示优化 ✅

**变更**：调整盈亏列的显示顺序

**之前**：
```
+3.33%        (百分比在上)
+$500.00      (金额在下)
```

**现在**：
```
+$500.00      (金额在上，较大字体)
+3.33%        (百分比在下，较小字体)
```

**原因**：金额是更直观的盈亏指标，应该优先显示。

**影响文件**：
- `web/frontend/src/components/intraday/PositionOverview.tsx`

---

### 2. 移除手动快照功能 ✅

**变更**：移除手动创建快照的功能，仅保留自动定时快照

**移除的功能**：
- ❌ 账户信息卡片中的"快照"按钮
- ❌ `POST /api/account-snapshots/create/{market_type}` API 接口
- ❌ 前端手动快照相关代码

**保留的功能**：
- ✅ 自动定时快照（收盘时自动创建）
- ✅ 快照数据查询接口
- ✅ 趋势图查看功能

**原因**：
1. **数据一致性**：收盘时的快照更有意义，便于对比和分析
2. **简化操作**：用户无需手动操作，系统自动管理
3. **避免混淆**：防止用户在盘中创建快照导致数据不一致

**影响文件**：
- `web/frontend/src/components/intraday/AccountInfo.tsx` - 移除快照按钮和相关逻辑
- `web/backend/routes/account_snapshot_routes.py` - 移除手动创建接口

---

## 自动快照时间表

| 市场 | 本地收盘时间 | 快照时间（北京） | 说明 |
|------|-------------|------------------|------|
| 美股 (US) | 美东 16:00 | 夏令时 04:00<br>冬令时 05:00 | 自动处理 DST |
| 港股 (HK) | 香港 16:00 | 16:00 | 无夏令时 |
| A股 (CN) | 北京 15:00 | 15:00 | 无夏令时 |

**重要**：系统使用市场本地时区，APScheduler 自动处理夏令时切换。

## 用户影响

### 对现有用户
- **无需操作**：系统会自动在收盘后创建快照
- **数据保留**：已有的快照数据不受影响
- **趋势图**：仍可正常查看资产趋势

### 对新用户
- **自动化**：无需了解快照功能，系统自动管理
- **简单易用**：只需查看趋势图即可

## 技术细节

### 前端变更

#### AccountInfo.tsx
```typescript
// 移除的代码
const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

const handleCreateSnapshot = async () => {
  // ... 手动创建快照的逻辑
};

// 移除的 UI
<button onClick={handleCreateSnapshot}>
  快照
</button>
```

#### PositionOverview.tsx
```typescript
// 调整盈亏显示顺序
<div className="text-xs md:text-sm">
  {/* 金额在上 */}
  <div className={`font-medium ${pnlColor}`}>
    {pnl >= 0 ? '+' : ''}{currency}{pnl.toFixed(2)}
  </div>
  {/* 百分比在下 */}
  <div className={`text-xs ${pnlColor}`}>
    {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
  </div>
</div>
```

### 后端变更

#### account_snapshot_routes.py
```python
# 移除的接口
@router.post("/create/{market_type}")
async def create_snapshot(...):
    # ... 手动创建快照的逻辑

# 替换为注释
# Manual snapshot creation endpoint removed - snapshots are now created automatically
# by the snapshot scheduler at market close times
```

## 迁移指南

### 如果你有自定义代码调用手动快照接口

**之前**：
```typescript
// 手动创建快照
await fetch('/api/account-snapshots/create/US', { method: 'POST' });
```

**现在**：
```typescript
// 无需手动创建，系统自动在收盘时创建
// 如需查看最新快照，使用查询接口
const response = await fetch('/api/account-snapshots/latest/US');
```

### 如果你依赖手动快照的时间点

**建议**：
1. 使用定时快照数据（收盘时的数据更准确）
2. 如需实时数据，直接调用 Futu API 获取账户信息

## 测试建议

### 1. 验证持仓盈亏显示
```bash
# 访问智能盯盘页面
http://localhost:3000/intraday-trading

# 检查持仓概览表格
# 确认盈亏列显示：金额在上，百分比在下
```

### 2. 验证快照按钮已移除
```bash
# 访问智能盯盘页面
http://localhost:3000/intraday-trading

# 检查账户信息卡片
# 确认只有"刷新"按钮，没有"快照"按钮
```

### 3. 验证自动快照功能
```bash
# 查看后端启动日志
✅ Snapshot scheduler started (daily account snapshots)
📸 Scheduled snapshot jobs (3):
  - Daily US Market Snapshot: next run at ...
  - Daily HK Market Snapshot: next run at ...
  - Daily CN Market Snapshot: next run at ...

# 等待定时任务执行（或修改时间测试）
# 查看数据库确认快照已创建
SELECT * FROM account_snapshots 
WHERE DATE(snapshot_date) = CURRENT_DATE;
```

## 回滚方案

如果需要恢复手动快照功能：

1. **恢复前端代码**：
   ```bash
   git checkout HEAD~1 web/frontend/src/components/intraday/AccountInfo.tsx
   ```

2. **恢复后端接口**：
   ```bash
   git checkout HEAD~1 web/backend/routes/account_snapshot_routes.py
   ```

3. **重启服务**

## 相关文档

- `docs/ASSET_SNAPSHOT_FEATURE.md` - 功能文档（已更新）
- `docs/SNAPSHOT_IMPLEMENTATION_SUMMARY.md` - 实现总结（已更新）
- `docs/SNAPSHOT_QUICK_START.md` - 快速启动指南（已更新）

## 常见问题

### Q: 为什么移除手动快照？
A: 收盘时的快照更有意义，便于对比和分析。手动快照可能在盘中创建，导致数据不一致。

### Q: 如果我需要盘中的账户数据怎么办？
A: 直接使用账户信息卡片的"刷新"按钮，获取实时数据。快照用于历史趋势分析，不适合实时查看。

### Q: 已有的手动快照数据会被删除吗？
A: 不会。所有历史快照数据都会保留，可以正常查看趋势图。

### Q: 可以修改自动快照的时间吗？
A: 可以。修改 `web/backend/services/snapshot_scheduler.py` 中的 `MARKET_CLOSE_TIMES` 配置。

## 下一步计划

1. ⏭️ 优化快照数据存储（压缩历史数据）
2. ⏭️ 添加快照数据导出功能
3. ⏭️ 实现快照对比分析功能
4. ⏭️ 添加资产异常变化告警

## 更新总结

本次更新优化了用户体验，简化了操作流程：
- ✅ 持仓盈亏显示更直观（金额优先）
- ✅ 移除手动快照，避免数据混乱
- ✅ 保留自动快照，确保数据一致性
- ✅ 更新相关文档

所有变更已完成并通过测试。
