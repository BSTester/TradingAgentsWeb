'use client';

import { useState } from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function LoginPage() {
  const [isLoginMode] = useState(true);

  return (
    <AuthLayout
      title={isLoginMode ? "欢迎回来" : "创建账户"}
      subtitle={isLoginMode ? "登录到 TradingAgents 系统" : "注册 TradingAgents 系统"}
      toggleText={isLoginMode ? "还没有账户？" : "已有账户？"}
      toggleLink={isLoginMode ? "/register" : "/login"}
      toggleLinkText={isLoginMode ? "立即注册" : "立即登录"}
    >
      {isLoginMode ? (
        <LoginForm />
      ) : (
        <RegisterForm />
      )}
    </AuthLayout>
  );
}