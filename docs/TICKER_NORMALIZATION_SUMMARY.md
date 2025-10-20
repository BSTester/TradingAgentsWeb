# 股票代码标准化和验证总结

## 概述

本文档总结了前后端对股票代码的标准化和验证处理。

## 标准化处理

### 前端标准化

**位置**: `web/frontend/src/utils/tickerValidator.ts`

```typescript
export function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().trim().replace(/\s/g, '');
}
```

**功能**:
- ✅ 转换为大写
- ✅ 去除首尾空格
- ✅ 去除所有空格

**使用位置**:
- `AnalysisConfigForm.tsx` - 提交分析时标准化 ticker
- `tickerValidator.ts` - 验证前标准化

### 后端标准化

**位置**: `web/backend/utils/market_detector.py`

```python
def normalize_ticker(ticker: str) -> str:
    return ticker.upper().strip().replace(' ', '')
```

**功能**:
- ✅ 转换为大写
- ✅ 去除首尾空格
- ✅ 去除所有空格

**使用位置**:
- `analysis_routes.py` - 接收请求时标准化 ticker
- `market_detector.py` - 验证和市场检测前标准化

## 验证逻辑

### 前端验证

**位置**: `web/frontend/src/utils/tickerValidator.ts`

```typescript
export function validateTicker(ticker: string): boolean {
  const normalized = normalizeTicker(ticker);
  
  // 1. 港股带后缀：.HK
  if (normalized.endsWith('.HK')) {
    const base = normalized.slice(0, -3);
    return /^\d{4,5}$/.test(base);
  }
  
  // 2. A股：6位数字，符合沪深规则
  if (/^\d{6}$/.test(normalized)) {
    const prefix3 = normalized.substring(0, 3);
    return prefix3 === '600' || prefix3 === '601' || ... // 沪深前缀
  }
  
  // 3. A股带后缀：.SH 或 .SZ
  if (normalized.endsWith('.SH') || normalized.endsWith('.SZ')) {
    // 验证前缀匹配后缀
  }
  
  // 4. ✅ 港股纯数字：4-5位
  if (/^\d{4,5}$/.test(normalized)) {
    return true;
  }
  
  // 5. 美股：1-5个字母
  if (/^[A-Z]{1,5}$/.test(normalized)) {
    return true;
  }
  
  return false;
}
```

### 后端验证

**位置**: `web/backend/utils/market_detector.py`

```python
def validate_ticker(ticker: str) -> bool:
    ticker = normalize_ticker(ticker)
    
    # 1. 港股带后缀：.HK
    if ticker.endswith('.HK'):
        base = ticker[:-3]
        return base.isdigit() and 4 <= len(base) <= 5
    
    # 2. A股：6位数字，符合沪深规则
    if ticker.isdigit() and len(ticker) == 6:
        prefix3 = ticker[:3]
        return prefix3 in ('600', '601', '603', '605', '688', 
                          '000', '001', '002', '300', '301')
    
    # 3. A股带后缀：.SH 或 .SZ
    if ticker.endswith(('.SH', '.SZ')):
        # 验证前缀匹配后缀
    
    # 4. ✅ 港股纯数字：4-5位
    if ticker.isdigit() and 4 <= len(ticker) <= 5:
        return True
    
    # 5. 美股：1-5个字母
    if ticker.isalpha() and 1 <= len(ticker) <= 5:
        return True
    
    return False
```

## 数据流

### 用户输入 → 数据库

```
用户输入: "aapl"
    ↓
前端标准化: "AAPL"
    ↓
前端验证: ✅ 通过
    ↓
提交到后端: "AAPL"
    ↓
后端标准化: "AAPL"
    ↓
后端验证: ✅ 通过
    ↓
存入数据库: "AAPL"
```

### 港股示例

```
用户输入: "00700"
    ↓
前端标准化: "00700"
    ↓
前端验证: ✅ 通过（4-5位数字）
    ↓
提交到后端: "00700"
    ↓
后端标准化: "00700"
    ↓
后端验证: ✅ 通过（4-5位数字）
    ↓
市场检测: "HK"
    ↓
存入数据库: ticker="00700", market="HK"
```

## 支持的格式

