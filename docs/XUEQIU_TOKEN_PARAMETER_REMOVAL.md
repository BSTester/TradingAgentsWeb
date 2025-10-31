# 雪球Token参数移除说明

## 更新日期
2025-11-01

## 更新原因
简化API接口，统一使用环境变量管理雪球Token，避免在代码中传递敏感信息。

## 更新内容

### 1. 函数签名变更

#### akshare_stock.py

**之前**：
```python
def get_stock_realtime_quote(symbol: str, token: str = None) -> str:
```

**之后**：
```python
def get_stock_realtime_quote(symbol: str) -> str:
```

#### akshare_fundamentals.py

**之前**：
```python
def get_fundamentals(ticker: str, curr_date: str = None, token: str = None) -> str:
```

**之后**：
```python
def get_fundamentals(ticker: str, curr_date: str = None) -> str:
```

### 2. Token获取方式

**统一方式**：仅从环境变量 `XUEQIU_TOKEN` 读取

```python
# 在函数内部
token = os.getenv('XUEQIU_TOKEN')
```

### 3. 使用方式变更

#### 之前的用法（已废弃）
```python
# 方式1：传入token参数
quote = get_stock_realtime_quote("600000", token="your_token")

# 方式2：使用环境变量
quote = get_stock_realtime_quote("600000")
```

#### 现在的用法（唯一方式）
```python
# 必须先设置环境变量
# export XUEQIU_TOKEN="your_token_here"

# 调用函数（不需要传token参数）
quote = get_stock_realtime_quote("600000")
fundamentals = get_fundamentals("600000")
```

## 优势

### 1. 安全性提升
- ✅ Token不会出现在代码中
- ✅ 避免意外提交到版本控制
- ✅ 统一的密钥管理方式

### 2. 接口简化
- ✅ 函数签名更简洁
- ✅ 减少参数传递
- ✅ 降低使用复杂度

### 3. 配置统一
- ✅ 与其他API Key（如OPENAI_API_KEY）保持一致
- ✅ 便于Docker和生产环境配置
- ✅ 符合12-Factor App原则

## 迁移指南

### 对于现有代码

如果你的代码中使用了token参数：

**需要修改的代码**：
```python
# 旧代码
token = "your_token"
quote = get_stock_realtime_quote("600000", token=token)
fundamentals = get_fundamentals("600000", token=token)
```

**修改为**：
```python
# 新代码 - 确保环境变量已设置
quote = get_stock_realtime_quote("600000")
fundamentals = get_fundamentals("600000")
```

### 设置环境变量

**开发环境**：
```bash
# Linux/Mac
export XUEQIU_TOKEN="your_token_here"

# Windows CMD
set XUEQIU_TOKEN=your_token_here

# Windows PowerShell
$env:XUEQIU_TOKEN="your_token_here"
```

**生产环境（Docker）**：
```env
# .env 文件
XUEQIU_TOKEN=your_token_here
```

**Python代码中设置（不推荐）**：
```python
import os
os.environ['XUEQIU_TOKEN'] = "your_token_here"
```

## 影响范围

### 修改的文件

1. **核心代码**
   - `tradingagents/dataflows/akshare_stock.py`
   - `tradingagents/dataflows/akshare_fundamentals.py`

2. **测试代码**
   - `tests/test_realtime_quotes.py`

3. **文档**
   - `docs/XUEQIU_TOKEN_SETUP.md`
   - `docs/REALTIME_QUOTES_IMPLEMENTATION.md`

### 不受影响的部分

- 环境变量配置方式保持不变
- Token获取方法保持不变
- 数据返回格式保持不变
- 其他功能不受影响

## 兼容性说明

### 破坏性变更

⚠️ **这是一个破坏性变更**

如果你的代码中使用了token参数，需要进行修改：

```python
# ❌ 这将导致TypeError
quote = get_stock_realtime_quote("600000", token="xxx")
# TypeError: get_stock_realtime_quote() got an unexpected keyword argument 'token'

# ✅ 正确的方式
quote = get_stock_realtime_quote("600000")
```

### 向后兼容

如果你的代码已经使用环境变量方式，无需任何修改：

```python
# ✅ 这种方式继续有效
quote = get_stock_realtime_quote("600000")
```

## 测试验证

### 运行测试
```bash
# 设置环境变量
export XUEQIU_TOKEN="your_token_here"

# 运行测试
python tests/test_realtime_quotes.py
```

### 预期结果
- 符号标准化测试：全部通过
- API集成测试：需要有效的Token

## 文档更新

所有相关文档已更新：

1. ✅ `docs/XUEQIU_TOKEN_SETUP.md` - 移除token参数说明
2. ✅ `docs/REALTIME_QUOTES_IMPLEMENTATION.md` - 更新使用示例
3. ✅ `tests/README.md` - 更新测试说明
4. ✅ 函数docstring - 更新参数说明

## 常见问题

### Q: 为什么要移除token参数？
A: 为了提高安全性和统一配置管理方式，避免敏感信息出现在代码中。

### Q: 如果我需要使用不同的token怎么办？
A: 在运行前修改环境变量即可：
```bash
export XUEQIU_TOKEN="new_token"
python your_script.py
```

### Q: 在测试中如何使用不同的token？
A: 在测试前设置环境变量，或在测试代码中临时设置：
```python
import os
os.environ['XUEQIU_TOKEN'] = "test_token"
```

### Q: 如果没有设置环境变量会怎样？
A: 函数会尝试使用akshare的默认token，但可能会失败。建议始终设置环境变量。

## 总结

本次更新简化了API接口，提高了安全性，统一了配置管理方式。虽然是破坏性变更，但迁移成本很低，只需确保环境变量正确设置即可。

**关键要点**：
- ✅ Token参数已移除
- ✅ 必须使用环境变量 `XUEQIU_TOKEN`
- ✅ 函数调用更简洁
- ✅ 安全性更高
- ⚠️ 需要更新现有代码

## 相关文档

- [Token配置指南](XUEQIU_TOKEN_SETUP.md)
- [实时行情实现文档](REALTIME_QUOTES_IMPLEMENTATION.md)
- [快速开始指南](REALTIME_QUOTES_QUICKSTART.md)
