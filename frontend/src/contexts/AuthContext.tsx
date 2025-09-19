import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiRequest, API_ENDPOINTS } from '@/config/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  is_approved: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, otp_code: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 檢查是否已登入
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      setIsAuthenticated(true); // 有 token 就表示已登入

      try {
        const response = await apiRequest('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          console.warn('Token validation failed:', response.status);
          // Token 無效，清除
          localStorage.removeItem('token');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string, otp_code: string): Promise<boolean> => {
    try {
      const response = await apiRequest(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          otp_code,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        setIsAuthenticated(true);

        // 獲取用戶信息
        try {
          const userResponse = await apiRequest('/api/auth/me');
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setUser(userData);
          } else {
            console.warn('Failed to fetch user info, but login was successful', userResponse.status);
          }
        } catch (userError) {
          console.warn('Error fetching user info:', userError);
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};