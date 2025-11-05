'use client';

import React, { useState, useEffect } from 'react';
import { analysisAPI, scheduledTasksAPI } from '@/lib/api';
import { normalizeTicker, validateTicker, getTickerErrorMessage } from '@/utils/tickerValidator';
import { ScheduleConfig, ScheduleData } from './ScheduleConfig';
import { useUserConfig } from '@/hooks/useUserConfig';
import { useAuth } from '@/lib/auth';

interface AnalysisConfigFormProps {
  config: any;
  onAnalysisStart: (analysisId: string) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface FormData {
  ticker: string;
  analysis_date: string;
  analysts: string[];
  research_depth: number;
  llm_provider: string;
  api_key: string;
  shallow_thinker: string;
  deep_thinker: string;
  is_public: boolean;  // Privacy setting for leaderboard
  email_notification: boolean;  // Email notification setting
}

interface Analyst {
  value: string;
  label: string;
  description: string;
}

interface ResearchDepth {
  value: number;
  label: string;
  description: string;
}

interface LLMProvider {
  value: string;
  label: string;
  description: string;
  url?: string;
}

interface Model {
  value: string;
  label: string;
}

interface AnalysisResponse {
  analysis_id: string;
  status: string;
  message?: string;
}

export function AnalysisConfigForm({ config, onAnalysisStart, onShowToast }: AnalysisConfigFormProps) {
  const { token } = useAuth();
  const { config: userConfig, loading: configLoading } = useUserConfig(token);
  
  const [formData, setFormData] = useState<FormData>({
    ticker: '',
    analysis_date: new Date().toISOString().split('T')[0] || '',
    analysts: [],  // 初始为空，由缓存或默认值填充
    research_depth: 1,
    llm_provider: '',
    api_key: '',
    shallow_thinker: '',
    deep_thinker: '',
    is_public: true,  // Default to public (checked)
    email_notification: false,  // Default to disabled
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiKeyValidated, setApiKeyValidated] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [tickerError, setTickerError] = useState<string>('');
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  // 执行交易状态
  const [enableTradingExecutor, setEnableTradingExecutor] = useState(false);
  const [futuApiBaseUrl, setFutuApiBaseUrl] = useState('');
  const [futuApiKey, setFutuApiKey] = useState('');
  const [futuApiValidated, setFutuApiValidated] = useState(false);
  const [validatingFutuApi, setValidatingFutuApi] = useState(false);

  // 当富途API配置改变时，重置验证状态
  const handleFutuApiBaseUrlChange = (value: string) => {
    setFutuApiBaseUrl(value);
    setFutuApiValidated(false);
  };

  const handleFutuApiKeyChange = (value: string) => {
    setFutuApiKey(value);
    setFutuApiValidated(false);
  };

  // 定期报告配置状态
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    task_name: '',
    execution_cycle: '',
    execution_time: '',
    interval_days: 1,
    end_date: ''
  });

  // 检查当前选择的LLM提供商是否需要API密钥
  const requiresApiKey = formData.llm_provider && formData.llm_provider !== 'ollama';

  // 从服务器加载配置（只加载一次）
  const [configLoaded, setConfigLoaded] = useState(false);
  
