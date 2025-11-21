# 市场时间时区修复

## 问题描述

原有的市场开闭市判断使用的是用户本地时间，没有考虑各市场的实际时区，导致：
- 美股市场状态判断不准确（应该使用美东时间）
- 港股市场状态判断不准确（应该使用香港时间）
- A股市场状态判断不准确（应该使用北京时间）

## 解决方案

创建了专门的市场时间工具函数，使用 `Intl.DateTimeFormat` API 正确处理各市场的时区。

## 实现细节

### 1. 市场时区定义

**文件**：`web/frontend/src/utils/marketTime.ts`

```typescript
// 市场时区映射
US: 'America/New_York'  // 美东时间（EST/EDT，自动处理夏令时）
HK: 'Asia/Hong_Kong'    // 香港时间（HKT，UTC+8）
CN: 'Asia/Shanghai'     // 北京时间（CST，UTC+8）
```

### 2. 交易时间定义

#### 美股（US）
- **时区**：美东时间（EST/EDT）
- **交易日**：周一至周五
- **交易时间**：9:30-16:00
- **夏令时**：自动处理（3月第二个周日至11月第一个周日）

#### 港股（HK）
- **时区**：香港时间（HKT，UTC+8）
- **交易日**：周一至周五
- **交易时间**：
  - 早市：9:30-12:00
  - 午市：13:00-16:00
- **午间休市**：12:00-13:00

#### A股（CN）
- **时区**：北京时间（CST，UTC+8）
- **交易日**：周一至周五
- **交易时间**：
  - 早市：9:30-11:30
  - 午市：13:00-15:00
- **午间休市**：11:30-13:00

### 3. 核心函数

#### `getTimeInTimezone(timezone: string): Date`

获取指定时区的当前时间。

```typescript
// 使用 Intl.DateTimeFormat API
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
```

**优点**：
- 自动处理夏令时
- 浏览器原生支持
- 无需第三方库
- 准确可靠

#### `checkMarketStatus(market: string): MarketStatus`

检查指定市场的开闭市状态。

```typescript
interface MarketStatus {
  isOpen: boolean;      // 是否开市
  message: string;      // 状态描述
  localTime?: string;   // 市场当地时间
}
```

**返回示例**：

```typescript
// 开市中
{
  isOpen: true,
  message: "美股市场开市中（美东时间 10:30）",
  localTime: "10:30"
}

// 未开市
{
  isOpen: false,
  message: "美股市场未开市（开市时间：9:30 美东时间，当前：08:45）",
  localTime: "08:45"
}

// 午间休市
{
  isOpen: false,
  message: "港股市场午间休市（午市时间：13:00-16:00，当前：12:30）",
  localTime: "12:30"
}

// 周末休市
{
  isOpen: false,
  message: "A股市场周末休市（当前北京时间：10:30）",
  localTime: "10:30"
}
```

### 4. 状态消息

#### 美股消息格式
- 开市中：`美股市场开市中（美东时间 HH:MM）`
- 未开市：`美股市场未开市（开市时间：9:30 美东时间，当前：HH:MM）`
- 已收市：`美股市场已收市（收市时间：16:00 美东时间，当前：HH:MM）`
- 周末休市：`美股市场周末休市（当前美东时间：HH:MM）`

#### 港股消息格式
- 开市中：`港股市场开市中（香港时间 HH:MM）`
- 未开市：`港股市场未开市（开市时间：9:30 香港时间，当前：HH:MM）`
- 午间休市：`港股市场午间休市（午市时间：13:00-16:00，当前：HH:MM）`
- 已收市：`港股市场已收市（收市时间：16:00 香港时间，当前：HH:MM）`
- 周末休市：`港股市场周末休市（当前香港时间：HH:MM）`

#### A股消息格式
- 开市中：`A股市场开市中（北京时间 HH:MM）`
- 未开市：`A股市场未开市（开市时间：9:30 北京时间，当前：HH:MM）`
- 午间休市：`A股市场午间休市（午市时间：13:00-15:00，当前：HH:MM）`
- 已收市：`A股市场已收市（收市时间：15:00 北京时间，当前：HH:MM）`
- 周末休市：`A股市场周末休市（当前北京时间：HH:MM）`

## 使用方法

### 在React组件中使用

```typescript
import { checkMarketStatus } from '@/utils/marketTime';

function MyComponent() {
  const [marketStatus, setMarketStatus] = useState({ isOpen: false, message: '' });
  const [selectedMarket, setSelectedMarket] = useState('US');

  useEffect(() => {
    const updateMarketStatus = () => {
      const status = checkMarketStatus(selectedMarket);
      setMarketStatus({ isOpen: status.isOpen, message: status.message });
    };

    updateMarketStatus();
    const interval = setInterval(updateMarketStatus, 60000); // 每分钟更新
    return () => clearInterval(interval);
  }, [selectedMarket]);

  return (
    <div>
      {!marketStatus.isOpen && (
        <div className="alert">
          {marketStatus.message}
        </div>
      )}
    </div>
  );
}
```

### 获取市场当地时间

