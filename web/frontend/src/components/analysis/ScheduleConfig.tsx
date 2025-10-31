'use client';

import React from 'react';

export interface ScheduleData {
  task_name: string;
  execution_cycle: string;
  execution_time: string;
  interval_days: number;
  end_date: string;
  day_of_week?: string; // 周几执行（0-6，0=周日）
}

interface ScheduleConfigProps {
  scheduleData: ScheduleData;
  onChange: (data: Partial<ScheduleData>) => void;
  isScheduled: boolean;
  onToggleSchedule: (enabled: boolean) => void;
}

export function ScheduleConfig({ scheduleData, onChange, isScheduled, onToggleSchedule }: ScheduleConfigProps) {
  const executionCycles = [
    { value: 'daily', label: '每天执行', description: '每天在指定时间执行一次' },
    { value: 'weekly', label: '每周执行', description: '每周指定日期在指定时间执行' },
    { value: 'workdays', label: '工作日执行', description: '周一至周五在指定时间执行' },
    { value: 'every_n_days', label: '每N天执行', description: '每隔指定天数执行一次' }
  ];

  const daysOfWeek = [
    { value: '1', label: '周一' },
    { value: '2', label: '周二' },
    { value: '3', label: '周三' },
    { value: '4', label: '周四' },
    { value: '5', label: '周五' },
    { value: '6', label: '周六' },
    { value: '0', label: '周日' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
          6
        </div>
        <h4 className="text-lg font-medium text-gray-900">定期报告（可选）</h4>
      </div>

      <div className="ml-11 space-y-4">
        {/* Toggle for scheduling */}
        <div className="flex items-center space-x-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <input
            type="checkbox"
            id="enable_schedule"
            checked={isScheduled}
            onChange={(e) => onToggleSchedule(e.target.checked)}
            className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
          />
          <label htmlFor="enable_schedule" className="flex-1 cursor-pointer">
            <div className="font-medium text-gray-900">
              <i className="fas fa-clock mr-2 text-purple-600" />
              启用定期报告
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {isScheduled 
                ? '任务将按照设定的周期自动执行' 
                : '不勾选则立即执行一次'}
            </p>
          </label>
        </div>

        {/* Schedule configuration (only shown when enabled) */}
        {isScheduled && (
          <div className="space-y-4 p-4 border border-purple-200 rounded-lg bg-white">
            {/* Task Name */}
            <div>
              <label htmlFor="task_name" className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-tag mr-1" />
                任务名称
              </label>
              <input
                type="text"
                id="task_name"
                value={scheduleData.task_name}
                onChange={(e) => onChange({ task_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="例如：每日TSLA分析"
                required={isScheduled}
              />
              <p className="text-sm text-gray-500 mt-1">
                为您的定期报告起一个易于识别的名称
              </p>
            </div>

            {/* Execution Cycle */}
            <div>
              <label htmlFor="execution_cycle" className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-repeat mr-1" />
                执行周期
              </label>
              <select
                id="execution_cycle"
                value={scheduleData.execution_cycle}
                onChange={(e) => onChange({ execution_cycle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required={isScheduled}
              >
                <option value="">请选择执行周期...</option>
                {executionCycles.map((cycle) => (
                  <option key={cycle.value} value={cycle.value}>
                    {cycle.label} - {cycle.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Day of Week (only for weekly) */}
            {scheduleData.execution_cycle === 'weekly' && (
              <div>
                <label htmlFor="day_of_week" className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-calendar-week mr-1" />
                  选择星期几
                </label>
                <select
                  id="day_of_week"
                  value={scheduleData.day_of_week || ''}
                  onChange={(e) => onChange({ day_of_week: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">请选择...</option>
                  {daysOfWeek.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  任务将在每周的这一天执行
                </p>
              </div>
            )}

            {/* Interval Days (only for every_n_days) */}
            {scheduleData.execution_cycle === 'every_n_days' && (
              <div>
                <label htmlFor="interval_days" className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-calendar-day mr-1" />
                  间隔天数
                </label>
                <input
                  type="number"
                  id="interval_days"
                  min="1"
                  max="365"
                  value={scheduleData.interval_days}
                  onChange={(e) => onChange({ interval_days: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="输入间隔天数（1-365）"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  任务将每隔指定天数执行一次
                </p>
              </div>
            )}

            {/* Execution Time */}
            <div>
              <label htmlFor="execution_time" className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-clock mr-1" />
                执行时间
              </label>
              <input
                type="time"
                id="execution_time"
                value={scheduleData.execution_time}
                onChange={(e) => onChange({ execution_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required={isScheduled}
              />
              <p className="text-sm text-gray-500 mt-1">
                任务将在每天的这个时间执行（北京时间 UTC+8）
              </p>
            </div>

            {/* End Date (optional) */}
            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-calendar-times mr-1" />
                结束日期（可选）
              </label>
              <input
                type="date"
                id="end_date"
                value={scheduleData.end_date}
                onChange={(e) => onChange({ end_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                任务将在此日期后自动停止（不填则持续执行）
              </p>
            </div>

            {/* Schedule Summary */}
            {scheduleData.execution_cycle && scheduleData.execution_time && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start">
                  <i className="fas fa-info-circle text-purple-600 text-lg mt-0.5 mr-3" />
                  <div className="flex-1">
                    <h5 className="font-medium text-purple-900 mb-2">任务执行计划</h5>
                    <ul className="text-sm text-purple-800 space-y-1">
                      <li>
                        <i className="fas fa-check-circle mr-2" />
                        周期：{executionCycles.find(c => c.value === scheduleData.execution_cycle)?.label}
                        {scheduleData.execution_cycle === 'weekly' && scheduleData.day_of_week && 
                          ` (${daysOfWeek.find(d => d.value === scheduleData.day_of_week)?.label})`}
                        {scheduleData.execution_cycle === 'every_n_days' && scheduleData.interval_days && 
                          ` (每${scheduleData.interval_days}天)`}
                      </li>
                      <li>
                        <i className="fas fa-check-circle mr-2" />
                        时间：每天 {scheduleData.execution_time} (北京时间)
                      </li>
                      {scheduleData.end_date && (
                        <li>
                          <i className="fas fa-check-circle mr-2" />
                          结束：{scheduleData.end_date}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
