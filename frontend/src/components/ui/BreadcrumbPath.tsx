import { useLocation } from 'react-router-dom';
import { Home, TrendingUp, Settings, Users, Database, ChevronRight } from 'lucide-react';

interface RouteInfo {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  parent?: string;
}

const routeConfig: Record<string, RouteInfo> = {
  '/': { name: '首頁', icon: Home },
  '/kline-player': { name: 'K線播放器', icon: TrendingUp },
  '/admin': { name: '管理者選項', icon: Settings },
  '/admin/users': { name: '用戶管理', icon: Users, parent: '/admin' },
  '/admin/symbols': { name: '幣別管理', icon: Database, parent: '/admin' },
};

export function BreadcrumbPath() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const getCurrentRoute = (): RouteInfo => {
    return routeConfig[currentPath] || { name: '未知頁面', icon: Home };
  };

  const getParentRoute = (): RouteInfo | null => {
    const current = routeConfig[currentPath];
    if (current?.parent) {
      return routeConfig[current.parent];
    }
    return null;
  };

  const currentRoute = getCurrentRoute();
  const parentRoute = getParentRoute();

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-600">
      {parentRoute && (
        <>
          <parentRoute.icon className="h-4 w-4" />
          <span className="font-medium">{parentRoute.name}</span>
          <ChevronRight className="h-3 w-3" />
        </>
      )}
      <currentRoute.icon className="h-4 w-4" />
      <span className="font-medium text-gray-800">{currentRoute.name}</span>
    </div>
  );
}
