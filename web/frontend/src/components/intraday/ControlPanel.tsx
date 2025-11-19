'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSchedulerStatus, useSchedulerControl, useSchedulerConfig } from '@/hooks/useIntradayTrading';
import { configAPI } from '@/lib/apiClient';
import { PromptConfigTab } from './PromptConfigTab';

interface ControlPanelProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface LLMProvider {
  value: string;
  label: string;
  description: string;
}

interface Model {
  value: string;
  label: string;
}

export function ControlPanel({ onShowToast }: ControlPanelProps) {
  const { data: status, isLoading } = useSchedulerStatus();
  const { data: config, isLoading: configLoading } = useSchedulerConfig();
  const { start, stop, updateConfig } = useSchedulerControl();
  const [interval, setInterval] = useState(5);
  const [futuApiUrl, setFutuApiUrl] = useState('');
  const [futuApiKey, setFutuApiKey] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['US', 'HK', 'CN']); // 默认全选
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<'basic' | 'prompt'>('basic');
  const [showApiKey, setShowApiKey] = useState(false);
  const [configValidated, setConfigValidated] = useState(false);
  const [validatingConfig, setValidatingConfig] = useState(false);
  const [pendingAction, setPendingAction] = useState<'start' | 'stop' | null>(null);

  
  // LLM Configuration states
  const [llmProvider, setLlmProvider] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [showLlmApiKey, setShowLlmApiKey] = useState(false); // 默认隐藏密钥保护隐私
  const [llmKeyValidated, setLlmKeyValidated] = useState(false);
  const [validatingLlmKey, setValidatingLlmKey] = useState(false);
  const [llmModel, setLlmModel] = useState(''); // 只需要一个模型（深度思考模型）
  const [backendUrl, setBackendUrl] = useState(''); // Backend URL for custom endpoints
  
  // API配置数据 - 使用 React Query 缓存
  const { data: apiConfig, isLoading: loadingApiConfig } = useQuery({
    queryKey: ['api-config'],
    queryFn: () => configAPI.getConfig(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Load config on mount
  useEffect(() => {
    if (config) {
      setInterval(config.interval_minutes || 60);
      setFutuApiUrl(config.futu_api_url || '');
      setFutuApiKey(config.futu_api_key || '');
      setLlmProvider(config.llm_provider || '');
      setLlmApiKey(config.api_key || ''); // 使用 api_key 字段（从 last_api_key 或 intraday_api_key 获取）
      setLlmModel(config.llm_model || ''); // 加载深度思考模型
      setBackendUrl(config.backend_url || ''); // 加载 backend URL
      
      // Load market selection (always comma-separated or single)
      if (config.market_type) {
        if (config.market_type.includes(',')) {
          // Handle comma-separated markets like "US,HK,CN"
          const markets = config.market_type.split(',').map((m: string) => m.trim());
          // Filter out invalid values like "ALL" (legacy data)
          const validMarkets = markets.filter((m: string) => ['US', 'HK', 'CN'].includes(m));
          setSelectedMarkets(validMarkets.length > 0 ? validMarkets : ['US', 'HK', 'CN']);
        } else if (['US', 'HK', 'CN'].includes(config.market_type)) {
          setSelectedMarkets([config.market_type]);
        } else {
          // Handle legacy "ALL" or invalid values - default to all markets
          setSelectedMarkets(['US', 'HK', 'CN']);
        }
      }
      
      // If config exists and has API key, mark as validated
      if (config.futu_api_url && config.has_futu_api_key) {
        setConfigValidated(true);
      }
      // If LLM config exists and has API key (or is ollama), mark as validated
      if (config.llm_provider && (config.llm_provider === 'ollama' || config.api_key)) {
        setLlmKeyValidated(true);
      }
      // Only show config modal if no config at all (not even from analysis page)
      if (!config.futu_api_url) {
        setShowConfigModal(true);
      }
    }
  }, [config]);

  // Clear loading state when status changes
  useEffect(() => {
    if (pendingAction && status) {
      if (pendingAction === 'start' && status.is_running) {
        setIsUpdating(false);
        setPendingAction(null);
      } else if (pendingAction === 'stop' && !status.is_running) {
        setIsUpdating(false);
        setPendingAction(null);
      }
    }
  }, [status?.is_running, pendingAction]);



  // Reset validation when config changes
  const handleFutuApiUrlChange = (value: string) => {
    setFutuApiUrl(value);
    setConfigValidated(false);
  };

  const handleFutuApiKeyChange = (value: string) => {
    setFutuApiKey(value);
    setConfigValidated(false);
  };

  const handleLlmProviderChange = (value: string) => {
    setLlmProvider(value);
    setLlmKeyValidated(false);
    
    // Auto-set backend URL from provider config
    const providers = getLlmProviders();
    const selectedProvider = providers.find(p => p.value === value);
    if (selectedProvider && 'url' in selectedProvider) {
      setBackendUrl((selectedProvider as any).url);
    } else {
      setBackendUrl('');
    }
  };

  const handleLlmApiKeyChange = (value: string) => {
    setLlmApiKey(value);
    setLlmKeyValidated(false);
  };

  const handleLlmModelChange = (value: string) => {
    setLlmModel(value);
  };

  // Get LLM providers from API config
  const getLlmProviders = (): LLMProvider[] => {
    if (apiConfig?.llm_providers) {
      return apiConfig.llm_providers;
    }
    // Fallback to default providers
    return [
      { value: 'openai', label: 'OpenAI', description: 'GPT系列模型' },
      { value: 'anthropic', label: 'Anthropic', description: 'Claude系列模型' },
      { value: 'google', label: 'Google', description: 'Gemini系列模型' },
      { value: 'openrouter', label: 'OpenRouter', description: '多模型聚合平台' },
      { value: 'deepseek', label: 'Deepseek', description: 'Deepseek系列模型' },
      { value: 'qwen', label: 'Qwen', description: '通义千问系列模型' },
      { value: 'oneai', label: 'OneAI', description: '多模型聚合平台' },
      { value: 'ollama', label: 'Ollama', description: '本地模型服务' }
    ];
  };

  // Get models for provider from API config
  const getModelsForProvider = (provider: string, type: 'shallow' | 'deep'): Model[] => {
    const providerKey = provider.toLowerCase();
    
    // Try to get from API config first
    if (apiConfig?.models?.[providerKey]?.[type]) {
      return apiConfig.models[providerKey][type];
    }
    
    // Fallback to default models
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
      deepseek: {
        shallow: [
          { value: 'deepseek-chat', label: 'DeepSeek Chat' }
        ],
        deep: [
          { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' }
        ]
      },
      qwen: {
        shallow: [
          { value: 'qwen-turbo', label: 'Qwen Turbo' }
        ],
        deep: [
          { value: 'qwen-max', label: 'Qwen Max' },
          { value: 'qwen-plus', label: 'Qwen Plus' }
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

  // Validate LLM API Key using shared config API
  const validateLlmKey = async () => {
    if (!llmProvider || llmProvider === 'ollama') {
      onShowToast('Ollama 不需要验证 API 密钥', 'info');
      return;
    }

    if (!llmApiKey) {
      onShowToast('请先输入 LLM API 密钥', 'error');
      return;
    }

    try {
      setValidatingLlmKey(true);
      const result = await configAPI.validateAPIKey(llmProvider, llmApiKey);

      if (result.valid) {
        setLlmKeyValidated(true);
        onShowToast('LLM API 密钥验证成功', 'success');
      } else {
        setLlmKeyValidated(false);
        onShowToast(result.message || 'LLM API 密钥格式不正确', 'error');
      }
    } catch (error: any) {
      setLlmKeyValidated(false);
      onShowToast(error.message || 'LLM API 密钥验证失败', 'error');
    } finally {
      setValidatingLlmKey(false);
    }
  };

  const validateConfig = async () => {
    if (!futuApiUrl) {
      onShowToast('请先输入富途API地址', 'error');
      return;
    }

    if (!futuApiKey) {
      onShowToast('请先输入富途API密钥', 'error');
      return;
    }

    try {
      setValidatingConfig(true);
      const { intradayTradingAPI } = await import('@/lib/apiClient');
      const result = await intradayTradingAPI.validateConfig({
        futu_api_url: futuApiUrl,
        futu_api_key: futuApiKey,
      });

      if (result.valid) {
        setConfigValidated(true);
        onShowToast('富途API配置验证成功', 'success');
      } else {
        setConfigValidated(false);
        onShowToast(result.message || '富途API配置验证失败', 'error');
      }
    } catch (error: any) {
      setConfigValidated(false);
      onShowToast(error.message || '验证失败', 'error');
    } finally {
      setValidatingConfig(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!futuApiUrl) {
      onShowToast('请输入富途API地址', 'error');
      return;
    }

    if (!futuApiKey) {
      onShowToast('请输入富途API密钥', 'error');
      return;
    }

    if (interval < 5 || interval > 120) {
      onShowToast('分析间隔必须在5-120分钟之间', 'error');
      return;
    }

    if (!configValidated) {
      onShowToast('请先验证富途API配置', 'error');
      return;
    }

    // Validate LLM config if provided
    if (llmProvider && llmProvider !== 'ollama' && llmApiKey && !llmKeyValidated) {
      onShowToast('请先验证 LLM API 密钥', 'error');
      return;
    }

    // Validate model selection if LLM provider is configured
    if (llmProvider && (llmKeyValidated || llmProvider === 'ollama')) {
      if (!llmModel) {
        onShowToast('请选择 LLM 模型', 'error');
        return;
      }
    }

    // Validate market selection
    if (selectedMarkets.length === 0) {
      onShowToast('请至少选择一个市场', 'error');
      return;
    }

    try {
      setIsUpdating(true);
      const configData: any = {
        futu_api_url: futuApiUrl,
        futu_api_key: futuApiKey,
        interval_minutes: interval,
        market_type: selectedMarkets.join(','), // Always use comma-separated format
      };
      
      // Add LLM config if provided
      if (llmProvider) {
        configData.llm_provider = llmProvider;
      }
      if (llmApiKey) {
        configData.api_key = llmApiKey;  // 使用 api_key 而不是 llm_api_key
      }
      if (llmModel) {
        configData.llm_model = llmModel;
      }
      if (backendUrl) {
        configData.backend_url = backendUrl;
      }
      
      await updateConfig.mutateAsync(configData);
      onShowToast('配置已保存', 'success');
      setShowConfigModal(false);
      setFutuApiKey(''); // Clear for security
      setLlmApiKey(''); // Clear for security
    } catch (error: any) {
      onShowToast(error.message || '保存失败', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStart = async () => {
    if (!futuApiUrl) {
      onShowToast('请先配置富途API地址', 'error');
      setShowConfigModal(true);
      return;
    }

    try {
      setIsUpdating(true);
      setPendingAction('start');
      onShowToast('正在启动系统...', 'info');
      await start.mutateAsync();
      // Success toast will be shown when WebSocket confirms
      // isUpdating will be cleared when status changes
    } catch (error: any) {
      onShowToast(error.message || '启动失败', 'error');
      setIsUpdating(false);
      setPendingAction(null);
    }
  };

  const handleStop = async () => {
    try {
      setIsUpdating(true);
      setPendingAction('stop');
      onShowToast('正在停止系统...', 'info');
      await stop.mutateAsync();
      // Success toast will be shown when WebSocket confirms
      // isUpdating will be cleared when status changes
    } catch (error: any) {
      onShowToast(error.message || '停止失败', 'error');
      setIsUpdating(false);
      setPendingAction(null);
    }
  };

  const handleUpdateInterval = async () => {
    if (interval < 5 || interval > 120) {
      onShowToast('分析间隔必须在5-120分钟之间', 'error');
      return;
    }

    try {
      setIsUpdating(true);
      await updateConfig.mutateAsync({ interval_minutes: interval });
      onShowToast('分析间隔已更新', 'success');
    } catch (error: any) {
      onShowToast(error.message || '更新失败', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading || configLoading) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
        <div className="flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mr-3" />
          <span className="text-text-secondary">加载系统状态...</span>
        </div>
      </div>
    );
  }

  const isRunning = status?.is_running || false;
  const currentInterval = status?.interval_minutes || interval;
  const nextRunTime = status?.next_run_time;

  return (
    <>
      {/* Compact Control Bar */}
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border px-3 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Status */}
          <div className="flex items-center space-x-2 md:space-x-4 min-w-0 flex-1">
            <div className="flex items-center flex-shrink-0">
              <span className={`w-2 h-2 md:w-3 md:h-3 rounded-full mr-1 md:mr-2 ${
                isRunning ? 'bg-green-600 animate-pulse' : 'bg-text-muted'
              }`} />
              <span className="text-xs md:text-sm font-medium text-text-primary whitespace-nowrap">
                {isRunning ? '运行中' : '已停止'}
              </span>
            </div>
            {isRunning && nextRunTime && (
              <div className="text-xs md:text-sm font-medium text-text-primary truncate">
                <i className="fas fa-clock mr-1" />
                <span className="hidden sm:inline">下次分析时间: </span>
                <span className="sm:hidden">下次: </span>
                {new Date(nextRunTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
          </div>

          {/* Right: Control Buttons */}
          <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
            {/* Start/Stop Button */}
            {isRunning ? (
              <button
                onClick={handleStop}
                disabled={isUpdating}
                className="w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2 text-xs md:text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="停止系统"
              >
                {isUpdating && pendingAction === 'stop' ? (
                  <i className="fas fa-spinner fa-spin md:mr-2" />
                ) : (
                  <i className="fas fa-stop md:mr-2" />
                )}
                <span className="hidden md:inline">停止</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={isUpdating}
                className="w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2 text-xs md:text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="启动系统"
              >
                {isUpdating && pendingAction === 'start' ? (
                  <i className="fas fa-spinner fa-spin md:mr-2" />
                ) : (
                  <i className="fas fa-play md:mr-2" />
                )}
                <span className="hidden md:inline">启动</span>
              </button>
            )}

            {/* Config Button */}
            <button
              onClick={() => setShowConfigModal(true)}
              className="w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2 text-xs md:text-sm bg-dark-tertiary text-text-primary rounded-md hover:bg-dark-primary border border-dark-border transition-colors flex items-center justify-center"
              title="系统配置"
            >
              <i className="fas fa-cog" />
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-secondary rounded-lg shadow-xl border border-dark-border max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 px-6 py-4 border-b border-dark-border flex items-center justify-between bg-dark-secondary">
              <h3 className="text-xl font-bold text-text-primary">
                <i className="fas fa-cog mr-2 text-blue-600" />
                系统配置
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-text-muted hover:text-text-secondary"
              >
                <i className="fas fa-times text-xl" />
              </button>
            </div>

            {/* Tabs - Fixed */}
            <div className="flex-shrink-0 border-b border-dark-border bg-dark-secondary">
              <nav className="flex -mb-px px-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveConfigTab('basic')}
                  className={`py-4 px-6 text-sm font-medium border-b-2 ${
                    activeConfigTab === 'basic'
                      ? 'border-accent-primary text-accent-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-dark-border'
                  }`}
                >
                  <i className="fas fa-sliders-h mr-2" />
                  基础配置
                </button>
                <button
                  onClick={() => setActiveConfigTab('prompt')}
                  className={`py-4 px-6 text-sm font-medium border-b-2 ${
                    activeConfigTab === 'prompt'
                      ? 'border-accent-primary text-accent-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-dark-border'
                  }`}
                >
                  <i className="fas fa-robot mr-2" />
                  提示词配置
                </button>
              </nav>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {activeConfigTab === 'basic' ? (
                <>
              {/* Info banner if using analysis config */}
              {config?.is_using_analysis_config && futuApiUrl && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="flex items-start">
                    <i className="fas fa-info-circle text-blue-600 mt-0.5 mr-2" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">当前使用启动分析页面的配置</p>
                      <p className="text-xs mt-1">如需单独配置智能盯盘，请修改下方设置并保存</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Futu API URL */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  富途API地址 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={futuApiUrl}
                  onChange={(e) => handleFutuApiUrlChange(e.target.value)}
                  placeholder="http://localhost:8080"
                  className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
                />
                <p className="text-xs text-text-tertiary mt-1">
                  富途OpenAPI服务地址
                </p>
              </div>

              {/* Futu API Key with Validate Button */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  <i className="fas fa-key mr-1" />
                  富途API密钥 <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={futuApiKey}
                      onChange={(e) => handleFutuApiKeyChange(e.target.value)}
                      placeholder="请输入富途API密钥"
                      className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      <i className={`fas ${showApiKey ? 'fa-eye-slash' : 'fa-eye'} text-text-muted hover:text-text-secondary`} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={validateConfig}
                    disabled={validatingConfig || !futuApiUrl || !futuApiKey}
                    className={`px-4 py-2 rounded-md border font-medium transition-colors ${
                      configValidated
                        ? 'bg-success-500/20 border-success-500 text-success-500'
                        : 'bg-dark-tertiary border-dark-border text-text-primary hover:bg-dark-primary'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {validatingConfig ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-1" />
                        验证中
                      </>
                    ) : configValidated ? (
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
                <p className="text-xs text-text-tertiary mt-1">
                  <i className="fas fa-lock mr-1" />
                  富途OpenAPI密钥，用于身份验证
                </p>
              </div>

              {/* Interval */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  分析间隔（分钟） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  min={5}
                  max={120}
                  className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
                />
                <p className="text-xs text-text-tertiary mt-1">
                  系统每隔多少分钟执行一次分析（范围：5-120分钟，默认60分钟）
                </p>
              </div>

              {/* Market Selection */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  分析市场 <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center space-x-6">
                  {[
                    { value: 'US', label: '美股', icon: '🇺🇸' },
                    { value: 'HK', label: '港股', icon: '🇭🇰' },
                    { value: 'CN', label: 'A股', icon: '🇨🇳' },
                  ].map((market) => (
                    <label key={market.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMarkets.includes(market.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMarkets([...selectedMarkets, market.value]);
                          } else {
                            setSelectedMarkets(selectedMarkets.filter(m => m !== market.value));
                          }
                        }}
                        className="w-4 h-4 text-accent-primary border-dark-border rounded focus:ring-accent-primary bg-dark-tertiary"
                      />
                      <span className="text-sm text-text-primary">
                        {market.icon} {market.label}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-text-tertiary mt-1">
                  选择要分析的市场，可多选。系统会按顺序检查每个市场的开盘状态
                </p>
              </div>

              {/* LLM Configuration Section */}
              <div className="border-t border-dark-border pt-4 mt-4">
                <h4 className="text-sm font-semibold text-text-primary mb-3">
                  <i className="fas fa-brain mr-2 text-accent-secondary" />
                  LLM 配置
                </h4>
                <p className="text-xs text-text-tertiary mb-3">
                  配置用于智能盯盘分析的 LLM 服务商和模型，如不配置将使用分析页面的缓存配置
                </p>

                {/* LLM Provider */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    LLM 提供商 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={llmProvider}
                    onChange={(e) => handleLlmProviderChange(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    required
                    disabled={loadingApiConfig}
                  >
                    <option value="" className="bg-dark-tertiary text-text-primary">
                      {loadingApiConfig ? '加载中...' : '请选择 LLM 服务商...'}
                    </option>
                    {getLlmProviders().map((provider) => (
                      <option key={provider.value} value={provider.value} className="bg-dark-tertiary text-text-primary">
                        {provider.label} - {provider.description}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-text-tertiary mt-1">
                    选择用于智能盯盘分析的 LLM 提供商
                  </p>
                </div>

                {/* LLM API Key */}
                {llmProvider && llmProvider !== 'ollama' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      <i className="fas fa-key mr-1" />
                      LLM API 密钥 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <input
                          type={showLlmApiKey ? 'text' : 'password'}
                          value={llmApiKey}
                          onChange={(e) => handleLlmApiKeyChange(e.target.value)}
                          placeholder={`请输入 ${llmProvider.toUpperCase()} API 密钥`}
                          className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                          required
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                        >
                          <i className={`fas ${showLlmApiKey ? 'fa-eye-slash' : 'fa-eye'} text-text-muted hover:text-text-secondary`} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={validateLlmKey}
                        disabled={validatingLlmKey || !llmApiKey}
                        className={`px-4 py-2 rounded-md border font-medium transition-colors ${
                          llmKeyValidated
                            ? 'bg-success-500/20 border-success-500 text-success-500'
                            : 'bg-dark-tertiary border-dark-border text-text-primary hover:bg-dark-primary'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {validatingLlmKey ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-1" />
                            验证中
                          </>
                        ) : llmKeyValidated ? (
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
                    <p className="text-xs text-text-tertiary mt-1">
                      <i className="fas fa-lock mr-1" />
                      用于访问 {llmProvider.toUpperCase()} 服务的 API 密钥
                    </p>
                  </div>
                )}

                {/* Model Selection - Show when API key is validated or using Ollama */}
                {llmProvider && (llmKeyValidated || llmProvider === 'ollama') && (
                  <div className="border-t border-dark-border pt-4 mt-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <i className="fas fa-brain text-purple-600" />
                      <span className="font-medium text-purple-700">选择 LLM 模型</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        <i className="fas fa-robot mr-1" />
                        LLM 模型 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={llmModel}
                        onChange={(e) => handleLlmModelChange(e.target.value)}
                        className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
                        required
                      >
                        <option value="" className="bg-dark-tertiary text-text-primary">选择模型...</option>
                        {getModelsForProvider(llmProvider, 'deep').map((model) => (
                          <option key={model.value} value={model.value} className="bg-dark-tertiary text-text-primary">
                            {model.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-text-tertiary mt-1">
                        用于智能盯盘分析和决策（使用深度思考模型选项）
                      </p>
                    </div>
                  </div>
                )}
              </div>

                <div className="px-6 py-4 border-t border-dark-border flex justify-end space-x-2">
                  <button
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 text-text-primary bg-dark-tertiary rounded-md hover:bg-dark-primary border border-dark-border"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={isUpdating || !futuApiUrl}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-save mr-2" />
                    保存配置
                  </button>
                </div>
                </>
              ) : (
                <PromptConfigTab onShowToast={onShowToast} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
