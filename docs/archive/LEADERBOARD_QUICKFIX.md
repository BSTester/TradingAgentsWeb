# 实时排名功能快速修复指南

## 🚀 快速开始（5分钟）

### 步骤1: 执行数据库迁移 ⭐⭐⭐ 必须
```bash
# 添加 participate_in_leaderboard 字段
python db/migrate_add_leaderboard_flag.py
```

### 步骤2: 验证设置
```bash
# 运行验证脚本
python scripts/verify_leaderboard_setup.py
```

### 步骤3: 初始化测试数据（可选）
```bash
# 为参与排名的用户创建30天样本数据
python scripts/init_leaderboard_sample_data.py
```

### 步骤4: 测试功能
1. 启动后端服务（如果未运行）
   ```bash
   python web/backend/app.py
   ```

2. 启动前端服务（如果未运行）
   ```bash
   cd web/frontend
   npm run dev
   ```

3. 访问页面测试
   - 登录系统
   - 进入"智能盯盘"页面
   - 开启"参加排名"开关
   - 访问"实时排名"页面

---

## 🔧 已知问题及修复

### 问题1: 趋势图显示占位图
**状态**: 待实现
**影响**: 中等
**修复方案**: 

1. 安装图表库
```bash
cd web/frontend
npm install recharts
```

2. 修改 `web/frontend/src/components/leaderboard/LeaderboardChart.tsx`
```typescript
// 替换Canvas实现为Recharts
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// 在组件中使用
<ResponsiveContainer width="100%" height={400}>
  <LineChart data={trendData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
    <XAxis dataKey="date" stroke="#9ca3af" />
    <YAxis stroke="#9ca3af" />
    <Tooltip 
      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
      labelStyle={{ color: '#e5e7eb' }}
    />
    <Legend />
    {users.map((user, index) => (
      <Line 
        key={user.user_id}
        type="monotone" 
        dataKey={`user_${user.user_id}`}
        stroke={colors[index % colors.length]}
        name={user.username}
        strokeWidth={2}
      />
    ))}
  </LineChart>
</ResponsiveContainer>
```

### 问题2: 持仓价格显示为0
**状态**: 待实现
**影响**: 中等
**修复方案**: 

1. 安装依赖
```bash
pip install yfinance
```

2. 参考修复脚本
```bash
python scripts/fix_leaderboard_positions.py
```

3. 按照输出的示例代码修改 `web/backend/routes/public_leaderboard_routes.py`

### 问题3: WebSocket连接失败
**状态**: 已有降级方案
**影响**: 低
**说明**: 
- 系统会自动降级到HTTP轮询模式
- 用户仍可正常使用，只是更新频率降低

---

## 📊 功能测试清单

### 基础功能
- [ ] 数据库字段已添加
- [ ] 用户可以开启/关闭排名参与
- [ ] 排名页面可以访问
- [ ] 用户列表正常显示

### 实时功能
- [ ] WebSocket连接成功
- [ ] 数据每分钟自动更新
- [ ] 降级到HTTP轮询正常工作

### 详情功能
- [ ] 点击用户显示详情
- [ ] 持仓数据正常显示
- [ ] 决策历史正常显示

---

## 🐛 常见问题排查

### Q1: 数据库迁移失败
**错误**: `column participate_in_leaderboard already exists`
**解决**: 字段已存在，无需再次迁移

### Q2: 排名页面显示"暂无参与排名的用户"
**原因**: 没有用户开启排名
**解决**: 
1. 登录系统
2. 进入"智能盯盘"页面
3. 开启"参加排名"开关

### Q3: WebSocket连接失败
**原因**: 后端服务未运行或端口不匹配
**解决**:
1. 确认后端服务运行在 http://localhost:8000
2. 检查防火墙设置
3. 查看浏览器控制台错误信息

### Q4: 趋势图不显示
**原因**: 用户没有历史数据
**解决**:
```bash
python scripts/init_leaderboard_sample_data.py
```

---

## 📈 性能优化建议

### 短期优化
1. 添加Redis缓存
```python
# 缓存排名数据
@cache.cached(timeout=60, key_prefix='leaderboard_users')
async def get_leaderboard_users():
    # ... 查询逻辑
```

2. 优化数据库查询
```python
# 使用索引
# 已在模型中添加: index=True
```

### 长期优化
1. 使用CDN加速静态资源
2. 实现数据预聚合
3. 添加分页加载
4. 实现虚拟滚动

---

## 🔐 安全建议

### 数据隐私
- ✅ 默认不参与排名
- ✅ 用户可随时关闭
- ⚠️ 建议添加数据脱敏选项

### API安全
- ✅ 公开API无需鉴权（设计如此）
- ⚠️ 建议添加访问频率限制
- ⚠️ 建议添加IP白名单

---

## 📞 获取帮助

如果遇到问题：
1. 运行验证脚本: `python scripts/verify_leaderboard_setup.py`
2. 查看后端日志
3. 查看浏览器控制台
4. 检查网络请求

---

## ✅ 完成检查

部署完成后，确认以下功能正常：
- [ ] 数据库迁移成功
- [ ] 用户可以开启排名
- [ ] 排名页面可以访问
- [ ] 用户列表正常显示
- [ ] WebSocket或HTTP轮询正常工作
- [ ] 点击用户显示详情
- [ ] 数据实时更新

全部完成后，功能即可上线使用！🎉
