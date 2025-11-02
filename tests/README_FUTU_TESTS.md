# Futu Trading API Tests

本目录包含 Futu 交易 API 集成的测试脚本。

## 测试脚本

### 1. 快速测试 (quick_test_futu_tools.py)

**用途**: 快速验证所有工具是否正确实现，不需要 API 服务运行。

**测试内容**:
- ✅ 导入所有 DataFlow 函数
- ✅ 导入所有 Tool 包装器
- ✅ 检查配置
- ✅ 验证工具属性（LangChain 兼容性）
- ✅ API 覆盖率检查
- ✅ 函数签名验证

**运行方式**:
```bash
# 从项目根目录运行
python tests/quick_test_futu_tools.py
```

**预期输出**:
```
======================================================================
Futu Trading Tools - Quick Test
======================================================================

Test 1: Importing DataFlow Functions...
✓ All DataFlow functions imported successfully

Test 2: Importing Tool Wrappers...
✓ All tool wrappers imported successfully

Test 3: Checking Configuration...
✓ Base URL: http://localhost:8000
✓ Timeout: 30s

Test 4: Verifying Tool Attributes...
✓ get_futu_account_info: Valid LangChain tool
✓ get_futu_positions: Valid LangChain tool
...

Test 5: API Coverage Check...
Total API endpoints: 9
Total tools implemented: 9
✓ All API endpoints have corresponding tools

Test 6: Function Signature Check...
✓ get_futu_account_info: All required parameters present
✓ get_futu_positions: All required parameters present
...

======================================================================
Summary
======================================================================
✓ All imports successful
✓ Configuration valid
✓ All tools are valid LangChain tools
✓ All 9 API endpoints covered
✓ All function signatures correct

✓ All tests passed! Tools are ready to use.
```

---

### 2. 完整集成测试 (test_futu_api_integration.py)

**用途**: 完整测试所有 API 端点的实际调用，需要 API 服务运行。

**测试内容**:
- ✅ 配置检查
- ✅ 获取账户信息
- ✅ 获取持仓列表
- ✅ 获取股票行情
- ✅ 获取 K 线数据
- ✅ 获取热门股票
- ✅ 获取热门新闻
- ✅ 查询订单
- ✅ 下单（需要确认）
- ✅ 撤单（需要确认）
- ✅ 错误处理

**前置条件**:
1. Futu API 服务正在运行
2. 配置 `.env` 文件:
   ```bash
   FUTU_API_BASE_URL=http://localhost:8000
   FUTU_API_TIMEOUT=30
   ```

**运行方式**:
```bash
# 从项目根目录运行
python tests/test_futu_api_integration.py
```

**预期输出**:
```
======================================================================
                  Futu Trading API Integration Test
======================================================================

ℹ API Base URL: http://localhost:8000
ℹ API Timeout: 30s

======================================================================
                        Test 1: Configuration
======================================================================

Testing: Configuration Check
ℹ Base URL: http://localhost:8000
ℹ Timeout: 30s
ℹ Test Market: US
ℹ Test Stock: AAPL
✓ Test passed: Configuration Check

======================================================================
                    Test 2-7: Read-Only API Tests
======================================================================

Testing: Get Account Info
{
  "net_asset_value": 100000.0,
  "cash": 50000.0,
  "position_value": 50000.0,
  ...
}
✓ Test passed: Get Account Info

Testing: Get Positions
[
  {
    "stock_code": "AAPL",
    "quantity": 100,
    ...
  }
]
ℹ Total positions: 1
✓ Test passed: Get Positions

...

======================================================================
                Test 8-9: Write API Tests (Require Confirmation)
======================================================================

Testing: Place Order
⚠ This test will place a real order in the mock account!
ℹ Order: BUY 1 AAPL @ $180.0
Continue with order placement? (y/N): y
{
  "success": true,
  "order_id": "123456789",
  ...
}
ℹ Order placed successfully: 123456789
✓ Test passed: Place Order

Testing: Cancel Order
ℹ Cancelling order: 123456789
{
  "success": true,
  ...
}
ℹ Order cancelled successfully
✓ Test passed: Cancel Order

======================================================================
                        Test 10: Error Handling
======================================================================

Testing: Error Handling
ℹ Testing error handling with invalid inputs...
✓ Correctly raised ValueError: Invalid market_type: INVALID. Must be US, HK, or CN
...
✓ Test passed: Error Handling

======================================================================
                            Test Summary
======================================================================

Total Tests:   11
Passed:        11
Failed:        0
Skipped:       0

Pass Rate:     100.0%

✓ All tests passed!
```

