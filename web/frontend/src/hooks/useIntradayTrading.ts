/**
 * React Query hooks for intraday trading system
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { intradayTradingAPI } from '@/lib/apiClient';

// Query keys
export const intradayTradingKeys = {
  all: ['intraday-trading'] as const,
  scheduler: () => [...intradayTradingKeys.all, 'scheduler'] as const,
  schedulerStatus: () => [...intradayTradingKeys.scheduler(), 'status'] as const,
  schedulerConfig: () => [...intradayTradingKeys.scheduler(), 'config'] as const,
  account: () => [...intradayTradingKeys.all, 'account'] as const,
  positions: () => [...intradayTradingKeys.all, 'positions'] as const,
  decisions: () => [...intradayTradingKeys.all, 'decisions'] as const,
  decisionsList: (page: number, limit: number) => [...intradayTradingKeys.decisions(), { page, limit }] as const,
  decision: (id: number) => [...intradayTradingKeys.decisions(), id] as const,
  orders: () => [...intradayTradingKeys.all, 'orders'] as const,
};

// Hook to get scheduler status
// NOTE: This hook no longer fetches from API, it only reads from cache
// The status is populated by WebSocket 'scheduler_status_sync' message on connection
export function useSchedulerStatus() {
  return useQuery({
    queryKey: intradayTradingKeys.schedulerStatus(),
    queryFn: () => {
      // This should never be called as enabled is false
      // Data is populated by WebSocket only
      throw new Error('Scheduler status should be populated by WebSocket');
    },
    enabled: false, // Never fetch from API, only use WebSocket data
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook to get scheduler config
export function useSchedulerConfig() {
  return useQuery({
    queryKey: intradayTradingKeys.schedulerConfig(),
    queryFn: () => intradayTradingAPI.getConfig(),
    // Config rarely changes, only refetch on mount
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// Hook to control scheduler
export function useSchedulerControl() {
  const queryClient = useQueryClient();

  const start = useMutation({
    mutationFn: () => intradayTradingAPI.startScheduler(),
    // Don't invalidate - WebSocket will update the status
  });

  const stop = useMutation({
    mutationFn: () => intradayTradingAPI.stopScheduler(),
    // Don't invalidate - WebSocket will update the status
  });

  const updateConfig = useMutation({
    mutationFn: (config: {
      futu_api_url?: string;
      futu_api_key?: string;
      interval_minutes?: number;
      market_type?: string;
      llm_provider?: string;
      llm_api_key?: string;
    }) => intradayTradingAPI.updateConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: intradayTradingKeys.schedulerStatus() });
      queryClient.invalidateQueries({ queryKey: intradayTradingKeys.schedulerConfig() });
    },
  });

  return { start, stop, updateConfig };
}

// Hook to get account info
export function useAccountInfo(market: string = 'US') {
  return useQuery({
    queryKey: [...intradayTradingKeys.account(), market],
    queryFn: () => intradayTradingAPI.getAccountInfo(market),
    // Disable all auto-refetch, rely on WebSocket for updates
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity, // Never consider stale, only update via WebSocket
  });
}

// Hook to get positions
export function usePositions(market: string = 'US') {
  return useQuery({
    queryKey: [...intradayTradingKeys.positions(), market],
    queryFn: () => intradayTradingAPI.getPositions(market),
    // Disable all auto-refetch, rely on WebSocket for updates
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity, // Never consider stale, only update via WebSocket
  });
}

// Hook to get decisions list
// NOTE: This hook no longer fetches from API, it only reads from cache
// The decisions list is populated by WebSocket 'decisions_initial' message on connection
// and updated by 'intraday_session_complete' message
export function useDecisions(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: intradayTradingKeys.decisionsList(page, limit),
    queryFn: () => {
      // This should never be called as enabled is false
      // Data is populated by WebSocket only
      throw new Error('Decisions list should be populated by WebSocket');
    },
    enabled: false, // Never fetch from API, only use WebSocket data
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook to get single decision
export function useDecision(id: number) {
  return useQuery({
    queryKey: intradayTradingKeys.decision(id),
    queryFn: () => intradayTradingAPI.getDecision(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// Hook to get orders
export function useOrders(market: string = 'US', filterStatus: number = 0) {
  return useQuery({
    queryKey: [...intradayTradingKeys.orders(), market, filterStatus],
    queryFn: () => intradayTradingAPI.getOrders(market, filterStatus),
    // Disable all auto-refetch, rely on manual refresh when switching market
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity, // Never consider stale, only update manually
  });
}

// Hook to cancel order
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, stockCode, marketType }: { orderId: string; stockCode: string; marketType: string }) =>
      intradayTradingAPI.cancelOrder(orderId, stockCode),
    onSuccess: (_, variables) => {
      // Invalidate orders query to refresh the list
      queryClient.invalidateQueries({ queryKey: [...intradayTradingKeys.orders(), variables.marketType] });
    },
  });
}
