import { useState, useRef, useCallback } from 'react';
import { KlineChart } from './components/KlineChart';

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
  
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      
      // 重置播放狀態
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
      
      setStatus(`成功載入 ${result.length} 筆 ${symbol} ${interval} 資料`);
      console.log('載入的資料:', result);

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

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          加密貨幣 K線圖播放器
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">控制面板</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
          </div>
          <div className="mt-6">
            <button 
              onClick={handleLoadData}
              disabled={loading}
              className={`px-6 py-2 rounded-md transition-colors ${
                loading 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? '載入中...' : '載入資料'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">播放控制</h2>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <button 
              onClick={handlePlay}
              disabled={!historicalData.length || isPlaying}
              className={`px-4 py-2 rounded-md transition-colors ${
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
              className={`px-4 py-2 rounded-md transition-colors ${
                !isPlaying
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-yellow-600 text-white hover:bg-yellow-700'
              }`}
            >
              暫停
            </button>
            <button 
              onClick={handleStop}
              disabled={!historicalData.length}
              className={`px-4 py-2 rounded-md transition-colors ${
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
              className={`px-4 py-2 rounded-md transition-colors ${
                !historicalData.length
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              重置
            </button>
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium">播放速度</label>
              <select 
                value={speed} 
                onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
                className="p-2 border border-gray-300 rounded-md"
              >
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="3">3x</option>
                <option value="5">5x</option>
                <option value="10">10x</option>
              </select>
            </div>
          </div>
          
          {historicalData.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>進度: {currentIndex} / {historicalData.length}</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">K線圖表</h2>
          <div className="h-96">
            {currentData.length > 0 ? (
              <KlineChart 
                data={currentData} 
                symbol={selectedSymbol} 
                interval={selectedInterval}
              />
            ) : (
              <div className="h-full bg-gray-100 rounded-md flex items-center justify-center">
                <p className="text-gray-500">請先載入資料並播放</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className={`text-sm font-medium ${
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
          <p className="text-xs text-gray-500 mt-1">
            後端: <a href="http://localhost:5000/api/health" className="text-blue-600 underline" target="_blank">http://localhost:5000</a>
            {data && ` | 已載入 ${data.length} 筆資料`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;