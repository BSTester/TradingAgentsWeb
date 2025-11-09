'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthResponse } from '@/lib/types';
import { authAPI } from './apiClient';
import { queryClient } from './react-query';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string, captcha?: { id: string; answer: string }) => Promise<void>;
  loginWithEmailCode: (email: string, code: string, captcha?: { id: string; answer: string }) => Promise<void>;
  register: (username: string, email: string, password?: string, captcha?: { id: string; answer: string }, emailCode?: string) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查本地存储的token
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      setToken(savedToken);
      // 验证token并获取用户信息
      getCurrentUser(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const getCurrentUser = async (_authToken: string) => {
    try {
      const userData = await authAPI.getCurrentUser();
      setUser(userData);
    } catch {
      // Token可能已过期，清除本地存储
      localStorage.removeItem('access_token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string, captcha?: { id: string; answer: string }) => {
    try {
      const response: AuthResponse = await authAPI.login(username, password, captcha);
      
      // 立即设置用户状态和token
      setUser(response.user);
      setToken(response.access_token);
      localStorage.setItem('access_token', response.access_token);
      
      // 同时设置cookie供middleware使用
      document.cookie = `access_token=${response.access_token}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7天过期
      
      // 确保状态已经同步更新
      return Promise.resolve();
    } catch (error: any) {
      // 传递详细的错误信息
      throw new Error(error.message || '登录失败，请检查用户名和密码');
    }
  };

  const loginWithEmailCode = async (email: string, code: string, captcha?: { id: string; answer: string }) => {
    try {
      const response: AuthResponse = await authAPI.loginWithEmailCode(email, code, captcha);
      
      // 立即设置用户状态和token
      setUser(response.user);
      setToken(response.access_token);
      localStorage.setItem('access_token', response.access_token);
      
      // 同时设置cookie供middleware使用
      document.cookie = `access_token=${response.access_token}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7天过期
      
      // 确保状态已经同步更新
      return Promise.resolve();
    } catch (error: any) {
      // 传递详细的错误信息
      throw new Error(error.message || '登录失败，请检查验证码');
    }
  };

  const register = async (username: string, email: string, password?: string, captcha?: { id: string; answer: string }, emailCode?: string) => {
    try {
      const response: AuthResponse = await authAPI.register(username, email, password, captcha, emailCode);
      
      // 立即设置用户状态和token
      setUser(response.user);
      setToken(response.access_token);
      localStorage.setItem('access_token', response.access_token);
      
      // 同时设置cookie供middleware使用
      document.cookie = `access_token=${response.access_token}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7天过期
      
      // 确保状态已经同步更新
      return Promise.resolve();
    } catch (error: any) {
      // 传递详细的错误信息
      throw new Error(error.message || '注册失败，请稍后重试');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('access_token');
    // 同时清除cookie
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    
    // 清除所有 React Query 缓存，避免下一个用户看到上一个用户的数据
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        loginWithEmailCode,
        register,
        logout,
        token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}