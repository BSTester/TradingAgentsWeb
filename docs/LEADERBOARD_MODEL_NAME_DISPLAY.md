# 排行榜显示模型名称

## 功能描述

在排行榜的排名列表中显示每个用户使用的LLM模型名称，让用户可以了解其他参与者使用的模型，便于对比不同模型的表现。

## 实现内容

### 1. 后端API修改

**文件**：`web/backend/routes/public_leaderboard_routes.py`

**修改**：在 `/api/public/leaderboard/users` 接口中添加模型信息

```python
# 获取用户配置
config_query = select(UserConfig).where(UserConfig.user_id.in_(user_ids))
config_result = await db.execute(config_query)
configs = {config.user_id: config for config in config_result.scalars().all()}

# 添加模型信息到用户数据
for key, user_data in users_dict.items():
    user_id = user_data['user_id']
    if user_id in configs:
        config = configs[user_id]
        # 优先使用智能盯盘模型，否则使用分析模型
        model_name = config.intraday_llm_model or config.last_deep_thinker
        user_data['model_name'] = model_name if model_name else None
    else:
        user_data['model_name'] = None
```

**返回数据结构**：
```json
{
  "user_id": 1,
  "username": "trader123",
  "market_type": "US",
  "total_assets": 105000.50,
  "latest_snapshot_date": "2024-11-17",
  "model_name": "gpt-4-turbo"
}
```

### 2. 前端显示修改

**文件**：`web/frontend/src/components/leaderboard/LeaderboardTrendChart.tsx`

**TypeScript接口**：
```typescript
interface User {
  user_id: number;
  username: string;
  market_type: string;
  total_assets: number;
  latest_snapshot_date: string;
  model_name?: string;  // 新增字段
}
```

**UI显示**：
```tsx
<div className="text-left flex-1">
  <p className="text-sm font-medium text-text-primary">
    {user.username}
  </p>
  <div className="flex items-center gap-2 mt-1">
    <p className="text-xs text-text-tertiary">
      {user.latest_snapshot_date}
    </p>
    {user.model_name && (
      <>
        <span className="text-xs text-text-tertiary">•</span>
        <span className="text-xs px-1.5 py-0.5 bg-accent-primary/10 text-accent-primary rounded border border-accent-primary/30">
          {user.model_name}
        </span>
      </>
    )}
  </div>
</div>
```

## 视觉效果

### 排名列表显示

