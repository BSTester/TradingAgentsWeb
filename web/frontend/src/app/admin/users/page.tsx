'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '@/lib/api';
import type { AdminUser } from '@/lib/types';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => adminAPI.users({ page, limit, ...(search ? { search } : {}) }),
  });

  const toggleActive = useMutation({
    mutationFn: (u: AdminUser) => adminAPI.setUserActive(u.id, !u.is_active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const toggleRole = useMutation({
    mutationFn: (u: AdminUser) => adminAPI.setUserRole(u.id, u.role === 'admin' ? 'user' : 'admin'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users = (data?.data ?? []) as AdminUser[];
  const meta = data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / (meta.limit || limit))) : 1;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-responsive-h2 text-text-primary">用户管理</h1>
          <p className="mt-1 text-sm text-text-tertiary">注册用户列表，含用户名/邮箱/角色/状态/剩余次数。</p>
        </div>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="搜索用户名 / 邮箱"
          className="form-control w-56"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-dark-secondary" />)}
        </div>
      ) : error || users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-10 text-center text-sm text-text-tertiary">
          {(error as any)?.message || '暂无用户。'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dark-border">
          <div className="overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户名</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th className="text-right">剩余次数</th>
                  <th>状态</th>
                  <th>注册时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="num">{u.id}</td>
                    <td className="font-medium text-text-primary">{u.username}</td>
                    <td className="text-text-secondary">{u.email}</td>
                    <td>
                      <button
                        onClick={() => toggleRole.mutate(u)}
                        disabled={toggleRole.isPending}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          u.role === 'admin' ? 'bg-warning-500/20 text-warning-500' : 'bg-dark-tertiary text-text-secondary'
                        }`}
                      >
                        {u.role === 'admin' ? '管理员' : '普通用户'}
                      </button>
                    </td>
                    <td className="num text-right">{u.balance}</td>
                    <td>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${u.is_active ? 'bg-down/10 text-down' : 'bg-up/10 text-up'}`}>
                        {u.is_active ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="num text-text-tertiary">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <button
                        onClick={() => toggleActive.mutate(u)}
                        disabled={toggleActive.isPending}
                        className="rounded-lg border border-dark-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
                      >
                        {u.is_active ? '禁用' : '启用'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-dark-border px-4 py-3 text-sm">
              <span className="text-text-tertiary">共 {meta?.total} 条</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-dark-border px-3 py-1 text-text-secondary disabled:opacity-40">上一页</button>
                <span className="px-2 text-text-secondary">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-dark-border px-3 py-1 text-text-secondary disabled:opacity-40">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
