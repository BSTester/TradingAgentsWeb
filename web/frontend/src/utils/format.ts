// Formatting utilities

export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatPercentage = (value: number, decimals = 2): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

export const formatNumber = (value: number, decimals = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatLargeNumber = (value: number): string => {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toString();
};

export const formatConfidence = (confidence: number): string => {
  return `${Math.round(confidence * 100)}%`;
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

export const capitalizeFirst = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const formatTicker = (ticker: string): string => {
  return ticker.toUpperCase();
};

export const formatAnalysisStatus = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'error':
      return 'Error';
    default:
      return capitalizeFirst(status);
  }
};

export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'queued':
      return 'text-warning-600 bg-warning-50';
    case 'running':
      return 'text-info-600 bg-info-50';
    case 'completed':
      return 'text-success-600 bg-success-50';
    case 'error':
      return 'text-danger-600 bg-danger-50';
    default:
      return 'text-secondary-600 bg-secondary-50';
  }
};

export const formatLogLevel = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'info':
      return 'INFO';
    case 'warning':
      return 'WARN';
    case 'error':
      return 'ERROR';
    case 'debug':
      return 'DEBUG';
    default:
      return level.toUpperCase();
  }
};

export const getLogLevelColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'info':
      return 'text-info-600';
    case 'warning':
      return 'text-warning-600';
    case 'error':
      return 'text-danger-600';
    case 'debug':
      return 'text-secondary-600';
    default:
      return 'text-gray-600';
  }
};

// Utility function for combining class names (similar to clsx)
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};