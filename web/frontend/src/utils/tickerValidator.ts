/**
 * Ticker validation and market detection utilities
 * 股票代码校验和市场检测工具
 */

/**
 * 标准化股票代码：去除空格并转大写
 */
export function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().trim().replace(/\s/g, '');
}

/**
 * 校验股票代码格式是否有效
 */
export function validateTicker(ticker: string): boolean {
  const normalized = normalizeTicker(ticker);
  
  // 港股：4-5位数字或带.HK后缀
  if (normalized.endsWith('.HK')) {
    const base = normalized.slice(0, -3);
    return /^\d{4,5}$/.test(base);
  }
  if (/^\d{4,5}$/.test(normalized)) {
    return true;
  }
  
  // A股：6位数字或带.SH/.SS后缀
  if (normalized.endsWith('.SH') || normalized.endsWith('.SS')) {
    const base = normalized.slice(0, -3);
    return /^\d{6}$/.test(base);
  }
  if (/^\d{6}$/.test(normalized)) {
    return true;
  }
  
  // 美股：1-5个字母
  if (/^[A-Z]{1,5}$/.test(normalized)) {
    return true;
  }
  
  return false;
}

/**
 * 根据股票代码识别市场类型
 */
export function detectMarket(ticker: string): 'US' | 'HK' | 'CN' {
  const normalized = normalizeTicker(ticker);
  
  // 港股：4-5位数字或带.HK后缀
  if (normalized.endsWith('.HK') || /^\d{4,5}$/.test(normalized)) {
    return 'HK';
  }
  
  // A股：6位数字或带.SH/.SS后缀
  if (normalized.endsWith('.SH') || normalized.endsWith('.SS') || /^\d{6}$/.test(normalized)) {
    return 'CN';
  }
  
  // 默认为美股
  return 'US';
}

/**
 * 获取股票代码格式错误提示信息
 */
export function getTickerErrorMessage(ticker: string): string {
  if (!ticker || ticker.trim() === '') {
    return '请输入股票代码';
  }
  
  return '无效的股票代码格式。请输入有效的美股（如AAPL）、港股（如0700或0700.HK）或A股（如600000或600000.SH）代码。';
}
