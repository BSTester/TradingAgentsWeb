'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAccountTrend, type TrendResponse } from '@/lib/api/accountSnapshots';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface AccountTrendModalProps {
  marketType: string;
  metric: 'total_assets' | 'cash' | 'market_value';
  onClose: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const metricLabels = {
  total_assets: '总资产',
  cash: '可用资金',
  market_value: '持仓市值',
};

const metricColors = {
  total_assets: '#3b82f6', // blue
  cash: '#10b981', // green
  market_value: '#f59e0b', // amber
};

export function AccountTrendModal({
  marketType,
  metric,
  onClose,
  onShowToast,
}: AccountTrendModalProps) {
  const [timeRange, setTimeRange] = useState<'today' | 7 | 30 | 90 | 365>('today');
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<TrendResponse | null>(null);

  useEffect(() => {
    loadTrendData();
  }, [timeRange, marketType]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      const todayOnly = timeRange === 'today';
      const days = typeof timeRange === 'number' ? timeRange : 1;
      const data = await getAccountTrend(marketType, days, todayOnly);
      setTrendData(data);
    } catch (error: any) {
      onShowToast(error.response?.data?.detail || '加载趋势数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    // Determine currency based on market type
    const getCurrencySymbol = (market: string) => {
      switch (market.toUpperCase()) {
        case 'US':
          return '$';
        case 'HK':
          return 'HK$';
        case 'CN':
          return '¥';
        default:
          return '$';
      }
    };
    const currencySymbol = getCurrencySymbol(marketType);
    
    // Simple formatting with currency symbol prefix
    return `${currencySymbol}${value.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'MM/dd', { locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  const calculateChange = () => {
    if (!trendData || trendData.data.length < 2) return null;

    const firstValue = trendData.data[0][metric];
    const lastValue = trendData.data[trendData.data.length - 1][metric];
    const change = lastValue - firstValue;
    const percentage = (change / firstValue) * 100;

    return { change, percentage };
  };

  const change = calculateChange();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-dark-secondary md:rounded-lg shadow-xl border-0 md:border border-dark-border w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 px-4 md:px-6 py-3 md:py-4 border-b border-dark-border flex items-center justify-between bg-dark-secondary">
          <div className="flex-1">
            <h3 className="text-lg md:text-xl font-bold text-text-primary">
              <i className="fas fa-chart-line mr-2 text-accent-primary" />
              {metricLabels[metric]} - {marketType}
            </h3>
            {change && (
              <div className="text-sm md:text-base mt-1">
                <span className={`font-semibold ${change.change >= 0 ? 'text-[#f03a55]' : 'text-[#00a870]'}`}>
                  {change.change >= 0 ? '+' : ''}{formatCurrency(change.change)}
                  {' '}
                  ({change.change >= 0 ? '+' : ''}{change.percentage.toFixed(2)}%)
                </span>
                <span className="text-text-secondary ml-2">
                  {timeRange}天变化
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary min-w-touch min-h-touch flex items-center justify-center ml-2"
          >
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="px-4 md:px-6 py-3 border-b border-dark-border bg-dark-tertiary">
          <div className="flex gap-2 overflow-x-auto">
            {[
              { value: 'today' as const, label: '今日', icon: 'fa-clock' },
              { value: 7 as const, label: '7天', icon: 'fa-calendar-week' },
              { value: 30 as const, label: '30天', icon: 'fa-calendar-alt' },
              { value: 90 as const, label: '90天', icon: 'fa-calendar' },
              { value: 365 as const, label: '1年', icon: 'fa-calendar-check' },
            ].map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value as any)}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  timeRange === range.value
                    ? 'bg-accent-primary text-white'
                    : 'bg-dark-secondary text-text-secondary hover:bg-dark-primary'
                }`}
              >
                <i className={`fas ${range.icon} mr-1`} />
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64 md:h-96">
              <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mr-3" />
              <span className="text-text-secondary">加载中...</span>
            </div>
          ) : trendData && trendData.data.length > 0 ? (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={window.innerWidth < 768 ? 300 : 400}>
                <LineChart
                  data={trendData.data}
                  margin={{
                    top: 5,
                    right: window.innerWidth < 768 ? 5 : 30,
                    left: window.innerWidth < 768 ? 5 : 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#9ca3af"
                    style={{ fontSize: window.innerWidth < 768 ? '12px' : '14px' }}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    stroke="#9ca3af"
                    style={{ fontSize: window.innerWidth < 768 ? '12px' : '14px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '0.5rem',
                      color: '#f3f4f6',
                    }}
                    formatter={(value: number) => [formatCurrency(value), metricLabels[metric]]}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: window.innerWidth < 768 ? '12px' : '14px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric}
                    stroke={metricColors[metric]}
                    strokeWidth={2}
                    dot={{ fill: metricColors[metric], r: window.innerWidth < 768 ? 3 : 4 }}
                    activeDot={{ r: window.innerWidth < 768 ? 5 : 6 }}
                    name={metricLabels[metric]}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Stats Summary */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-dark-tertiary rounded-lg p-3 md:p-4 border border-dark-border">
                  <div className="text-xs md:text-sm text-text-secondary mb-1">最高值</div>
                  <div className="text-base md:text-lg font-bold text-text-primary">
                    {formatCurrency(Math.max(...trendData.data.map(d => d[metric])))}
                  </div>
                </div>
                <div className="bg-dark-tertiary rounded-lg p-3 md:p-4 border border-dark-border">
                  <div className="text-xs md:text-sm text-text-secondary mb-1">最低值</div>
                  <div className="text-base md:text-lg font-bold text-text-primary">
                    {formatCurrency(Math.min(...trendData.data.map(d => d[metric])))}
                  </div>
                </div>
                <div className="bg-dark-tertiary rounded-lg p-3 md:p-4 border border-dark-border">
                  <div className="text-xs md:text-sm text-text-secondary mb-1">平均值</div>
                  <div className="text-base md:text-lg font-bold text-text-primary">
                    {formatCurrency(
                      trendData.data.reduce((sum, d) => sum + d[metric], 0) / trendData.data.length
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 md:h-96 text-center">
              {timeRange === 'today' ? (
                <>
                  <i className="fas fa-moon text-4xl md:text-6xl text-text-muted mb-4" />
                  <h3 className="text-base md:text-lg font-medium text-text-primary mb-2">市场已休市</h3>
                  <p className="text-sm md:text-base text-text-secondary">
                    {marketType} 市场当前没有交易数据
                  </p>
                </>
              ) : (
                <>
                  <i className="fas fa-chart-line text-4xl md:text-6xl text-text-muted mb-4" />
                  <h3 className="text-base md:text-lg font-medium text-text-primary mb-2">暂无数据</h3>
                  <p className="text-sm md:text-base text-text-secondary">
                    系统还没有记录账户快照数据
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-t border-dark-border flex justify-end bg-dark-secondary">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-tertiary text-text-primary rounded-md hover:bg-dark-primary border border-dark-border transition-colors text-sm md:text-base"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
