import { Link } from 'react-router-dom';
import { Users, Database, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Settings className="h-8 w-8 text-gray-700" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">管理者選項</h1>
          <p className="text-gray-600">系統管理與設定功能</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Users className="h-6 w-6 text-blue-600" />
              <CardTitle>用戶管理</CardTitle>
            </div>
            <CardDescription>
              管理系統用戶帳號、權限與角色設定
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/users">
              <Button className="w-full">
                進入用戶管理
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Database className="h-6 w-6 text-green-600" />
              <CardTitle>幣別管理</CardTitle>
            </div>
            <CardDescription>
              管理交易幣別、時間間隔與資料來源設定
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/symbols">
              <Button className="w-full">
                進入幣別管理
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* 預留空間給未來的管理功能 */}
        <Card className="hover:shadow-lg transition-shadow opacity-50">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Settings className="h-6 w-6 text-gray-400" />
              <CardTitle className="text-gray-500">系統設定</CardTitle>
            </div>
            <CardDescription className="text-gray-400">
              系統參數與全域配置（即將推出）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>
              即將推出
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">管理者說明</h3>
        <ul className="text-blue-700 space-y-1 text-sm">
          <li>• <strong>用戶管理：</strong>新增、編輯、刪除用戶帳號，設定用戶權限與角色</li>
          <li>• <strong>幣別管理：</strong>配置可用的交易幣別與時間間隔選項</li>
          <li>• 所有管理功能僅限管理者權限使用</li>
        </ul>
      </div>
    </div>
  );
}
