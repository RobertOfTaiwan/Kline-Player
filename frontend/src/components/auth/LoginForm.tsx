import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    otp_code: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const success = await login(formData.email, formData.password, formData.otp_code);
      if (success) {
        onSuccess?.();
      } else {
        setError('登入失敗，請檢查您的帳號密碼和驗證碼');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">登入帳號</CardTitle>
        <CardDescription>
          請輸入您的郵箱、密碼和 Google Authenticator 驗證碼
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">郵箱地址</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密碼</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="請輸入密碼"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp_code" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Google Authenticator 驗證碼
            </Label>
            <Input
              id="otp_code"
              name="otp_code"
              type="text"
              placeholder="請輸入6位數驗證碼"
              value={formData.otp_code}
              onChange={handleChange}
              maxLength={6}
              required
            />
            <p className="text-xs text-gray-500">
              請打開 Google Authenticator App 獲取驗證碼
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            登入
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          還沒有帳號？{' '}
          <button
            type="button"
            className="text-blue-600 hover:underline font-medium"
            onClick={onSwitchToRegister}
          >
            立即註冊
          </button>
        </div>
      </CardContent>
    </Card>
  );
}