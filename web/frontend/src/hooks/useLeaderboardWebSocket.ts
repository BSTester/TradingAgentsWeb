'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { buildApiUrl } from '@/utils/api'

// Get base URL for WebSocket connections
const getWebSocketUrl = (endpoint: string): string => {
  // Use the API base URL from environment or window location
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const protocol = apiBaseUrl.startsWith('https') ? 'wss:' : 'ws:'
  const host = apiBaseUrl.replace(/^https?:\/\//, '')
  return `${protocol}//${host}${endpoint}`
}

// WebSocket更新频率：5分钟
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface LeaderboardUser {
  user_id: number
  username: string
  market_type: string
  total_assets: number
  latest_snapshot_date: string
}

interface LeaderboardUpdate {
  type: 'leaderboard_update' | 'user_update' | 'initial_data'
  timestamp: string
  data?: {
    users?: LeaderboardUser[]
    user?: LeaderboardUser
  }
}

interface UseLeaderboardWebSocketOptions {
  token?: string
  market?: string
  reconnectAttempts?: number
  reconnectInterval?: number
}

interface UseLeaderboardWebSocketReturn {
  isConnected: boolean
  users: LeaderboardUser[]
  error: string | null
  lastUpdate: string | null
  connect: () => void
  disconnect: () => void
}

export function useLeaderboardWebSocket(options: UseLeaderboardWebSocketOptions = {}): UseLeaderboardWebSocketReturn {
  const { token, market, reconnectAttempts = 5, reconnectInterval = 3000 } = options

  const [isConnected, setIsConnected] = useState(false)
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const updateRequestIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    // Clean up existing connection first
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        console.log('✅ WebSocket already connected')
        return
      }
      
      // Close any existing connection that's not open
      try {
        if (wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close()
        }
      } catch (err) {
        console.warn('⚠️ Error closing existing WebSocket:', err)
      }
      wsRef.current = null
    }

    try {
      // Build WebSocket URL for leaderboard
      const wsUrl = getWebSocketUrl('/ws/leaderboard')
      console.log('🔌 Connecting to WebSocket:', wsUrl)

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close()
          setError('连接超时 - 无法连接到服务器，请检查后端服务是否运行')
        }
      }, 10000) // 10 seconds timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout)
        console.log('✅ Leaderboard WebSocket connected successfully')
        setIsConnected(true)
        setError(null)
        reconnectCountRef.current = 0

        // Start heartbeat (every 30 seconds to keep connection alive)
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)

        // Request initial data immediately
        console.log('📤 Requesting initial leaderboard data...')
        ws.send(JSON.stringify({ type: 'get_initial_data' }))

        // Request data updates every 5 minutes
        updateRequestIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log('🔄 Requesting leaderboard data update (5-minute interval)')
            ws.send(JSON.stringify({ type: 'get_initial_data' }))
          }
        }, UPDATE_INTERVAL)
      }

      ws.onmessage = (event) => {
        try {
          const message: LeaderboardUpdate = JSON.parse(event.data)

          switch (message.type) {
            case 'initial_data':
              if (message.data?.users) {
                console.log(`📊 Received initial data: ${message.data.users.length} users`)
                setUsers(message.data.users)
                setLastUpdate(message.timestamp)
              }
              break
            case 'leaderboard_update':
              if (message.data?.users) {
                console.log(`🔄 Leaderboard update: ${message.data.users.length} users`)
                setUsers(message.data.users)
                setLastUpdate(message.timestamp)
              }
              break
            case 'user_update':
              if (message.data?.user) {
                console.log(`👤 User update: ${message.data.user.username}`)
                setUsers(prev => {
                  const updatedUsers = [...prev]
                  const userIndex = updatedUsers.findIndex(u => u.user_id === message.data!.user.user_id)
                  if (userIndex >= 0) {
                    updatedUsers[userIndex] = message.data!.user
                  } else {
                    updatedUsers.push(message.data!.user)
                  }
                  // Sort by total_assets descending
                  updatedUsers.sort((a, b) => b.total_assets - a.total_assets)
                  return updatedUsers
                })
                setLastUpdate(message.timestamp)
              }
              break
            case 'pong':
              // Heartbeat response
              break
            case 'error':
              console.error('❌ Server error:', message.data?.message)
              setError(message.data?.message || 'Leaderboard WebSocket error')
              break
            default:
              console.log('⚠️ Unknown leaderboard message type:', message.type)
          }
        } catch (err) {
          console.error('❌ Error parsing leaderboard WebSocket message:', err)
        }
      }

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout)
        
        // Only process close event if this is still the current WebSocket
        if (wsRef.current === ws) {
          console.log(`🔌 Leaderboard WebSocket closed: code=${event.code}, reason=${event.reason || 'No reason'}`)
          setIsConnected(false)
          wsRef.current = null

          // Clear intervals
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current)
            heartbeatIntervalRef.current = null
          }
          if (updateRequestIntervalRef.current) {
            clearInterval(updateRequestIntervalRef.current)
            updateRequestIntervalRef.current = null
          }

          // Attempt to reconnect if not manually closed
          if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
            reconnectCountRef.current++
            console.log(`🔄 Attempting to reconnect leaderboard (${reconnectCountRef.current}/${reconnectAttempts})...`)
            setError(`连接断开，正在重连 (${reconnectCountRef.current}/${reconnectAttempts})...`)

            reconnectTimeoutRef.current = setTimeout(() => {
              connect()
            }, reconnectInterval)
          } else if (reconnectCountRef.current >= reconnectAttempts) {
            console.error('❌ Max reconnection attempts reached')
            setError('连接失败，已达到最大重连次数，请刷新页面重试')
          }
        } else {
          console.log('⚠️ Ignoring close event from old WebSocket connection')
        }
      }

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout)
        
        // Only log error if this is still the current WebSocket
        if (wsRef.current === ws) {
          console.error('❌ Leaderboard WebSocket error:', error)
          console.error('📍 WebSocket URL:', wsUrl)
          console.error('📊 WebSocket state:', ws.readyState, '(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)')
          console.error('🔧 API Base URL:', process.env.NEXT_PUBLIC_API_BASE_URL)
          console.error('🌐 Window origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A')

          // 提供更详细的错误信息
          let errorMessage = 'WebSocket连接失败';
          
          if (ws.readyState === WebSocket.CONNECTING) {
            errorMessage = '正在连接WebSocket服务器...';
          } else if (ws.readyState === WebSocket.CLOSED) {
            errorMessage = 'WebSocket连接已关闭，尝试重新连接...';
          } else if (ws.readyState === WebSocket.CLOSING) {
            errorMessage = 'WebSocket连接正在关闭...';
          }
          
          setError(errorMessage)
        } else {
          console.log('⚠️ Ignoring error from old WebSocket connection')
        }
      }

    } catch (err) {
      console.error('Failed to create leaderboard WebSocket connection:', err)
      setError('Failed to create connection')
    }
  }, [token, reconnectAttempts, reconnectInterval])

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting leaderboard WebSocket...')
    
    // Clear all timers
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }

    if (updateRequestIntervalRef.current) {
      clearInterval(updateRequestIntervalRef.current)
      updateRequestIntervalRef.current = null
    }

    // Close WebSocket connection
    if (wsRef.current) {
      try {
        // Only close if not already closed
        if (wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close(1000, 'Manual disconnect')
        }
      } catch (err) {
        console.warn('⚠️ Error closing WebSocket:', err)
      }
      wsRef.current = null
    }

    setIsConnected(false)
    setError(null)
    reconnectCountRef.current = 0
    
    console.log('✅ Leaderboard WebSocket disconnected')
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    users,
    error,
    lastUpdate,
    connect,
    disconnect,
  }
}