  useEffect(() => {
    // 防止重复加载
    if (configLoaded) return;
    
    if (userConfig && !configLoading) {
      console.log('📋 加载用户配置:', userConfig);
      
      // 加载服务端缓存的配置
      setFormData(prev => ({
        ...prev,
        ticker: userConfig.last_ticker || '',  // 加载最后的股票代码
        analysts: userConfig.last_analysts || ['market', 'social', 'news', 'fundamentals'],
        research_depth: userConfig.last_research_depth || 1,
        llm_provider: userConfig.last_llm_provider || '',
        shallow_thinker: userConfig.last_shallow_thinker || '',
        deep_thinker: userConfig.last_deep_thinker || '',
        api_key: userConfig.last_api_key || '', // 从服务器加载实际密钥
        analysis_date: new Date().toISOString().split('T')[0] || ''
      }));
      
      // 加载执行交易配置
      setEnableTradingExecutor(userConfig.enable_trading_executor || false);
      setFutuApiBaseUrl(userConfig.futu_api_base_url || '');
      setFutuApiKey(userConfig.futu_api_key || '');
      
      // 如果服务器有缓存的 API 密钥，设置验证状态
      if (userConfig.last_api_key) {
        setApiKeyValidated(true);
        console.log('✅ API Key 已验证（从缓存）');
      }
      
      // 如果有富途 API 配置，设置为已验证
      if (userConfig.enable_trading_executor && userConfig.futu_api_base_url && userConfig.futu_api_key) {
        setFutuApiValidated(true);
        console.log('✅ 富途 API 已验证（从缓存）');
      }
      
      console.log('✅ 配置加载完成');
      setConfigLoaded(true);
      onShowToast('已加载上次配置', 'info');
    } else if (!configLoading && !userConfig && !configLoaded) {
      // 如果没有配置，设置默认值
      console.log('⚠️ 未找到用户配置，使用默认值');
      setFormData(prev => ({
        ...prev,
        analysts: ['market', 'social', 'news', 'fundamentals']
      }));
      setConfigLoaded(true);
    }
  }, [userConfig, configLoading, configLoaded, onShowToast]);

  const availableAnalysts: Analyst[] = config?.analysts || [
    { value: 'market', label: '市场分析师', description: '分析市场趋势和技术指标' },
    { value: 'social', label: '社交媒体分析师', description: '分析社交情绪和讨论' },
    { value: 'news', label: '新闻分析师', description: '分析新闻情绪和市场影响' },
    { value: 'fundamentals', label: '基本面分析师', description: '分析公司财务和基本面' }
  ];

  const researchDepths: ResearchDepth[] = config?.research_depths || [
    { value: 1, label: '快速分析', description: '单轮分析，适合快速决策' },
    { value: 2, label: '标准分析', description: '两轮分析，平衡速度和深度' },
    { value: 3, label: '深度分析', description: '三轮分析，全面综合评估' }
  ];

  const llmProviders: LLMProvider[] = config?.llm_providers || [
    { value: 'openai', label: 'OpenAI', description: 'GPT系列模型' },
    { value: 'anthropic', label: 'Anthropic', description: 'Claude系列模型' },
    { value: 'google', label: 'Google', description: 'Gemini系列模型' },
    { value: 'openrouter', label: 'OpenRouter', description: '多模型聚合平台' },
    { value: 'deepseek', label: 'Deepseek', description: 'Deepseek系列模型' },
    { value: 'qwen', label: 'Qwen', description: '通义千问系列模型' },
    { value: 'oneai', label: 'OneAI', description: '多模型聚合平台' },
    { value: 'ollama', label: 'Ollama', description: '本地模型服务' }
  ];

