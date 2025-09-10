import { useState, useRef, useCallback, useEffect } from 'react';
import { KlineChart } from './components/KlineChart';
import { MovingAverageConfigPanel, type MovingAverageConfig } from './components/MovingAverageConfig';
import { getDefaultPeriods } from './utils/movingAverages';

interface KlineData {
  x: number;
  y: number;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function App() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('準備就緒');
  const [data, setData] = useState<any[]>([]);
  const [historicalData, setHistoricalData] = useState<KlineData[]>([]);
  const [currentData, setCurrentData] = useState<KlineData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [viewMode, setViewMode] = useState<'static' | 'player'>('static'); // 新增視圖模式
  
  // 均線配置狀態
  const [movingAverageConfig, setMovingAverageConfig] = useState<MovingAverageConfig>(() => {
    const defaults = getDefaultPeriods('1h');
    return {
      short: {
        enabled: false,
        type: 'EMA',
        period: defaults.short,
        color: '#3B82F6', // 藍色
        label: '短期',
      },
      medium: {
        enabled: false,
        type: 'EMA',
        period: defaults.medium,
        color: '#EF4444', // 紅色
        label: '中期',
      },
      long: {
        enabled: false,
        type: 'SMA',
        period: defaults.long,
        color: '#10B981', // 綠色
        label: '長期',
      },
    };
  });
  
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 當間隔改變時，更新均線預設週期
  useEffect(() => {
    const defaults = getDefaultPeriods(selectedInterval);
    setMovingAverageConfig(prev => ({
      short: { ...prev.short, period: defaults.short },
      medium: { ...prev.medium, period: defaults.medium },
      long: { ...prev.long, period: defaults.long },
    }));
  }, [selectedInterval]);

