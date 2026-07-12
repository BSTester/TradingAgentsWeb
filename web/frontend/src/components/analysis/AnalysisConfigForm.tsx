'use client';

import React, { useState, useEffect } from 'react';
import { analysisAPI, scheduledTasksAPI } from '@/lib/api';
import { normalizeTicker, validateTicker, getTickerErrorMessage } from '@/utils/tickerValidator';
import { ScheduleConfig, ScheduleData } from './ScheduleConfig';
import { useUserConfig } from '@/hooks/useUserConfig';
import { useAuth } from '@/lib/auth';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';
import { useUserLLMSettings } from '@/hooks/useUserLLMSettings';
import { ModelSelector, ModelOption } from './ModelSelector';

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
  const { data: llmSettings, isLoading: llmSettingsLoading } = useUserLLMSettings();
  const { getLocalKey, hasLocalKey, saveLocalKey } = useLocalLLMKeys();
  
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
  const [saveApiKeyToBrowser, setSaveApiKeyToBrowser] = useState(false);
  const [tickerError, setTickerError] = useState<string>('');
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  // Model-only selection: the user only ever sees model display names.
  const [selectedModelLabel, setSelectedModelLabel] = useState('');

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

  const enabledUserProviders = (llmSettings?.providers || []).filter((provider: any) => provider.is_enabled);
  const defaultUserProvider =
    enabledUserProviders.find((provider: any) => String(provider.id) === String(llmSettings?.default_provider_id)) ||
    enabledUserProviders.find((provider: any) => provider.is_default) ||
    enabledUserProviders[0] ||
    null;
  const selectedUserProvider =
    enabledUserProviders.find((provider: any) => provider.provider_name === formData.llm_provider) || null;
  const systemDefault = config?.system_default || null;
  const isUsingSystemDefault =
    !selectedUserProvider &&
    !!systemDefault?.provider_name &&
    systemDefault.provider_name === formData.llm_provider;

  // 检查当前选择的LLM提供商是否需要用户 API 密钥；系统默认使用后端 KEY，不要求用户输入
  const requiresApiKey = formData.llm_provider && formData.llm_provider !== 'ollama';
  const requiresUserApiKey = !!requiresApiKey && !isUsingSystemDefault;

  // 当前 provider 在本地浏览器是否已有保存的 KEY（不回显明文）
  const localKeyForProvider =
    requiresApiKey && hasLocalKey(formData.llm_provider)
      ? getLocalKey(formData.llm_provider)
      : null;

  // 是否提供了可用 KEY：本地已存 / 一次性输入 / 已手动验证
  const apiKeyProvided = apiKeyValidated || !!localKeyForProvider || !!formData.api_key.trim();

  const effectiveBackendUrl =
    selectedUserProvider?.base_url ||
    (isUsingSystemDefault ? systemDefault?.base_url : '') ||
    config?.llm_providers?.find((p: any) => p.value === formData.llm_provider)?.url ||
    '';

  // ---- Model-only selection (Workflow Desk privacy boundary) ----
  // The launch form shows model display names only. Provider / backend_url / api_key
  // are resolved silently (effectiveBackendUrl + localKeyForProvider above) when the
  // payload is built; they are never rendered here.
  const resolveModelLabel = (provider: string, shallow: string, deep: string): string => {
    const labelOf = (type: 'shallow' | 'deep', value: string) => {
      if (!value) return '';
      const arr = config?.models?.[String(provider || '').toLowerCase()]?.[type];
      const found = Array.isArray(arr) ? arr.find((m: any) => m?.value === value) : undefined;
      return found?.label || value;
    };
    const sh = labelOf('shallow', shallow);
    const dp = labelOf('deep', deep);
    if (sh && dp && sh !== dp) return `${sh} / ${dp}`;
    return dp || sh || '';
  };

  const handleModelSelect = (selection: ModelOption | null) => {
    setSelectedModelLabel(selection?.label || '');
    setApiKeyValidated(false);
    setFormData((prev) => ({
      ...prev,
      llm_provider: selection?.provider || '',
      shallow_thinker: selection?.shallow || '',
      deep_thinker: selection?.deep || '',
      api_key: '', // never carry a UI-entered key in the launch surface
    }));
  };

  // 从服务器加载配置（只加载一次）
  const [configLoaded, setConfigLoaded] = useState(false);
  
  useEffect(() => {
    // 防止重复加载
    if (configLoaded) return;
    
    if ((configLoading || llmSettingsLoading) && !configLoaded) return;

    if ((userConfig || llmSettings || config) && !configLoaded) {
      console.log('📋 加载用户配置:', userConfig);
      const initialProvider = defaultUserProvider?.provider_name || systemDefault?.provider_name || userConfig?.last_llm_provider || '';
      const initialShallow =
        defaultUserProvider?.shallow_model ||
        systemDefault?.shallow_model ||
        userConfig?.last_shallow_thinker ||
        '';
      const initialDeep =
        defaultUserProvider?.deep_model ||
        systemDefault?.deep_model ||
        userConfig?.last_deep_thinker ||
        '';
      
      // 加载服务端缓存的配置（注意：服务端不再返回用户明文 API KEY，KEY 仅存前端 localStorage）
      setFormData(prev => ({
        ...prev,
        ticker: userConfig?.last_ticker || '',  // 加载最后的股票代码
        analysts: userConfig?.last_analysts || ['market', 'social', 'news', 'fundamentals'],
        research_depth: userConfig?.last_research_depth || 1,
        llm_provider: initialProvider,
        shallow_thinker: initialShallow,
        deep_thinker: initialDeep,
        // api_key 不回填（安全约束：不回显明文 KEY，不把 KEY 写回后端/缓存）
        analysis_date: new Date().toISOString().split('T')[0] || ''
      }));
      
      // 加载执行交易配置
      setEnableTradingExecutor(userConfig?.enable_trading_executor || false);
      setFutuApiBaseUrl(userConfig?.futu_api_base_url || '');
      setFutuApiKey(userConfig?.futu_api_key || '');
      
      // 如果有富途 API 配置，设置为已验证
      if (userConfig?.enable_trading_executor && userConfig?.futu_api_base_url && userConfig?.futu_api_key) {
        setFutuApiValidated(true);
        console.log('✅ 富途 API 已验证（从缓存）');
      }
      
      console.log('✅ 配置加载完成');
      setSelectedModelLabel(resolveModelLabel(initialProvider, initialShallow, initialDeep));
      setConfigLoaded(true);
      onShowToast('已加载上次配置', 'info');
    } else if (!configLoading && !llmSettingsLoading && !userConfig && !configLoaded) {
      // 如果没有配置，设置默认值
      console.log('⚠️ 未找到用户配置，使用默认值');
      setFormData(prev => ({
        ...prev,
        analysts: ['market', 'social', 'news', 'fundamentals']
      }));
      setConfigLoaded(true);
    }
  }, [userConfig, configLoading, llmSettingsLoading, llmSettings, config, configLoaded, defaultUserProvider, systemDefault, onShowToast]);

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

  const effectiveProviderLabel =
    selectedUserProvider?.display_name ||
    systemDefault?.display_name ||
    llmProviders.find((provider: LLMProvider) => provider.value === formData.llm_provider)?.label ||
    formData.llm_provider;

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
    if (name === 'llm_provider') {
      setSaveApiKeyToBrowser(false);
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

    // 模型密钥由“我的模型”中的浏览器本地 KEY 静默提供；发起分析页不暴露 KEY 输入或来源。
    if (requiresUserApiKey && !apiKeyProvided) {
      onShowToast('该模型尚未在“我的模型”填写可用密钥，请先前往“我的模型”完成配置。', 'error');
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
        backend_url: effectiveBackendUrl,
        shallow_thinker: formData.shallow_thinker,
        deep_thinker: formData.deep_thinker,
        is_public: formData.is_public,
        enable_trading_executor: enableTradingExecutor,
        futu_api_base_url: enableTradingExecutor ? futuApiBaseUrl : undefined,
        futu_api_key: enableTradingExecutor ? futuApiKey : undefined,
        email_notification: formData.email_notification,
      };

      // 添加API密钥：优先用本浏览器已保存的本地 KEY，其次用本次一次性输入（绝不回显/持久化）
      const effectiveApiKey = localKeyForProvider || formData.api_key.trim() || undefined;
      if (effectiveApiKey) {
        requestData.api_key = effectiveApiKey;
      }
      if (formData.api_key.trim() && saveApiKeyToBrowser) {
        saveLocalKey(formData.llm_provider, formData.api_key.trim());
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
      console.log('Status:', response.status);

      // 检查是否是重复任务
      if (response.message) {
        // 重复任务，显示明确的警告提示
        console.log('Duplicate task detected, connecting to existing analysis:', response.analysis_id);
        onShowToast('⚠️ 该股票的分析任务已在进行中，已自动连接到现有任务。', 'warning');
        // 延迟一下再跳转，让用户看到提示
        setTimeout(() => {
          onAnalysisStart(response.analysis_id);
        }, 1500);
      } else if (response.status === 'queued') {
        // 任务排队中，跳转到历史记录页面
        console.log('Task queued, redirecting to history page');
        onShowToast('⏳ 分析任务已加入队列，请稍候...', 'info');
        setTimeout(() => {
          window.location.href = '/history';
        }, 1500);
      } else {
        // 新任务立即开始，跳转到进度页面
        console.log('Task started immediately, redirecting to progress page');
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
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border">
      <div className="p-4 md:p-6 border-b border-dark-border">
        <h3 className="text-base md:text-lg font-semibold text-text-primary">
          <i className="fas fa-cog mr-2 text-accent-primary" />
          配置分析
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6 md:space-y-8 pb-20 md:pb-6">
        {/* 步骤1: 股票代码 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <h4 className="text-lg font-medium text-text-primary">股票代码</h4>
          </div>
          <div className="ml-11">
            <label htmlFor="ticker" className="block text-sm font-medium text-text-secondary mb-2">
              输入要分析的股票代码
            </label>
            <input
              type="text"
              id="ticker"
              name="ticker"
              value={formData.ticker}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 md:py-2 h-12 md:h-auto text-base md:text-sm bg-dark-tertiary text-white border rounded-md focus:outline-none focus:ring-2 focus:border-transparent transition-all ${tickerError
                ? 'border-danger-500 focus:ring-danger-500'
                : 'border-dark-border focus:ring-accent-primary'
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
            <p className="text-sm text-text-tertiary mt-2">
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
            <h4 className="text-lg font-medium text-text-primary">分析日期</h4>
          </div>
          <div className="ml-11">
            <label htmlFor="analysis_date" className="block text-sm font-medium text-text-secondary mb-2">
              选择分析日期
            </label>
            <input
              type="date"
              id="analysis_date"
              name="analysis_date"
              value={formData.analysis_date}
              onChange={handleInputChange}
              className="w-full px-3 py-2 h-12 md:h-auto text-base md:text-sm bg-dark-tertiary border border-dark-border text-white rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
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
            <h4 className="text-lg font-medium text-text-primary">分析师团队</h4>
          </div>
          <div className="ml-11">
            <p className="text-sm text-text-secondary mb-4">选择您的LLM分析师智能体进行分析</p>
            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              {availableAnalysts.map((analyst: Analyst) => (
                <div
                  key={analyst.value}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${formData.analysts.includes(analyst.value)
                    ? 'border-accent-primary bg-accent-primary/10 shadow-glow-cyan'
                    : 'border-dark-border hover:border-accent-primary/50 bg-dark-tertiary'
                    }`}
                  onClick={() => handleAnalystToggle(analyst.value)}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.analysts.includes(analyst.value)}
                      onChange={() => handleAnalystToggle(analyst.value)}
                      className="mt-1 h-6 w-6 md:h-5 md:w-5 text-accent-primary focus:ring-accent-primary border-dark-border rounded cursor-pointer bg-dark-secondary min-w-touch min-h-touch md:min-w-0 md:min-h-0"
                    />
                    <div className="flex-1">
                      <h5 className="font-medium text-text-primary text-base md:text-sm">{analyst.label}</h5>
                      <p className="text-sm text-text-secondary">{analyst.description}</p>
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
            <h4 className="text-lg font-medium text-text-primary">研究深度</h4>
          </div>
          <div className="ml-11">
            <p className="text-sm text-text-secondary mb-4">选择您的研究深度级别</p>
            <div className="space-y-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
              {researchDepths.map((depth: ResearchDepth) => (
                <div
                  key={depth.value}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${formData.research_depth === depth.value
                    ? 'border-accent-primary bg-accent-primary/10 shadow-glow-cyan'
                    : 'border-dark-border hover:border-accent-primary/50 bg-dark-tertiary'
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
                      className="mt-1 h-5 w-5 text-accent-primary focus:ring-accent-primary border-dark-border cursor-pointer bg-dark-secondary"
                    />
                    <div>
                      <h5 className="font-medium text-text-primary">{depth.label}</h5>
                      <p className="text-sm text-text-secondary">{depth.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 步骤5: 模型（Workflow Desk — 只展示模型名，Provider/Endpoint/密钥状态不在此暴露） */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-accent-primary text-dark-primary rounded-full flex items-center justify-center text-sm font-bold">
              5
            </div>
            <h4 className="text-lg font-medium text-text-primary">模型</h4>
          </div>
          <div className="ml-11 space-y-3">
            <ModelSelector
              config={config}
              value={selectedModelLabel}
              onChange={handleModelSelect}
            />
            {formData.llm_provider && requiresUserApiKey && !localKeyForProvider && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-sm text-warning-500"
              >
                <i className="fas fa-triangle-exclamation mr-2" aria-hidden="true" />
                该模型尚未在“我的模型”填写可用密钥，请前往“我的模型”完成配置后再发起分析。
              </div>
            )}
          </div>
        </div>

        {/* 执行交易配置 */}
        <div className="bg-dark-tertiary rounded-lg border border-dark-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <i className="fas fa-robot text-accent-primary"></i>
                执行交易
              </h4>
              <p className="text-sm text-text-secondary mt-1">
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
                <label htmlFor="futu_api_base_url" className="block text-sm font-medium text-text-secondary mb-2">
                  富途 API Base URL
                  <span className="text-danger-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  id="futu_api_base_url"
                  value={futuApiBaseUrl}
                  onChange={(e) => handleFutuApiBaseUrlChange(e.target.value)}
                  placeholder="http://localhost:8000"
                  className="w-full px-4 py-2 bg-dark-secondary border border-dark-border text-white rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
                  required={enableTradingExecutor}
                />
              </div>
              
              <div>
                <label htmlFor="futu_api_key" className="block text-sm font-medium text-text-secondary mb-2">
                  <i className="fas fa-key mr-1" />
                  富途 API Key
                  <span className="text-danger-500 ml-1">*</span>
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      id="futu_api_key"
                      value={futuApiKey}
                      onChange={(e) => handleFutuApiKeyChange(e.target.value)}
                      placeholder="输入富途 API Key"
                      className="w-full px-3 py-2 bg-dark-secondary border border-dark-border text-white rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
                      required={enableTradingExecutor}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      <i className={`fas ${showApiKey ? 'fa-eye-slash' : 'fa-eye'} text-text-tertiary hover:text-accent-primary transition-colors`} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={validateFutuApi}
                    disabled={!futuApiBaseUrl || !futuApiKey || validatingFutuApi}
                    className={`px-4 py-2 rounded-md border font-medium transition-colors ${
                      futuApiValidated
                        ? 'bg-success-500/20 border-success-500 text-success-500'
                        : 'bg-dark-tertiary border-dark-border text-text-secondary hover:bg-dark-secondary'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {validatingFutuApi ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-1" />
                        验证中
                      </>
                    ) : futuApiValidated ? (
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
                  API Key 将安全地保存在服务器上
                </p>
              </div>
              
              <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-lg p-3">
                <p className="text-sm text-text-secondary">
                  <i className="fas fa-info-circle mr-2 text-accent-primary"></i>
                  <strong className="text-text-primary">注意：</strong>执行交易将在分析完成后自动执行模拟交易操作，包括投资组合管理、仓位控制和自动止盈止损。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 隐私授权和邮件通知 - 左右排列 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 隐私授权 */}
          <div className="bg-warning-500/10 border-l-4 border-warning-500 p-4 rounded">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <i className="fas fa-info-circle text-warning-500 text-xl mt-0.5" />
              </div>
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-bold text-text-primary mb-2">隐私授权</h4>
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={formData.is_public}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                    className="mt-1 h-4 w-4 text-accent-primary focus:ring-accent-primary border-dark-border rounded cursor-pointer bg-dark-secondary"
                  />
                  <label htmlFor="is_public" className="text-sm text-text-secondary cursor-pointer">
                    我同意将此分析结果公开展示在最新分析列表中，供其他用户参考学习。
                    <span className="block mt-1 text-xs text-text-tertiary">
                      （不勾选则仅自己可见，勾选后将在首页最新分析中展示）
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 邮件通知 */}
          <div className="bg-accent-primary/10 border-l-4 border-accent-primary p-4 rounded">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <i className="fas fa-envelope text-accent-primary text-xl mt-0.5" />
              </div>
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-bold text-text-primary mb-2">邮件通知</h4>
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="email_notification"
                    checked={formData.email_notification}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_notification: e.target.checked }))}
                    className="mt-1 h-4 w-4 text-accent-primary focus:ring-accent-primary border-dark-border rounded cursor-pointer bg-dark-secondary"
                  />
                  <label htmlFor="email_notification" className="text-sm text-text-secondary cursor-pointer">
                    分析完成后发送邮件通知到我的注册邮箱
                    <span className="block mt-1 text-xs text-text-tertiary">
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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-secondary rounded-lg shadow-xl border border-dark-border max-w-md w-full p-4 md:p-6 animate-fade-in">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <i className="fas fa-shield-alt text-accent-primary text-2xl md:text-3xl" />
              </div>
              <div className="ml-3 md:ml-4">
                <h3 className="text-responsive-h4 text-text-primary mb-2">
                  隐私设置确认
                </h3>
                <div className="text-sm text-text-secondary space-y-2">
                  {formData.is_public ? (
                    <>
                      <p className="flex items-start">
                        <i className="fas fa-check-circle text-success-500 mr-2 mt-0.5" />
                        <span>您已同意将分析结果<strong className="text-success-400">公开展示</strong>在最新分析列表上</span>
                      </p>
                      <p className="ml-6 text-xs text-text-tertiary">
                        其他用户可以在首页最新分析中查看您的分析结果，这有助于社区学习交流
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="flex items-start">
                        <i className="fas fa-lock text-text-tertiary mr-2 mt-0.5" />
                        <span>您的分析结果将<strong className="text-text-primary">仅自己可见</strong></span>
                      </p>
                      <p className="ml-6 text-xs text-text-tertiary">
                        分析结果不会出现在公开排行榜中，只有您可以查看
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:space-x-3 mt-6">
              <button
                onClick={() => setShowPrivacyDialog(false)}
                className="w-full md:flex-1 px-4 py-3 md:py-2 border border-dark-border rounded-lg text-text-primary bg-dark-tertiary hover:bg-dark-primary transition-colors min-h-touch"
              >
                取消
              </button>
              <button
                onClick={confirmStartAnalysis}
                className="w-full md:flex-1 px-4 py-3 md:py-2 bg-accent-primary text-dark-primary rounded-lg hover:bg-accent-secondary transition-colors font-medium min-h-touch"
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
