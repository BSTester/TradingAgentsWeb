'use client';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useToast, Toast } from '@/components/ui/Toast';

export default function RegisterPage() {
  const { toast, showToast, hideToast } = useToast();

  return (
    <>
      <AuthLayout
        title="创建账户"
        subtitle="注册 TradingAgentsWeb 开始智能交易分析"
        toggleText="已有账户？"
        toggleLink="/login"
        toggleLinkText="立即登录"
      >
        <RegisterForm onShowToast={showToast} />
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