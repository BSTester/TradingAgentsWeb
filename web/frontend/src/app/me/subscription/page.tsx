'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subscriptionAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { SubscriptionInfo } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  purchase: '购买',
  consume: '消耗',
  refund: '退款',
  grant: '赠送',
};

export default function MeSubscriptionPage() {
  const { user } = useAuth();
  const [type, setType] = useState('all');

  const { data } = useQuery({
    queryKey: ['subscription-me'],
    queryFn: () => subscriptionAPI.me(),
    enabled: !!user,
  });

  const me = data?.data as SubscriptionInfo | undefined;
  const all = me?.transactions ?? [];
  const filtered = type === 'all' ? all : all.filter((t) => t.type === type);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-responsive-h2 text-text-primary">订阅明细</h1>
        <p className="mt-1 text-sm text-text-tertiary">您的分析次数流水与余额。</p>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-2xl border border-accent-primary/30 bg-gradient-to-br from-dark-secondary to-dark-tertiary p-5">
        <div>
          <p className="text-xs text-text-tertiary">当前可用次数</p>
          <p className="num mt-1 text-4xl font-bold text-text-primary">{me?.balance ?? 0}</p>
        </div>
        <i className="fas fa-coins text-4xl text-accent-primary" aria-hidden="true" />
      </div>

      <div className="mb-4 flex gap-1 rounded-lg border border-dark-border bg-dark-secondary p-1">
        {['all', 'purchase', 'consume', 'refund'].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              type === t ? 'bg-accent-primary text-white' : 'text-text-secondary'
            }`}
          >
            {t === 'all' ? '全部' : TYPE_LABEL[t] ?? t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-10 text-center text-sm text-text-tertiary">
          暂无{type === 'all' ? '' : TYPE_LABEL[type]}流水。
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dark-border">
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>商品</th>
                <th>描述</th>
                <th className="text-right">增减</th>
                <th className="text-right">剩余</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td className="num text-text-tertiary">{new Date(t.created_at).toLocaleString()}</td>
                  <td>{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td>{t.plan_name ?? '—'}</td>
                  <td>{t.description ?? '—'}</td>
                  <td className={`num text-right ${t.amount >= 0 ? 'text-down' : 'text-up'}`}>
                    {t.amount >= 0 ? '+' : ''}
                    {t.amount}
                  </td>
                  <td className="num text-right">{t.balance}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
