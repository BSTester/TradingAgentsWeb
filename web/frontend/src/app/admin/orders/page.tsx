'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '@/lib/api';
import type { AdminOrder } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  purchase: '购买',
  consume: '消耗',
  refund: '退款',
  grant: '赠送',
};

const TYPE_BADGE: Record<string, string> = {
  purchase: 'bg-accent-primary/15 text-accent-primary',
  consume: 'bg-warning-500/15 text-warning-500',
  refund: 'bg-danger-500/15 text-danger-500',
  grant: 'bg-down/15 text-down',
};

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('all');
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', page, type],
    queryFn: () => adminAPI.orders({ page, limit, ...(type !== 'all' ? { type } : {}) }),
  });

  const orders = (data?.data ?? []) as AdminOrder[];
  const meta = data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / (meta.limit || limit))) : 1;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-responsive-h2 text-text-primary">订单列表</h1>
          <p className="mt-1 text-sm text-text-tertiary">所有用户的订阅/分析次数流水。</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-dark-border bg-dark-secondary p-1">
          {['all', 'purchase', 'consume', 'refund', 'grant'].map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                type === t ? 'bg-accent-primary text-white' : 'text-text-secondary'
              }`}
            >
              {t === 'all' ? '全部' : TYPE_LABEL[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-dark-secondary" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-10 text-center text-sm text-text-tertiary">
          暂无订单记录。
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dark-border">
          <div className="overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户</th>
                  <th>类型</th>
                  <th>商品/描述</th>
                  <th className="text-right">增减</th>
                  <th className="text-right">剩余</th>
                  <th>状态</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="num">{o.id}</td>
                    <td className="font-medium text-text-primary">{o.username}</td>
                    <td>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[o.type] ?? 'bg-dark-tertiary text-text-secondary'}`}>
                        {TYPE_LABEL[o.type] ?? o.type}
                      </span>
                    </td>
                    <td className="text-text-secondary">{o.description ?? o.plan_name ?? '—'}</td>
                    <td className={`num text-right ${o.amount >= 0 ? 'text-down' : 'text-up'}`}>
                      {o.amount >= 0 ? '+' : ''}{o.amount}
                    </td>
                    <td className="num text-right">{o.balance}</td>
                    <td>{o.status}</td>
                    <td className="num text-text-tertiary">{o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</td>
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
