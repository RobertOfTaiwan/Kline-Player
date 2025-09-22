import { useState, useRef, useCallback, useEffect } from 'react';
import { KlineChart } from './components/KlineChart';
import { MovingAverageConfigPanel, type MovingAverageConfig } from './components/MovingAverageConfig';
import { getDefaultPeriods } from './utils/movingAverages';
import { apiRequest, API_ENDPOINTS } from './config/api';

interface Symbol {
  value: string;
  label: string;
}

interface Interval {
  value: string;
  label: string;
}

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

// 輔助函數：將時間間隔轉換為毫秒數
const getIntervalMilliseconds = (interval: string): number => {
  const intervals: { [key: string]: number } = {
    '5m': 5 * 60 * 1000,      // 5分鐘
    '15m': 15 * 60 * 1000,    // 15分鐘
    '1h': 60 * 60 * 1000,     // 1小時
    '4h': 4 * 60 * 60 * 1000, // 4小時
    '1d': 24 * 60 * 60 * 1000, // 1天
    '1w': 7 * 24 * 60 * 60 * 1000, // 1週
  };

  return intervals[interval] || intervals['1h']; // 預設為1小時
};

// 輔助函數：獲取 UTC 時間的 datetime-local 格式
const getUTCDateTimeLocal = (date: Date = new Date()): string => {
  // 直接使用 UTC 時間，格式化為 YYYY-MM-DDTHH:mm 格式
  return date.toISOString().slice(0, 16);
};

