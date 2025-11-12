# Account Snapshot Feature - Implementation Plan

## Overview

Add daily account snapshot functionality to track account balance trends over time. Users can view historical trends through charts accessible from account info cards.

---

## Backend Implementation

### 1. ✅ Database Model

**File**: `web/backend/models.py`

**Model**: `AccountSnapshot`

```python
class AccountSnapshot(Base):
    id: int
    user_id: int
    market_type: str  # US, HK, CN
    snapshot_date: datetime
    total_assets: float
    cash: float
    market_value: float
    unrealized_pnl: float
    realized_pnl: float
    account_data: JSON
    positions_data: JSON
    created_at: datetime
```

**Indexes**:
- `user_id`
- `market_type`
- `snapshot_date`
- Composite: `(user_id, market_type, snapshot_date DESC)`

### 2. ✅ Database Migration

**File**: `web/backend/migrations/006_add_account_snapshots.py`

Creates `account_snapshots` table with proper indexes.

### 3. ✅ API Routes

**File**: `web/backend/routes/account_snapshot_routes.py`

**Endpoints**:

#### GET `/api/account-snapshots/trend/{market_type}`
Get account balance trend data

**Query Params**:
- `days`: Number of days (default: 30)

**Response**:
```json
{
  "market_type": "US",
  "start_date": "2024-10-14",
  "end_date": "2024-11-13",
  "data": [
    {
      "date": "2024-10-14",
      "total_assets": 100000.00,
      "cash": 50000.00,
      "market_value": 50000.00,
      "unrealized_pnl": 1000.00,
      "realized_pnl": 500.00
    },
    ...
  ]
}
```

#### GET `/api/account-snapshots/latest/{market_type}`
Get the latest snapshot

#### POST `/api/account-snapshots/create/{market_type}`
Create a new snapshot (called by scheduled task)

#### GET `/api/account-snapshots/stats/{market_type}`
Get account statistics

**Response**:
```json
{
  "market_type": "US",
  "latest": { ... },
  "change_7d": {
    "amount": 5000.00,
    "percentage": 5.0
  },
  "change_30d": {
    "amount": 10000.00,
    "percentage": 10.0
  },
  "total_snapshots": 45
}
```

### 4. ⏳ Scheduled Task (TODO)

**File**: `web/backend/tasks/snapshot_scheduler.py` (to be created)

**Schedule**: Daily at market close
- US Market: 4:00 PM ET (after market close)
- HK Market: 4:00 PM HKT
- CN Market: 3:00 PM CST

**Implementation**:
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('cron', hour=16, minute=0, timezone='US/Eastern')
async def snapshot_us_market():
    # Create snapshot for all users with US market access
    pass

@scheduler.scheduled_job('cron', hour=16, minute=0, timezone='Asia/Hong_Kong')
async def snapshot_hk_market():
    # Create snapshot for all users with HK market access
    pass

@scheduler.scheduled_job('cron', hour=15, minute=0, timezone='Asia/Shanghai')
async def snapshot_cn_market():
    # Create snapshot for all users with CN market access
    pass
```

---

## Frontend Implementation

### 1. ⏳ API Client (TODO)

**File**: `web/frontend/src/lib/api/accountSnapshots.ts`

```typescript
export async function getAccountTrend(
  marketType: string,
  days: number = 30
): Promise<TrendData> {
  const response = await axios.get(
    `${API_BASE_URL}/api/account-snapshots/trend/${marketType}`,
    {
      params: { days },
      headers: { Authorization: `Bearer ${getAuthToken()}` }
    }
  );
  return response.data;
}

export async function getAccountStats(
  marketType: string
): Promise<AccountStats> {
  const response = await axios.get(
    `${API_BASE_URL}/api/account-snapshots/stats/${marketType}`,
    {
      headers: { Authorization: `Bearer ${getAuthToken()}` }
    }
  );
  return response.data;
}
```

### 2. ⏳ Trend Chart Modal Component (TODO)

**File**: `web/frontend/src/components/intraday/AccountTrendModal.tsx`

**Features**:
- Line chart showing account balance over time
- Multiple metrics: Total Assets, Cash, Market Value
- Time range selector: 7D, 30D, 90D, 1Y
- Percentage change indicators
- Responsive design

**Libraries**:
- Chart.js or Recharts for visualization
- date-fns for date formatting

**UI**:
```tsx
<Modal>
  <Header>
    <Title>账户资产趋势 - {marketType}</Title>
    <TimeRangeSelector>
      [7天] [30天] [90天] [1年]
    </TimeRangeSelector>
    <CloseButton />
  </Header>
  
  <Body>
    <LineChart>
      - Total Assets (总资产)
      - Cash (可用资金)
      - Market Value (持仓市值)
    </LineChart>
    
    <Stats>
      <Stat>
        <Label>7天变化</Label>
        <Value>+$5,000 (+5.0%)</Value>
      </Stat>
      <Stat>
        <Label>30天变化</Label>
        <Value>+$10,000 (+10.0%)</Value>
      </Stat>
    </Stats>
  </Body>
