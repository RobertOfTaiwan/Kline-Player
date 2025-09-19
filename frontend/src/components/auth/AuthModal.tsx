import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'register';
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onOpenChange, defaultTab = 'login', onSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab);

  const handleSuccess = () => {
    onSuccess?.();
    onOpenChange(false);
  };

  const switchToLogin = () => setActiveTab('login');
  const switchToRegister = () => setActiveTab('register');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {activeTab === 'login' ? (
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToRegister={switchToRegister}
          />
        ) : (
          <RegisterForm
            onSuccess={handleSuccess}
            onSwitchToLogin={switchToLogin}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}