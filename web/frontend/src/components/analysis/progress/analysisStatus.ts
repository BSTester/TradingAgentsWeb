import { buildApiUrl } from '../../../utils/api';
import type { StatusFetcher, WebSocketMessage } from './types';

/** Load the initial status before opening the progress websocket. Non-2xx is recoverable. */
export async function loadAnalysisProgressConfig(
  analysisId: string,
  token: string | null,
  fetchStatus: StatusFetcher = fetch,
): Promise<WebSocketMessage['data']> {
  const response = await fetchStatus(buildApiUrl(`/api/analysis/${analysisId}/status`), {
    headers: { 'Authorization': `Bearer ${token || ''}` },
  });

  if (!response.ok) {
    const suffix = response.statusText ? ` ${response.statusText}` : '';
    throw new Error(`无法加载分析状态（${response.status}${suffix}）`);
  }

  return response.json() as Promise<WebSocketMessage['data']>;
}