/**
 * Hook for managing user configuration (server-side cached settings)
 * Replaces localStorage with server-side storage for better security and cross-device sync
 */

import { useState, useEffect } from 'react';
import { userConfigAPI } from '@/lib/apiClient';

export interface UserConfig {
  // Analysis configuration cache
  last_ticker?: string;  // 最后分析的股票代码
  last_analysts?: string[];
  last_research_depth?: number;
  last_llm_provider?: string;
  last_shallow_thinker?: string;
  last_deep_thinker?: string;
  last_backend_url?: string;
  
  // Trading executor configuration
  enable_trading_executor: boolean;
  futu_api_base_url?: string;
  futu_api_key?: string;
  
  // API key (single field for all providers)
  last_api_key?: string;  // Actual API key value
}

export interface UserConfigUpdate {
  last_ticker?: string;  // 最后分析的股票代码
  last_analysts?: string[];
  last_research_depth?: number;
  last_llm_provider?: string;
  last_shallow_thinker?: string;
  last_deep_thinker?: string;
  last_backend_url?: string;
  enable_trading_executor?: boolean;
  futu_api_base_url?: string;
  futu_api_key?: string;
  last_api_key?: string;  // Single API key field for all providers
}

export function useUserConfig(token: string | null) {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load config from server
  const loadConfig = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await userConfigAPI.getConfig();
      setConfig(data);

      // Clean up old localStorage data (one-time migration)
      if (typeof window !== 'undefined') {
        const oldKeys = [
          'analysts',
          'researchDepth',
          'llmProvider',
          'shallowThinker',
          'deepThinker',
          'backendUrl',
          'openaiApiKey',
          'anthropicApiKey',
          'googleApiKey',
          'openrouterApiKey',
          'trading_agents_config_cache' // 旧的缓存键
        ];
        oldKeys.forEach(key => localStorage.removeItem(key));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to load user config:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update config on server
  const updateConfig = async (updates: UserConfigUpdate): Promise<boolean> => {
    if (!token) {
      return false;
    }

    try {
      const data = await userConfigAPI.updateConfig(updates);
      setConfig(data);
      return true;
    } catch (err) {
      console.error('Failed to update user config:', err);
      return false;
    }
  };

  // Load config on mount or when token changes
  useEffect(() => {
    if (token) {
      loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Only re-run when token changes

  return {
    config,
    loading,
    error,
    loadConfig,
    updateConfig
  };
}
