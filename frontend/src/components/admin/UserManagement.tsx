import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Trash2,
  User,
  Mail,
  Calendar,
  MoreHorizontal,
  UserCheck,
  UserX
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiRequest, API_ENDPOINTS } from '@/config/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  is_approved: boolean;
  created_at: string;
  last_login_date?: string;
  login_count?: number;
  last_login_ip?: string;
}

interface CreateUserData {
  email: string;
  name: string;
  password: string;
  role: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createData, setCreateData] = useState<CreateUserData>({
    email: '',
    name: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiRequest(API_ENDPOINTS.ADMIN_USERS);

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError('無法載入用戶列表');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setError('');

    try {
      // 使用註冊端點創建用戶
      const response = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: createData.email,
          name: createData.name,
          password: createData.password
        }),
      });

      if (response.ok) {
        setShowCreateDialog(false);
        setCreateData({ email: '', name: '', password: '', role: 'user' });
        setError('用戶創建成功！新用戶需要等待管理員核准。');
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.detail || '建立用戶失敗');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: number, isApproved: boolean) => {
    try {
      const endpoint = isApproved ? 'reject' : 'approve';
      const response = await apiRequest(`${API_ENDPOINTS.ADMIN_USERS}/${userId}/${endpoint}`, {
        method: 'PUT',
      });

      if (response.ok) {
        fetchUsers();
      } else {
        setError('更新用戶狀態失敗');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('確定要刪除此用戶嗎？此操作無法復原。')) {
      return;
    }

    try {
      const response = await apiRequest(`${API_ENDPOINTS.ADMIN_USERS}/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchUsers();
      } else {
        setError('刪除用戶失敗');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'user':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return '管理員';
      case 'user':
        return '用戶';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">用戶管理</h1>
        <p className="mt-2 text-sm text-gray-700">
          管理系統中的所有用戶帳號和權限
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="搜尋用戶姓名或郵箱..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              建立用戶
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>建立新用戶</DialogTitle>
              <DialogDescription>
                建立一個新的用戶帳號
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">郵箱地址</Label>
                <Input
                  id="email"
                  type="email"
                  value={createData.email}
                  onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <Input
                  id="password"
                  type="password"
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? '建立中...' : '建立用戶'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用戶列表</CardTitle>
          <CardDescription>
            共 {filteredUsers.length} 個用戶
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">沒有找到用戶</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm ? '請嘗試不同的搜尋條件' : '開始建立第一個用戶'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="h-6 w-6 text-gray-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.name}
                          </p>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}
                          >
                            {getRoleText(user.role)}
                          </span>
                          {!user.is_approved && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              未核准
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center text-sm text-gray-500">
                            <Mail className="flex-shrink-0 mr-1.5 h-4 w-4" />
                            {user.email}
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4" />
                            {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleToggleUserStatus(user.id, user.is_approved)}
                          >
                            {user.is_approved ? (
                              <>
                                <UserX className="mr-2 h-4 w-4" />
                                拒絕用戶
                              </>
                            ) : (
                              <>
                                <UserCheck className="mr-2 h-4 w-4" />
                                核准用戶
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            刪除用戶
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}