```
┌─────────────────────────────────────────┐
│ 🏆 排名列表 (10)                        │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 1  trader123                        │ │
│ │    2024-11-17 • gpt-4-turbo         │ │
│ │                      $105,000       │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 2  investor456                      │ │
│ │    2024-11-17 • claude-3-opus       │ │
│ │                      $102,500       │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 3  quant789                         │ │
│ │    2024-11-17 • gemini-pro          │ │
│ │                      $98,750        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 模型标签样式

- **背景色**：`bg-accent-primary/10` - 半透明的主题色背景
- **文字色**：`text-accent-primary` - 主题色文字
- **边框**：`border border-accent-primary/30` - 半透明边框
- **圆角**：`rounded` - 圆角矩形
- **内边距**：`px-1.5 py-0.5` - 紧凑的内边距
- **字体大小**：`text-xs` - 小号字体

## 模型优先级

### 选择逻辑

```python
model_name = config.intraday_llm_model or config.last_deep_thinker
```

1. **优先**：`intraday_llm_model` - 智能盯盘使用的模型
2. **备选**：`last_deep_thinker` - 分析功能使用的深度思考模型
3. **默认**：`None` - 如果都没有配置，不显示模型标签

### 原因说明

- **智能盯盘优先**：因为排行榜主要展示实时交易表现，智能盯盘的模型更相关
- **分析模型备选**：如果用户没有配置智能盯盘，显示分析模型也有参考价值
- **无配置处理**：不显示标签，避免显示 "null" 或空白标签

## 常见模型名称

### OpenAI
- `gpt-4-turbo`
- `gpt-4`
- `gpt-3.5-turbo`

### Anthropic
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

### Google
- `gemini-pro`
- `gemini-1.5-pro`
- `gemini-1.5-flash`

### 本地模型
- `llama-3-70b`
- `mixtral-8x7b`
- `qwen-72b`

## 用户价值

### 1. 模型对比

用户可以看到：
- 哪些模型的用户表现更好
- 不同模型在不同市场的表现
- 模型选择对收益的影响

### 2. 学习参考

- 新用户可以参考排名靠前的用户使用的模型
- 了解主流模型的选择趋势
- 评估是否需要切换模型

### 3. 透明度

- 增加排行榜的透明度
- 让用户了解竞争对手的配置
- 促进社区交流和学习

## 隐私考虑

### 显示的信息

✅ **显示**：
- 模型名称（如 `gpt-4-turbo`）
- 用户名
- 资产总额
- 最后更新日期

❌ **不显示**：
- API密钥
- 后端URL
- 其他敏感配置

### 用户控制

用户可以通过以下方式控制信息显示：
1. **退出排行榜**：不参与排名，信息不会显示
2. **不配置模型**：如果没有配置模型，不会显示模型标签

## 响应式设计

### 桌面端

```
┌─────────────────────────────────────┐
│ 1  trader123                        │
│    2024-11-17 • gpt-4-turbo         │
│                      $105,000       │
└─────────────────────────────────────┘
```

### 移动端

```
┌───────────────────────────┐
│ 1  trader123              │
│    2024-11-17             │
│    gpt-4-turbo            │
│              $105,000     │
└───────────────────────────┘
```

在小屏幕上，模型标签可能会换行到下一行。

## 性能考虑

### 数据库查询

```python
# 批量查询用户配置，避免N+1问题
config_query = select(UserConfig).where(UserConfig.user_id.in_(user_ids))
```

- 使用 `IN` 查询一次性获取所有用户配置
- 避免为每个用户单独查询
- 使用字典缓存配置数据

### 查询性能

- **用户数量**：通常 < 100
- **查询时间**：< 50ms
- **额外开销**：可忽略

## 测试场景

### 1. 有模型配置

**用户配置**：
- `intraday_llm_model`: `gpt-4-turbo`
- `last_deep_thinker`: `claude-3-opus`

**显示结果**：
```
trader123
2024-11-17 • gpt-4-turbo
```

### 2. 只有分析模型

**用户配置**：
- `intraday_llm_model`: `null`
- `last_deep_thinker`: `claude-3-opus`

**显示结果**：
```
trader123
2024-11-17 • claude-3-opus
```

### 3. 无模型配置

**用户配置**：
- `intraday_llm_model`: `null`
- `last_deep_thinker`: `null`

**显示结果**：
```
trader123
2024-11-17
```
（不显示模型标签）

### 4. 无用户配置记录

**数据库**：UserConfig 表中没有该用户的记录

**显示结果**：
```
trader123
2024-11-17
```
（不显示模型标签）

## 未来改进

### 1. 模型图标

为不同的模型提供商添加图标：

```tsx
{user.model_name && (
  <span className="flex items-center gap-1">
    {getModelIcon(user.model_name)}
    <span>{user.model_name}</span>
  </span>
)}
```

### 2. 模型性能统计

显示使用该模型的用户平均收益：

```tsx
<span className="text-xs text-text-tertiary">
  平均收益: +5.2%
</span>
```

### 3. 模型筛选

允许用户按模型筛选排行榜：

```tsx
<select onChange={(e) => filterByModel(e.target.value)}>
  <option value="">所有模型</option>
  <option value="gpt-4-turbo">GPT-4 Turbo</option>
  <option value="claude-3-opus">Claude 3 Opus</option>
</select>
```

### 4. 模型对比视图

提供模型性能对比图表：
- 不同模型的平均收益
- 不同模型的用户数量
- 不同模型在不同市场的表现

## 相关文件

### 修改的文件
- `web/backend/routes/public_leaderboard_routes.py` - 后端API
- `web/frontend/src/components/leaderboard/LeaderboardTrendChart.tsx` - 前端组件

### 相关文件
- `web/backend/models.py` - UserConfig 模型
- `web/frontend/src/app/leaderboard/page.tsx` - 排行榜页面

## 相关文档

- `docs/LEADERBOARD_UI_IMPROVEMENTS.md` - 排行榜UI改进
- `docs/MARKET_TIME_TIMEZONE_FIX.md` - 市场时间修复
- `docs/CHINESE_MARKET_COLOR_SCHEME.md` - 颜色方案
