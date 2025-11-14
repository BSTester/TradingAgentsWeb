/**
 * Market Currency Utilities
 * 
 * Maps market types to their respective currency symbols and codes
 */

export type MarketType = 'US' | 'HK' | 'CN';

export interface CurrencyInfo {
  symbol: string;
  code: string;
  name: string;
}

/**
 * Market to currency mapping
 */
export const MARKET_CURRENCIES: Record<MarketType, CurrencyInfo> = {
  US: {
    symbol: '$',
    code: 'USD',
    name: 'US Dollar',
  },
  HK: {
    symbol: 'HK$',
    code: 'HKD',
    name: 'Hong Kong Dollar',
  },
  CN: {
    symbol: '¥',
    code: 'CNY',
    name: 'Chinese Yuan',
  },
};

/**
 * Get currency info for a market type
 * 
 * @param marketType - Market type (US, HK, CN)
 * @returns Currency information
 */
export function getCurrencyForMarket(marketType: string): CurrencyInfo {
  const normalizedMarket = marketType.toUpperCase() as MarketType;
  return MARKET_CURRENCIES[normalizedMarket] || MARKET_CURRENCIES.US;
}

/**
 * Get currency symbol for a market type
 * 
 * @param marketType - Market type (US, HK, CN)
 * @returns Currency symbol (e.g., '$', 'HK$', '¥')
 */
export function getCurrencySymbol(marketType: string): string {
  return getCurrencyForMarket(marketType).symbol;
}

/**
 * Get currency code for a market type
 * 
 * @param marketType - Market type (US, HK, CN)
 * @returns Currency code (e.g., 'USD', 'HKD', 'CNY')
 */
export function getCurrencyCode(marketType: string): string {
  return getCurrencyForMarket(marketType).code;
}

/**
 * Format a number as currency for the specified market
 * 
 * @param amount - Amount to format
 * @param marketType - Market type (US, HK, CN)
 * @param options - Intl.NumberFormat options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  marketType: string,
  options?: Intl.NumberFormatOptions
): string {
  const currency = getCurrencyForMarket(marketType);
  
  // Default formatting options
  const defaultOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  };
  
  // Use appropriate locale based on market
  const locale = marketType === 'CN' ? 'zh-CN' : marketType === 'HK' ? 'zh-HK' : 'en-US';
  
  return new Intl.NumberFormat(locale, defaultOptions).format(amount);
}

/**
 * Format a number with currency symbol (simpler version)
 * 
 * @param amount - Amount to format
 * @param marketType - Market type (US, HK, CN)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with currency symbol
 */
export function formatAmount(
  amount: number,
  marketType: string,
  decimals: number = 2
): string {
  const symbol = getCurrencySymbol(marketType);
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  return `${symbol}${formatted}`;
}
