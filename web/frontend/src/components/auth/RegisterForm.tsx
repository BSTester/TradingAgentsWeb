'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useToast, Toast } from '@/components/ui/Toast';

import CaptchaImage from './CaptchaImage';

interface RegisterFormProps {
  // 移除了 onSwitchToLogin，现在由 AuthLayout 统一处理
  onSubmit?: (data: { username: string; email: string; password: string }) => void;
  externalLoading?: boolean;
  externalError?: string;
}

export function RegisterForm({ onSubmit: _onSubmit, externalLoading: _externalLoading, externalError: _externalError }: RegisterFormProps) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  
  // Email verification code state
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);
  
  // Password setup modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const { register } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const router = useRouter();

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendEmailCode = async () => {
    // Validate email first
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      showToast('请先输入有效的邮箱地址', 'warning');
      return;
    }
    
    // Validate CAPTCHA
    if (!captchaId || !captchaInput.trim()) {
      showToast('请输入图形验证码', 'warning');
      return;
    }
    
    setIsSendingCode(true);
    
    try {
      // Import authAPI from apiClient
      const { authAPI } = await import('@/lib/apiClient');
      
      // Use the register-specific endpoint
      await authAPI.sendEmailCodeForRegister(formData.email, {
        id: captchaId,
        answer: captchaInput.trim(),
      });
      
      showToast('验证码已发送到您的邮箱，请查收', 'success');
      setCountdown(60);
      // Keep captcha for reuse in registration submission (within TTL period)
    } catch (error: any) {
      showToast(error.message || '发送验证码失败，请稍后重试', 'error');
      // Only refresh captcha on error
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
    } finally {
      setIsSendingCode(false);
    }
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showToast('请输入有效的邮箱地址', 'error');
      return false;
    }

    // Validate email verification code
    if (!emailVerificationCode || emailVerificationCode.length !== 6) {
      showToast('请输入6位邮箱验证码', 'warning');
      return false;
    }

    // 服务端验证码：前端仅做必填校验，正确性由后端校验
    if (!captchaId || !captchaInput.trim()) {
      showToast('请输入图形验证码', 'warning');
      return false;
    }

    return true;
  };
  
  const handleSetPassword = async () => {
    if (password !== confirmPassword) {
      showToast('两次输入的密码不一致', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('密码长度至少6位', 'error');
      return;
    }
    
    setIsSettingPassword(true);
    
    try {
      // Call API to set password
      const { authAPI } = await import('@/lib/apiClient');
      await authAPI.setPassword(password);
      
      showToast('密码设置成功！', 'success');
      setShowPasswordModal(false);
      
      // Redirect to dashboard
      await new Promise(resolve => setTimeout(resolve, 500));
      router.replace('/dashboard');
    } catch (error: any) {
      showToast(error.message || '设置密码失败，请稍后重试', 'error');
    } finally {
      setIsSettingPassword(false);
    }
  };
  
  const handleSkipPassword = () => {
    setShowPasswordModal(false);
    showToast('您可以稍后在个人中心设置密码', 'info');
    router.replace('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Register without password (backend will generate a random one)
      await register(
        formData.username, 
        formData.email, 
        undefined, // No password provided
        { id: captchaId, answer: captchaInput.trim() },
        emailVerificationCode
      );
      
      showToast('注册成功！', 'success');
      setIsLoading(false);
      
      // Show password setup modal
      await new Promise(resolve => setTimeout(resolve, 500));
      setShowPasswordModal(true);
    } catch (error: any) {
      // 显示详细的错误信息
      const errorMessage = error.message || '注册失败，请稍后重试';
      showToast(errorMessage, 'error');
      setIsLoading(false);
      // 注册失败时刷新验证码（通过重新挂载触发内部刷新）
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
      setEmailVerificationCode(''); // Clear email code on error
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
            用户名
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-user text-gray-400" />
            </div>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="block w-full h-12 pl-10 pr-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="请输入用户名"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            邮箱地址
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-envelope text-gray-400" />
            </div>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="block w-full h-12 pl-10 pr-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="请输入邮箱地址"
              required
            />
          </div>
          <p className="mt-2 text-xs text-blue-600 flex items-start">
            <i className="fas fa-info-circle mr-1 mt-0.5 flex-shrink-0" />
            <span>请提供真实邮箱，用于接收分析报告、验证码登录等重要通知</span>
          </p>
        </div>

        <div>
          <label htmlFor="emailCode" className="block text-sm font-medium text-gray-700 mb-2">
            邮箱验证码
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              id="emailCode"
              value={emailVerificationCode}
              onChange={(e) => setEmailVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="flex-1 h-12 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-lg tracking-widest font-mono"
              placeholder="请输入6位验证码"
              maxLength={6}
              required
            />
            <button
              type="button"
              onClick={handleSendEmailCode}
              disabled={countdown > 0 || isSendingCode}
              className="px-4 h-12 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-sm"
            >
              {isSendingCode ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1" />
                  发送中
                </>
              ) : countdown > 0 ? (
                `${countdown}秒后重试`
              ) : (
                '发送验证码'
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            <i className="fas fa-shield-alt mr-1" />
            验证码将发送到您的邮箱，有效期5分钟
          </p>
        </div>

        {/* 图形验证码 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            图形验证码
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              placeholder="请输入右侧验证码"
              className="flex-1 h-12 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
            <div className="flex items-center gap-2">
              <CaptchaImage key={captchaKey} onIdChange={setCaptchaId} height={48} />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2" />
              注册中...
            </>
          ) : (
            <>
              <i className="fas fa-user-plus mr-2" />
              注册账户
            </>
          )}
        </button>
      </form>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* Password Setup Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-check text-green-600 text-2xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">注册成功！</h3>
              <p className="text-sm text-gray-600">
                为了账户安全，建议您设置登录密码
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="modal-password" className="block text-sm font-medium text-gray-700 mb-2">
                  设置密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-lock text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="modal-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full h-12 pl-10 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="请输入密码（至少6位）"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 hover:text-gray-600`} />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="modal-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                  确认密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-lock text-gray-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="modal-confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full h-12 pl-10 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="请再次输入密码"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 hover:text-gray-600`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleSkipPassword}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  稍后设置
                </button>
                <button
                  type="button"
                  onClick={handleSetPassword}
                  disabled={isSettingPassword || !password || !confirmPassword}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSettingPassword ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2" />
                      设置中...
                    </>
                  ) : (
                    '确认设置'
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                <i className="fas fa-info-circle mr-1" />
                您也可以稍后在个人中心设置或修改密码
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}