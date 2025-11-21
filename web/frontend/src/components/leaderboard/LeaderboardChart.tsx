'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildApiUrl } from '@/utils/api';

interface User {
  user_id: number;
  username: string;
  market_type: string;
  total_assets: number;
  latest_snapshot_date: string;
}

interface SnapshotData {
  date: string;
  total_assets: number;
}

interface LeaderboardChartProps {
  users: User[];
  onUserSelect: (userId: number, username: string) => void;
  selectedUserId: number | null;
}

export function LeaderboardChart({ users, onUserSelect, selectedUserId }: LeaderboardChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredUser, setHoveredUser] = useState<number | null>(null);

  // Fetch trend data for all users
  const { data: allTrendsData } = useQuery({
    queryKey: ['all-users-trends', users.map(u => u.user_id).join(',')],
    queryFn: async () => {
      if (users.length === 0) return {};
      
      const trendsPromises = users.map(async (user) => {
        try {
          const response = await fetch(buildApiUrl(`/api/public/leaderboard/user/${user.user_id}/trend`));
          if (!response.ok) return { userId: user.user_id, data: [] };
          const data = await response.json();
          return { userId: user.user_id, data };
        } catch (error) {
          console.error(`Failed to fetch trend for user ${user.user_id}:`, error);
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
    staleTime: 60 * 1000, // 1 minute
  });

  useEffect(() => {
    if (!canvasRef.current || users.length === 0 || !allTrendsData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = 60;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Colors for different users
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
    ];

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Check if we have any trend data
    const hasData = Object.values(allTrendsData).some(data => data.length > 0);
    
    if (!hasData) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无趋势数据，请先初始化样本数据', width / 2, height / 2);
      ctx.textAlign = 'left';
      return;
    }

    // Find min/max values for scaling
    let minValue = Infinity;
    let maxValue = -Infinity;
    let allDates: string[] = [];
    
    Object.values(allTrendsData).forEach(trendData => {
      trendData.forEach(point => {
        minValue = Math.min(minValue, point.total_assets);
        maxValue = Math.max(maxValue, point.total_assets);
        if (!allDates.includes(point.date)) {
          allDates.push(point.date);
        }
      });
    });
    
    allDates.sort();
    
    // Add padding to min/max
    const valueRange = maxValue - minValue;
    minValue -= valueRange * 0.1;
    maxValue += valueRange * 0.1;

    // Draw axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const value = minValue + (maxValue - minValue) * (i / ySteps);
      const y = height - padding - (chartHeight * i / ySteps);
      ctx.fillText(`$${(value / 1000).toFixed(0)}K`, padding - 10, y + 4);
      
      // Grid line
      ctx.strokeStyle = '#374151';
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw X-axis labels (show every 5th date)
    ctx.textAlign = 'center';
    allDates.forEach((date, index) => {
      if (index % 5 === 0 || index === allDates.length - 1) {
        const x = padding + (chartWidth * index / (allDates.length - 1));
        const shortDate = date.substring(5); // MM-DD
        ctx.fillText(shortDate, x, height - padding + 20);
      }
    });

    // Draw trend lines for each user
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

      trendData.forEach((point, pointIndex) => {
        const dateIndex = allDates.indexOf(point.date);
        if (dateIndex === -1) return;
        
        const x = padding + (chartWidth * dateIndex / (allDates.length - 1));
        const normalizedValue = (point.total_assets - minValue) / (maxValue - minValue);
        const y = height - padding - (chartHeight * normalizedValue);

        if (pointIndex === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw points
      if (isSelected || isHovered) {
        ctx.fillStyle = color;
        trendData.forEach(point => {
          const dateIndex = allDates.indexOf(point.date);
          if (dateIndex === -1) return;
          
          const x = padding + (chartWidth * dateIndex / (allDates.length - 1));
          const normalizedValue = (point.total_assets - minValue) / (maxValue - minValue);
          const y = height - padding - (chartHeight * normalizedValue);
          
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    // Draw legend
    ctx.textAlign = 'left';
    const legendY = 20;
    const legendItemWidth = 140;
    const legendItemsPerRow = Math.floor((width - padding * 2) / legendItemWidth);
    
    users.slice(0, 8).forEach((user, index) => {
      const color = colors[index % colors.length];
      const row = Math.floor(index / legendItemsPerRow);
      const col = index % legendItemsPerRow;
      const x = padding + col * legendItemWidth;
      const y = legendY + row * 20;

      const isSelected = selectedUserId === user.user_id;
      const isHovered = hoveredUser === user.user_id;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, 12, 12);

      ctx.fillStyle = isSelected || isHovered ? '#ffffff' : '#e5e7eb';
      ctx.font = isSelected || isHovered ? 'bold 12px sans-serif' : '12px sans-serif';
      ctx.fillText(`${user.username}`, x + 18, y + 10);
    });

  }, [users, selectedUserId, allTrendsData, hoveredUser]);

  // Render chart and user list
  return (
    <div className="bg-dark-secondary rounded-lg border border-dark-border p-6">
      <h2 className="text-xl font-bold text-text-primary mb-4">
        <i className="fas fa-chart-line mr-2" />
        资产趋势图
      </h2>
      
      {/* Chart Canvas */}
      <div className="relative mb-6">
        <canvas
          ref={canvasRef}
          className="w-full h-96 rounded-lg cursor-pointer"
          style={{ backgroundColor: '#1a1a1a' }}
        />
        {!allTrendsData && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mb-2" />
              <p className="text-text-secondary text-sm">加载趋势数据中...</p>
            </div>
          </div>
        )}
      </div>

      {/* User List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">
          参与排名用户 ({users.length})
        </h3>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {users.map((user, index) => (
            <button
              key={user.user_id}
              onClick={() => onUserSelect(user.user_id, user.username)}
              onMouseEnter={() => setHoveredUser(user.user_id)}
              onMouseLeave={() => setHoveredUser(null)}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                selectedUserId === user.user_id
                  ? 'bg-accent-primary/20 border-accent-primary'
                  : hoveredUser === user.user_id
                  ? 'bg-dark-primary border-accent-primary/50'
                  : 'bg-dark-tertiary hover:bg-dark-primary border-dark-border'
              } border`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: [
                      '#3B82F6',
                      '#10B981',
                      '#F59E0B',
                      '#EF4444',
                      '#8B5CF6',
                      '#EC4899',
                      '#14B8A6',
                      '#F97316',
                    ][index % 8],
                  }}
                />
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">
                    {user.username}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {user.market_type} • 最新: {user.latest_snapshot_date}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-text-primary">
                  ${user.total_assets.toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
