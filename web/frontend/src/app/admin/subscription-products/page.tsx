'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '@/lib/api';
import type { AdminSubscriptionPlan } from '@/lib/types';

const EMPTY = { name: '', credits: 10, price: 79, description: '', is_active: true };

export default function AdminSubscriptionProductsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscription-products'],
    queryFn: () => adminAPI.subscriptionProducts(),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        credits: form.credits,
        price: form.price,
        ...(form.description ? { description: form.description } : {}),
        is_active: form.is_active,
      };
      if (editingId != null) return adminAPI.updateSubscriptionProduct(editingId, payload);
      return adminAPI.createSubscriptionProduct(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-products'] });
      setForm({ ...EMPTY });
      setEditingId(null);
    },
  });

  const remove = useMutation({
    mutationFn: (planId: number) => adminAPI.deleteSubscriptionProduct(planId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-subscription-products'] }),
  });

  const startEdit = (p: AdminSubscriptionPlan) => {
    setEditingId(p.id);
    setForm({ name: p.name, credits: p.credits, price: p.price, description: p.description ?? '', is_active: p.is_active });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...EMPTY });
  };

  const products = (data?.data ?? []) as AdminSubscriptionPlan[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-responsive-h2 text-text-primary">订阅商品管理</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          新增 / 修改订阅套餐（次数、价格）。修改后对后续购买生效。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Create / Edit form */}
        <div className="rounded-2xl border border-dark-border bg-dark-secondary p-5">
          <h2 className="mb-4 text-responsive-h4 text-text-primary">
            {editingId != null ? `编辑套餐 #${editingId}` : '新增套餐'}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="form-label">名称</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="form-control mt-1" placeholder="10 次套餐" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">次数</label>
                <input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: +e.target.value })} className="form-control mt-1" />
              </div>
              <div>
                <label className="form-label">价格 (¥)</label>
                <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} className="form-control mt-1" />
              </div>
            </div>
            <div>
              <label className="form-label">描述</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="form-control mt-1" />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              启用（上架）
            </label>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.name}
              className="w-full rounded-lg bg-accent-primary py-2.5 text-sm font-semibold text-white hover:bg-accent-secondary disabled:opacity-60"
            >
              {save.isPending ? '保存中…' : editingId != null ? '保存修改' : '新增套餐'}
            </button>
            {editingId != null && (
              <button
                onClick={cancelEdit}
                className="w-full rounded-lg border border-dark-border py-2.5 text-sm text-text-secondary hover:text-text-primary"
              >
                取消编辑
              </button>
            )}
            {save.isError && <p className="text-sm text-danger-400">{(save.error as any)?.message ?? '保存失败'}</p>}
          </div>
        </div>

        {/* List with edit */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-dark-secondary" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-10 text-center text-sm text-text-tertiary">暂无订阅商品。</div>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-secondary p-4">
                  <div>
                    <p className="font-medium text-text-primary">{p.name}</p>
                    <p className="num text-xs text-text-tertiary">{p.credits} 次 · ¥{p.price.toFixed(0)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {p.is_active ? (
                      <span className="rounded bg-down/10 px-2 py-1 text-down">上架中</span>
                    ) : (
                      <span className="rounded bg-dark-tertiary px-2 py-1 text-text-tertiary">已停用</span>
                    )}
                    <button
                      onClick={() => startEdit(p)}
                      className="rounded-lg border border-dark-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`确定删除套餐「${p.name}」吗？`)) remove.mutate(p.id);
                      }}
                      disabled={remove.isPending}
                      className="rounded-lg border border-danger-500/40 px-3 py-1.5 text-xs font-medium text-danger-400 hover:text-danger-500 disabled:opacity-60"
                      title="删除"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
