'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AppNavbar } from '@/components/common/AppNavbar';
import { useToast, Toast } from '@/components/ui/Toast';
import { Footer } from '@/components/common/Footer';
import { AISettingsCard } from '@/components/profile/AISettingsCard';

export default function ProfilePage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleSetPassword = async () => {
    if (password !== confirmPassword) {
      showToast('两次输入的密码不一致', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('密码长度至少6位', 'error');
      return;
    }

    // If user has set password, old password is required
    if (user?.has_set_password && !oldPassword) {
      showToast('请输入旧密码', 'error');
      return;
    }
    
    setIsSettingPassword(true);
    
    try {
      const { authAPI } = await import('@/lib/apiClient');
      await authAPI.setPassword(password, user?.has_set_password ? oldPassword : undefined);
      
      showToast('密码设置成功！', 'success');
      setShowPasswordModal(false);
      setOldPassword('');
      setPassword('');
      setConfirmPassword('');
      
      // Refresh user data to update has_set_password flag
      window.location.reload();
    } catch (error: any) {
      showToast(error.message || '设置密码失败，请稍后重试', 'error');
    } finally {
      setIsSettingPassword(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-accent-primary mb-4" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      <AppNavbar user={user} onLogout={logout} />
      
      <div className="flex-1 py-8 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-responsive-h2 text-text-primary">
              <i className="fas fa-user-circle mr-3" />
              个人中心
            </h1>
            <p className="mt-2 text-responsive-body text-text-secondary">管理您的账户信息和设置</p>
          </div>

          {/* User Info Card */}
          <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6 mb-6">
            <h2 className="text-responsive-h3 text-text-primary mb-4">
              <i className="fas fa-id-card mr-2" />
              账户信息
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-dark-border">
                <div className="flex items-center">
                  <i className="fas fa-user text-text-muted w-6 mr-3" />
                  <span className="text-text-secondary">用户名</span>
                </div>
                <span className="font-medium text-text-primary">{user.username}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-dark-border">
                <div className="flex items-center">
                  <i className="fas fa-envelope text-text-muted w-6 mr-3" />
                  <span className="text-text-secondary">邮箱地址</span>
                </div>
                <span className="font-medium text-text-primary">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-dark-border">
                <div className="flex items-center">
                  <i className="fas fa-shield-alt text-text-muted w-6 mr-3" />
                  <span className="text-text-secondary">账户角色</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  user.role === 'admin' 
                    ? 'bg-warning-500/20 text-warning-500' 
                    : 'bg-accent-primary/20 text-accent-primary'
                }`}>
                  {user.role === 'admin' ? '管理员' : '普通用户'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center">
                  <i className="fas fa-calendar text-text-muted w-6 mr-3" />
                  <span className="text-text-secondary">注册时间</span>
                </div>
                <span className="font-medium text-text-primary">
                  {new Date(user.created_at).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>

          {/* AI Settings Card */}
          <AISettingsCard />

          {/* Password Settings Card */}
          <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-responsive-h3 text-text-primary mb-2">
                  <i className="fas fa-lock mr-2" />
                  密码设置
                </h2>
                <p className="text-text-secondary">
                  {user.has_set_password 
                    ? '为了账户安全，建议定期更新您的登录密码' 
                    : '您还未设置密码，建议设置密码以保护账户安全'}
                </p>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-colors whitespace-nowrap ml-6"
              >
                <i className="fas fa-key mr-2" />
                {user.has_set_password ? '修改密码' : '设置密码'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password Setup Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-secondary rounded-lg shadow-xl border border-dark-border max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-responsive-h3 text-text-primary">
                <i className="fas fa-lock mr-2" />
                {user.has_set_password ? '修改密码' : '设置密码'}
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setOldPassword('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-text-muted hover:text-text-secondary"
              >
                <i className="fas fa-times text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Old Password Field - only shown if user has set password */}
              {user.has_set_password && (
                <div>
                  <label htmlFor="old-password" className="block text-sm font-medium text-text-primary mb-2">
                    旧密码
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-lock text-text-muted" />
                    </div>
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      id="old-password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="block w-full h-12 pl-10 pr-12 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                      placeholder="请输入旧密码"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                    >
                      <i className={`fas ${showOldPassword ? 'fa-eye-slash' : 'fa-eye'} text-text-muted hover:text-text-secondary`} />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-2">
                  新密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-lock text-text-muted" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full h-12 pl-10 pr-12 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                    placeholder="请输入新密码（至少6位）"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-text-muted hover:text-text-secondary`} />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-text-primary mb-2">
                  确认密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-lock text-text-muted" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full h-12 pl-10 pr-12 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                    placeholder="请再次输入新密码"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-text-muted hover:text-text-secondary`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setOldPassword('');
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 px-4 py-3 border border-dark-border text-text-primary bg-dark-tertiary rounded-lg hover:bg-dark-primary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSetPassword}
                  disabled={isSettingPassword || !password || !confirmPassword || (user.has_set_password && !oldPassword)}
                  className="flex-1 px-4 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            </div>
          </div>
        </div>
      )}

      <Footer />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
