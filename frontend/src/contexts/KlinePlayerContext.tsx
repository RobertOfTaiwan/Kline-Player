import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { apiRequest, API_ENDPOINTS } from '@/config/api';
import { type MovingAverageConfig } from '@/components/MovingAverageConfig';
import { getDefaultPeriods } from '@/utils/movingAverages';

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

interface KlinePlayerContextType {
  // 數據狀態
  loading: boolean;
  status: string;
  data: any[];
  historicalData: KlineData[];
  currentData: KlineData[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;

  // 配置狀態
  selectedSymbol: string;
  selectedInterval: string;
  viewMode: 'static' | 'player';
  speed: number;
  startTime: string;
  endTime: string;
  symbols: Symbol[];
  intervals: Interval[];
  movingAverageConfig: MovingAverageConfig;

  // 操作方法
  setSelectedSymbol: (symbol: string) => void;
  setSelectedInterval: (interval: string) => void;
  setViewMode: (mode: 'static' | 'player') => void;
  setSpeed: (speed: number) => void;
  setStartTime: (time: string) => void;
  setEndTime: (time: string) => void;
  setMovingAverageConfig: (config: MovingAverageConfig) => void;
  handleLoadData: () => Promise<void>;
  handlePlay: () => void;
  handlePause: () => void;
  handleStop: () => void;
  handleReset: () => void;
}

const KlinePlayerContext = createContext<KlinePlayerContextType | undefined>(undefined);

export const useKlinePlayer = () => {
  const context = useContext(KlinePlayerContext);
  if (context === undefined) {
    throw new Error('useKlinePlayer must be used within a KlinePlayerProvider');
  }
  return context;
};

interface KlinePlayerProviderProps {
  children: ReactNode;
}

// 輔助函數：將時間間隔轉換為毫秒數
const getIntervalMilliseconds = (interval: string): number => {
  const intervals: { [key: string]: number } = {
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
  };

  return intervals[interval] || intervals['1h'];
};

export const KlinePlayerProvider: React.FC<KlinePlayerProviderProps> = ({ children }) => {
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
  const [viewMode, setViewMode] = useState<'static' | 'player'>('static');
  const [startTime, setStartTime] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [endTime, setEndTime] = useState(new Date().toISOString().slice(0, 16));

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
        color: '#3B82F6',
        label: '短期',
      },
      medium: {
        enabled: false,
        type: 'EMA',
        period: defaults.medium,
        color: '#EF4444',
        label: '中期',
      },
      long: {
        enabled: false,
        type: 'SMA',
        period: defaults.long,
        color: '#10B981',
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

          if (symbolsData.length > 0) {
            setSelectedSymbol(symbolsData[0].value);
          }
        } else {
          console.warn('無法獲取 API 資料，使用預設值');
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
      const userStartTime = new Date(startTime).getTime();
      const userEndTime = new Date(endTime).getTime();

      if (!userStartTime || !userEndTime) {
        setStatus('錯誤：請選擇有效的起始和結束時間');
        setLoading(false);
        return;
      }

      if (userStartTime >= userEndTime) {
        setStatus('錯誤：開始時間必須早於結束時間');
        setLoading(false);
        return;
      }

      const enabledPeriods = Object.values(movingAverageConfig)
        .filter(config => config.enabled)
        .map(config => config.period);

      const maxPeriod = enabledPeriods.length > 0 ? Math.max(...enabledPeriods) : 0;
      const intervalMs = getIntervalMilliseconds(selectedInterval);
      const bufferPeriods = Math.max(maxPeriod, 100);
      const actualStartTime = userStartTime - (bufferPeriods * intervalMs);

      setStatus(`載入資料中...（含均線計算所需歷史資料 ${bufferPeriods} 週期）`);

      const response = await apiRequest(`${API_ENDPOINTS.KLINES}?symbol=${selectedSymbol}&interval=${selectedInterval}&startTime=${actualStartTime}&endTime=${userEndTime}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      setData(result);

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

      const userStartIndex = processedData.findIndex(item => item.timestamp.getTime() >= userStartTime);
      const displayData = userStartIndex >= 0 ? processedData.slice(userStartIndex) : processedData;

      setHistoricalData(processedData);

      if (viewMode === 'static') {
        setCurrentData(displayData);
        setCurrentIndex(displayData.length);
        setProgress(100);
        setStatus(`靜態模式：顯示 ${displayData.length} 筆 ${selectedSymbol} ${selectedInterval} 完整資料（含均線計算）`);
      } else {
        // 播放器模式：從第一筆開始顯示，準備播放
        setIsPlaying(false);

        if (playIntervalRef.current) {
          clearInterval(playIntervalRef.current);
          playIntervalRef.current = null;
        }

        if (displayData.length > 0) {
          const firstDisplayIndex = userStartIndex >= 0 ? userStartIndex : 0;
          // 初始顯示第一筆資料，讓圖表和控制項都能出現
          setCurrentData(processedData.slice(0, firstDisplayIndex + 1));
          setCurrentIndex(firstDisplayIndex + 1);
          setProgress((1) / (processedData.length - firstDisplayIndex) * 100);
        } else {
          setCurrentData([]);
          setCurrentIndex(0);
          setProgress(0);
        }

        setStatus(`播放器模式：載入 ${displayData.length} 筆 ${selectedSymbol} ${selectedInterval} 資料（含均線歷史資料）`);
      }

    } catch (error) {
      console.error('載入資料失敗:', error);
      setStatus('載入資料失敗：' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = useCallback(() => {
    if (historicalData.length === 0) {
      setStatus('請先載入資料');
      return;
    }

    const userStartTime = new Date(startTime).getTime();
    const userStartIndex = historicalData.findIndex(item => item.timestamp.getTime() >= userStartTime);
    const startIndex = userStartIndex >= 0 ? userStartIndex : 0;

    if (currentIndex >= historicalData.length) {
      setStatus('播放完成');
      return;
    }

    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }

    setIsPlaying(true);
    setStatus('播放中...');

    const baseInterval = 1000;
    const interval = baseInterval / speed;

    playIntervalRef.current = setInterval(() => {
      setCurrentIndex(prevIndex => {
        if (prevIndex < historicalData.length) {
          const newIndex = prevIndex + 1;
          setCurrentData(historicalData.slice(0, newIndex));

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
  }, [historicalData, currentIndex, speed, startTime]);

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
      const userStartTime = new Date(startTime).getTime();
      const userStartIndex = historicalData.findIndex(item => item.timestamp.getTime() >= userStartTime);
      const startIndex = userStartIndex >= 0 ? userStartIndex : 0;

      setCurrentData(historicalData.slice(0, startIndex + 1));
      setCurrentIndex(startIndex + 1);

      const displayableLength = historicalData.length - startIndex;
      setProgress((1 / displayableLength) * 100);
      setStatus('已重置');
    }
  }, [handlePause, historicalData, startTime]);

  const value: KlinePlayerContextType = {
    loading,
    status,
    data,
    historicalData,
    currentData,
    currentIndex,
    isPlaying,
    progress,
    selectedSymbol,
    selectedInterval,
    viewMode,
    speed,
    startTime,
    endTime,
    symbols,
    intervals,
    movingAverageConfig,
    setSelectedSymbol,
    setSelectedInterval,
    setViewMode,
    setSpeed,
    setStartTime,
    setEndTime,
    setMovingAverageConfig,
    handleLoadData,
    handlePlay,
    handlePause,
    handleStop,
    handleReset,
  };

  return (
    <KlinePlayerContext.Provider value={value}>
      {children}
    </KlinePlayerContext.Provider>
  );
};