// API 配置
export const API_BASE_URL = 'http://localhost:5002';

// API 端點
export const API_ENDPOINTS = {
  // 認證相關
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',

  // K線資料
  KLINES: '/api/klines',
  SYMBOLS: '/api/symbols',
  INTERVALS: '/api/intervals',
  LIVE_PRICES: '/api/live-prices',
  HEALTH: '/api/health',

  // 管理員功能
  ADMIN_USERS: '/api/admin/users',
  ADMIN_SYMBOLS: '/api/admin/symbols',
};

// API 請求幫助函數
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // 添加認證 token
  const token = localStorage.getItem('token');
  if (token) {
    defaultOptions.headers = {
      ...defaultOptions.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  return fetch(url, mergedOptions);
};