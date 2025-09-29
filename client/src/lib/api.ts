export function formatPrice(price: number, decimals: number = 2): string {
  if (isNaN(price) || price === null || price === undefined) {
    return '$0.00';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(price);
}

export function formatPercentage(value: number, decimals: number = 2): string {
  if (isNaN(value) || value === null || value === undefined) {
    return '0.00%';
  }
  
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatVolume(volume: number): string {
  if (isNaN(volume) || volume === null || volume === undefined || volume === 0) {
    return '$0';
  }
  
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`;
  } else if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(2)}M`;
  } else if (volume >= 1e3) {
    return `$${(volume / 1e3).toFixed(2)}K`;
  }
  return `$${volume.toFixed(2)}`;
}

export function formatMarketCap(marketCap: number): string {
  if (isNaN(marketCap) || marketCap === null || marketCap === undefined || marketCap === 0) {
    return '$0';
  }
  
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  } else if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  }
  return `$${marketCap.toFixed(2)}`;
}

export function formatCompactNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) {
    return '0';
  }
  
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(1)}B`;
  } else if (num >= 1e6) {
    return `${(num / 1e6).toFixed(1)}M`;
  } else if (num >= 1e3) {
    return `${(num / 1e3).toFixed(1)}K`;
  }
  return num.toString();
}

export function getTimeAgo(timestamp: string | Date): string {
  const now = new Date();
  const time = new Date(timestamp);
  
  if (isNaN(time.getTime())) {
    return 'Unknown';
  }
  
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0';
  }
  
  // Handle crypto currencies differently
  if (['BTC', 'ETH', 'SOL', 'ADA'].includes(currency)) {
    return `${amount.toFixed(8)} ${currency}`;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function generateSparklineData(length: number = 20, trend: 'up' | 'down' | 'flat' = 'up'): number[] {
  const data: number[] = [];
  let baseValue = 100;
  
  for (let i = 0; i < length; i++) {
    const randomVariation = (Math.random() - 0.5) * 10;
    
    if (trend === 'up') {
      baseValue += (Math.random() * 2) + randomVariation;
    } else if (trend === 'down') {
      baseValue -= (Math.random() * 2) + randomVariation;
    } else {
      baseValue += randomVariation;
    }
    
    data.push(Math.max(0, baseValue));
  }
  
  return data;
}

// Error handling utilities
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof Error && 
    (error.message.includes('fetch') || 
     error.message.includes('network') ||
     error.message.includes('connection'));
}

// Local storage utilities with error handling
export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to parse localStorage item "${key}":`, error);
    return defaultValue;
  }
}

export function setToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save to localStorage "${key}":`, error);
  }
}