// 輔助函數：將 datetime-local 輸入值轉換為 UTC 時間戳
const getUTCTimestampFromInput = (inputValue: string): number => {
  if (!inputValue) return 0;
  // 在 datetime-local 值後加 'Z' 使其被解釋為 UTC 時間
  return new Date(inputValue + 'Z').getTime();
};

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

  // API 資料狀態
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [intervals, setIntervals] = useState<Interval[]>([]);
  
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

  // 組件載入時獲取 symbols 和 intervals
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [symbolsResponse, intervalsResponse] = await Promise.all([
          apiRequest(API_ENDPOINTS.SYMBOLS),
          apiRequest(API_ENDPOINTS.INTERVALS)
        ]);

        if (symbolsResponse.ok && intervalsResponse.ok) {
          const symbolsData = await symbolsResponse.json();
          const intervalsData = await intervalsResponse.json();

          setSymbols(symbolsData);
          setIntervals(intervalsData);

          // 設置預設選擇
          if (symbolsData.length > 0) {
            setSelectedSymbol(symbolsData[0].value);
          }
        } else {
          console.warn('無法獲取 API 資料，使用預設值');
          // 如果 API 失敗，使用預設值
          setSymbols([
            { value: 'BTCUSDT', label: 'BTC/USDT' },
            { value: 'ETHUSDT', label: 'ETH/USDT' },
            { value: 'SOLUSDT', label: 'SOL/USDT' }
          ]);
          setIntervals([
            { value: '5m', label: '5分鐘' },
            { value: '15m', label: '15分鐘' },
            { value: '1h', label: '1小時' },
            { value: '4h', label: '4小時' },
            { value: '1d', label: '1天' },
            { value: '1w', label: '1週' }
          ]);
        }
      } catch (error) {
        console.error('獲取初始資料失敗:', error);
        // 使用預設值
        setSymbols([
          { value: 'BTCUSDT', label: 'BTC/USDT' },
          { value: 'ETHUSDT', label: 'ETH/USDT' },
          { value: 'SOLUSDT', label: 'SOL/USDT' }
        ]);
        setIntervals([
          { value: '5m', label: '5分鐘' },
          { value: '15m', label: '15分鐘' },
          { value: '1h', label: '1小時' },
          { value: '4h', label: '4小時' },
          { value: '1d', label: '1天' },
          { value: '1w', label: '1週' }
        ]);
      }
    };

    fetchInitialData();
  }, []);

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
      const symbol = selectedSymbol;
      const interval = selectedInterval;
      // 獲取輸入值並將其視為 UTC 時間
      const startInput = (document.querySelector('input[data-start]') as HTMLInputElement)?.value || '';
      const endInput = (document.querySelector('input[data-end]') as HTMLInputElement)?.value || '';

      // 將 datetime-local 值轉換為 UTC 時間戳
      const userStartTime = getUTCTimestampFromInput(startInput);
      const endTime = getUTCTimestampFromInput(endInput);

      if (!userStartTime || !endTime) {
        setStatus('錯誤：請選擇有效的起始和結束時間');
        setLoading(false);
        return;
      }

      if (userStartTime >= endTime) {
        setStatus('錯誤：開始時間必須早於結束時間');
        setLoading(false);
        return;
      }

      // 計算需要額外載入的歷史資料長度（基於最長的均線週期）
      const enabledPeriods = Object.values(movingAverageConfig)
        .filter(config => config.enabled)
        .map(config => config.period);
      
      const maxPeriod = enabledPeriods.length > 0 ? Math.max(...enabledPeriods) : 0;
      
      // 計算時間間隔的毫秒數
      const intervalMs = getIntervalMilliseconds(interval);
      
      // 計算實際需要的開始時間（提前足夠的週期來計算均線）
      const bufferPeriods = Math.max(maxPeriod, 100); // 至少提前100個週期，確保有足夠資料
      const actualStartTime = userStartTime - (bufferPeriods * intervalMs);

      setStatus(`載入資料中...（含均線計算所需歷史資料 ${bufferPeriods} 週期）`);

      // 調用後端 API
      const response = await apiRequest(`${API_ENDPOINTS.KLINES}?symbol=${symbol}&interval=${interval}&startTime=${actualStartTime}&endTime=${endTime}`);
      
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
      
      // 找到用戶選擇的時間範圍內的資料索引
      const userStartIndex = processedData.findIndex(item => item.timestamp.getTime() >= userStartTime);
      const displayData = userStartIndex >= 0 ? processedData.slice(userStartIndex) : processedData;
      
      // 設置完整的歷史資料（用於均線計算）
      setHistoricalData(processedData);
      
      // 根據視圖模式設置顯示資料
      if (viewMode === 'static') {
        // 靜態模式：顯示用戶選擇範圍內的資料
        setCurrentData(displayData);
        setCurrentIndex(displayData.length);
        setProgress(100);
        setStatus(`靜態模式：顯示 ${displayData.length} 筆 ${symbol} ${interval} 完整資料（含均線計算）`);
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
        if (displayData.length > 0) {
          // 需要找到對應的索引位置
          const firstDisplayIndex = userStartIndex >= 0 ? userStartIndex : 0;
          setCurrentData(processedData.slice(0, firstDisplayIndex + 1));
          setCurrentIndex(firstDisplayIndex + 1);
          setProgress((firstDisplayIndex + 1) / processedData.length * 100);
        }
        
        setStatus(`播放器模式：載入 ${displayData.length} 筆 ${symbol} ${interval} 資料（含均線歷史資料）`);
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
    
    // 找到用戶選擇範圍的開始索引
    const userStartTime = getUTCTimestampFromInput((document.querySelector('input[data-start]') as HTMLInputElement)?.value || '');
    const userStartIndex = historicalData.findIndex(item => item.timestamp.getTime() >= userStartTime);
    const startIndex = userStartIndex >= 0 ? userStartIndex : 0;
    
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
          
          // 計算進度（基於用戶選擇的範圍）
          const displayableLength = historicalData.length - startIndex;
          const currentDisplayIndex = Math.max(0, newIndex - startIndex);
          setProgress((currentDisplayIndex / displayableLength) * 100);
          
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
      // 找到用戶選擇範圍的開始索引
      const userStartTime = getUTCTimestampFromInput((document.querySelector('input[data-start]') as HTMLInputElement)?.value || '');
      const userStartIndex = historicalData.findIndex(item => item.timestamp.getTime() >= userStartTime);
      const startIndex = userStartIndex >= 0 ? userStartIndex : 0;
      
      setCurrentData(historicalData.slice(0, startIndex + 1));
      setCurrentIndex(startIndex + 1);
      
      // 計算進度（基於用戶選擇的範圍）
      const displayableLength = historicalData.length - startIndex;
      setProgress((1 / displayableLength) * 100);
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
      
      // 找到用戶選擇範圍的開始索引
      const userStartTime = getUTCTimestampFromInput((document.querySelector('input[data-start]') as HTMLInputElement)?.value || '');
      const userStartIndex = historicalData.findIndex(item => item.timestamp.getTime() >= userStartTime);
      const startIndex = userStartIndex >= 0 ? userStartIndex : 0;
      
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex(prevIndex => {
          if (prevIndex < historicalData.length) {
            const newIndex = prevIndex + 1;
            setCurrentData(historicalData.slice(0, newIndex));
            
            // 計算進度（基於用戶選擇的範圍）
            const displayableLength = historicalData.length - startIndex;
            const currentDisplayIndex = Math.max(0, newIndex - startIndex);
            setProgress((currentDisplayIndex / displayableLength) * 100);
            
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
      // 找到用戶選擇範圍的開始索引
      const userStartTime = getUTCTimestampFromInput((document.querySelector('input[data-start]') as HTMLInputElement)?.value || '');
      const userStartIndex = historicalData.findIndex(item => item.timestamp.getTime() >= userStartTime);
      const displayData = userStartIndex >= 0 ? historicalData.slice(userStartIndex) : historicalData;
      
      if (newMode === 'static') {
        // 切換到靜態模式：顯示用戶選擇範圍內的資料
        setCurrentData(displayData);
        setCurrentIndex(historicalData.length);
        setProgress(100);
        setStatus(`靜態模式：顯示 ${displayData.length} 筆完整資料`);
      } else {
        // 切換到播放器模式：重置到用戶選擇範圍的開始
        const startIndex = userStartIndex >= 0 ? userStartIndex : 0;
        setCurrentData(historicalData.slice(0, startIndex + 1));
        setCurrentIndex(startIndex + 1);
        
        // 計算進度（基於用戶選擇的範圍）
        const displayableLength = historicalData.length - startIndex;
        setProgress((1 / displayableLength) * 100);
        setStatus(`播放器模式：準備播放 ${displayData.length} 筆資料`);
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
                  <select
                    data-symbol
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    {symbols.map((symbol) => (
                      <option key={symbol.value} value={symbol.value}>
                        {symbol.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">時間區間</label>
                  <select
                    data-interval
                    value={selectedInterval}
                    onChange={(e) => setSelectedInterval(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    {intervals.map((interval) => (
                      <option key={interval.value} value={interval.value}>
                        {interval.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">開始時間 (UTC時間)</label>
                  <input 
                    data-start
                    type="datetime-local" 
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    defaultValue={getUTCDateTimeLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">結束時間 (UTC時間)</label>
                  <input 
                    data-end
                    type="datetime-local" 
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    defaultValue={getUTCDateTimeLocal()}
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
                  
                  {historicalData.length > 0 && (() => {
                    const userStartIndex = historicalData.findIndex(item => item.timestamp.getTime() >= getUTCTimestampFromInput((document.querySelector('input[data-start]') as HTMLInputElement)?.value || '')) || 0;
                    const displayableLength = historicalData.length - userStartIndex;
                    const currentDisplayIndex = Math.max(0, currentIndex - userStartIndex);
                    
                    return (
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>進度: {currentDisplayIndex} / {displayableLength}</span>
                          <span>{progress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })()}
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
                historicalData={historicalData}
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