  const handleLoadData = async () => {
    setLoading(true);
    setStatus('載入資料中...');

    try {
      // 獲取表單值
      const symbol = (document.querySelector('select[data-symbol]') as HTMLSelectElement)?.value || 'BTCUSDT';
      const interval = (document.querySelector('select[data-interval]') as HTMLSelectElement)?.value || '1h';
      const startTime = new Date((document.querySelector('input[data-start]') as HTMLInputElement)?.value || '').getTime();
      const endTime = new Date((document.querySelector('input[data-end]') as HTMLInputElement)?.value || '').getTime();

      if (!startTime || !endTime) {
        setStatus('錯誤：請選擇有效的起始和結束時間');
        setLoading(false);
        return;
      }

      if (startTime >= endTime) {
        setStatus('錯誤：開始時間必須早於結束時間');
        setLoading(false);
        return;
      }

      // 調用後端 API
      const response = await fetch(`/api/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      setData(result);
      
      // 處理資料為圖表格式
      const processedData: KlineData[] = result.map((item: any[]) => ({
        x: item[0],
        y: parseFloat(item[4]),
        timestamp: new Date(item[0]),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
      }));
      
      setHistoricalData(processedData);
      setSelectedSymbol(symbol);
      setSelectedInterval(interval);
      
      // 根據視圖模式設置顯示資料
      if (viewMode === 'static') {
        // 靜態模式：顯示所有資料
        setCurrentData(processedData);
        setCurrentIndex(processedData.length);
        setProgress(100);
        setStatus(`靜態模式：顯示 ${result.length} 筆 ${symbol} ${interval} 完整資料`);
      } else {
        // 播放器模式：重置播放狀態
        setCurrentData([]);
        setCurrentIndex(0);
        setProgress(0);
        setIsPlaying(false);
        
        if (playIntervalRef.current) {
          clearInterval(playIntervalRef.current);
          playIntervalRef.current = null;
        }
        
        // 顯示第一筆資料
        if (processedData.length > 0) {
          setCurrentData([processedData[0]]);
          setCurrentIndex(1);
          setProgress(1 / processedData.length * 100);
        }
        
        setStatus(`播放器模式：載入 ${result.length} 筆 ${symbol} ${interval} 資料`);
      }
      // console.log('載入的資料:', result);

    } catch (error) {
      console.error('載入資料失敗:', error);
      setStatus('載入資料失敗：' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 播放控制函數
  const handlePlay = useCallback(() => {
    if (historicalData.length === 0) {
      setStatus('請先載入資料');
      return;
    }
    
    if (currentIndex >= historicalData.length) {
      setStatus('播放完成');
      return;
    }

    // 先清除任何現有的定時器
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    
    setIsPlaying(true);
    setStatus('播放中...');
    
    const baseInterval = 1000; // 基礎間隔 1 秒
    const interval = baseInterval / speed;
    
    playIntervalRef.current = setInterval(() => {
      setCurrentIndex(prevIndex => {
        if (prevIndex < historicalData.length) {
          const newIndex = prevIndex + 1;
          setCurrentData(historicalData.slice(0, newIndex));
          setProgress((newIndex / historicalData.length) * 100);
          
          if (newIndex >= historicalData.length) {
            setIsPlaying(false);
            setStatus('播放完成');
            if (playIntervalRef.current) {
              clearInterval(playIntervalRef.current);
              playIntervalRef.current = null;
            }
          }
          
          return newIndex;
        }
        return prevIndex;
      });
    }, interval);
  }, [historicalData, currentIndex, speed]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    setStatus('已暫停');
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  const handleStop = useCallback(() => {
    handlePause();
    setCurrentData([]);
    setCurrentIndex(0);
    setProgress(0);
    setStatus('已停止');
  }, [handlePause]);

  const handleReset = useCallback(() => {
    handlePause();
    if (historicalData.length > 0) {
      setCurrentData([historicalData[0]]);
      setCurrentIndex(1);
      setProgress(1 / historicalData.length * 100);
      setStatus('已重置');
    }
  }, [handlePause, historicalData]);

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    
    // 如果正在播放，立即調整定時器間隔
    if (isPlaying && playIntervalRef.current) {
      // 清除現有定時器
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
      
      // 以新速度重新開始播放
      const baseInterval = 1000;
      const interval = baseInterval / newSpeed;
      
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex(prevIndex => {
          if (prevIndex < historicalData.length) {
            const newIndex = prevIndex + 1;
            setCurrentData(historicalData.slice(0, newIndex));
            setProgress((newIndex / historicalData.length) * 100);
            
            if (newIndex >= historicalData.length) {
              setIsPlaying(false);
              setStatus('播放完成');
              if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
                playIntervalRef.current = null;
              }
            }
            
            return newIndex;
          }
          return prevIndex;
        });
      }, interval);
    }
  };

  // 切換視圖模式
  const handleModeChange = (newMode: 'static' | 'player') => {
    if (newMode === viewMode) return;
    
    // 停止播放
    if (isPlaying) {
      handlePause();
    }
    
    setViewMode(newMode);
    
    // 根據模式調整顯示
    if (historicalData.length > 0) {
      if (newMode === 'static') {
        // 切換到靜態模式：顯示所有資料
        setCurrentData(historicalData);
        setCurrentIndex(historicalData.length);
        setProgress(100);
        setStatus(`靜態模式：顯示 ${historicalData.length} 筆完整資料`);
      } else {
        // 切換到播放器模式：重置到第一筆
        setCurrentData([historicalData[0]]);
        setCurrentIndex(1);
        setProgress(1 / historicalData.length * 100);
        setStatus(`播放器模式：準備播放 ${historicalData.length} 筆資料`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 頂部標題欄 */}
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">
          加密貨幣 K線圖播放器
        </h1>
      </header>

      {/* Dashboard 布局 */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* 左側控制面板 */}
        <div className="w-80 bg-white border-r overflow-y-auto">
          <div className="p-4 space-y-6">
            
            {/* 視圖模式選擇 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">視圖模式</h2>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="viewMode"
                    value="static"
                    checked={viewMode === 'static'}
                    onChange={(e) => handleModeChange(e.target.value as 'static' | 'player')}
                    className="mr-2"
                  />
                  <span className="text-sm">靜態模式</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="viewMode"
                    value="player"
                    checked={viewMode === 'player'}
                    onChange={(e) => handleModeChange(e.target.value as 'static' | 'player')}
                    className="mr-2"
                  />
                  <span className="text-sm">播放器模式</span>
                </label>
              </div>
            </div>
            
            {/* 參數設定 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">參數設定</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">幣別</label>
                  <select data-symbol className="w-full p-2 border border-gray-300 rounded-md">
                    <option value="BTCUSDT">BTC/USDT</option>
                    <option value="ETHUSDT">ETH/USDT</option>
                    <option value="BNBUSDT">BNB/USDT</option>
                    <option value="ADAUSDT">ADA/USDT</option>
                    <option value="SOLUSDT">SOL/USDT</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">時間區間</label>
                  <select data-interval className="w-full p-2 border border-gray-300 rounded-md" defaultValue="1h">
                    <option value="5m">5分鐘</option>
                    <option value="15m">15分鐘</option>
                    <option value="1h">1小時</option>
                    <option value="4h">4小時</option>
                    <option value="1d">1天</option>
                    <option value="1w">1週</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">開始時間</label>
                  <input 
                    data-start
                    type="datetime-local" 
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    defaultValue={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">結束時間</label>
                  <input 
                    data-end
                    type="datetime-local" 
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                
                <button 
                  onClick={handleLoadData}
                  disabled={loading}
                  className={`w-full px-4 py-2 rounded-md transition-colors ${
                    loading 
                      ? 'bg-gray-400 text-white cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {loading ? '載入中...' : '載入資料'}
                </button>
              </div>
            </div>

            {/* 播放控制 - 只在播放器模式下顯示 */}
            {viewMode === 'player' && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4">播放控制</h2>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={handlePlay}
                      disabled={!historicalData.length || isPlaying}
                      className={`px-3 py-2 rounded-md transition-colors text-sm ${
                        !historicalData.length || isPlaying
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      播放
                    </button>
                    <button 
                      onClick={handlePause}
                      disabled={!isPlaying}
                      className={`px-3 py-2 rounded-md transition-colors text-sm ${
                        !isPlaying
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-yellow-600 text-white hover:bg-yellow-700'
                      }`}
                    >
                      暫停
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={handleStop}
                      disabled={!historicalData.length}
                      className={`px-3 py-2 rounded-md transition-colors text-sm ${
                        !historicalData.length
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      停止
                    </button>
                    <button 
                      onClick={handleReset}
                      disabled={!historicalData.length}
                      className={`px-3 py-2 rounded-md transition-colors text-sm ${
                        !historicalData.length
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      重置
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">播放速度</label>
                    <select 
                      value={speed} 
                      onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="1">1x</option>
                      <option value="2">2x</option>
                      <option value="3">3x</option>
                      <option value="5">5x</option>
                      <option value="10">10x</option>
                    </select>
                  </div>
                  
                  {historicalData.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>進度: {currentIndex} / {historicalData.length}</span>
                        <span>{progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 均線配置面板 */}
            <MovingAverageConfigPanel
              config={movingAverageConfig}
              interval={selectedInterval}
              onChange={setMovingAverageConfig}
            />

            {/* 狀態信息 */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className={`text-sm font-medium mb-2 ${
                status.includes('錯誤') || status.includes('失敗') 
                  ? 'text-red-600' 
                  : status.includes('成功') 
                    ? 'text-green-600' 
                    : status.includes('載入')
                      ? 'text-blue-600'
                      : 'text-gray-600'
              }`}>
                狀態: {status}
              </p>
              <p className="text-xs text-gray-500">
                後端: <a href="http://localhost:5000/api/health" className="text-blue-600 underline" target="_blank">localhost:5000</a>
                {data && <><br/>已載入 {data.length} 筆資料</>}
              </p>
            </div>
          </div>
        </div>

        {/* 右側圖表區域 */}
        <div className="flex-1 bg-white">
          {currentData.length > 0 ? (
            <div className="h-full p-4">
              <KlineChart 
                data={currentData} 
                symbol={selectedSymbol} 
                interval={selectedInterval}
                movingAverageConfig={movingAverageConfig}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">📈</div>
                <div className="text-xl font-medium mb-2">K線圖表</div>
                <div className="text-sm">
                  {viewMode === 'static' ? '請先載入資料查看圖表' : '請先載入資料並播放'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;