/**
 * API client for prompt template management
 */

import axios from 'axios';
import { buildApiUrl } from '@/utils/api';

/**
 * Get auth token from localStorage
 */
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
};

export interface Tool {
  id: number;
  tool_name: string;
  tool_description: string;
  tool_parameters: Record<string, any>;
  category: string;
  is_available: boolean;
}

export interface PromptTemplate {
  id: number;
  agent_type: string;
  user_id: number;
  system_prompt: string;
  template_name: string | null;
  description: string | null;
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  enabled_tools: string[];
}

export interface ToolSelection {
  tool_name: string;
  is_enabled: boolean;
}

/**
 * Get list of all available tools
 */
export async function getAvailableTools(category?: string): Promise<Tool[]> {
  const token = getAuthToken();
  const params = category ? { category } : {};
  
  const response = await axios.get(buildApiUrl('/api/prompts/tools'), {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  
  return response.data;
}

/**
 * Get current user's prompt template
 */
export async function getPromptTemplate(agentType: string = 'intraday_trader'): Promise<PromptTemplate> {
  const token = getAuthToken();
  
  const response = await axios.get(buildApiUrl(`/api/prompts/templates/${agentType}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  return response.data;
}

/**
 * Update prompt template
 */
export async function updatePromptTemplate(
  agentType: string,
  data: {
    system_prompt?: string;
    template_name?: string | undefined;
    description?: string | undefined;
    version?: string;
  }
): Promise<PromptTemplate> {
  const token = getAuthToken();
  
  const response = await axios.put(
    buildApiUrl(`/api/prompts/templates/${agentType}`),
    data,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}

/**
 * Reset template to default
 */
export async function resetToDefault(agentType: string = 'intraday_trader'): Promise<PromptTemplate> {
  const token = getAuthToken();
  
  const response = await axios.post(
    buildApiUrl(`/api/prompts/templates/${agentType}/reset`),
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}

/**
 * Get enabled tools for template
 */
export async function getEnabledTools(agentType: string = 'intraday_trader'): Promise<string[]> {
  const token = getAuthToken();
  
  const response = await axios.get(
    buildApiUrl(`/api/prompts/templates/${agentType}/tools`),
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}

/**
 * Update tool selection
 */
export async function updateToolSelection(
  agentType: string,
  tools: ToolSelection[]
): Promise<{ message: string }> {
  const token = getAuthToken();
  
  const response = await axios.put(
    buildApiUrl(`/api/prompts/templates/${agentType}/tools`),
    { tools },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  message: string;
  total_length?: number;  // Final assembled prompt character count
}

/**
 * Validate prompt template before saving
 */
export async function validatePromptTemplate(
  agentType: string,
  data: {
    system_prompt: string;
    template_name?: string;
    description?: string;
  }
): Promise<ValidationResult> {
  const token = getAuthToken();
  
  const response = await axios.post(
    buildApiUrl(`/api/prompts/templates/${agentType}/validate`),
    data,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}
