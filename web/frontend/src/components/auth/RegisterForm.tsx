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
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);

  const { register } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const router = useRouter();



  // CaptchaImage 首次挂载内部自行拉取挑战，因此这里不主动请求
  useEffect(() => {}, []);

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      showToast('两次输入的密码不一致', 'error');
      return false;
    }

    if (formData.password.length < 6) {
      showToast('密码长度至少6位', 'error');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showToast('请输入有效的邮箱地址', 'error');
      return false;
    }

    // 服务端验证码：前端仅做必填校验，正确性由后端校验
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
      await register(formData.username, formData.email, formData.password, { id: captchaId, answer: captchaInput.trim() });
      showToast('注册成功！正在跳转...', 'success');
      
      // 等待认证状态同步后再跳转，使用replace避免历史堆叠
      await new Promise(resolve => setTimeout(resolve, 500));
      router.replace('/dashboard');
    } catch (error: any) {
      // 显示详细的错误信息
      const errorMessage = error.message || '注册失败，请稍后重试';
      showToast(errorMessage, 'error');
      setIsLoading(false); // 只有在错误时才设置loading为false
      // 注册失败时刷新验证码（通过重新挂载触发内部刷新）
      setCaptchaKey((k) => k + 1);
      setCaptchaInput('');
    }
    // 成功时不立即设置loading为false，让用户看到跳转过程
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
              placeholder="请输入密码（至少6位）"
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
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
            确认密码
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-lock text-gray-400" />
            </div>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="block w-full h-12 pl-10 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="请再次输入密码"
              required
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
  </>
  );
}