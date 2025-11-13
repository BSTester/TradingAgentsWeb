# Currency Handling in Account Snapshots

## Overview

Currency symbols and codes are automatically determined by the frontend based on the selected market type. The backend does not store or return currency information.

## Design Decision

**Why not store currency in the database?**

1. **Deterministic**: Currency is always determined by market type (US → USD, HK → HKD, CN → CNY)
2. **No Redundancy**: Storing currency would be redundant since it can be derived from `market_type`
3. **Simpler Backend**: Backend focuses on numerical data, frontend handles presentation
4. **Easier Maintenance**: No need to update currency data if display preferences change

## Market to Currency Mapping

| Market Type | Currency Code | Currency Symbol | Currency Name |
|-------------|---------------|-----------------|---------------|
| US          | USD           | $               | US Dollar     |
| HK          | HKD           | HK$             | Hong Kong Dollar |
| CN          | CNY           | ¥               | Chinese Yuan  |

## Backend Implementation

### Database Schema

The `AccountSnapshot` model does NOT include a currency field:

```python
class AccountSnapshot(Base):
    __tablename__ = "account_snapshots"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    market_type = Column(String(10))  # US, HK, CN
    snapshot_date = Column(DateTime(timezone=True))
    
    # Financial data (no currency field)
    total_assets = Column(Float)
    cash = Column(Float)
    market_value = Column(Float)
    unrealized_pnl = Column(Float)
    realized_pnl = Column(Float)
    
    # account_data is set to None (no currency stored)
    account_data = Column(JSON, nullable=True)
```

### API Response

API endpoints return data without currency information:

```json
{
  "market_type": "US",
  "start_date": "2025-10-14",
  "end_date": "2025-11-13",
  "data": [
    {
      "date": "2025-11-13",
      "total_assets": 100000.00,
      "cash": 50000.00,
      "market_value": 50000.00,
      "unrealized_pnl": 5000.00,
      "realized_pnl": 0.00
    }
  ]
}
```

Note: No `currency` field in the response.

## Frontend Implementation

### Utility Functions

The frontend provides utility functions in `web/frontend/utils/marketCurrency.ts`:

```typescript
import { getCurrencySymbol, formatCurrency, formatAmount } from '@/utils/marketCurrency';

// Get currency symbol
const symbol = getCurrencySymbol('US');  // Returns: '$'
const symbol = getCurrencySymbol('HK');  // Returns: 'HK$'
const symbol = getCurrencySymbol('CN');  // Returns: '¥'

// Format currency with full locale support
const formatted = formatCurrency(100000, 'US');  // Returns: '$100,000.00'
const formatted = formatCurrency(100000, 'HK');  // Returns: 'HK$100,000.00'
const formatted = formatCurrency(100000, 'CN');  // Returns: '¥100,000.00'

// Simple formatting with symbol
const amount = formatAmount(100000, 'US');  // Returns: '$100,000.00'
```

### Usage in Components

```typescript
// In a React component
import { getCurrencySymbol, formatAmount } from '@/utils/marketCurrency';

function AccountSummary({ marketType, totalAssets }) {
  const currencySymbol = getCurrencySymbol(marketType);
  const formattedAmount = formatAmount(totalAssets, marketType);
  
  return (
    <div>
      <h3>Total Assets</h3>
      <p>{formattedAmount}</p>
      {/* Or manually: */}
      <p>{currencySymbol}{totalAssets.toLocaleString()}</p>
    </div>
  );
}
```

### Chart Labels

```typescript
// In chart configuration
import { getCurrencySymbol } from '@/utils/marketCurrency';

const chartOptions = {
  scales: {
    y: {
      ticks: {
        callback: function(value) {
          const symbol = getCurrencySymbol(marketType);
          return symbol + value.toLocaleString();
        }
      }
    }
  }
};
```

## Migration Notes

### Existing Data

If you have existing snapshots with currency stored in `account_data`:

1. **No action required**: The currency field in `account_data` is simply ignored
2. **Optional cleanup**: You can set `account_data` to `NULL` for existing records:

```sql
UPDATE account_snapshots SET account_data = NULL;
```

### API Consumers

If external systems consume the API and expect a `currency` field:

**Option 1: Add currency in API layer (not recommended)**
```python
# In route handler
response = {
    "market_type": market_type,
    "currency": get_currency_for_market(market_type),  # Add helper
    "data": trend_data
}
```

**Option 2: Document the change (recommended)**
- Update API documentation to indicate currency should be derived from `market_type`
- Provide the market-to-currency mapping table

## Benefits

1. **Reduced Storage**: No redundant currency data in database
2. **Consistency**: Currency always matches market type
3. **Flexibility**: Easy to change currency display format without backend changes
4. **Internationalization**: Frontend can handle locale-specific formatting
5. **Simplicity**: Backend focuses on data, frontend handles presentation

## Testing

### Backend Tests

```python
# Test that currency is not stored
def test_snapshot_no_currency():
    snapshot = AccountSnapshot(
        user_id=1,
        market_type="US",
        total_assets=100000,
        account_data=None
    )
    assert snapshot.account_data is None
```

### Frontend Tests

```typescript
// Test currency utilities
import { getCurrencySymbol, formatAmount } from '@/utils/marketCurrency';

test('getCurrencySymbol returns correct symbol', () => {
  expect(getCurrencySymbol('US')).toBe('$');
  expect(getCurrencySymbol('HK')).toBe('HK$');
  expect(getCurrencySymbol('CN')).toBe('¥');
});

test('formatAmount formats correctly', () => {
  expect(formatAmount(100000, 'US')).toBe('$100,000.00');
  expect(formatAmount(100000, 'HK')).toBe('HK$100,000.00');
  expect(formatAmount(100000, 'CN')).toBe('¥100,000.00');
});
```

## Future Considerations

If you need to support:

1. **Multiple currencies per market**: Store currency in database
2. **User-selected currency**: Add user preference table
3. **Currency conversion**: Add exchange rate service

For now, the simple market-based approach is sufficient and maintainable.