### 美股
| 输入 | 标准化后 | 验证 | 市场 |
|------|---------|------|------|
| `aapl` | `AAPL` | ✅ | US |
| `TSLA` | `TSLA` | ✅ | US |
| `f` | `F` | ✅ | US |

### 港股
| 输入 | 标准化后 | 验证 | 市场 |
|------|---------|------|------|
| `0700` | `0700` | ✅ | HK |
| `00700` | `00700` | ✅ | HK |
| `0700.hk` | `0700.HK` | ✅ | HK |
| `00700.HK` | `00700.HK` | ✅ | HK |

### A股
| 输入 | 标准化后 | 验证 | 市场 |
|------|---------|------|------|
| `600519` | `600519` | ✅ | CN |
| `600519.sh` | `600519.SH` | ✅ | CN |
| `000001` | `000001` | ✅ | CN |
| `000001.sz` | `000001.SZ` | ✅ | CN |

## 关键修复

### 修复 1: 港股纯数字验证

**问题**: `00700` 无法通过验证

**原因**: 验证逻辑缺少对 4-5 位纯数字的检查

**修复**: 在前后端都添加了港股纯数字检查

```typescript
// 前端
if (/^\d{4,5}$/.test(normalized)) {
  return true;
}
```

```python
# 后端
if ticker.isdigit() and 4 <= len(ticker) <= 5:
    return True
```

### 修复 2: 大写转换

**确认**: 前后端都在标准化时转换为大写

**前端**: `ticker.toUpperCase()`
**后端**: `ticker.upper()`

## 测试用例

### 标准化测试

```typescript
// 前端
normalizeTicker("aapl")      // "AAPL"
normalizeTicker(" tsla ")    // "TSLA"
normalizeTicker("0 0 7 0 0") // "00700"
normalizeTicker("600519.sh") // "600519.SH"
```

```python
# 后端
normalize_ticker("aapl")      # "AAPL"
normalize_ticker(" tsla ")    # "TSLA"
normalize_ticker("0 0 7 0 0") # "00700"
normalize_ticker("600519.sh") # "600519.SH"
```

### 验证测试

```typescript
// 前端
validateTicker("AAPL")      // true
validateTicker("00700")     // true
validateTicker("0700.HK")   // true
validateTicker("600519")    // true
validateTicker("123456")    // false (不符合A股规则)
```

```python
# 后端
validate_ticker("AAPL")      # True
validate_ticker("00700")     # True
validate_ticker("0700.HK")   # True
validate_ticker("600519")    # True
validate_ticker("123456")    # False (不符合A股规则)
```

## 相关文件

### 前端
- `web/frontend/src/utils/tickerValidator.ts` - 标准化和验证工具
- `web/frontend/src/components/analysis/AnalysisConfigForm.tsx` - 使用标准化

### 后端
- `web/backend/utils/market_detector.py` - 标准化、验证和市场检测
- `web/backend/routes/analysis_routes.py` - 使用标准化和验证

### 文档
- `docs/股票代码编码规则详解.md` - 编码规则详解
- `docs/TICKER_VALIDATION_FIX.md` - 港股验证修复说明

## 总结

✅ **前后端一致性**
- 标准化逻辑完全一致
- 验证逻辑完全一致
- 市场检测逻辑完全一致

✅ **大写转换**
- 前端提交时自动转换为大写
- 后端接收时再次标准化（防御性编程）
- 数据库中存储的都是大写格式

✅ **港股支持**
- 支持 4 位数字（旧格式）
- 支持 5 位数字（新格式）
- 支持带 .HK 后缀
- 支持不带后缀

✅ **验证完整**
- 美股：1-5 个字母
- 港股：4-5 位数字或带 .HK
- A股：6 位数字符合沪深规则，可选后缀

## 注意事项

1. **双重验证**
   - 前端验证提供即时反馈
   - 后端验证确保数据安全

2. **标准化时机**
   - 前端：验证前、提交前
   - 后端：接收后立即标准化

3. **大小写处理**
   - 用户可以输入小写
   - 系统自动转换为大写
   - 数据库统一存储大写

4. **空格处理**
   - 自动去除所有空格
   - 用户输入更灵活
