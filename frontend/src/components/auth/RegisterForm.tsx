import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Shield, Check } from 'lucide-react';
import { apiRequest, API_ENDPOINTS } from '@/config/api';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

interface RegisterResponseData {
  message: string;
  email_sent: boolean;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('密碼確認不符');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('密碼至少需要6個字元');
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          password: formData.password
        }),
      });

      const data: RegisterResponseData = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setShowSuccessDialog(true);
        setFormData({ email: '', name: '', password: '', confirmPassword: '' });
      } else {
        setError(data.message || '註冊失敗');
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

  const handleSuccessClose = () => {
    setShowSuccessDialog(false);
    onSwitchToLogin?.();
  };

  return (
    <>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">建立新帳號</CardTitle>
          <CardDescription>
            請填寫以下資訊來建立您的帳號
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="請輸入您的姓名"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

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
                placeholder="至少6個字元"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">確認密碼</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="再次輸入密碼"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
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
              註冊帳號
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            已經有帳號？{' '}
            <button
              type="button"
              className="text-blue-600 hover:underline font-medium"
              onClick={onSwitchToLogin}
            >
              立即登入
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              註冊成功！
            </DialogTitle>
            <DialogDescription>
              {success}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-sm">
                我們已將 Google Authenticator 設定說明發送到您的郵箱。請檢查您的郵件並按照說明完成雙因子認證設定。
              </AlertDescription>
            </Alert>

            <div className="flex justify-end space-x-2">
              <Button onClick={handleSuccessClose}>
                前往登入
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}