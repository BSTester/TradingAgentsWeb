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
        staleTime: 0, // 禁用缓存，始终获取最新数据
        cacheTime: 0, // 不缓存数据
        refetchOnMount: true, // 组件挂载时重新获取
        refetchOnWindowFocus: true, // 窗口聚焦时重新获取
        refetchOnReconnect: true, // 重新连接时重新获取
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