```typescript
import { getMarketLocalTime } from '@/utils/marketTime';

const usTime = getMarketLocalTime('US');  // "2024-11-17 10:30:45"
const hkTime = getMarketLocalTime('HK');  // "2024-11-17 23:30:45"
const cnTime = getMarketLocalTime('CN');  // "2024-11-17 23:30:45"
```

## 修改的文件

### 新增文件
- `web/frontend/src/utils/marketTime.ts` - 市场时间工具函数

### 修改文件
- `web/frontend/src/app/leaderboard/page.tsx` - 使用新的市场时间工具

## 时区处理说明

### 美东时间（EST/EDT）

美国东部时间有夏令时：
- **标准时间（EST）**：UTC-5（11月第一个周日至3月第二个周日）
- **夏令时（EDT）**：UTC-4（3月第二个周日至11月第一个周日）

使用 `America/New_York` 时区标识符，浏览器会自动处理夏令时转换。

### 香港时间（HKT）

香港时间全年固定：
- **时区**：UTC+8
- **无夏令时**

### 北京时间（CST）

中国标准时间全年固定：
- **时区**：UTC+8
- **无夏令时**

## 测试场景

### 1. 不同时区测试

假设当前UTC时间为 2024-11-17 14:30:00

| 市场 | 当地时间 | 状态 | 说明 |
|------|---------|------|------|
| US | 09:30 | 开市 | 刚开市 |
| HK | 22:30 | 休市 | 已收市 |
| CN | 22:30 | 休市 | 已收市 |

### 2. 午间休市测试

| 市场 | 当地时间 | 状态 | 说明 |
|------|---------|------|------|
| HK | 12:15 | 休市 | 午间休市 |
| CN | 12:00 | 休市 | 午间休市 |

### 3. 周末测试

| 市场 | 当地时间 | 状态 | 说明 |
|------|---------|------|------|
| US | 周六 10:00 | 休市 | 周末休市 |
| HK | 周日 14:00 | 休市 | 周末休市 |
| CN | 周六 11:00 | 休市 | 周末休市 |

### 4. 夏令时测试

测试美股在夏令时和标准时间的切换：

**夏令时期间**（3月-11月）：
- UTC 13:30 → EDT 09:30（开市）
- UTC 20:00 → EDT 16:00（收市）

**标准时间期间**（11月-3月）：
- UTC 14:30 → EST 09:30（开市）
- UTC 21:00 → EST 16:00（收市）

## 浏览器兼容性

### Intl.DateTimeFormat API

支持的浏览器：
- ✅ Chrome 24+
- ✅ Firefox 29+
- ✅ Safari 10+
- ✅ Edge 12+
- ✅ iOS Safari 10+
- ✅ Android Browser 4.4+

**覆盖率**：>98% 的现代浏览器

### 降级方案

如果需要支持更老的浏览器，可以使用第三方库：
- `date-fns-tz` - 轻量级时区库
- `moment-timezone` - 功能完整但体积较大
- `luxon` - 现代化的日期时间库

## 注意事项

### 1. 节假日

当前实现**不考虑节假日**，只判断周一至周五。

需要考虑的节假日：
- **美股**：感恩节、圣诞节、独立日等
- **港股**：春节、国庆节、圣诞节等
- **A股**：春节、国庆节、劳动节等

**未来改进**：可以添加节假日数据库或调用节假日API。

### 2. 盘前盘后交易

美股有盘前盘后交易时段：
- **盘前**：4:00-9:30 EDT
- **盘后**：16:00-20:00 EDT

当前实现只考虑正常交易时段。

### 3. 集合竞价

A股和港股有集合竞价时段：
- **A股集合竞价**：9:15-9:25
- **港股集合竞价**：9:00-9:30

当前实现将集合竞价视为未开市。

### 4. 临时休市

市场可能因特殊情况临时休市（如台风、技术故障等），当前实现无法检测。

## 性能考虑

### 1. 缓存策略

市场状态每分钟更新一次，避免频繁计算：

```typescript
const interval = setInterval(updateMarketStatus, 60000); // 60秒
```

### 2. 计算成本

`Intl.DateTimeFormat` 的性能：
- 首次调用：~1-2ms
- 后续调用：~0.1-0.5ms（浏览器内部缓存）

对于每分钟一次的更新，性能影响可以忽略。

## 相关文件

- `web/frontend/src/utils/marketTime.ts` - 市场时间工具
- `web/frontend/src/app/leaderboard/page.tsx` - 排行榜页面
- `web/frontend/src/app/intraday-trading/page.tsx` - 智能盯盘页面（未来可能使用）

## 参考资料

### 交易所官方时间
- [纽约证券交易所（NYSE）](https://www.nyse.com/markets/hours-calendars)
- [香港交易所（HKEX）](https://www.hkex.com.hk/Services/Trading-hours-and-Severe-Weather-Arrangements)
- [上海证券交易所（SSE）](http://www.sse.com.cn/)
- [深圳证券交易所（SZSE）](http://www.szse.cn/)

### IANA时区数据库
- [时区列表](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- [时区数据](https://www.iana.org/time-zones)

### MDN文档
- [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [Date.prototype.toLocaleString](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString)
