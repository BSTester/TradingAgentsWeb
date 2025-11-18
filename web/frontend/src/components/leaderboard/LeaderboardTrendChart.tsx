'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildApiUrl } from '@/utils/api';
import { getCurrencySymbol, formatAmount } from '@/utils/marketCurrency';

interface User {
  user_id: number;
  username: string;
  market_type: string;
  total_assets: number;
  latest_snapshot_date: string;
  model_name?: string;
}

interface SnapshotData {
  date: string;
  total_assets: number;
}

interface LeaderboardTrendChartProps {
  users: User[]; // 前10名用户
  allUsers: User[]; // 所有用户（用于排名列表）
  selectedMarket: string;
  selectedUserId: number | null;
  onUserSelect: (userId: number, username: string) => void;
  lastUpdate: string | null;
}

export function LeaderboardTrendChart({
  users,
  allUsers,
  selectedMarket,
  selectedUserId,
  onUserSelect,
  lastUpdate
}: LeaderboardTrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredUser, setHoveredUser] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data: {
      username: string;
      date: string;
      value: number;
      modelName?: string;
    } | null;
  }>({ visible: false, x: 0, y: 0, data: null });

  // 获取所有前10名用户的趋势数据（最近1周，每5分钟刷新一次）
  const { data: allTrendsData } = useQuery({
    queryKey: ['leaderboard-trends', users.map(u => u.user_id).join(','), selectedMarket],
    queryFn: async () => {
      if (users.length === 0) return {};
      
      const trendsPromises = users.map(async (user) => {
        try {
          // 获取最近1周的数据（7天），按市场过滤
          const response = await fetch(buildApiUrl(`/api/public/leaderboard/user/${user.user_id}/trend?days=7&market=${selectedMarket}`));
          if (!response.ok) return { userId: user.user_id, data: [] };
          const data = await response.json();
          return { userId: user.user_id, data };
        } catch (error) {
          return { userId: user.user_id, data: [] };
        }
      });
      
      const results = await Promise.all(trendsPromises);
      const trendsMap: Record<number, SnapshotData[]> = {};
      results.forEach(result => {
        trendsMap[result.userId] = result.data;
      });
      return trendsMap;
    },
    enabled: users.length > 0,
    staleTime: 5 * 60 * 1000, // 5分钟缓存，与WebSocket更新频率一致
    refetchInterval: 5 * 60 * 1000, // 每5分钟自动刷新
  });

  // 绘制趋势图
  useEffect(() => {
    if (!canvasRef.current || users.length === 0 || !allTrendsData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置canvas尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    
    // 响应式padding - 移动端使用更小的padding
    const isMobile = width < 640;
    const padding = isMobile 
      ? { top: 60, right: 20, bottom: 50, left: 60 }
      : { top: 80, right: 40, bottom: 60, left: 100 };
    
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 颜色方案
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
    ];

    // 清空画布
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // 检查是否有数据
    const hasData = Object.values(allTrendsData).some(data => data.length > 0);
    if (!hasData) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无趋势数据', width / 2, height / 2);
      return;
    }

    // 找出所有日期和最小/最大值
    let minValue = Infinity;
    let maxValue = -Infinity;
    const allDates = new Set<string>();
    
    Object.values(allTrendsData).forEach(trendData => {
      trendData.forEach(point => {
        minValue = Math.min(minValue, point.total_assets);
        maxValue = Math.max(maxValue, point.total_assets);
        allDates.add(point.date);
      });
    });
    
    const sortedDates = Array.from(allDates).sort();
    
    // 添加10%边距
    const valueRange = maxValue - minValue;
    minValue -= valueRange * 0.1;
    maxValue += valueRange * 0.1;

    // 绘制网格和坐标轴
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;

    // Y轴网格线
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (chartHeight * i / ySteps);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      // Y轴标签
      const value = maxValue - (maxValue - minValue) * (i / ySteps);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      // 根据数值大小选择合适的格式
      let label = '';
      if (value >= 1000000) {
        // 百万以上：显示到万位
        label = `${(value / 10000).toFixed(1)}万`;
      } else if (value >= 10000) {
        // 万以上：显示到千位
        label = `${(value / 10000).toFixed(2)}万`;
      } else if (value >= 1000) {
        // 千以上：显示完整数值
        label = value.toFixed(0);
      } else {
        // 千以下：显示小数
        label = value.toFixed(2);
      }
      
      ctx.fillText(label, padding.left - 10, y + 4);
    }

    // X轴网格线和标签
    ctx.textAlign = 'center';
    sortedDates.forEach((date, index) => {
      // 根据数据点数量调整显示间隔
      const totalPoints = sortedDates.length;
      let showInterval = 1;
      
      if (totalPoints > 200) {
        showInterval = Math.floor(totalPoints / 10); // 显示约10个标签
      } else if (totalPoints > 100) {
        showInterval = Math.floor(totalPoints / 15); // 显示约15个标签
      } else if (totalPoints > 50) {
        showInterval = Math.floor(totalPoints / 20); // 显示约20个标签
      } else {
        showInterval = Math.max(1, Math.floor(totalPoints / 10));
      }
      
      if (index % showInterval === 0 || index === sortedDates.length - 1) {
        const x = padding.left + (chartWidth * index / (sortedDates.length - 1));
        
        // 网格线
        ctx.strokeStyle = '#1f2937';
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
        
        // 标签 - 根据数据格式显示
        let label = '';
        if (date.includes(' ')) {
          // 包含时间的格式: "2025-11-17 14:30:00"
          const parts = date.split(' ');
          const datePart = parts[0].substring(5); // MM-DD
          const timePart = parts[1].substring(0, 5); // HH:MM
          label = `${datePart} ${timePart}`;
        } else {
          // 只有日期的格式: "2025-11-17"
          label = date.substring(5); // MM-DD
        }
        
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px sans-serif';
        ctx.fillText(label, x, height - padding.bottom + 20);
      }
    });

    // 绘制趋势线
    users.forEach((user, userIndex) => {
      const trendData = allTrendsData[user.user_id] || [];
      if (trendData.length === 0) return;

      const color = colors[userIndex % colors.length];
      const isSelected = selectedUserId === user.user_id;
      const isHovered = hoveredUser === user.user_id;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected || isHovered ? 3 : 2;
      ctx.globalAlpha = isSelected || isHovered ? 1 : 0.7;
      ctx.beginPath();

      let hasStarted = false;
      trendData.forEach((point) => {
        const dateIndex = sortedDates.indexOf(point.date);
        if (dateIndex === -1) return;
        
        const x = padding.left + (chartWidth * dateIndex / (sortedDates.length - 1));
        const normalizedValue = (point.total_assets - minValue) / (maxValue - minValue);
        const y = padding.top + chartHeight - (chartHeight * normalizedValue);

        if (!hasStarted) {
          ctx.moveTo(x, y);
          hasStarted = true;
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
      ctx.globalAlpha = 1;

      // 绘制数据点
      if (isSelected || isHovered) {
        ctx.fillStyle = color;
        trendData.forEach(point => {
          const dateIndex = sortedDates.indexOf(point.date);
          if (dateIndex === -1) return;
          
          const x = padding.left + (chartWidth * dateIndex / (sortedDates.length - 1));
          const normalizedValue = (point.total_assets - minValue) / (maxValue - minValue);
          const y = padding.top + chartHeight - (chartHeight * normalizedValue);
          
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    // 标题 - 放在最上方，移动端使用更小字体
    ctx.fillStyle = '#e5e7eb';
    ctx.font = isMobile ? 'bold 13px sans-serif' : 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    const titleText = `资产趋势 - 前10名 (${selectedMarket === 'US' ? '美股' : selectedMarket === 'HK' ? '港股' : 'A股'})`;
    ctx.fillText(titleText, padding.left, isMobile ? 20 : 25);

    // 最后更新时间 - 放在标题右侧，移动端可能换行
    if (lastUpdate) {
      ctx.fillStyle = '#6b7280';
      ctx.font = isMobile ? '9px sans-serif' : '11px sans-serif';
      ctx.textAlign = 'right';
      const updateText = `更新: ${new Date(lastUpdate).toLocaleTimeString('zh-CN')}`;
      ctx.fillText(updateText, width - padding.right, isMobile ? 20 : 25);
    }

    // 绘制图例 - 放在标题下方，移动端调整布局
    ctx.textAlign = 'left';
    const legendY = isMobile ? 35 : 45;
    const legendItemWidth = isMobile ? 100 : 150;
    const legendItemsPerRow = Math.floor((width - padding.left - padding.right) / legendItemWidth);
    
    users.forEach((user, index) => {
      const color = colors[index % colors.length];
      const row = Math.floor(index / legendItemsPerRow);
      const col = index % legendItemsPerRow;
      const x = padding.left + col * legendItemWidth;
      const y = legendY + row * (isMobile ? 18 : 22);

      const isSelected = selectedUserId === user.user_id;
      const isHovered = hoveredUser === user.user_id;

      // 颜色方块
      ctx.fillStyle = color;
      const boxSize = isMobile ? 10 : 12;
      ctx.fillRect(x, y, boxSize, boxSize);

      // 用户名 - 移动端使用更小字体和截断
      ctx.fillStyle = isSelected || isHovered ? '#ffffff' : '#e5e7eb';
      const fontSize = isMobile ? 10 : 11;
      ctx.font = isSelected || isHovered ? `bold ${fontSize}px sans-serif` : `${fontSize}px sans-serif`;
      
      let displayName = `${index + 1}. ${user.username}`;
      // 移动端截断过长的用户名
      if (isMobile && displayName.length > 10) {
        displayName = displayName.substring(0, 9) + '...';
      }
      
      ctx.fillText(displayName, x + (isMobile ? 14 : 18), y + (isMobile ? 8 : 10));
    });

  }, [users, selectedUserId, allTrendsData, hoveredUser, selectedMarket, lastUpdate]);

  // 处理鼠标移动事件
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !allTrendsData) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 80, right: 40, bottom: 60, left: 100 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // 检查是否在图表区域内
    if (x < padding.left || x > rect.width - padding.right || 
        y < padding.top || y > rect.height - padding.bottom) {
      setTooltip({ visible: false, x: 0, y: 0, data: null });
      return;
    }

    // 找出所有日期
    const allDates = new Set<string>();
    Object.values(allTrendsData).forEach(trendData => {
      trendData.forEach(point => allDates.add(point.date));
    });
    const sortedDates = Array.from(allDates).sort();

    if (sortedDates.length === 0) return;

    // 计算最接近的数据点
    const relativeX = x - padding.left;
    const dateIndex = Math.round((relativeX / chartWidth) * (sortedDates.length - 1));
    
    if (dateIndex < 0 || dateIndex >= sortedDates.length) {
      setTooltip({ visible: false, x: 0, y: 0, data: null });
      return;
    }

    const targetDate = sortedDates[dateIndex];

    // 找出最接近鼠标的用户数据
    let closestUser: { username: string; value: number; distance: number; modelName?: string } | null = null;
    let minValue = Infinity;
    let maxValue = -Infinity;

    Object.values(allTrendsData).forEach(trendData => {
      trendData.forEach(point => {
        minValue = Math.min(minValue, point.total_assets);
        maxValue = Math.max(maxValue, point.total_assets);
      });
    });

    const valueRange = maxValue - minValue;
    minValue -= valueRange * 0.1;
    maxValue += valueRange * 0.1;

    users.forEach((user) => {
      const trendData = allTrendsData[user.user_id] || [];
      const dataPoint = trendData.find(p => p.date === targetDate);
      
      if (dataPoint) {
        const normalizedValue = (dataPoint.total_assets - minValue) / (maxValue - minValue);
        const pointY = padding.top + chartHeight - (chartHeight * normalizedValue);
        const distance = Math.abs(y - pointY);

        if (!closestUser || distance < closestUser.distance) {
          closestUser = {
            username: user.username,
            value: dataPoint.total_assets,
            distance,
            modelName: user.model_name
          };
        }
      }
    });

    if (closestUser && closestUser.distance < 20) {
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        data: {
          username: closestUser.username,
          date: targetDate,
          value: closestUser.value,
          modelName: closestUser.modelName
        }
      });
    } else {
      setTooltip({ visible: false, x: 0, y: 0, data: null });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, data: null });
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-4 p-2 sm:p-4 h-full">
      {/* 趋势图 */}
      <div className="flex-1 bg-dark-secondary rounded-lg border border-dark-border p-2 sm:p-4 relative min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        
        {/* Tooltip */}
        {tooltip.visible && tooltip.data && (
          <div
            className="fixed z-50 bg-dark-primary border border-accent-primary rounded-lg shadow-lg p-3 pointer-events-none"
            style={{
              left: `${tooltip.x + 10}px`,
              top: `${tooltip.y + 10}px`,
            }}
          >
            <div className="text-sm font-semibold text-text-primary mb-1">
              {tooltip.data.username}
            </div>
            {tooltip.data.modelName && (
              <div className="text-xs text-accent-primary mb-1 font-medium">
                <i className="fas fa-brain mr-1" />
                {tooltip.data.modelName}
              </div>
            )}
            <div className="text-xs text-text-secondary mb-1">
              {tooltip.data.date.includes(' ') 
                ? tooltip.data.date.replace(' ', ' · ')
                : tooltip.data.date
              }
            </div>
            <div className="text-sm font-bold text-accent-primary">
              {getCurrencySymbol(selectedMarket)}{tooltip.data.value.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </div>
          </div>
        )}
      </div>

      {/* 排名列表 */}
      <div className="w-full lg:w-80 bg-dark-secondary rounded-lg border border-dark-border p-3 sm:p-4 flex flex-col min-h-0">
        <h3 className="text-lg font-bold text-text-primary mb-3 sm:mb-4 flex-shrink-0">
          <i className="fas fa-list-ol mr-2" />
          排名列表 ({allUsers.length})
        </h3>
        <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
          {allUsers
            .sort((a, b) => b.total_assets - a.total_assets)
            .map((user, index) => (
              <button
                key={user.user_id}
                onClick={() => onUserSelect(user.user_id, user.username)}
                onMouseEnter={() => setHoveredUser(user.user_id)}
                onMouseLeave={() => setHoveredUser(null)}
                className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg transition-all ${
                  selectedUserId === user.user_id
                    ? 'bg-accent-primary/20 border-accent-primary'
                    : hoveredUser === user.user_id
                    ? 'bg-dark-primary border-accent-primary/50'
                    : 'bg-dark-tertiary hover:bg-dark-primary border-dark-border'
                } border`}
              >
                <div className="flex items-center space-x-2.5 sm:space-x-3 flex-1 min-w-0">
                  {/* 排名 */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-orange-600 text-white' :
                    'bg-dark-primary text-text-secondary'
                  }`}>
                    {index + 1}
                  </div>
                  
                  {/* 用户信息 */}
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {user.username}
                    </p>
                    <p className="text-xs text-text-tertiary truncate">
                      {user.latest_snapshot_date}
                    </p>
                  </div>
                </div>
                
                {/* 资产和模型 */}
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-sm font-semibold text-text-primary mb-1">
                    {formatAmount(user.total_assets, selectedMarket, 0)}
                  </p>
                  {user.model_name && (
                    <p className="text-xs text-accent-primary font-medium truncate max-w-[100px] sm:max-w-[120px] ml-auto" title={user.model_name}>
                      {user.model_name}
                    </p>
                  )}
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
