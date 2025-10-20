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
  
  // 港股：5位数字（2008年后统一为5位）或带.HK后缀
  if (normalized.endsWith('.HK')) {
    const base = normalized.slice(0, -3);
    // 港股代码：5位数字，或4位数字（兼容旧格式）
    return /^\d{4,5}$/.test(base);
  }
  
  // A股：必须是6位数字，且符合沪深市场规则
  if (/^\d{6}$/.test(normalized)) {
    // 沪市主板：600、601、603、605开头
    // 科创板：688开头
    // 深市主板：000、001开头
    // 中小板：002开头
    // 创业板：300、301开头
    const prefix3 = normalized.substring(0, 3);
    
    // 沪市
    if (prefix3 === '600' || prefix3 === '601' || prefix3 === '603' || 
        prefix3 === '605' || prefix3 === '688') {
      return true;
    }
    
    // 深市
    if (prefix3 === '000' || prefix3 === '001' || prefix3 === '002' || 
        prefix3 === '300' || prefix3 === '301') {
      return true;
    }
    
    // 不符合沪深市场规则
    return false;
  }
  
  // A股带后缀：.SH（沪市）或.SZ（深市）
  if (normalized.endsWith('.SH') || normalized.endsWith('.SZ')) {
    const base = normalized.slice(0, -3);
    if (!/^\d{6}$/.test(base)) {
      return false;
    }
    
    const prefix3 = base.substring(0, 3);
    
    if (normalized.endsWith('.SH')) {
      // 沪市：600、601、603、605、688开头
      return prefix3 === '600' || prefix3 === '601' || prefix3 === '603' || 
             prefix3 === '605' || prefix3 === '688';
    } else {
      // 深市：000、001、002、300、301开头
      return prefix3 === '000' || prefix3 === '001' || prefix3 === '002' || 
             prefix3 === '300' || prefix3 === '301';
    }
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
  if (normalized.endsWith('.HK')) {
    return 'HK';
  }
  
  // A股：6位数字或带.SH/.SZ后缀
  if (normalized.endsWith('.SH') || normalized.endsWith('.SZ')) {
    return 'CN';
  }
  
  // 6位数字：检查是否符合A股规则
  if (/^\d{6}$/.test(normalized)) {
    const prefix3 = normalized.substring(0, 3);
    // 沪市或深市
    if (prefix3 === '600' || prefix3 === '601' || prefix3 === '603' || 
        prefix3 === '605' || prefix3 === '688' ||
        prefix3 === '000' || prefix3 === '001' || prefix3 === '002' || 
        prefix3 === '300' || prefix3 === '301') {
      return 'CN';
    }
  }
  
  // 4-5位数字：港股
  if (/^\d{4,5}$/.test(normalized)) {
    return 'HK';
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
  
  const normalized = normalizeTicker(ticker);
  
  // 检查是否是6位数字但不符合沪深规则
  if (/^\d{6}$/.test(normalized)) {
    const prefix3 = normalized.substring(0, 3);
    return `无效的A股代码：${ticker}\n\n沪市代码必须以 600/601/603/605/688 开头\n深市代码必须以 000/001/002/300/301 开头`;
  }
  
  // 检查是否带了错误的后缀
  if (normalized.endsWith('.SH') || normalized.endsWith('.SZ')) {
    const base = normalized.slice(0, -3);
    const suffix = normalized.slice(-3);
    
    if (!/^\d{6}$/.test(base)) {
      return `无效的A股代码格式：${ticker}\n\nA股代码必须是6位数字`;
    }
    
    if (suffix === '.SH') {
      return `无效的沪市代码：${ticker}\n\n沪市代码必须以 600/601/603/605/688 开头`;
    } else {
      return `无效的深市代码：${ticker}\n\n深市代码必须以 000/001/002/300/301 开头`;
    }
  }
  
  return `无效的股票代码格式：${ticker}\n\n支持格式：\n• 美股：1-5个字母（如 AAPL、TSLA）\n• 港股：4-5位数字或带.HK后缀（如 0700、00700.HK）\n• A股沪市：600/601/603/605/688开头（如 600519、688001.SH）\n• A股深市：000/001/002/300/301开头（如 000001、300750.SZ）`;
}
