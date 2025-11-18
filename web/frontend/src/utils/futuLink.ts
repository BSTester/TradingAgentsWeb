/**
 * 富途股票详情页链接工具函数
 */

/**
 * 生成富途股票详情页 URL
 * 
 * URL 格式:
 * - 美股: https://www.futunn.com/stock/NVDA-US
 * - 港股: https://www.futunn.com/stock/02258-HK
 * - A股(沪市): https://www.futunn.com/stock/688670-SH
 * - A股(深市): https://www.futunn.com/stock/301017-SZ
 * 
 * @param stockCode 股票代码
 * @param marketType 市场类型 (US/HK/CN)
 * @returns 富途股票详情页 URL
 */
export function getFutuStockUrl(stockCode: string, marketType: string): string {
  const market = marketType.toUpperCase();
  
  // 提取纯股票代码
  // 港股/A股: 提取数字 (例如: "HK.00700" 或 "00700.HK" -> "00700")
  // 美股: 提取字母，选择最长的匹配 (例如: "US.AAPL" -> "AAPL", 而不是 "US")
  let pureCode = stockCode;
  if (market === 'US') {
    // 提取所有字母序列，选择最长的（避免匹配到 "US.AAPL" 中的 "US"）
    const matches = stockCode.match(/[A-Z]+/g);
    if (matches && matches.length > 0) {
      pureCode = matches.reduce((a, b) => a.length >= b.length ? a : b);
    }
  } else {
    // 港股/A股: 提取数字
    const match = stockCode.match(/\d+/);
    pureCode = match ? match[0] : stockCode;
  }
  
  if (market === 'US') {
    // 美股: AAPL, NVDA 等
    return `https://www.futunn.com/stock/${pureCode}-US`;
  } else if (market === 'HK') {
    // 港股: 00700, 02258 等
    return `https://www.futunn.com/stock/${pureCode}-HK`;
  } else if (market === 'CN') {
    // A股: 需要判断沪市还是深市
    // 沪市: 60xxxx, 688xxx (科创板)
    // 深市: 00xxxx, 30xxxx (创业板), 002xxx (中小板)
    if (pureCode.startsWith('60') || pureCode.startsWith('688')) {
      return `https://www.futunn.com/stock/${pureCode}-SH`;
    } else {
      return `https://www.futunn.com/stock/${pureCode}-SZ`;
    }
  }
  
  // 兜底
  return `https://www.futunn.com/stock/${pureCode}`;
}

/**
 * 在新标签页中打开富途股票详情页
 * 
 * @param stockCode 股票代码
 * @param marketType 市场类型 (US/HK/CN)
 */
export function openFutuStockPage(stockCode: string, marketType: string): void {
  const url = getFutuStockUrl(stockCode, marketType);
  window.open(url, '_blank', 'noopener,noreferrer');
}
