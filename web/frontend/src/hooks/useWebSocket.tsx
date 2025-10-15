'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { LogEntry, WebSocketMessage } from '../types'

interface UseWebSocketOptions {
  url: string
  token?: string
  reconnectAttempts?: number
  reconnectInterval?: number
}

interface UseWebSocketReturn {
  isConnected: boolean
  logs: LogEntry[]
  error: string | null
  connect: () => void
  disconnect: () => void
  clearLogs: () => void
  sendMessage: (message: any) => void
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, token, reconnectAttempts = 5, reconnectInterval = 3000 } = options
  
  const [isConnected, setIsConnected] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const wsUrl = token ? `${url}?token=${token}` : url
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setError(null)
        reconnectCountRef.current = 0

        // Send authentication if token exists
        if (token) {
          ws.send(JSON.stringify({
            type: 'auth',
            token: token
          }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          
          switch (message.type) {
            case 'log':
              if (message.data) {
                setLogs(prev => [...prev, message.data as LogEntry])
              }
              break
            case 'ping':
              // Respond to ping with pong
              ws.send(JSON.stringify({ type: 'pong' }))
              break
            case 'error':
              setError(message.data?.message || 'WebSocket error')
              break
            default:
              console.log('Unknown message type:', message.type)
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        setIsConnected(false)
        wsRef.current = null

        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++
          console.log(`Attempting to reconnect (${reconnectCountRef.current}/${reconnectAttempts})...`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setError('Connection error')
      }

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      setError('Failed to create connection')
    }
  }, [url, token, reconnectAttempts, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }
    
    setIsConnected(false)
    reconnectCountRef.current = 0
  }, [])

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    logs,
    error,
    connect,
    disconnect,
    clearLogs,
    sendMessage,
  }
}