import { apiClient, publicApiClient } from '@/lib/apiClient';
import type { ReportPreview, RoleChainReport } from '@/types/report';

// Detail payload from GET /api/reports/{id}
export interface ReportDetail {
  id: string;
  ticker: string;
  company_name: string;
  market: 'US' | 'HK' | 'CN' | null;
  source: { type: string; session_id: string | null; task_id: number | null };
  conclusion: {
    rating: number;
    rating_label: string;
    summary: string;
    key_points: string[];
  };
  sections: Array<{
    key: string;
    title: string;
    summary: string;
    content: string;
  }>;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  role_chain?: RoleChainReport;
}

function unwrap<T>(res: { data?: T }): T {
  return res.data as T;
}

export const reportAPI = {
  // Authenticated: my reports + public
  list: async (params: { page?: number; limit?: number; ticker?: string; market?: string } = {}) => {
    const { page = 1, limit = 20, ticker, market } = params;
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (ticker) qs.set('ticker', ticker);
    if (market) qs.set('market', market);
    const res = await apiClient.get<{ data: ReportPreview[]; meta: { total: number; has_next: boolean } }>(
      `/api/reports?${qs.toString()}`,
    );
    return unwrap(res);
  },

  // Public feed for the home / leaderboard (no auth required)
  publicFeed: async (limit = 12) => {
    try {
      const res = await publicApiClient.get<{ data: ReportPreview[]; meta: { total: number } }>(
        `/api/reports/public?limit=${limit}`,
      );
      return unwrap(res);
    } catch {
      return { data: [], meta: { total: 0 } };
    }
  },

  // Full report detail incl. role_chain
  get: async (id: string) => {
    const res = await apiClient.get<{ data: ReportDetail }>(`/api/reports/${id}`);
    return res.data.data;
  },

  exportUrl: (id: string, format: 'md' | 'json' | 'pdf') =>
    `/api/reports/${id}/export?format=${format}`,
};
