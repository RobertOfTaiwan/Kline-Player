import { useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface PathSegment {
  name: string;
  path: string;
}

export function BreadcrumbPath() {
  const location = useLocation();

  const getPathSegments = (pathname: string): PathSegment[] => {
    const segments: PathSegment[] = [
      { name: '首頁', path: '/' }
    ];

    if (pathname === '/') {
      return segments;
    }

    if (pathname.startsWith('/kline-player')) {
      segments.push({ name: 'K線播放器', path: '/kline-player' });
    } else if (pathname.startsWith('/admin')) {
      segments.push({ name: '管理者選項', path: '/admin' });
      
      if (pathname === '/admin/users') {
        segments.push({ name: '用戶管理', path: '/admin/users' });
      } else if (pathname === '/admin/symbols') {
        segments.push({ name: '幣別管理', path: '/admin/symbols' });
      }
    }

    return segments;
  };

  const segments = getPathSegments(location.pathname);

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600">
      <Home className="h-4 w-4" />
      {segments.map((segment, index) => (
        <div key={segment.path} className="flex items-center">
          {index > 0 && <ChevronRight className="h-3 w-3 mx-1 text-gray-400" />}
          <span className={`${
            index === segments.length - 1 
              ? 'text-gray-900 font-medium' 
              : 'text-gray-500 hover:text-gray-700'
          } whitespace-nowrap`}>
            {segment.name}
          </span>
        </div>
      ))}
    </nav>
  );
}
