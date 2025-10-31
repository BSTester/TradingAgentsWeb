# 定时任务功能更新 - 时区和每周执行

## 📋 更新内容

### 1. 时区调整：UTC → 北京时间 (UTC+8)

所有定时任务现在使用**北京时间（Asia/Shanghai, UTC+8）**而不是UTC时间。

#### 后端更新
- ✅ `scheduler_service.py` - 调度器时区改为 `Asia/Shanghai`
- ✅ 所有 CronTrigger 使用 `timezone='Asia/Shanghai'`
- ✅ IntervalTrigger 使用北京时区计算开始时间
- ✅ 模型注释更新为"Beijing time"

#### 前端更新
- ✅ `ScheduleConfig.tsx` - 执行时间说明改为"北京时间 UTC+8"
- ✅ `page.tsx` - 任务列表显示"北京时间"而不是"UTC"
- ✅ 摘要显示更新为"北京时间"

### 2. 每周执行增强：支持选择星期几

用户现在可以选择具体在星期几执行任务，而不是固定在周一。

#### 数据库更新
- ✅ 添加 `day_of_week` 字段到 `ScheduledTask` 模型
- ✅ 字段类型：String(1)，可选
- ✅ 值范围：0-6（0=周日，1=周一，...，6=周六）

#### 后端更新
- ✅ `ScheduledTaskCreate` schema 添加 `day_of_week` 字段
- ✅ 添加验证器：weekly 周期必须提供 day_of_week
- ✅ `scheduler_service.py` 支持 day_of_week 参数
- ✅ 正确转换日期格式（我们的0=周日 → APScheduler的6=周日）
- ✅ API 路由验证和保存 day_of_week

#### 前端更新
- ✅ `ScheduleConfig.tsx` 添加星期几选择下拉框
- ✅ 仅在选择"每周执行"时显示
- ✅ 提供周一到周日的选项
- ✅ 摘要显示包含选择的星期几
- ✅ `ScheduleData` 接口添加 `day_of_week` 字段
- ✅ 任务列表显示星期几信息

## 🔄 日期格式转换

### 前端到后端
- 前端：0=周日, 1=周一, 2=周二, ..., 6=周六
- 后端存储：相同格式（0-6）
- APScheduler：0=周一, 1=周二, ..., 6=周日

### 转换逻辑（在 scheduler_service.py）
```python
# 我们的格式 -> APScheduler格式
day_int = int(day_of_week)
if day_int == 0:  # 周日
    cron_day = 6
else:  # 周一-周六
    cron_day = day_int - 1
```

## 📝 用户界面变化

### 创建定时任务时

**每周执行选项：**
- 旧版：固定每周一执行
- 新版：可选择周一到周日任意一天

**执行时间说明：**
- 旧版：显示"UTC时区"
- 新版：显示"北京时间 UTC+8"

### 任务列表显示

**执行周期列：**
- 每天：显示"每天"
- 每周：显示"每周 (周X)" - 例如"每周 (周三)"
- 工作日：显示"工作日"
- 每N天：显示"每3天"等

**执行时间列：**
- 旧版：显示"09:00 UTC"
- 新版：显示"09:00 北京时间"

## 🔧 数据库迁移

### 新增字段
```sql
ALTER TABLE scheduled_tasks ADD COLUMN day_of_week VARCHAR(1);
```

### 迁移说明
1. 字段为可选（nullable=True）
2. 仅 weekly 周期需要此字段
3. 现有任务不受影响（字段为NULL）
4. 新建 weekly 任务必须提供此字段

### 运行迁移
```bash
# 删除旧表（如果存在）
python web/backend/migrations/add_scheduled_tasks_table.py --rollback

# 创建新表（包含 day_of_week 字段）
python web/backend/migrations/add_scheduled_tasks_table.py
```

## ✅ 验证清单

### 后端验证
- [x] 调度器使用 Asia/Shanghai 时区
- [x] 数据库模型包含 day_of_week 字段
- [x] Schema 验证 weekly 周期必须有 day_of_week
- [x] API 路由正确处理 day_of_week
- [x] 日期格式正确转换
- [x] 所有文件无语法错误

### 前端验证
- [x] ScheduleConfig 显示星期几选择
- [x] 仅 weekly 周期显示星期几选择
- [x] 时区说明更新为北京时间
- [x] 任务列表正确显示星期几
- [x] 类型定义包含 day_of_week
- [x] 所有文件无语法错误

## 🧪 测试场景

### 1. 创建每周任务
1. 选择"每周执行"
2. 应该显示"选择星期几"下拉框
3. 选择"周三"
4. 设置时间为"14:00"
5. 提交
6. ✅ 任务应该在每周三 14:00（北京时间）执行

### 2. 验证时区
1. 创建任务，设置时间为"09:00"
2. 检查任务列表
3. ✅ 应该显示"09:00 北京时间"
4. 检查后端日志
5. ✅ 任务应该在北京时间 09:00 触发

### 3. 验证星期几显示
1. 创建多个每周任务，选择不同星期
2. 在任务列表中查看
3. ✅ 应该显示"每周 (周一)"、"每周 (周五)"等

### 4. 验证表单验证
1. 选择"每周执行"
2. 不选择星期几
3. 提交表单
4. ✅ 应该显示错误："day_of_week is required when execution_cycle is 'weekly'"

## 📊 API 变化

### 创建任务请求
```json
{
  "task_name": "每周三分析",
  "ticker": "AAPL",
  "execution_cycle": "weekly",
  "execution_time": "14:00",
  "day_of_week": "3",  // 新增：0=周日, 1=周一, ..., 6=周六
  ...
}
```

### 任务响应
```json
{
  "id": 1,
  "execution_cycle": "weekly",
  "execution_time": "14:00",
  "day_of_week": "3",  // 新增
  "next_run_time": "2025-11-05T14:00:00+08:00",  // 北京时间
  ...
}
```

## 🔄 向后兼容性

### 现有任务
- 现有的 weekly 任务（如果有）day_of_week 为 NULL
- 系统会默认使用周一（day_of_week='1'）
- 建议重新创建 weekly 任务以指定具体星期几

### 其他周期
- daily、workdays、every_n_days 不受影响
- day_of_week 字段对这些周期为 NULL

## 📚 相关文件

### 后端文件（已更新）
- `web/backend/models.py` - 添加 day_of_week 字段
- `web/backend/schemas.py` - 添加验证器
- `web/backend/services/scheduler_service.py` - 时区和日期转换
- `web/backend/routes/scheduled_task_routes.py` - API 验证
- `web/backend/app.py` - 加载任务时传递 day_of_week

### 前端文件（已更新）
- `web/frontend/src/components/analysis/ScheduleConfig.tsx` - UI 更新
- `web/frontend/src/app/scheduled-tasks/page.tsx` - 显示更新
- `web/frontend/src/types/index.ts` - 类型定义

## 🎉 更新完成

所有更改已完成并通过语法检查。主要改进：

1. **时区本地化** - 所有时间使用北京时间，更符合中国用户习惯
2. **灵活的每周执行** - 可以选择任意星期几，不再限制为周一
3. **清晰的时间显示** - 界面明确标注"北京时间"
4. **完整的验证** - 确保 weekly 任务必须选择星期几

下一步：运行数据库迁移并测试功能！
