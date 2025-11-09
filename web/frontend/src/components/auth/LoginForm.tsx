'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useToast, Toast } from '@/components/ui/Toast';

import CaptchaImage from './CaptchaImage';

export function LoginForm() {
  // Login mode: 'password' or 'email'
  const [loginMode, setLoginMode] = useState<'password' | 'email'>('password');
  
  // Password login state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  
  // Email code login state
  const [emailForCode, setEmailForCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);
  
  // Common state
  const [isLoading, setIsLoading] = useState(false);
  const [captchaId, setCaptchaId] = useState<string>('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);

  const { login, loginWithEmailCode } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const router = useRouter();
  
  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);





  const handleSendCode = async () => {
    // Validate email
    if (!emailForCode || !emailForCode.includes('@')) {
      showToast('请输入有效的邮箱地址', 'warning');
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
      
      await authAPI.sendEmailCode(emailForCode, {
        id: captchaId,
        answer: captchaInput.trim(),
      });
      
      showToast('验证码已发送到您的邮箱', 'success');
      setCountdown(60); // Start 60-second countdown
      // Keep captcha for reuse in login submission (within TTL period)
    } catch (error: any) {
      showToast(error.message || '发送验证码失败，请稍后重试', 'error');
      // Only refresh captcha on error
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaId || !captchaInput.trim()) {
      showToast('请输入图形验证码', 'warning');
      return;
    }

    setIsLoading(true);

    try {
      await login(formData.username, formData.password, { id: captchaId, answer: captchaInput.trim() });
      showToast('登录成功！正在跳转...', 'success');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      router.replace('/dashboard');
    } catch (error: any) {
      const errorMessage = error.message || '登录失败，请检查用户名和密码';
      showToast(errorMessage, 'error');
      setIsLoading(false);
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
    }
  };
  
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    if (!emailForCode || !emailForCode.includes('@')) {
      showToast('请输入有效的邮箱地址', 'warning');
      return;
    }
    
    // Validate code
    if (!verificationCode || verificationCode.length !== 6) {
      showToast('请输入6位验证码', 'warning');
      return;
    }
    
    // Validate CAPTCHA
    if (!captchaId || !captchaInput.trim()) {
      showToast('请输入图形验证码', 'warning');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await loginWithEmailCode(emailForCode, verificationCode, { id: captchaId, answer: captchaInput.trim() });
      showToast('登录成功！正在跳转...', 'success');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      router.replace('/dashboard');
    } catch (error: any) {
      const errorMessage = error.message || '登录失败，请检查验证码';
      showToast(errorMessage, 'error');
      setIsLoading(false);
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
      setVerificationCode(''); // Clear verification code on error
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
      {/* Login Mode Toggle */}
      <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setLoginMode('password')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            loginMode === 'password'
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <i className="fas fa-key mr-2" />
          密码登录
        </button>
        <button
          type="button"
          onClick={() => setLoginMode('email')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            loginMode === 'email'
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <i className="fas fa-envelope mr-2" />
          邮箱验证码
        </button>
      </div>

      {/* Password Login Form */}
      {loginMode === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              密码
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-lock text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="block w-full h-12 pl-10 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="请输入密码"
                required
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
                登录中...
              </>
            ) : (
              <>
                <i className="fas fa-user-check mr-2" />
                登录账户
              </>
            )}
          </button>
        </form>
      )}

      {/* Email Code Login Form */}
      {loginMode === 'email' && (
        <form onSubmit={handleEmailLogin} className="space-y-6">
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
                value={emailForCode}
                onChange={(e) => setEmailForCode(e.target.value)}
                className="block w-full h-12 pl-10 pr-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="请输入注册邮箱"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              邮箱验证码
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                id="code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="flex-1 h-12 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-lg tracking-widest font-mono"
                placeholder="请输入6位验证码"
                maxLength={6}
                required
              />
              <button
                type="button"
                onClick={handleSendCode}
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
          </div>

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
                登录中...
              </>
            ) : (
              <>
                <i className="fas fa-user-check mr-2" />
                登录账户
              </>
            )}
          </button>
        </form>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </>
  );
}