'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

import CaptchaImage from './CaptchaImage';

interface LoginFormProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function LoginForm({ onShowToast }: LoginFormProps) {
  const [loginMode, setLoginMode] = useState<'password' | 'email'>('password');
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  
  const [emailForCode, setEmailForCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [captchaId, setCaptchaId] = useState<string>('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);

  const { login, loginWithEmailCode } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    if (!emailForCode || !emailForCode.includes('@')) {
      onShowToast('请输入有效的邮箱地址', 'warning');
      return;
    }
    
    if (!captchaId || !captchaInput.trim()) {
      onShowToast('请输入图形验证码', 'warning');
      return;
    }
    
    setIsSendingCode(true);
    
    try {
      const { authAPI } = await import('@/lib/apiClient');
      
      await authAPI.sendEmailCode(emailForCode, {
        id: captchaId,
        answer: captchaInput.trim(),
      });
      
      onShowToast('验证码已发送到您的邮箱', 'success');
      setCountdown(60);
    } catch (error: any) {
      onShowToast(error.message || '发送验证码失败，请稍后重试', 'error');
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaId || !captchaInput.trim()) {
      onShowToast('请输入图形验证码', 'warning');
      return;
    }

    setIsLoading(true);

    try {
      await login(formData.username, formData.password, { id: captchaId, answer: captchaInput.trim() });
      onShowToast('登录成功！正在跳转...', 'success');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      router.replace('/');
    } catch (error: any) {
      const errorMessage = error.message || '登录失败，请检查用户名和密码';
      onShowToast(errorMessage, 'error');
      setIsLoading(false);
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
    }
  };
  
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailForCode || !emailForCode.includes('@')) {
      onShowToast('请输入有效的邮箱地址', 'warning');
      return;
    }
    
    if (!verificationCode || verificationCode.length !== 6) {
      onShowToast('请输入6位验证码', 'warning');
      return;
    }
    
    if (!captchaId || !captchaInput.trim()) {
      onShowToast('请输入图形验证码', 'warning');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await loginWithEmailCode(emailForCode, verificationCode, { id: captchaId, answer: captchaInput.trim() });
      onShowToast('登录成功！正在跳转...', 'success');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      router.replace('/');
    } catch (error: any) {
      const errorMessage = error.message || '登录失败，请检查验证码';
      onShowToast(errorMessage, 'error');
      setIsLoading(false);
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
      setVerificationCode('');
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
      <div className="flex mb-6 bg-dark-tertiary rounded-lg p-1">
        <button
          type="button"
          onClick={() => setLoginMode('password')}
          className={`flex-1 py-2 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-all ${
            loginMode === 'password'
              ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <i className="fas fa-key mr-1 sm:mr-2" />
          <span className="hidden xs:inline">密码登录</span>
          <span className="xs:hidden">密码</span>
        </button>
        <button
          type="button"
          onClick={() => setLoginMode('email')}
          className={`flex-1 py-2 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-all ${
            loginMode === 'email'
              ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <i className="fas fa-envelope mr-1 sm:mr-2" />
          <span className="hidden xs:inline">邮箱验证码</span>
          <span className="xs:hidden">验证码</span>
        </button>
      </div>

      {/* Password Login Form */}
      {loginMode === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-2">
              用户名
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-user text-text-tertiary" />
              </div>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="block w-full h-12 pl-10 pr-3 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
                placeholder="请输入用户名"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
              密码
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-lock text-text-tertiary" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="block w-full h-12 pl-10 pr-12 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
                placeholder="请输入密码"
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-text-tertiary hover:text-accent-primary transition-colors`} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              图形验证码
            </label>
            <div className="flex flex-row items-center gap-3">
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="请输入验证码"
                className="flex-1 min-w-0 h-12 px-4 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
                required
              />
              <div className="flex items-center flex-shrink-0 max-w-[140px]">
                <CaptchaImage key={captchaKey} onIdChange={setCaptchaId} height={48} />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-accent-primary to-accent-secondary text-white py-3 px-4 rounded-lg hover:shadow-glow-cyan hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-dark-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
              邮箱地址
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-envelope text-text-tertiary" />
              </div>
              <input
                type="email"
                id="email"
                value={emailForCode}
                onChange={(e) => setEmailForCode(e.target.value)}
                className="block w-full h-12 pl-10 pr-3 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
                placeholder="请输入注册邮箱"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-text-secondary mb-2">
              邮箱验证码
            </label>
            <div className="flex flex-row items-center gap-3">
              <input
                type="text"
                id="code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-2/3 h-12 px-4 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all text-center tracking-widest font-mono"
                placeholder="6位验证码"
                maxLength={6}
                required
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={countdown > 0 || isSendingCode}
                className="w-1/3 h-12 bg-gradient-to-r from-accent-secondary to-accent-primary text-white rounded-lg hover:shadow-glow-cyan focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap text-sm"
              >
                {isSendingCode ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-1" />
                    <span className="hidden xs:inline">发送中</span>
                    <span className="xs:hidden">发送中</span>
                  </>
                ) : countdown > 0 ? (
                  <span className="text-xs xs:text-sm">{countdown}秒</span>
                ) : (
                  <>
                    <span className="hidden xs:inline">发送验证码</span>
                    <span className="xs:hidden">发送</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              图形验证码
            </label>
            <div className="flex flex-row items-center gap-3">
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="请输入验证码"
                className="flex-1 min-w-0 h-12 px-4 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
                required
              />
              <div className="flex items-center flex-shrink-0 max-w-[140px]">
                <CaptchaImage key={captchaKey} onIdChange={setCaptchaId} height={48} />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-accent-primary to-accent-secondary text-white py-3 px-4 rounded-lg hover:shadow-glow-cyan hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-dark-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
    </>
  );
}


