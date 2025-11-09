'use client';

import { useState } from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useToast, Toast } from '@/components/ui/Toast';

export default function LoginPage() {
  const [isLoginMode] = useState(true);
  const { toast, showToast, hideToast } = useToast();

  return (
    <>
      <AuthLayout
        title={isLoginMode ? "欢迎回来" : "创建账户"}
        subtitle={isLoginMode ? "登录到 TradingAgentsWeb 系统" : "注册 TradingAgentsWeb 系统"}
        toggleText={isLoginMode ? "还没有账户？" : "已有账户？"}
        toggleLink={isLoginMode ? "/register" : "/login"}
        toggleLinkText={isLoginMode ? "立即注册" : "立即登录"}
      >
        {isLoginMode ? (
          <LoginForm onShowToast={showToast} />
        ) : (
          <RegisterForm onShowToast={showToast} />
        )}
      </AuthLayout>
      
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </>
  );
}