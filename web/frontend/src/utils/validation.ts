// Validation utilities

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateUsername = (username: string): boolean => {
  // Username should be 3-50 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
  return usernameRegex.test(username);
};

export const validatePassword = (password: string): boolean => {
  // Password should be at least 6 characters
  return password.length >= 6;
};

export const validateTicker = (ticker: string): boolean => {
  // Ticker should be 1-10 characters, letters and numbers only
  const tickerRegex = /^[A-Za-z0-9.]{1,10}$/;
  return tickerRegex.test(ticker);
};

export const validateApiKey = (apiKey: string, provider: string): boolean => {
  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }

  switch (provider) {
    case 'openai':
      // OpenAI API keys start with 'sk-'
      return apiKey.startsWith('sk-') && apiKey.length > 10;
    case 'anthropic':
      // Anthropic API keys start with 'sk-ant-'
      return apiKey.startsWith('sk-ant-') && apiKey.length > 15;
    case 'google':
      // Google API keys are typically 39 characters
      return apiKey.length >= 30;
    case 'openrouter':
      // OpenRouter API keys start with 'sk-or-'
      return apiKey.startsWith('sk-or-') && apiKey.length > 15;
    default:
      // Generic validation - at least 10 characters
      return apiKey.length >= 10;
  }
};

export const getPasswordStrength = (password: string): {
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Use at least 8 characters');
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include lowercase letters');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include uppercase letters');
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include numbers');
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include special characters');
  }

  return { score, feedback };
};

export const validateRequired = (value: string, fieldName: string): string | undefined => {
  if (!value || value.trim().length === 0) {
    return `${fieldName} is required`;
  }
  return undefined;
};

export const validateMinLength = (value: string, minLength: number, fieldName: string): string | undefined => {
  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }
  return undefined;
};

export const validateMaxLength = (value: string, maxLength: number, fieldName: string): string | undefined => {
  if (value.length > maxLength) {
    return `${fieldName} must be no more than ${maxLength} characters`;
  }
  return undefined;
};