'use client';

import React, { useState } from 'react';
import { useOrders, useCancelOrder } from '@/hooks/useIntradayTrading';
import { getCurrencySymbol } from '@/utils/marketCurrency';

interface TodayOrdersProps {
  selectedMarket: string;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function TodayOrders({ selectedMarket, onShowToast }: TodayOrdersProps) {
  const [filterStatus, setFilterStatus] = useState<number>(0); // 0=all, 1=filled, 2=pending, 3=cancelled
  const { data: orders, isLoading, error } = useOrders(selectedMarket, filterStatus);
  const cancelOrderMutation = useCancelOrder();
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<{ orderId: string; stockCode: string } | null>(null);

  const currency = getCurrencySymbol(selectedMarket);

  // Note: Orders are refreshed when:
  // 1. Market is switched
  // 2. Decision session completes
  // 3. Order is placed or cancelled (via WebSocket tool_result)

  const handleCancelOrderClick = (orderId: string, stockCode: string) => {
    setOrderToCancel({ orderId, stockCode });
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;

    setCancellingOrderId(orderToCancel.orderId);
    setShowCancelConfirm(false);
    
    try {
      await cancelOrderMutation.mutateAsync({
        orderId: orderToCancel.orderId,
        stockCode: orderToCancel.stockCode,
        marketType: selectedMarket,
      });
      
      onShowToast('订单撤销成功', 'success');
    } catch (error: any) {
      onShowToast(error.message || '订单撤销失败', 'error');
    } finally {
      setCancellingOrderId(null);
      setOrderToCancel(null);
    }
  };

  const handleCancelConfirm = () => {
    setShowCancelConfirm(false);
    setOrderToCancel(null);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: string; label: string }> = {
      filled: { color: 'bg-success-500/20 text-success-400 border border-success-500/50', icon: 'fa-check-circle', label: '已成交' },
      pending: { color: 'bg-warning-500/20 text-warning-400 border border-warning-500/50', icon: 'fa-clock', label: '待成交' },
      cancelled: { color: 'bg-gray-500/20 text-gray-400 border border-gray-500/50', icon: 'fa-times-circle', label: '已撤销' },
      rejected: { color: 'bg-red-500/20 text-red-400 border border-red-500/50', icon: 'fa-exclamation-circle', label: '已拒绝' },
    };

    const badge = badges[status.toLowerCase()] || badges.pending;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <i className={`fas ${badge.icon} mr-1`} />
        {badge.label}
      </span>
    );
  };

  const getSideBadge = (side: string) => {
    if (side.toUpperCase() === 'BUY') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white">
          买入
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-white">
          卖出
        </span>
      );
    }
  };

  const getOrderTypeBadge = (orderType: string) => {
    const isLimit = orderType.toUpperCase() === 'LIMIT';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        isLimit 
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
          : 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
      }`}>
        {isLimit ? '限价' : '市价'}
      </span>
    );
  };

  // Backend already filters today's orders based on market local time
  // No need to filter on frontend
  const todayOrders = orders || [];

  if (isLoading) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
        <div className="flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mr-3" />
          <span className="text-text-secondary">加载今日订单...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
        <div className="flex items-center justify-center text-danger-500">
          <i className="fas fa-exclamation-triangle mr-2" />
          <span>加载今日订单失败</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border">
      <div className="px-6 py-4 border-b border-dark-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-xl font-bold text-text-primary">
            <i className="fas fa-file-invoice mr-2 text-blue-600" />
            今日订单
          </h2>
          
          {/* Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterStatus(0)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filterStatus === 0
                  ? 'bg-accent-primary text-white'
                  : 'bg-dark-tertiary text-text-secondary hover:bg-dark-primary'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterStatus(1)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filterStatus === 1
                  ? 'bg-success-500 text-white'
                  : 'bg-dark-tertiary text-text-secondary hover:bg-dark-primary'
              }`}
            >
              已成交
            </button>
            <button
              onClick={() => setFilterStatus(2)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filterStatus === 2
                  ? 'bg-warning-500 text-white'
                  : 'bg-dark-tertiary text-text-secondary hover:bg-dark-primary'
              }`}
            >
              待成交
            </button>
            <button
              onClick={() => setFilterStatus(3)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filterStatus === 3
                  ? 'bg-gray-500 text-white'
                  : 'bg-dark-tertiary text-text-secondary hover:bg-dark-primary'
              }`}
            >
              已撤销
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {todayOrders.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-6xl text-text-muted mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">暂无订单记录</h3>
            <p className="text-text-secondary">
              今日还没有任何订单记录
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-border">
              <thead className="bg-dark-tertiary">
                <tr>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    股票代码
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    方向
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    类型
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    状态
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    数量
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    价格
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    已成交
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    下单时间
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-dark-secondary divide-y divide-dark-border">
                {todayOrders.map((order: any) => (
                  <tr key={order.order_id} className="hover:bg-dark-tertiary transition-colors">
                    <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                      <div className="text-xs md:text-sm font-medium text-text-primary">
                        {order.stock_code}
                      </div>
                      {order.stock_name && (
                        <div className="text-xs text-text-tertiary hidden md:block">
                          {order.stock_name}
                        </div>
                      )}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                      {getSideBadge(order.side)}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                      {getOrderTypeBadge(order.order_type)}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs md:text-sm text-text-primary">
                      {order.quantity}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs md:text-sm text-text-primary">
                      {order.price ? `${currency}${order.price}` : '-'}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs md:text-sm text-text-primary">
                      {order.filled_quantity || 0}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs text-text-secondary">
                      {new Date(order.create_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                      {order.status.toLowerCase() === 'pending' ? (
                        <button
                          onClick={() => handleCancelOrderClick(order.order_id, order.stock_code)}
                          disabled={cancellingOrderId === order.order_id}
                          className="px-2 md:px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                        >
                          {cancellingOrderId === order.order_id ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-1" />
                              <span className="hidden md:inline">撤销中</span>
                            </>
                          ) : (
                            <>
                              <i className="fas fa-ban mr-1" />
                              <span className="hidden md:inline">撤单</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-text-tertiary">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {todayOrders.length > 0 && (
          <div className="mt-6 pt-4 border-t border-dark-border">
            <div className="text-sm text-text-secondary text-center">
              共 {todayOrders.length} 条今日订单
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-secondary rounded-lg shadow-xl border border-dark-border max-w-md w-full">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-dark-border">
              <h3 className="text-lg font-semibold text-text-primary">
                <i className="fas fa-exclamation-triangle text-warning-500 mr-2" />
                确认撤单
              </h3>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-text-secondary">
                确定要撤销此订单吗？
              </p>
              {orderToCancel && (
                <div className="mt-4 p-3 bg-dark-tertiary rounded border border-dark-border">
                  <div className="text-sm">
                    <div className="text-text-tertiary">订单号</div>
                    <div className="text-text-primary font-mono text-xs mt-1">
                      {orderToCancel.orderId}
                    </div>
                  </div>
                  <div className="text-sm mt-2">
                    <div className="text-text-tertiary">股票代码</div>
                    <div className="text-text-primary font-semibold mt-1">
                      {orderToCancel.stockCode}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-dark-border flex justify-end gap-3">
              <button
                onClick={handleCancelConfirm}
                className="px-4 py-2 bg-dark-tertiary text-text-primary rounded-md hover:bg-dark-primary border border-dark-border transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                <i className="fas fa-ban mr-2" />
                确认撤单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
