import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, Settings, LogOut, Home, TrendingUp, Users, Database, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { KlinePlayerSidebar } from '@/components/kline/KlinePlayerSidebar';
import { PriceTicker } from '@/components/ui/PriceTicker';
import { BreadcrumbPath } from '@/components/layout/BreadcrumbPath';

interface MainLayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  children?: NavigationItem[];
}

const navigation: NavigationItem[] = [
  { name: '首頁', href: '/', icon: Home },
  {
    name: 'K線播放器',
    href: '/kline-player',
    icon: TrendingUp,
  },
  {
    name: '管理者選項',
    href: '/admin',
    icon: Settings,
    roles: ['admin'],
    children: [
      { name: '用戶管理', href: '/admin/users', icon: Users, roles: ['admin'] },
      { name: '幣別管理', href: '/admin/symbols', icon: Database, roles: ['admin'] },
    ]
  },
];

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({});
  const [klinePlayerExpanded, setKlinePlayerExpanded] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalType, setAuthModalType] = useState<'login' | 'register'>('login');

  const handleLogin = () => {
    setAuthModalType('login');
    setAuthModalOpen(true);
  };

  const handleRegister = () => {
    setAuthModalType('register');
    setAuthModalOpen(true);
  };

  const handleLogout = () => {
    logout();
  };

  const handleAuthSuccess = () => {
    setAuthModalOpen(false);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleItemExpansion = (itemName: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const filteredNavigation = navigation.filter(item =>
    !item.roles || item.roles.includes(user?.role || 'guest')
  );

  const toggleKlinePlayerExpansion = () => {
    setKlinePlayerExpanded(!klinePlayerExpanded);
  };

  const renderNavigationItem = (item: NavigationItem, isMobile = false) => {
    const isActive = location.pathname === item.href ||
      (item.children && item.children.some(child => location.pathname === child.href));
    const isExpanded = expandedItems[item.name];
    const hasChildren = item.children && item.children.length > 0;
    
    // 特殊處理 K線播放器
    const isKlinePlayer = item.name === 'K線播放器';
    const showKlineControls = isKlinePlayer && location.pathname === item.href && klinePlayerExpanded;

    return (
      <div key={item.name}>
        <div className="flex items-center">
          <Link
            to={item.href}
            className={`flex-1 group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
              isActive && !hasChildren
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <item.icon className={`${sidebarCollapsed && !isMobile ? 'mr-0' : 'mr-3'} h-5 w-5 transition-colors ${
              isActive && !hasChildren
                ? 'text-blue-500'
                : 'text-gray-400 group-hover:text-gray-500'
            }`} />
            {(!sidebarCollapsed || isMobile) && (
              <span className="truncate">{item.name}</span>
            )}
          </Link>
          {/* K線播放器的展開/收合按鈕 */}
          {isKlinePlayer && location.pathname === item.href && (!sidebarCollapsed || isMobile) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto p-1 h-8 w-8"
              onClick={toggleKlinePlayerExpansion}
            >
              {klinePlayerExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          {/* 原有的子項目展開按鈕 */}
          {hasChildren && (!sidebarCollapsed || isMobile) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto p-1 h-8 w-8"
              onClick={() => toggleItemExpansion(item.name)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {hasChildren && isExpanded && (!sidebarCollapsed || isMobile) && (
          <div className="ml-6 mt-1 space-y-1">
            {item.children?.map(child => (
              <Link
                key={child.name}
                to={child.href}
                className={`group flex items-center px-2 py-1.5 text-sm rounded-md transition-colors ${
                  location.pathname === child.href
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <child.icon className={`mr-2 h-4 w-4 transition-colors ${
                  location.pathname === child.href
                    ? 'text-blue-500'
                    : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                <span className="truncate">{child.name}</span>
              </Link>
            ))}
          </div>
        )}
        {/* K線播放器的控制參數 */}
        {showKlineControls && (
          <KlinePlayerSidebar />
        )}
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-10 w-10 text-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
            <div className="h-0 flex-1 overflow-y-auto pt-5 pb-4">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold text-gray-900">K線播放器</h1>
              </div>
              <nav className="mt-5 space-y-1 px-2">
                {filteredNavigation.map((item) => renderNavigationItem(item, true))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
      }`}>
        <div className="flex flex-1 flex-col min-h-0 bg-white border-r border-gray-200">
          <div className="flex flex-1 flex-col pt-5 pb-4 overflow-y-auto">
            <div className={`flex items-center flex-shrink-0 px-4 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!sidebarCollapsed && (
                <h1 className="text-xl font-bold text-gray-900">K線播放器</h1>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebarCollapse}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className={`h-4 w-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </Button>
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {filteredNavigation.map((item) => renderNavigationItem(item, false))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex flex-col flex-1 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      }`}>
        {/* Top navigation */}
        <div className="sticky top-0 z-10 flex h-16 bg-white shadow flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          <div className="flex-1 px-4 flex items-center min-w-0">
            {/* 左側：路徑顯示 */}
            <div className="flex-shrink-0 hidden md:block w-48">
              <BreadcrumbPath />
            </div>

            {/* 中間：資訊顯示區 (跑馬燈) */}
            <div className="flex-1 mx-2 md:mx-4 min-w-0 overflow-hidden">
              <PriceTicker className="h-full flex items-center" />
            </div>

            {/* 右側：用戶選單區域 */}
            <div className="flex items-center flex-shrink-0 z-30 bg-white relative min-w-max pl-4">
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={undefined} alt={user?.name || '用戶'} />
                        <AvatarFallback>
                          {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name || '用戶'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email || '載入中...'}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      <span>個人資料</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>設定</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>登出</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" onClick={handleLogin}>
                    登入
                  </Button>
                  <Button size="sm" onClick={handleRegister}>
                    註冊
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 h-screen overflow-hidden">
          <div className="h-full">
            <div className="h-full mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultTab={authModalType}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}