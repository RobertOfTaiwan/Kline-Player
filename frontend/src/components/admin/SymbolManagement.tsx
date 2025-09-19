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
  TrendingUp,
  Activity,
  MoreHorizontal,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiRequest, API_ENDPOINTS } from '@/config/api';

interface Symbol {
  id: number;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_updated?: string;
}

interface CreateSymbolData {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  name: string;
}

export function SymbolManagement() {
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createData, setCreateData] = useState<CreateSymbolData>({
    symbol: '',
    base_asset: '',
    quote_asset: 'USDT',
    name: ''
  });

  useEffect(() => {
    fetchSymbols();
  }, []);

  const fetchSymbols = async () => {
    try {
      setLoading(true);
      console.log('正在獲取交易對列表...');
      
      // 檢查認證 token
      const token = localStorage.getItem('token');
      console.log('認證 token:', token ? '存在' : '不存在');
      
      // 先測試健康檢查端點
      try {
        const healthResponse = await apiRequest('/api/health');
        console.log('健康檢查響應:', healthResponse.status);
      } catch (healthErr) {
        console.error('健康檢查失敗:', healthErr);
      }
      
      const response = await apiRequest(API_ENDPOINTS.ADMIN_SYMBOLS);
      console.log('API 響應狀態:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('獲取到的交易對數據:', data);
        setSymbols(data);
        setError('');
      } else {
        const errorText = await response.text();
        console.error('API 錯誤:', response.status, errorText);
        setError(`無法載入交易對列表: ${response.status} ${errorText}`);
      }
    } catch (err) {
      console.error('網路錯誤:', err);
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setError('');

    try {
      const response = await apiRequest(API_ENDPOINTS.ADMIN_SYMBOLS, {
        method: 'POST',
        body: JSON.stringify(createData),
      });

      if (response.ok) {
        setShowCreateDialog(false);
        setCreateData({ symbol: '', base_asset: '', quote_asset: 'USDT', name: '' });
        fetchSymbols();
      } else {
        const data = await response.json();
        setError(data.detail || '建立交易對失敗');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleSymbolStatus = async (symbolId: number, isActive: boolean) => {
    try {
      const response = await apiRequest(`${API_ENDPOINTS.ADMIN_SYMBOLS}/${symbolId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (response.ok) {
        fetchSymbols();
      } else {
        setError('更新交易對狀態失敗');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    }
  };

  const handleDeleteSymbol = async (symbolId: number) => {
    if (!confirm('確定要刪除此交易對嗎？相關的歷史資料也會被刪除，此操作無法復原。')) {
      return;
    }

    try {
      const response = await apiRequest(`${API_ENDPOINTS.ADMIN_SYMBOLS}/${symbolId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchSymbols();
      } else {
        setError('刪除交易對失敗');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    }
  };

  const filteredSymbols = symbols.filter(symbol =>
    symbol.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    symbol.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    symbol.base_asset.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">交易對管理</h1>
        <p className="mt-2 text-sm text-gray-700">
          管理系統支援的加密貨幣交易對
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
            placeholder="搜尋交易對..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新增交易對
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增交易對</DialogTitle>
                <DialogDescription>
                  手動新增一個新的加密貨幣交易對
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSymbol} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="symbol">交易對代碼</Label>
                  <Input
                    id="symbol"
                    placeholder="例如: BTCUSDT"
                    value={createData.symbol}
                    onChange={(e) => setCreateData({
                      ...createData,
                      symbol: e.target.value.toUpperCase()
                    })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base_asset">基礎資產</Label>
                    <Input
                      id="base_asset"
                      placeholder="例如: BTC"
                      value={createData.base_asset}
                      onChange={(e) => setCreateData({
                        ...createData,
                        base_asset: e.target.value.toUpperCase()
                      })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote_asset">報價資產</Label>
                    <Input
                      id="quote_asset"
                      placeholder="例如: USDT"
                      value={createData.quote_asset}
                      onChange={(e) => setCreateData({
                        ...createData,
                        quote_asset: e.target.value.toUpperCase()
                      })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">顯示名稱</Label>
                  <Input
                    id="name"
                    placeholder="例如: Bitcoin"
                    value={createData.name}
                    onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createLoading}>
                    {createLoading ? '新增中...' : '新增交易對'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>交易對列表</CardTitle>
          <CardDescription>
            共 {filteredSymbols.length} 個交易對，其中 {filteredSymbols.filter(s => s.is_active).length} 個已啟用
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSymbols.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">沒有找到交易對</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm ? '請嘗試不同的搜尋條件' : '開始新增第一個交易對'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredSymbols.map((symbol) => (
                  <div
                    key={symbol.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <TrendingUp className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900">
                            {symbol.symbol}
                          </p>
                          <span className="text-sm text-gray-500">
                            ({symbol.name})
                          </span>
                          {!symbol.is_active && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              已停用
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center text-sm text-gray-500">
                            <Activity className="flex-shrink-0 mr-1.5 h-4 w-4" />
                            {symbol.base_asset}/{symbol.quote_asset}
                          </div>
                          <div className="text-sm text-gray-500">
                            建立於 {new Date(symbol.created_at).toLocaleDateString()}
                          </div>
                          {symbol.last_updated && (
                            <div className="text-sm text-gray-500">
                              更新於 {new Date(symbol.last_updated).toLocaleDateString()}
                            </div>
                          )}
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
                            onClick={() => handleToggleSymbolStatus(symbol.id, symbol.is_active)}
                          >
                            {symbol.is_active ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                停用交易對
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                啟用交易對
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteSymbol(symbol.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            刪除交易對
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