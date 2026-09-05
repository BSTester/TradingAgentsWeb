'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageShell } from '@/components/ws133/Shell';
import type { SubscriptionPlan, SubscriptionInfo } from '@/lib/types';

export default function SubscribePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: plansData } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => subscriptionAPI.plans(),
    staleTime: 60_000,
  });

  const { data: meData } = useQuery({
    queryKey: ['subscription-me'],
    queryFn: () => subscriptionAPI.me(),
    enabled: !!user,
  });

  const purchase = useMutation({
    mutationFn: (planId: number) => subscriptionAPI.purchase(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-me'] });
    },
  });

  const plans = plansData?.data ?? ([] as SubscriptionPlan[]);
  const me = meData?.data as SubscriptionInfo | undefined;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-responsive-h2 text-text-primary">订阅中心</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            按次订阅。充值后可使用系统 LLM 进行多智能体分析；也可在「自定义模型」配置自有 Key。
          </p>
        </div>

        {/* Balance */}
        {user && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-accent-primary/30 bg-gradient-to-br from-dark-secondary to-dark-tertiary p-5">
            <div>
              <p className="text-xs text-text-tertiary">当前可用分析次数</p>
              <p className="num mt-1 text-3xl font-bold text-text-primary">{me?.balance ?? 0}</p>
            </div>
            <i className="fas fa-coins text-3xl text-accent-primary" aria-hidden="true" />
          </div>
        )}

        {/* Plans */}
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-2xl border border-dark-border bg-dark-secondary p-6 shadow-card-dark transition-all hover:border-accent-primary/50"
            >
              <h3 className="text-responsive-h4 text-text-primary">{p.name}</h3>
              <p className="mt-1 text-sm text-text-tertiary">{p.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-text-primary">
                  <span className="num">¥{p.price.toFixed(0)}</span>
                </span>
                <span className="text-sm text-text-tertiary">/ {p.credits} 次</span>
              </div>
              <p className="mt-2 text-xs text-text-tertiary">
                平均每次 <span className="num">¥{(p.price / p.credits).toFixed(2)}</span>
              </p>
              <div className="mt-6">
                {user ? (
                  <button
                    onClick={() => purchase.mutate(p.id)}
                    disabled={purchase.isPending}
                    className="w-full rounded-lg bg-accent-primary py-2.5 text-sm font-semibold text-white hover:bg-accent-secondary disabled:opacity-60"
                  >
                    {purchase.isPending ? '处理中…' : '购买'}
                  </button>
                ) : (
                  <Link
                    href="/auth"
                    className="block w-full rounded-lg border border-accent-primary py-2.5 text-center text-sm font-semibold text-accent-primary hover:bg-accent-primary hover:text-white"
                  >
                    登录后购买
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {purchase.isError && (
          <div className="mt-4 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-sm text-danger-400">
            {(purchase.error as any)?.message ?? '购买失败'}
          </div>
        )}

        {user && (
          <div className="mt-8">
            <h2 className="mb-3 text-responsive-h4 text-text-primary">次数流水</h2>
            {!me || me.transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-8 text-center text-sm text-text-tertiary">
                暂无流水。
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-dark-border">
                <table className="table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>类型</th>
                      <th>描述</th>
                      <th className="text-right">增减</th>
                      <th className="text-right">剩余</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="num text-text-tertiary">
                          {new Date(t.created_at).toLocaleString()}
                        </td>
                        <td>{t.type}</td>
                        <td>{t.description}</td>
                        <td
                          className={`num text-right ${t.amount >= 0 ? 'text-down' : 'text-up'}`}
                        >
                          {t.amount >= 0 ? '+' : ''}
                          {t.amount}
                        </td>
                        <td className="num text-right">{t.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
