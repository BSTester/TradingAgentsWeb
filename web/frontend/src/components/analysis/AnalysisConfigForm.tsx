'use client';

import React, { useState, useEffect } from 'react';
import { analysisAPI } from '@/lib/api';
import { normalizeTicker, validateTicker, getTickerErrorMessage } from '@/utils/tickerValidator';

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

const CACHE_KEY = 'trading_agents_config_cache';

export function AnalysisConfigForm({ config, onAnalysisStart, onShowToast }: AnalysisConfigFormProps) {
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
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiKeyValidated, setApiKeyValidated] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [tickerError, setTickerError] = useState<string>('');
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  // 检查当前选择的LLM提供商是否需要API密钥
  const requiresApiKey = formData.llm_provider && formData.llm_provider !== 'ollama';

  // 缓存配置（包含API密钥）
  const saveConfigToCache = (data: FormData) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        ...data,
        cached_at: new Date().toISOString()
      }));
    } catch (_error) {
      console.warn('缓存配置失败:', _error);
    }
  };

  // 加载缓存配置（包含API密钥）
  const loadConfigFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cachedData = JSON.parse(cached);
        const cachedDate = new Date(cachedData.cached_at);
        const now = new Date();
        const diffHours = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60);

        // 缓存在24小时内有效
        if (diffHours < 24) {
          setFormData(prev => ({
            ...prev,
            ...cachedData,
            analysis_date: new Date().toISOString().split('T')[0] || '' // 始终使用今天的日期
          }));

          // 如果缓存中包含API密钥且不是本地模型，设置验证状态为true
          // 这样用户就不需要重新输入已缓存的API密钥
          if (cachedData.api_key && cachedData.llm_provider && cachedData.llm_provider !== 'ollama') {
            setApiKeyValidated(true);
          }

          return true;
        }
      }
    } catch (_error) {
      console.warn('加载缓存配置失败:', _error);
    }
    return false;
  };

  useEffect(() => {
    // 加载缓存的配置
    const loaded = loadConfigFromCache();
    if (loaded) {
      onShowToast('已加载上次配置', 'info');
    } else {
      // 如果没有缓存，设置默认值：全选分析师
      setFormData(prev => ({
        ...prev,
        analysts: ['market', 'social', 'news', 'fundamentals']
      }));
    }
  }, []);

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
        // 保存包含API密钥的配置到缓存
        saveConfigToCache(formData);
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
      // 保存完整配置到缓存（包括API密钥）
      saveConfigToCache(formData);

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
        is_public: formData.is_public,  // Include privacy setting
      };

      // 根据提供商添加对应的API密钥
      if (formData.llm_provider === 'openai' || formData.llm_provider === 'oneai' || formData.llm_provider === 'deepseek') {
        requestData.openai_api_key = formData.api_key;
      } else if (formData.llm_provider === 'anthropic') {
        requestData.anthropic_api_key = formData.api_key;
      } else if (formData.llm_provider === 'google') {
        requestData.google_api_key = formData.api_key;
      } else if (formData.llm_provider === 'openrouter') {
        requestData.openrouter_api_key = formData.api_key;
      }

      // 调用后端API启动分析
      const response: AnalysisResponse = await analysisAPI.startAnalysis(requestData);

      console.log('=== Analysis Started ===');
      console.log('Response:', response);
      console.log('Analysis ID:', response.analysis_id);

      // 检查是否是重复任务
      if (response.message && response.status !== 'queued') {
        // 重复任务，显示明确的警告提示
        console.log('Duplicate task detected, connecting to existing analysis:', response.analysis_id);
        onShowToast('⚠️ 您已有正在进行的分析任务，不能同时运行多个分析。已自动连接到现有任务。', 'warning');
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
                启动分析中...
              </>
            ) : (
              <>
                <i className="fas fa-play mr-2" />
                开始分析
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