  const getModelsForProvider = (provider: string, type: 'shallow' | 'deep'): Model[] => {
    // 将provider转换为小写以匹配后端返回的键名
    const providerKey = provider.toLowerCase();

    // 如果config中有模型数据，使用config的数据
    if (config?.models?.[providerKey]?.[type]) {
      return config.models[providerKey][type];
    }

    // 否则使用默认模型列表
    const defaultModels: Record<string, Record<string, Model[]>> = {
      openai: {
        shallow: [
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
        ],
        deep: [
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'gpt-4', label: 'GPT-4' }
        ]
      },
      anthropic: {
        shallow: [
          { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
        ],
        deep: [
          { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
          { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' }
        ]
      },
      google: {
        shallow: [
          { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
        ],
        deep: [
          { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
          { value: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' }
        ]
      },
      openrouter: {
        shallow: [
          { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
          { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' }
        ],
        deep: [
          { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus' },
          { value: 'google/gemini-pro', label: 'Gemini Pro' }
        ]
      },
      oneai: {
        shallow: [
          { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
          { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' }
        ],
        deep: [
          { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus' },
          { value: 'google/gemini-pro', label: 'Gemini Pro' }
        ]
      },
      ollama: {
        shallow: [
          { value: 'llama3.2', label: 'Llama 3.2' },
          { value: 'mistral', label: 'Mistral' },
          { value: 'phi3', label: 'Phi-3' }
        ],
        deep: [
          { value: 'llama3.1:70b', label: 'Llama 3.1 70B' },
          { value: 'mixtral:8x7b', label: 'Mixtral 8x7B' },
          { value: 'qwen2.5:72b', label: 'Qwen 2.5 72B' }
        ]
      }
    };

    return defaultModels[providerKey]?.[type] || [];
  };

  const getApiKeyPlaceholder = (provider: string) => {
    const placeholders: Record<string, string> = {
      openai: '输入您的OpenAI API密钥 (sk-...)',
      oneai: '输入您的OneAI API密钥 (sk-...)',
      deepseek: '输入您的Deepseek API密钥 (sk-...)',
      qwen: '输入您的Qwen API密钥 (sk-...)',
      anthropic: '输入您的Anthropic API密钥 (sk-ant-...)',
      google: '输入您的Google API密钥',
      openrouter: '输入您的OpenRouter API密钥 (sk-or-...)',
      ollama: '本地模型无需API密钥'
    };
    return placeholders[provider] || '输入API密钥';
  };

  // 验证股票代码格式（使用统一的校验工具）
  const validateTickerFormat = (ticker: string): { valid: boolean; error: string } => {
    if (!ticker || ticker.trim() === '') {
      return { valid: false, error: '请输入股票代码' };
    }

    const normalized = normalizeTicker(ticker);
    const isValid = validateTicker(normalized);

    if (!isValid) {
      return {
        valid: false,
        error: getTickerErrorMessage(ticker)
      };
    }

    return { valid: true, error: '' };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // 如果更改了LLM提供商或API密钥，重置验证状态
    if (name === 'llm_provider' || name === 'api_key') {
      setApiKeyValidated(false);
    }

    // 如果更改了股票代码，实时校验
    if (name === 'ticker') {
      if (value.trim() === '') {
        setTickerError('');
      } else {
        const validation = validateTickerFormat(value);
        setTickerError(validation.error);
      }
    }
  };

  const handleAnalystToggle = (analystId: string) => {
    setFormData(prev => ({
      ...prev,
      analysts: prev.analysts.includes(analystId)
        ? prev.analysts.filter(id => id !== analystId)
        : [...prev.analysts, analystId]
    }));
  };

  // 验证API密钥
  const validateApiKey = async () => {
    if (!formData.api_key || !formData.llm_provider) {
      onShowToast('请先输入API密钥', 'error');
      return;
    }

    setValidatingKey(true);
    try {
      // 调用后端API验证密钥
      const result = await analysisAPI.validateKey({
        provider: formData.llm_provider,
        api_key: formData.api_key
      });

      if (result.valid) {
        setApiKeyValidated(true);
        onShowToast('API密钥验证成功', 'success');
      } else {
        setApiKeyValidated(false);
        onShowToast(result.message || 'API密钥格式不正确', 'error');
      }
    } catch (error: any) {
      setApiKeyValidated(false);
      onShowToast(error.message || 'API密钥验证失败', 'error');
    } finally {
      setValidatingKey(false);
    }
  };

  // 验证富途API配置
  const validateFutuApi = async () => {
    if (!futuApiBaseUrl || !futuApiKey) {
      onShowToast('请先输入富途 API Base URL 和 API Key', 'error');
      return;
    }

    setValidatingFutuApi(true);
    try {
      // 调用富途API的 /api/hot-news 接口验证
      const url = `${futuApiBaseUrl.replace(/\/$/, '')}/api/hot-news?lang=en-us`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': futuApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // 检查返回的数据是否有效
        if (data && (Array.isArray(data) || data.data)) {
          setFutuApiValidated(true);
          onShowToast('富途 API 配置验证成功', 'success');
        } else {
          setFutuApiValidated(false);
          onShowToast('富途 API 返回数据格式不正确', 'error');
        }
      } else {
        setFutuApiValidated(false);
        const errorText = await response.text();
        onShowToast(`富途 API 验证失败: ${response.status} ${errorText}`, 'error');
      }
    } catch (error: any) {
      setFutuApiValidated(false);
      onShowToast(`富途 API 连接失败: ${error.message}`, 'error');
    } finally {
      setValidatingFutuApi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证股票代码
    const tickerValidation = validateTickerFormat(formData.ticker);
    if (!tickerValidation.valid) {
      setTickerError(tickerValidation.error);
      onShowToast('请输入有效的股票代码', 'error');
      return;
    }

    if (formData.analysts.length === 0) {
      onShowToast('请至少选择一个分析师', 'error');
      return;
    }

    // 检查API密钥验证
    if (requiresApiKey && !apiKeyValidated) {
      onShowToast('请先验证API密钥', 'error');
      return;
    }

    // 验证执行交易配置
    if (enableTradingExecutor) {
      if (!futuApiBaseUrl || !futuApiKey) {
        onShowToast('启用执行交易时必须填写富途 API 配置', 'error');
        return;
      }
      if (!futuApiValidated) {
        onShowToast('请先验证富途 API 配置', 'error');
        return;
      }
    }

    // 只有勾选公开时才显示确认对话框，未勾选直接开始分析
    if (formData.is_public) {
      setShowPrivacyDialog(true);
    } else {
      confirmStartAnalysis();
    }
  };

  // 确认开始分析
  const confirmStartAnalysis = async () => {
    setShowPrivacyDialog(false);
    setIsSubmitting(true);

    try {
      // 准备API请求数据（使用标准化的ticker）
      const requestData: any = {
        ticker: normalizeTicker(formData.ticker),
        analysis_date: formData.analysis_date,
        analysts: formData.analysts,
        research_depth: formData.research_depth,
        llm_provider: formData.llm_provider,
        backend_url: config?.llm_providers?.find((p: any) => p.value === formData.llm_provider)?.url || '',
        shallow_thinker: formData.shallow_thinker,
        deep_thinker: formData.deep_thinker,
        is_public: formData.is_public,
        enable_trading_executor: enableTradingExecutor,
        futu_api_base_url: enableTradingExecutor ? futuApiBaseUrl : undefined,
        futu_api_key: enableTradingExecutor ? futuApiKey : undefined,
        email_notification: formData.email_notification,
      };

      // 添加API密钥（如果提供了新密钥，否则后端会使用缓存的）
      if (formData.api_key) {
        requestData.api_key = formData.api_key;
      }

      // 检查是否是定期报告
      if (isScheduled) {
        // 验证定期报告配置
        if (!scheduleData.task_name || !scheduleData.execution_cycle || !scheduleData.execution_time) {
          onShowToast('请完整填写定期报告配置', 'error');
          setIsSubmitting(false);
          return;
        }
        
        // 验证每周执行必须选择星期几
        if (scheduleData.execution_cycle === 'weekly' && !scheduleData.day_of_week) {
          onShowToast('请选择星期几执行', 'error');
          setIsSubmitting(false);
          return;
        }
        
        // 验证每N天执行必须填写间隔天数
        if (scheduleData.execution_cycle === 'every_n_days' && (!scheduleData.interval_days || scheduleData.interval_days < 1)) {
          onShowToast('请填写有效的间隔天数', 'error');
          setIsSubmitting(false);
          return;
        }

        // 创建定期报告
        const scheduledTaskData = {
          ...requestData,
          task_name: scheduleData.task_name,
          execution_cycle: scheduleData.execution_cycle,
          execution_time: scheduleData.execution_time,
          interval_days: scheduleData.interval_days,
          day_of_week: scheduleData.day_of_week,
          end_date: scheduleData.end_date || undefined,
          enable_trading_executor: enableTradingExecutor,
          futu_api_base_url: enableTradingExecutor ? futuApiBaseUrl : undefined,
          futu_api_key: enableTradingExecutor ? futuApiKey : undefined,
        };

        const response = await scheduledTasksAPI.create(scheduledTaskData);
        
        console.log('=== Scheduled Task Created ===');
        console.log('Response:', response);
        console.log('Task ID:', response.id);

        onShowToast('✅ 定期报告创建成功！', 'success');
        
        // 跳转到定期报告页面
        setTimeout(() => {
          window.location.href = '/scheduled-tasks';
        }, 1500);
        
        return; // 重要：阻止继续执行立即分析逻辑
      }

      // 调用后端API启动分析（立即执行）
      const response: AnalysisResponse = await analysisAPI.startAnalysis(requestData);

      console.log('=== Analysis Started ===');
      console.log('Response:', response);
      console.log('Analysis ID:', response.analysis_id);

      // 检查是否是重复任务
      if (response.message && response.status !== 'queued') {
        // 重复任务，显示明确的警告提示
        console.log('Duplicate task detected, connecting to existing analysis:', response.analysis_id);
        onShowToast('⚠️ 该股票的分析任务已在进行中，已自动连接到现有任务。', 'warning');
        // 延迟一下再跳转，让用户看到提示
        setTimeout(() => {
          onAnalysisStart(response.analysis_id);
        }, 1500);
      } else {
        // 新任务
        onShowToast('✅ 分析任务已启动！', 'success');
        onAnalysisStart(response.analysis_id);
      }
    } catch (error: any) {
      console.error('启动分析失败:', error);
      onShowToast(error.message || '启动分析失败', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          <i className="fas fa-cog mr-2 text-blue-600" />
          配置分析
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* 步骤1: 股票代码 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <h4 className="text-lg font-medium text-gray-900">股票代码</h4>
          </div>
          <div className="ml-11">
            <label htmlFor="ticker" className="block text-sm font-medium text-gray-700 mb-2">
              输入要分析的股票代码
            </label>
            <input
              type="text"
              id="ticker"
              name="ticker"
              value={formData.ticker}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${tickerError
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
                }`}
              placeholder="例如：TSLA, 600519, 00700.HK"
              required
            />
            {tickerError && (
              <div className="mt-2 text-sm text-red-600 whitespace-pre-line">
                <i className="fas fa-exclamation-circle mr-1" />
                {tickerError}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              <i className="fas fa-info-circle mr-1" />
              支持美股（如 AAPL）、A股（如 600519）、港股（如 00700.HK）
            </p>
          </div>
        </div>

        {/* 步骤2: 分析日期 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              2
            </div>
            <h4 className="text-lg font-medium text-gray-900">分析日期</h4>
          </div>
          <div className="ml-11">
            <label htmlFor="analysis_date" className="block text-sm font-medium text-gray-700 mb-2">
              选择分析日期
            </label>
            <input
              type="date"
              id="analysis_date"
              name="analysis_date"
              value={formData.analysis_date}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        {/* 步骤3: 分析师团队 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              3
            </div>
            <h4 className="text-lg font-medium text-gray-900">分析师团队</h4>
          </div>
          <div className="ml-11">
            <p className="text-sm text-gray-600 mb-4">选择您的LLM分析师智能体进行分析</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableAnalysts.map((analyst: Analyst) => (
                <div
                  key={analyst.value}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${formData.analysts.includes(analyst.value)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                    }`}
                  onClick={() => handleAnalystToggle(analyst.value)}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.analysts.includes(analyst.value)}
                      onChange={() => handleAnalystToggle(analyst.value)}
                      className="mt-1"
                    />
                    <div>
                      <h5 className="font-medium text-gray-900">{analyst.label}</h5>
                      <p className="text-sm text-gray-600">{analyst.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 步骤4: 研究深度 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              4
            </div>
            <h4 className="text-lg font-medium text-gray-900">研究深度</h4>
          </div>
          <div className="ml-11">
            <p className="text-sm text-gray-600 mb-4">选择您的研究深度级别</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {researchDepths.map((depth: ResearchDepth) => (
                <div
                  key={depth.value}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${formData.research_depth === depth.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                    }`}
                  onClick={() => setFormData(prev => ({ ...prev, research_depth: depth.value }))}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="radio"
                      name="research_depth"
                      value={depth.value}
                      checked={formData.research_depth === depth.value}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                    <div>
                      <h5 className="font-medium text-gray-900">{depth.label}</h5>
                      <p className="text-sm text-gray-600">{depth.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 步骤5: LLM服务商 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              5
            </div>
            <h4 className="text-lg font-medium text-gray-900">LLM服务商</h4>
          </div>
          <div className="ml-11 space-y-4">
            <div>
              <label htmlFor="llm_provider" className="block text-sm font-medium text-gray-700 mb-2">
                选择要使用的服务商
              </label>
              <select
                id="llm_provider"
                name="llm_provider"
                value={formData.llm_provider}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">请选择LLM服务商...</option>
                {llmProviders.map((provider: LLMProvider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label} - {provider.description}
                  </option>
                ))}
              </select>
            </div>

            {/* API密钥输入 */}
            {requiresApiKey && (
              <div>
                <label htmlFor="api_key" className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-key mr-1" />
                  API密钥
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      id="api_key"
                      name="api_key"
                      value={formData.api_key}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={getApiKeyPlaceholder(formData.llm_provider)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      <i className={`fas ${showApiKey ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 hover:text-gray-600`} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={validateApiKey}
                    disabled={validatingKey || !formData.api_key}
                    className={`px-4 py-2 rounded-md border font-medium transition-colors ${apiKeyValidated
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {validatingKey ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-1" />
                        验证中
                      </>
                    ) : apiKeyValidated ? (
                      <>
                        <i className="fas fa-check mr-1" />
                        已验证
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check mr-1" />
                        验证
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  <i className="fas fa-info-circle mr-1" />
                  访问所选LLM服务商需要您的API密钥
                </p>
              </div>
            )}

            {/* 思维智能体选择 */}
            {(apiKeyValidated || formData.llm_provider === 'ollama') && (
              <div className="border-t pt-4">
                <div className="flex items-center space-x-2 mb-4">
                  <i className="fas fa-lightbulb text-green-600" />
                  <span className="font-medium text-green-700">为您的分析选择思维智能体</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="shallow_thinker" className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-bolt mr-1" />
                      快速思维LLM引擎
                    </label>
                    <select
                      id="shallow_thinker"
                      name="shallow_thinker"
                      value={formData.shallow_thinker}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">选择模型...</option>
                      {getModelsForProvider(formData.llm_provider, 'shallow').map((model: Model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 mt-1">用于快速初始分析和快速决策</p>
                  </div>
                  <div>
                    <label htmlFor="deep_thinker" className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-brain mr-1" />
                      深度思维LLM引擎
                    </label>
                    <select
                      id="deep_thinker"
                      name="deep_thinker"
                      value={formData.deep_thinker}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">选择模型...</option>
                      {getModelsForProvider(formData.llm_provider, 'deep').map((model: Model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 mt-1">用于全面分析和复杂推理</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 执行交易配置 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-robot text-blue-600"></i>
                执行交易
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                启用模拟交易执行功能（需要富途 API）。部署模拟交易服务可访问{' '}
                <a 
                  href="https://github.com/BSTester/futu-paper-trade-api" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  GitHub
                </a>
                {' '}获取代码
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableTradingExecutor}
                onChange={(e) => setEnableTradingExecutor(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {enableTradingExecutor && (
            <div className="space-y-4 pl-6 border-l-2 border-blue-500">
              <div>
                <label htmlFor="futu_api_base_url" className="block text-sm font-medium text-gray-700 mb-2">
                  富途 API Base URL
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  id="futu_api_base_url"
                  value={futuApiBaseUrl}
                  onChange={(e) => handleFutuApiBaseUrlChange(e.target.value)}
                  placeholder="http://localhost:8000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={enableTradingExecutor}
                />
              </div>
              
              <div>
                <label htmlFor="futu_api_key" className="block text-sm font-medium text-gray-700 mb-2">
                  富途 API Key
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    id="futu_api_key"
                    value={futuApiKey}
                    onChange={(e) => handleFutuApiKeyChange(e.target.value)}
                    placeholder="输入富途 API Key"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={enableTradingExecutor}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    <i className={`fas fa-eye${showApiKey ? '-slash' : ''}`}></i>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  <i className="fas fa-lock mr-1"></i>
                  API Key 将安全地保存在服务器上
                </p>
              </div>

              {/* 验证按钮和状态 */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={validateFutuApi}
                  disabled={!futuApiBaseUrl || !futuApiKey || validatingFutuApi}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    futuApiValidated
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
                  }`}
                >
                  {validatingFutuApi ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      验证中...
                    </>
                  ) : futuApiValidated ? (
                    <>
                      <i className="fas fa-check-circle mr-2"></i>
                      已验证
                    </>
                  ) : (
                    <>
                      <i className="fas fa-shield-alt mr-2"></i>
                      验证配置
                    </>
                  )}
                </button>
                
                {futuApiValidated && (
                  <span className="text-sm text-green-600 flex items-center">
                    <i className="fas fa-check-circle mr-1"></i>
                    富途 API 配置有效
                  </span>
                )}
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <i className="fas fa-info-circle mr-2"></i>
                  <strong>注意：</strong>执行交易将在分析完成后自动执行模拟交易操作，包括投资组合管理、仓位控制和自动止盈止损。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 隐私授权和邮件通知 - 左右排列 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 隐私授权 */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <i className="fas fa-info-circle text-yellow-600 text-xl mt-0.5" />
              </div>
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-bold text-yellow-800 mb-2">隐私授权</h4>
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={formData.is_public}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="is_public" className="text-sm text-yellow-700 cursor-pointer">
                    我同意将此分析结果公开展示在排行榜上，供其他用户参考学习。
                    <span className="block mt-1 text-xs text-yellow-600">
                      （不勾选则仅自己可见，勾选后将在首页排行榜中展示）
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 邮件通知 */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <i className="fas fa-envelope text-blue-600 text-xl mt-0.5" />
              </div>
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-bold text-blue-800 mb-2">邮件通知</h4>
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="email_notification"
                    checked={formData.email_notification}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_notification: e.target.checked }))}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="email_notification" className="text-sm text-blue-700 cursor-pointer">
                    分析完成后发送邮件通知到我的注册邮箱
                    <span className="block mt-1 text-xs text-blue-600">
                      <i className="fas fa-info-circle mr-1" />
                      邮件将包含完整的分析报告和网页版链接
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 定期报告配置 */}
        <ScheduleConfig
          scheduleData={scheduleData}
          onChange={(data) => setScheduleData(prev => ({ ...prev, ...data }))}
          isScheduled={isScheduled}
          onToggleSchedule={setIsScheduled}
        />

        {/* 提交按钮 */}
        <div className="text-center pt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2" />
                {isScheduled ? '创建定期报告中...' : '启动分析中...'}
              </>
            ) : (
              <>
                <i className={`fas ${isScheduled ? 'fa-clock' : 'fa-play'} mr-2`} />
                {isScheduled ? '创建定期报告' : '开始分析'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* 隐私确认对话框 */}
      {showPrivacyDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <i className="fas fa-shield-alt text-blue-600 text-3xl" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  隐私设置确认
                </h3>
                <div className="text-sm text-gray-600 space-y-2">
                  {formData.is_public ? (
                    <>
                      <p className="flex items-start">
                        <i className="fas fa-check-circle text-green-500 mr-2 mt-0.5" />
                        <span>您已同意将分析结果<strong className="text-green-600">公开展示</strong>在排行榜上</span>
                      </p>
                      <p className="ml-6 text-xs text-gray-500">
                        其他用户可以在首页排行榜中查看您的分析结果，这有助于社区学习交流
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="flex items-start">
                        <i className="fas fa-lock text-gray-500 mr-2 mt-0.5" />
                        <span>您的分析结果将<strong className="text-gray-700">仅自己可见</strong></span>
                      </p>
                      <p className="ml-6 text-xs text-gray-500">
                        分析结果不会出现在公开排行榜中，只有您可以查看
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowPrivacyDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmStartAnalysis}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                确认并开始分析
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}