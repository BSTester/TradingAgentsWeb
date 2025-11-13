# Currency Symbol Frontend Fix

## Issue

The currency symbols in the intraday trading page (智能盯盘) were not displaying correctly in charts and position tables. The frontend was trying to get currency from the API response, but the backend no longer returns currency information.

## Root Cause

After consolidating the Futu API implementation, the backend was updated to NOT store or return currency information. Instead, currency should be determined by the frontend based on the selected market type.

However, the frontend components were still trying to use `account?.currency` or `position.currency` from the API response, which no longer exists.

## Solution

Updated all frontend components to determine currency based on market type using a simple helper function:

```typescript
const getCurrencySymbol = (market: string) => {
  switch (market.toUpperCase()) {
    case 'US':
      return '$';
    case 'HK':
      return 'HK$';
    case 'CN':
      return '¥';
    default:
      return '$';
  }
};
```

## Files Modified

### 1. AccountInfo.tsx
**Location:** `web/frontend/src/components/intraday/AccountInfo.tsx`

**Changes:**
- Added `getCurrencySymbol()` helper function
- Changed from `account?.currency || '$'` to `getCurrencySymbol(selectedMarket)`
- Currency now correctly reflects the selected market

**Before:**
```typescript
const currency = account?.currency || '$';
```

**After:**
```typescript
const getCurrencySymbol = (market: string) => {
  switch (market.toUpperCase()) {
    case 'US': return '$';
    case 'HK': return 'HK$';
    case 'CN': return '¥';
    default: return '$';
  }
};
const currency = getCurrencySymbol(selectedMarket);
```

### 2. AccountTrendModal.tsx
**Location:** `web/frontend/src/components/intraday/AccountTrendModal.tsx`

**Changes:**
- Updated `formatCurrency()` function to use market type instead of API response
- Changed from `trendData?.currency || '$'` to `getCurrencySymbol(marketType)`
- Chart tooltips and stats now show correct currency symbols

**Before:**
```typescript
const formatCurrency = (value: number) => {
  const currencySymbol = trendData?.currency || '$';
  return `${currencySymbol}${value.toFixed(2)}`;
};
```

**After:**
```typescript
const formatCurrency = (value: number) => {
  const getCurrencySymbol = (market: string) => {
    switch (market.toUpperCase()) {
      case 'US': return '$';
      case 'HK': return 'HK$';
      case 'CN': return '¥';
      default: return '$';
    }
  };
  const currencySymbol = getCurrencySymbol(marketType);
  return `${currencySymbol}${value.toFixed(2)}`;
};
```

### 3. PositionOverview.tsx
**Location:** `web/frontend/src/components/intraday/PositionOverview.tsx`

**Changes:**
- Added `getCurrencySymbol()` helper function
- Changed from `position.currency || '$'` to `currency` (derived from market)
- Position table now shows correct currency for cost price, current price, and P&L

**Before:**
```typescript
{position.currency || '$'}{position.cost_price?.toFixed(2) || '0.00'}
{position.currency || '$'}{position.current_price?.toFixed(2) || '0.00'}
{position.currency || '$'}{(position.pnl || 0).toFixed(2)}
```

**After:**
```typescript
const currency = getCurrencySymbol(selectedMarket);
// ...
{currency}{position.cost_price?.toFixed(2) || '0.00'}
{currency}{position.current_price?.toFixed(2) || '0.00'}
{currency}{(position.pnl || 0).toFixed(2)}
```

## Testing

### Test Scenarios

1. **US Market (美股)**
   - Select US market in dropdown
   - Verify total assets card shows `$` symbol
   - Open trend chart, verify chart shows `$` in tooltips and stats
   - Check position table, verify prices show `$` symbol

2. **HK Market (港股)**
   - Select HK market in dropdown
   - Verify total assets card shows `HK$` symbol
   - Open trend chart, verify chart shows `HK$` in tooltips and stats
   - Check position table, verify prices show `HK$` symbol

3. **CN Market (A股)**
   - Select CN market in dropdown
   - Verify total assets card shows `¥` symbol
   - Open trend chart, verify chart shows `¥` in tooltips and stats
   - Check position table, verify prices show `¥` symbol

4. **Market Switching**
   - Switch between markets
   - Verify currency symbol updates immediately in all components
   - Verify no API errors or console warnings

### Expected Results

- ✅ Currency symbols match the selected market
- ✅ Total assets card displays correct currency
- ✅ Trend charts show correct currency in tooltips and stats
- ✅ Position table shows correct currency for all price fields
- ✅ Currency updates immediately when switching markets
- ✅ No API errors related to missing currency field

## Benefits

1. **Consistency**: Currency always matches the selected market
2. **No API Dependency**: Frontend doesn't rely on backend for currency information
3. **Immediate Updates**: Currency changes instantly when switching markets
4. **Simpler Logic**: Single source of truth for currency mapping
5. **Better UX**: Users see the correct currency symbol for their selected market

## Future Improvements

Consider creating a shared utility file for currency handling:

```typescript
// web/frontend/src/utils/currency.ts
export const getCurrencySymbol = (market: string): string => {
  switch (market.toUpperCase()) {
    case 'US': return '$';
    case 'HK': return 'HK$';
    case 'CN': return '¥';
    default: return '$';
  }
};

export const formatCurrency = (value: number, market: string): string => {
  const symbol = getCurrencySymbol(market);
  return `${symbol}${value.toFixed(2)}`;
};
```

This would eliminate code duplication across components and make future updates easier.

## Related Documentation

- [Currency Handling Guide](./CURRENCY_HANDLING.md) - Complete guide on currency handling approach
- [Futu API Consolidation](./FUTU_API_CONSOLIDATION.md) - Backend changes that removed currency from API
