// 常用 LLM 服务商（WS-133）。前台「自定义模型」与后台「LLM 配置」共用同一份厂商列表，
// 全部为市面上常见厂商，不提供自定义项。
export interface CommonProvider {
  value: string;
  label: string;
  base_url: string;
  models: string[];
}

export const COMMON_PROVIDERS: CommonProvider[] = [
  { value: 'openai', label: 'OpenAI', base_url: 'https://api.openai.com/v1', models: ['gpt-5.5', 'gpt-4o', 'gpt-4o-mini', 'o1-mini'] },
  { value: 'anthropic', label: 'Anthropic (Claude)', base_url: 'https://api.anthropic.com', models: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'] },
  { value: 'deepseek', label: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { value: 'google', label: 'Google Gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
  { value: 'moonshot', label: 'Moonshot (Kimi)', base_url: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
  { value: 'qwen', label: '阿里云 · 通义千问', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-max', 'qwen-turbo'] },
  { value: 'openrouter', label: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', models: ['openrouter/auto'] },
];

export function findCommonProvider(value: string): CommonProvider | undefined {
  return COMMON_PROVIDERS.find((p) => p.value === value);
}
