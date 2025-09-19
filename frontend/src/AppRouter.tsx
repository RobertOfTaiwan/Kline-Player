import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { HomePage } from './components/pages/HomePage';
import { KlinePlayer } from './components/kline/KlinePlayer';
import { KlineSettingsPanel } from './components/kline/KlineSettingsPanel';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UserManagement } from './components/admin/UserManagement';
import { SymbolManagement } from './components/admin/SymbolManagement';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { KlinePlayerProvider } from './contexts/KlinePlayerContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

function ProtectedRoute({ children, requiredRoles = [] }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated && requiredRoles.length > 0) {
    return <Navigate to="/" replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(user?.role || 'guest')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  return (
    <KlinePlayerProvider>
      <MainLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/kline-player/*" element={
            <Routes>
              <Route index element={<KlinePlayer />} />
              <Route path="settings" element={<KlineSettingsPanel />} />
              <Route path="controls" element={<KlineSettingsPanel />} />
              <Route path="indicators" element={<KlineSettingsPanel />} />
            </Routes>
          } />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/symbols"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <SymbolManagement />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </KlinePlayerProvider>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}