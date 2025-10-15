'use client';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <AuthLayout
      title="创建账户"
      subtitle="注册 TradingAgents 开始智能交易分析"
      toggleText="已有账户？"
      toggleLink="/login"
      toggleLinkText="立即登录"
    >
      <RegisterForm />
    </AuthLayout>
  );
}