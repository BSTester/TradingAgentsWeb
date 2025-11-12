/**
 * API client for account snapshots
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get auth token from localStorage
 */
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
};

export interface SnapshotData {
  date: string;
  total_assets: number;
  cash: number;
  market_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
}

export interface TrendResponse {
  market_type: string;
  start_date: string;
  end_date: string;
  data: SnapshotData[];
}

export interface ChangeData {
  amount: number;
  percentage: number;
}

export interface AccountStats {
  market_type: string;
  latest: any;
  change_7d: ChangeData | null;
  change_30d: ChangeData | null;
  total_snapshots: number;
}

/**
 * Get account balance trend for the specified market
 */
export async function getAccountTrend(
  marketType: string,
  days: number = 30
): Promise<TrendResponse> {
  const token = getAuthToken();
  
  const response = await axios.get(
    `${API_BASE_URL}/api/account-snapshots/trend/${marketType}`,
    {
      params: { days },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}

/**
 * Get the latest account snapshot
 */
export async function getLatestSnapshot(marketType: string): Promise<any> {
  const token = getAuthToken();
  
  const response = await axios.get(
    `${API_BASE_URL}/api/account-snapshots/latest/${marketType}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}

/**
 * Create a new account snapshot
 */
export async function createSnapshot(marketType: string): Promise<any> {
  const token = getAuthToken();
  
  const response = await axios.post(
    `${API_BASE_URL}/api/account-snapshots/create/${marketType}`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}

/**
 * Get account statistics
 */
export async function getAccountStats(marketType: string): Promise<AccountStats> {
  const token = getAuthToken();
  
  const response = await axios.get(
    `${API_BASE_URL}/api/account-snapshots/stats/${marketType}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}
