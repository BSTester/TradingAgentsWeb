'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth'
import { ToasterProvider } from '@/components/ui/ToasterProvider'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000, // 30秒后过期（WebSocket会主动更新）
        gcTime: 5 * 60 * 1000, // 5分钟后清理缓存
        refetchOnMount: false, // 不在挂载时自动获取（依赖 WebSocket）
        refetchOnWindowFocus: false, // 不在窗口聚焦时获取（依赖 WebSocket）
        refetchOnReconnect: true, // 重新连接时获取（网络恢复）
        retry: (failureCount, error: any) => {
          if (error?.response?.status === 401) {
            return false
          }
          return failureCount < 2
        },
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToasterProvider>
          {children}
        </ToasterProvider>
      </AuthProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  )
}