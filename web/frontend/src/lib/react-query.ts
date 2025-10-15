// React Query configuration
import { QueryClient } from '@tanstack/react-query';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: unknown) => {
        // Don't retry on 4xx errors except 408, 429
        const errorResponse = (error as any)?.response;
        if (errorResponse?.status >= 400 && errorResponse?.status < 500) {
          if (errorResponse?.status === 408 || errorResponse?.status === 429) {
            return failureCount < 2;
          }
          return false;
        }
        // Retry on network errors and 5xx errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
    },
  },
});

// Query keys factory
export const queryKeys = {
  // Auth
  auth: {
    me: ['auth', 'me'] as const,
  },
  // Analysis
  analysis: {
    all: ['analysis'] as const,
    list: (params?: Record<string, unknown>) => ['analysis', 'list', params] as const,
    detail: (id: string) => ['analysis', 'detail', id] as const,
    status: (id: string) => ['analysis', 'status', id] as const,
    results: (id: string) => ['analysis', 'results', id] as const,
    markdown: (id: string) => ['analysis', 'markdown', id] as const,
  },
  // Config
  config: {
    all: ['config'] as const,
    providers: ['config', 'providers'] as const,
    analysts: ['config', 'analysts'] as const,
  },
} as const;