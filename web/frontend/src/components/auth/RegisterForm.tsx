'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useToast, Toast } from '@/components/ui/Toast';

import CaptchaImage from './CaptchaImage';

interface RegisterFormProps {
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
  
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const { register } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendEmailCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      showToast('请先输入有效的邮箱地址', 'warning');
      return;
    }
    
    if (!captchaId || !captchaInput.trim()) {
      showToast('请输入图形验证码', 'warning');
      return;
    }
    
    setIsSendingCode(true);
    
    try {
      const { authAPI } = await import('@/lib/apiClient');
      
      await authAPI.sendEmailCodeForRegister(formData.email, {
        id: captchaId,
        answer: captchaInput.trim(),
      });
      
      showToast('验证码已发送到您的邮箱，请查收', 'success');
      setCountdown(60);
    } catch (error: any) {
      showToast(error.message || '发送验证码失败，请稍后重试', 'error');
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

    if (!emailVerificationCode || emailVerificationCode.length !== 6) {
      showToast('请输入6位邮箱验证码', 'warning');
      return false;
    }

    if (!captchaId || !captchaInput.trim()) {
      showToast('请输入图形验证码', 'warning');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await register(
        formData.username, 
        formData.email, 
        undefined,
        { id: captchaId, answer: captchaInput.trim() },
        emailVerificationCode
      );
      
      showToast('注册成功！正在跳转...', 'success');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      router.replace('/dashboard?setup_password=true');
    } catch (error: any) {
      const errorMessage = error.message || '注册失败，请稍后重试';
      showToast(errorMessage, 'error');
      setIsLoading(false);
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
      setEmailVerificationCode('');
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
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="block w-full h-12 pl-10 pr-3 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
              placeholder="请输入邮箱地址"
              required
            />
          </div>
          <p className="mt-2 text-xs text-accent-primary flex items-start">
            <i className="fas fa-info-circle mr-1 mt-0.5 flex-shrink-0" />
            <span>请提供真实邮箱，用于接收分析报告、验证码登录等重要通知</span>
          </p>
        </div>

        <div>
          <label htmlFor="emailCode" className="block text-sm font-medium text-text-secondary mb-2">
            邮箱验证码
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              id="emailCode"
              value={emailVerificationCode}
              onChange={(e) => setEmailVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="flex-1 h-12 px-3 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all text-center text-lg tracking-widest font-mono"
              placeholder="请输入6位验证码"
              maxLength={6}
              required
            />
            <button
              type="button"
              onClick={handleSendEmailCode}
              disabled={countdown > 0 || isSendingCode}
              className="px-4 h-12 bg-gradient-to-r from-accent-secondary to-accent-primary text-white rounded-lg hover:shadow-glow-cyan focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap text-sm"
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
          <p className="mt-2 text-xs text-text-tertiary">
            <i className="fas fa-shield-alt mr-1" />
            验证码将发送到您的邮箱，有效期5分钟
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            图形验证码
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              placeholder="请输入右侧验证码"
              className="flex-1 h-12 px-3 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
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
          className="w-full bg-gradient-to-r from-success-500 to-success-600 text-white py-3 px-4 rounded-lg hover:shadow-glow-cyan hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2 focus:ring-offset-dark-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
    </>
  );
}
