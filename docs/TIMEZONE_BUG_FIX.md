# 时区Bug修复 - Offset-Naive vs Offset-Aware

## 🐛 问题描述

执行定时任务时出现错误：
```
TypeError: can't compare offset-naive and offset-aware datetimes
```

### 错误原因

在 `task_executor.py` 中比较时间时，一个datetime对象带时区信息（offset-aware），另一个不带（offset-naive），导致无法比较。

### 出错位置

1. **第40行** - 检查任务是否到达结束日期
   ```python
   if task.end_date and datetime.now(timezone.utc) > task.end_date:
   ```

2. **第137行** - 检查下次运行时间是否超过结束日期
   ```python
   if task.end_date and next_run > task.end_date:
   ```

## ✅ 修复方案

### 统一使用北京时间（Asia/Shanghai）

所有时间比较都使用带时区的datetime对象，并统一使用北京时间。

### 修复内容

#### 1. 检查结束日期（第40行附近）

**修复前：**
```python
if task.end_date and datetime.now(timezone.utc) > task.end_date:
```

**修复后：**
```python
if task.end_date:
    from pytz import timezone as pytz_timezone
    beijing_tz = pytz_timezone('Asia/Shanghai')
    now_beijing = datetime.now(beijing_tz)
    
    # Ensure end_date is timezone-aware
    if task.end_date.tzinfo is None:
        end_date_aware = beijing_tz.localize(task.end_date)
    else:
        end_date_aware = task.end_date.astimezone(beijing_tz)
    
    if now_beijing > end_date_aware:
        # Mark as completed
```

#### 2. 更新任务统计（第126行附近）

**修复前：**
```python
task.last_run_time = datetime.now(timezone.utc)
```

**修复后：**
```python
from pytz import timezone as pytz_timezone
beijing_tz = pytz_timezone('Asia/Shanghai')
task.last_run_time = datetime.now(beijing_tz)
```

#### 3. 检查下次运行时间（第137行附近）

**修复前：**
```python
if task.end_date and next_run > task.end_date:
```

**修复后：**
```python
if task.end_date:
    # Ensure both datetimes are timezone-aware
    if task.end_date.tzinfo is None:
        end_date_aware = beijing_tz.localize(task.end_date)
    else:
        end_date_aware = task.end_date.astimezone(beijing_tz)
    
    if next_run.tzinfo is None:
        next_run_aware = beijing_tz.localize(next_run)
    else:
        next_run_aware = next_run.astimezone(beijing_tz)
    
    if next_run_aware > end_date_aware:
        # Mark as completed
```

## 🔧 技术细节

### Timezone-Aware vs Timezone-Naive

**Timezone-Naive（不带时区）：**
```python
datetime.now()  # 没有时区信息
datetime(2025, 11, 1, 14, 0, 0)  # 没有时区信息
```

**Timezone-Aware（带时区）：**
```python
datetime.now(timezone.utc)  # UTC时区
datetime.now(pytz.timezone('Asia/Shanghai'))  # 北京时区
```

### 为什么不能直接比较？

Python不允许直接比较带时区和不带时区的datetime对象，因为：
- Naive datetime 不知道自己在哪个时区
- 比较结果会产生歧义

### 解决方法

1. **统一使用带时区的datetime**
2. **检查并转换naive datetime为aware datetime**
3. **统一时区后再比较**

## 📝 修复后的行为

### 时间比较逻辑

1. **获取当前时间** - 使用北京时间
   ```python
   now_beijing = datetime.now(pytz.timezone('Asia/Shanghai'))
   ```

2. **确保end_date带时区**
   - 如果是naive：假设为北京时间并添加时区信息
   - 如果是aware：转换为北京时间

3. **确保next_run带时区**
   - APScheduler返回的时间应该已经带时区
   - 如果没有，添加北京时区

4. **比较时间**
   - 所有时间都是带时区的
   - 都转换为北京时间
   - 安全比较

## ✅ 验证

### 测试场景

1. **创建带结束日期的任务**
   ```python
   end_date = "2025-12-31"
   ```

2. **任务执行时检查**
   - ✅ 不再抛出TypeError
   - ✅ 正确比较当前时间和结束日期
   - ✅ 到期后正确标记为completed

3. **检查下次运行时间**
   - ✅ 正确比较next_run和end_date
   - ✅ 超过结束日期时正确停止任务

### 日志输出

**成功执行：**
```
✅ Executing scheduled task 2: 测试任务 (ticker: AAPL)
✅ Scheduled task 2 execution initiated successfully
```

**到达结束日期：**
```
⏰ Scheduled task 2 has reached end date, marking as completed
```

**下次运行超过结束日期：**
```
⏰ Next run time is after end date, marking task 2 as completed
```

## 🔄 相关依赖

### pytz库

修复使用了 `pytz` 库来处理时区：
```python
from pytz import timezone as pytz_timezone
beijing_tz = pytz_timezone('Asia/Shanghai')
```

### 确认已安装

pytz通常随Python标准库一起安装，但如果缺失：
```bash
pip install pytz
```

## 📊 影响范围

### 修改的文件
- ✅ `web/backend/services/task_executor.py`

### 影响的功能
- ✅ 定时任务执行
- ✅ 结束日期检查
- ✅ 任务统计更新
- ✅ 下次运行时间计算

### 不影响的功能
- ✅ 任务创建
- ✅ 任务列表显示
- ✅ 任务启用/禁用
- ✅ 任务删除

## 🎯 最佳实践

### 时区处理建议

1. **始终使用timezone-aware datetime**
   ```python
   # 好的做法
   now = datetime.now(pytz.timezone('Asia/Shanghai'))
   
   # 避免
   now = datetime.now()  # naive datetime
   ```

2. **数据库存储**
   - 使用 `DateTime(timezone=True)` 列类型
   - 确保存储的是UTC或带时区的时间

3. **时间比较前检查**
   ```python
   if dt.tzinfo is None:
       dt = tz.localize(dt)
   ```

4. **统一时区**
   - 内部使用UTC或统一时区
   - 显示时转换为用户时区

## 🎉 修复完成

- ✅ 所有时间比较使用timezone-aware datetime
- ✅ 统一使用北京时间
- ✅ 正确处理naive和aware datetime
- ✅ 通过语法检查
- ✅ 错误已修复

定时任务现在可以正常执行，不会再出现时区比较错误！