---

## API 端点覆盖情况

| API 端点 | DataFlow 函数 | Tool 包装器 | 状态 |
|---------|--------------|------------|------|
| `/api/account` | `get_account_info` | `get_futu_account_info` | ✅ |
| `/api/positions` | `get_positions` | `get_futu_positions` | ✅ |
| `/api/quote` | `get_quote` | `get_futu_quote` | ✅ |
| `/api/kline` | `get_kline_data` | `get_futu_kline` | ✅ |
| `/api/hot-stocks` | `get_hot_stocks` | `get_futu_hot_stocks` | ✅ |
| `/api/trade` | `place_order` | `place_futu_order` | ✅ |
| `/api/cancel` | `cancel_order` | `cancel_futu_order` | ✅ |
| `/api/orders` | `get_orders` | `get_futu_orders` | ✅ |
| `/api/hot-news` | `get_hot_news` | `get_futu_hot_news` | ✅ |

**总计**: 9/9 端点已实现 (100%)

---

## 测试配置

### 环境变量

在 `.env` 文件中配置：

```bash
# Futu API 配置
FUTU_API_BASE_URL=http://localhost:8000
FUTU_API_TIMEOUT=30
```

### 测试参数

在 `test_futu_api_integration.py` 中可以修改测试参数：

```python
TEST_CONFIG = {
    "market_type": "US",      # 测试市场
    "test_stock": "AAPL",     # 测试股票
    "test_quantity": 1,       # 测试数量
    "test_price": 180.0,      # 测试价格
}
```

---

## 故障排查

### 问题 1: 导入错误

```
ModuleNotFoundError: No module named 'tradingagents'
```

**解决方案**: 从项目根目录运行测试
```bash
cd /path/to/TradingAgentsWeb
python tests/quick_test_futu_tools.py
```

### 问题 2: 连接错误

```
Error: Failed to connect to Futu API
```

**解决方案**:
1. 检查 Futu API 服务是否运行
   ```bash
   curl http://localhost:8000/health
   ```
2. 检查 `FUTU_API_BASE_URL` 配置
3. 检查防火墙设置

### 问题 3: 认证错误

```
Error: Authentication failed - Cookie may have expired
```

**解决方案**:
1. 重新获取 Cookie
2. 联系 API 服务管理员

### 问题 4: 测试失败

**解决方案**:
1. 查看详细错误信息
2. 检查 API 服务日志
3. 验证测试参数是否正确

---

## 测试最佳实践

### 1. 开发阶段

- 先运行快速测试验证工具实现
- 使用小数量进行交易测试
- 及时撤销测试订单

### 2. 集成测试

- 确保 API 服务稳定运行
- 使用模拟账户测试
- 记录测试结果

### 3. 持续集成

- 将快速测试加入 CI 流程
- 定期运行完整集成测试
- 监控测试通过率

---

## 扩展测试

### 添加新测试

1. 在 `test_futu_api_integration.py` 中添加测试函数：
   ```python
   def test_new_feature():
       """Test new feature"""
       result = new_function()
       print_result(result)
       return result
   ```

2. 在 `main()` 中调用：
   ```python
   run_test(test_new_feature, "New Feature Test")
   ```

### 性能测试

可以添加性能测试来测量 API 响应时间：

```python
import time

def test_performance():
    """Test API performance"""
    start = time.time()
    get_quote("AAPL", "US")
    elapsed = time.time() - start
    print(f"Response time: {elapsed:.3f}s")
```

---

## 相关文档

- [Futu Trading Setup](../docs/FUTU_TRADING_SETUP.md) - API 配置指南
- [Futu Integration Summary](../docs/FUTU_INTEGRATION_SUMMARY.md) - 集成总结
- [DataFlow Module README](../tradingagents/dataflows/README_FUTU.md) - 模块文档

---

## 总结

测试脚本提供了：

✅ **快速验证** - 无需 API 服务即可验证工具实现  
✅ **完整测试** - 覆盖所有 API 端点  
✅ **错误处理** - 测试各种错误场景  
✅ **用户友好** - 彩色输出和详细反馈  
✅ **安全确认** - 写操作需要用户确认  

使用这些测试脚本可以确保 Futu 交易 API 集成的质量和可靠性！
