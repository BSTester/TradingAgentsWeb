# 时区处理规范

## 概述

TradingAgentsWeb 系统统一使用**北京时间(Asia/Shanghai, UTC+8)**作为标准时区。所有时间相关的操作都应该使用北京时间,确保时间的一致性和准确性。

## 时区标准

- **标准时区**: Asia/Shanghai (北京时间, UTC+8)
- **数据库时间**: 所有 DateTime 字段都使用 `timezone=True` 存储时区感知的时间戳
- **API 响应**: 所有时间字段都包含时区信息(ISO 8601 格式)
- **前端显示**: 前端接收到的时间已经是北京时间,可以直接显示

## 代码规范

### 1. 获取当前时间

**正确做法**:
```python
from datetime import datetime
from pytz import timezone as pytz_timezone

beijing_tz = pytz_timezone('Asia/Shanghai')
now_beijing = datetime.now(beijing_tz)
```

**错误做法**:
```python
# ❌ 不要使用无时区的 datetime.now()
now = datetime.now()

# ❌ 不要使用 UTC 时间
now_utc = datetime.now(timezone.utc)

# ❌ 不要使用 datetime.utcnow()
now_utc = datetime.utcnow()
```

### 2. 时间比较

在比较时间时,确保两个时间都是时区感知的:

```python
from pytz import timezone as pytz_timezone

beijing_tz = pytz_timezone('Asia/Shanghai')

# 如果时间是 naive (无时区),先转换为时区感知
if datetime_obj.tzinfo is None:
    datetime_aware = beijing_tz.localize(datetime_obj)
else:
    datetime_aware = datetime_obj.astimezone(beijing_tz)

# 现在可以安全比较
if datetime_aware > another_datetime_aware:
    # ...
```

### 3. 数据库模型

所有时间字段都应该使用 `DateTime(timezone=True)`:

```python
from sqlalchemy import Column, DateTime

class MyModel(Base):
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
```

### 4. 格式化时间字符串

```python
# 生成 ISO 8601 格式(包含时区信息)
timestamp_str = now_beijing.isoformat()

# 生成自定义格式
date_str = now_beijing.strftime('%Y-%m-%d')
datetime_str = now_beijing.strftime('%Y-%m-%d %H:%M:%S')
```

## 已修复的文件

以下文件已经更新为使用北京时间:

### 后端核心文件

1. **web/backend/services/task_executor.py**
   - 定时任务执行时使用北京时间
   - 创建 analysis_id 时使用北京时间
   - 更新 last_run_time 时使用北京时间

2. **web/backend/services/scheduler_service.py**
   - 调度器配置使用 Asia/Shanghai 时区
   - 计算下次执行时间时使用北京时间

3. **web/backend/routes/scheduled_task_routes.py**
   - 创建任务时验证结束日期使用北京时间
   - 更新任务时使用北京时间

4. **web/backend/routes/analysis_routes.py**
   - 生成 analysis_id 时使用北京时间
   - WebSocket 消息时间戳使用北京时间

5. **web/backend/app.py**
   - TaskManager 监控时间使用北京时间
   - 启动加载任务时检查使用北京时间

6. **web/backend/health.py**
   - 健康检查接口返回北京时间

7. **web/backend/analysis_task.py**
   - 分析任务完成时间使用北京时间
   - 默认分析日期使用北京时间

### 数据库模型

**web/backend/models.py**
- 所有时间字段都使用 `DateTime(timezone=True)`
- 包括: created_at, updated_at, started_at, completed_at, next_run_time, last_run_time, end_date 等

## 前端处理

前端接收到的时间已经是北京时间(带时区信息),可以直接使用:

```typescript
// 接收到的时间格式: "2025-11-01T21:10:00+08:00"
const date = new Date(task.next_run_time);

// 显示本地化时间
const localTime = date.toLocaleString('zh-CN');

// 使用 date-fns 格式化
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const relativeTime = formatDistanceToNow(date, {
  addSuffix: true,
  locale: zhCN
});
```

## 测试建议

### 1. 时区一致性测试

```python
# 测试创建任务时的时间
task = create_scheduled_task(...)
assert task.created_at.tzinfo is not None
assert task.created_at.tzinfo.zone == 'Asia/Shanghai'
```

### 2. 时间比较测试

```python
# 测试结束日期检查
end_date = datetime(2025, 12, 31, 23, 59, 59)
end_date_aware = beijing_tz.localize(end_date)
now_beijing = datetime.now(beijing_tz)

assert now_beijing < end_date_aware  # 应该可以正常比较
```

### 3. 跨时区测试

在不同时区的服务器上运行,确保时间仍然正确:
- 服务器时区设置为 UTC
- 服务器时区设置为其他时区
- 验证所有时间操作仍然使用北京时间

## 常见问题

### Q: 为什么不使用 UTC 时间?

A: 虽然 UTC 是国际标准,但考虑到:
1. 目标用户主要在中国
2. 股票市场交易时间基于北京时间
3. 用户更容易理解北京时间
4. 避免前端需要频繁转换时区

因此统一使用北京时间更符合业务需求。

### Q: 数据库时区如何配置?

A: 
- SQLite: 自动处理时区信息
- MySQL: 建议设置 `time_zone = '+08:00'`
- PostgreSQL: 建议设置 `timezone = 'Asia/Shanghai'`

### Q: 如何处理夏令时?

A: 中国不使用夏令时,Asia/Shanghai 时区全年固定为 UTC+8,无需特殊处理。

### Q: 前端用户在其他时区怎么办?

A: 前端可以根据用户浏览器时区自动转换显示,但后端统一使用北京时间存储和处理。

## 检查清单

在添加新功能时,确保:

- [ ] 所有 `datetime.now()` 都指定了 `beijing_tz` 参数
- [ ] 所有时间比较前都检查了时区感知
- [ ] 数据库模型的时间字段使用 `DateTime(timezone=True)`
- [ ] API 响应的时间字段包含时区信息
- [ ] 文档中说明了时间使用北京时间

## 相关文件

- `web/backend/services/task_executor.py` - 定时任务执行
- `web/backend/services/scheduler_service.py` - 任务调度
- `web/backend/routes/scheduled_task_routes.py` - 定时任务 API
- `web/backend/routes/analysis_routes.py` - 分析 API
- `web/backend/app.py` - 应用主文件
- `web/backend/models.py` - 数据库模型
- `web/backend/health.py` - 健康检查
- `web/backend/analysis_task.py` - 分析任务执行

## 更新日期

最后更新: 2025-10-31