</Modal>
```

### 3. ⏳ Update Account Info Cards (TODO)

**File**: `web/frontend/src/components/intraday/AccountInfo.tsx`

**Changes**:
- Add chart icon button to each card (Total Assets, Cash, Market Value)
- On click, open AccountTrendModal with corresponding metric
- Icon position: Top-right corner of card

**Example**:
```tsx
<Card>
  <CardHeader>
    <Title>总资产</Title>
    <IconButton onClick={() => setShowTrendModal(true)}>
      <i className="fas fa-chart-line" />
    </IconButton>
  </CardHeader>
  <CardBody>
    <Value>$100,000.00</Value>
    <Change>+5.0% (7天)</Change>
  </CardBody>
</Card>

{showTrendModal && (
  <AccountTrendModal
    marketType={marketType}
    metric="total_assets"
    onClose={() => setShowTrendModal(false)}
  />
)}
```

---

## Data Flow

```
1. Scheduled Task (Daily at Market Close)
   ↓
2. Fetch Account Data from Futu API
   ↓
3. Save Snapshot to Database
   ↓
4. User Clicks Chart Icon on Card
   ↓
5. Frontend Fetches Trend Data
   ↓
6. Display Chart in Modal
```

---

## Database Schema

```sql
CREATE TABLE account_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    market_type VARCHAR(10) NOT NULL,
    snapshot_date TIMESTAMP NOT NULL,
    total_assets FLOAT NOT NULL,
    cash FLOAT NOT NULL,
    market_value FLOAT NOT NULL,
    unrealized_pnl FLOAT DEFAULT 0.0,
    realized_pnl FLOAT DEFAULT 0.0,
    account_data TEXT,
    positions_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_account_snapshots_user_id ON account_snapshots(user_id);
CREATE INDEX idx_account_snapshots_market_type ON account_snapshots(market_type);
CREATE INDEX idx_account_snapshots_snapshot_date ON account_snapshots(snapshot_date);
CREATE INDEX idx_account_snapshots_user_market_date ON account_snapshots(user_id, market_type, snapshot_date DESC);
```

---

## Testing Plan

### Backend Tests
- [ ] Create snapshot successfully
- [ ] Fetch trend data for different time ranges
- [ ] Handle missing snapshots gracefully
- [ ] Calculate percentage changes correctly
- [ ] Handle multiple markets independently

### Frontend Tests
- [ ] Chart icon appears on cards
- [ ] Modal opens on icon click
- [ ] Chart displays data correctly
- [ ] Time range selector works
- [ ] Modal closes properly
- [ ] Responsive on mobile

### Integration Tests
- [ ] End-to-end: Create snapshot → Fetch → Display
- [ ] Multiple users don't see each other's data
- [ ] Different markets show different data

---

## Implementation Status

### Completed ✅
1. Database model (`AccountSnapshot`)
2. Database migration script
3. API routes for snapshots
4. Route registration in app

### TODO ⏳
1. Scheduled task for daily snapshots
2. Frontend API client
3. Trend chart modal component
4. Update account info cards with chart icons
5. Chart library integration (Recharts recommended)
6. Testing

---

## Next Steps

1. **Run Migration**:
   ```bash
   python web/backend/migrations/006_add_account_snapshots.py
   ```

2. **Test API Endpoints**:
   ```bash
   # Create a test snapshot
   curl -X POST http://localhost:8000/api/account-snapshots/create/US \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Get trend data
   curl http://localhost:8000/api/account-snapshots/trend/US?days=30 \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Implement Frontend Components**:
   - Create AccountTrendModal.tsx
   - Update AccountInfo.tsx
   - Add chart library dependency

4. **Implement Scheduled Task**:
   - Create snapshot_scheduler.py
   - Integrate with app startup
   - Test scheduling

---

## Dependencies

### Backend
- ✅ SQLAlchemy (already installed)
- ✅ FastAPI (already installed)
- ⏳ APScheduler (for scheduled tasks) - `pip install apscheduler`

### Frontend
- ⏳ Chart library - `npm install recharts` (recommended)
  * Alternative: `npm install chart.js react-chartjs-2`
- ✅ axios (already installed)
- ✅ date-fns (already installed)

---

## Notes

- Snapshots are created at market close to capture end-of-day state
- Each market has independent snapshots
- Historical data enables trend analysis and performance tracking
- Users can see their account growth over time
- Useful for evaluating trading strategy effectiveness
