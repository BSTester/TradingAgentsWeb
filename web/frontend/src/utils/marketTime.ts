/**
 * 市场时间工具函数
 * 根据各市场的当地时间判断开闭市状态
 */

export interface MarketStatus {
  isOpen: boolean;
  message: string;
  localTime?: string;
}

/**
 * 获取指定时区的当前时间
 * @param timezone IANA时区标识符
 * @returns Date对象
 */
function getTimeInTimezone(timezone: string): Date {
  // 获取当前UTC时间
  const now = new Date();
  
  // 使用Intl API获取指定时区的时间字符串
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
  
  const parts = formatter.formatToParts(now);
  const dateParts: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      dateParts[part.type] = part.value;
    }
  });
  
  // 构造本地时间的Date对象
  const localDate = new Date(
    parseInt(dateParts.year ?? ''),
    parseInt(dateParts.month ?? '') - 1,
    parseInt(dateParts.day ?? ''),
    parseInt(dateParts.hour ?? ''),
    parseInt(dateParts.minute ?? ''),
    parseInt(dateParts.second ?? '')
  );
  
  return localDate;
}

/**
 * 检查美股市场状态
 * 交易时间：周一至周五 9:30-16:00 EST/EDT
 */
function checkUSMarketStatus(): MarketStatus {
  // 获取当前时间并转换为美东时区
  const now = new Date();
  
  // 使用Intl API获取美东时间的各个部分
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  
  const parts = formatter.formatToParts(now);
  const dateParts: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      dateParts[part.type] = part.value;
    }
  });
  
  // 获取星期几（0=周日, 1=周一, ..., 6=周六）
  const weekdayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const day = weekdayMap[dateParts.weekday ?? ''] || 0;

  const hour = parseInt(dateParts.hour ?? '');
  const minute = parseInt(dateParts.minute ?? '');
  const time = hour * 60 + minute;

  const timeStr = `${dateParts.hour}:${dateParts.minute}`;

  let isOpen = false;
  let message = '';

  if (day >= 1 && day <= 5) {
    // 周一到周五
    if (time >= 570 && time < 960) { // 9:30-16:00
      isOpen = true;
      message = `美股市场开市中（交易时间：9:30-16:00 美东时间，当前：${timeStr}）`;
    } else if (time < 570) {
      message = `美股市场未开市（交易时间：9:30-16:00 美东时间，当前：${timeStr}）`;
    } else {
      message = `美股市场已收市（交易时间：9:30-16:00 美东时间，当前：${timeStr}）`;
    }
  } else {
    message = `美股市场周末休市（交易时间：周一至周五 9:30-16:00 美东时间）`;
  }
  
  return { isOpen, message, localTime: timeStr };
}

/**
 * 检查港股市场状态
 * 交易时间：周一至周五 9:30-12:00, 13:00-16:00 HKT
 */
function checkHKMarketStatus(): MarketStatus {
  // 获取当前时间并转换为香港时区
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  
  const parts = formatter.formatToParts(now);
  const dateParts: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      dateParts[part.type] = part.value;
    }
  });
  
  const weekdayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const day = weekdayMap[dateParts.weekday ?? ''] || 0;

  const hour = parseInt(dateParts.hour ?? '');
  const minute = parseInt(dateParts.minute ?? '');
  const time = hour * 60 + minute;

  const timeStr = `${dateParts.hour}:${dateParts.minute}`;

  let isOpen = false;
  let message = '';

  if (day >= 1 && day <= 5) {
    // 周一到周五
    if ((time >= 570 && time < 720) || (time >= 780 && time < 960)) {
      // 9:30-12:00 或 13:00-16:00
      isOpen = true;
      message = `港股市场开市中（交易时间：9:30-12:00, 13:00-16:00 香港时间，当前：${timeStr}）`;
    } else if (time < 570) {
      message = `港股市场未开市（交易时间：9:30-12:00, 13:00-16:00 香港时间，当前：${timeStr}）`;
    } else if (time >= 720 && time < 780) {
      message = `港股市场午间休市（交易时间：9:30-12:00, 13:00-16:00 香港时间，当前：${timeStr}）`;
    } else {
      message = `港股市场已收市（交易时间：9:30-12:00, 13:00-16:00 香港时间，当前：${timeStr}）`;
    }
  } else {
    message = `港股市场周末休市（交易时间：周一至周五 9:30-12:00, 13:00-16:00 香港时间）`;
  }
  
  return { isOpen, message, localTime: timeStr };
}

/**
 * 检查A股市场状态
 * 交易时间：周一至周五 9:30-11:30, 13:00-15:00 CST
 */
function checkCNMarketStatus(): MarketStatus {
  // 获取当前时间并转换为中国时区
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  
  const parts = formatter.formatToParts(now);
  const dateParts: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      dateParts[part.type] = part.value;
    }
  });
  
  const weekdayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const day = weekdayMap[dateParts.weekday ?? ''] || 0;

  const hour = parseInt(dateParts.hour ?? '');
  const minute = parseInt(dateParts.minute ?? '');
  const time = hour * 60 + minute;

  const timeStr = `${dateParts.hour}:${dateParts.minute}`;

  let isOpen = false;
  let message = '';

  if (day >= 1 && day <= 5) {
    // 周一到周五
    if ((time >= 570 && time < 690) || (time >= 780 && time < 900)) {
      // 9:30-11:30 或 13:00-15:00
      isOpen = true;
      message = `A股市场开市中（交易时间：9:30-11:30, 13:00-15:00 北京时间，当前：${timeStr}）`;
    } else if (time < 570) {
      message = `A股市场未开市（交易时间：9:30-11:30, 13:00-15:00 北京时间，当前：${timeStr}）`;
    } else if (time >= 690 && time < 780) {
      message = `A股市场午间休市（交易时间：9:30-11:30, 13:00-15:00 北京时间，当前：${timeStr}）`;
    } else {
      message = `A股市场已收市（交易时间：9:30-11:30, 13:00-15:00 北京时间，当前：${timeStr}）`;
    }
  } else {
    message = `A股市场周末休市（交易时间：周一至周五 9:30-11:30, 13:00-15:00 北京时间）`;
  }
  
  return { isOpen, message, localTime: timeStr };
}

/**
 * 检查指定市场的状态
 * @param market 市场代码：'US' | 'HK' | 'CN'
 * @returns 市场状态
 */
export function checkMarketStatus(market: string): MarketStatus {
  switch (market) {
    case 'US':
      return checkUSMarketStatus();
    case 'HK':
      return checkHKMarketStatus();
    case 'CN':
      return checkCNMarketStatus();
    default:
      return {
        isOpen: false,
        message: '未知市场',
      };
  }
}

/**
 * 获取市场的时区信息
 */
export function getMarketTimezone(market: string): string {
  switch (market) {
    case 'US':
      return 'America/New_York'; // 美东时间（EST/EDT）
    case 'HK':
      return 'Asia/Hong_Kong';   // 香港时间（HKT）
    case 'CN':
      return 'Asia/Shanghai';    // 北京时间（CST）
    default:
      return 'UTC';
  }
}

/**
 * 获取市场的当地时间字符串
 */
export function getMarketLocalTime(market: string): string {
  const timezone = getMarketTimezone(market);
  
  // 直接使用当前时间和指定时区格式化，不需要通过getTimeInTimezone
  return new Date().toLocaleString('zh-CN', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
