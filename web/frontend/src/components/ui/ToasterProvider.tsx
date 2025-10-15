'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { Toast } from './Toast'

interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToastContext() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToasterProvider')
  }
  return context
}

interface ToasterProviderProps {
  children: ReactNode
}

export function ToasterProvider({ children }: ToasterProviderProps) {
  const [toast, setToast] = useState({
    message: '',
    type: 'info' as 'success' | 'error' | 'info' | 'warning',
    isVisible: false,
  })

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({
      message,
      type,
      isVisible: true,
    })
  }

  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      isVisible: false,
    }))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  )
}
