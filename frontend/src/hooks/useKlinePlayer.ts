import { useState, useEffect, useCallback, useRef } from 'react';
import { KlineData, api } from '@/lib/api';

export interface UseKlinePlayerReturn {
  // 資料狀態
  historicalData: KlineData[];
  currentData: KlineData[];
  isLoading: boolean;
  error: string | null;
  
  // 播放狀態
  isPlaying: boolean;
  currentIndex: number;
  progress: number;
  
  // 控制函數
  loadData: (symbol: string, interval: string, startTime: number, endTime: number) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
  seekTo: (progress: number) => void;
  setSpeed: (speed: number) => void;
}

export function useKlinePlayer(): UseKlinePlayerReturn {
  const [historicalData, setHistoricalData] = useState<KlineData[]>([]);
  const [currentData, setCurrentData] = useState<KlineData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const progress = historicalData.length > 0 
    ? Math.floor((currentIndex / historicalData.length) * 100)
    : 0;

  const loadData = useCallback(async (
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ) => {
    if (startTime >= endTime) {
      setError('開始時間必須早於結束時間');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.getKlines(symbol, interval, startTime, endTime);
      
      if (data.length === 0) {
        setError('沒有找到資料');
        return;
      }

      setHistoricalData(data);
      setCurrentData([]);
      setCurrentIndex(0);
      
      // 顯示第一筆資料
      if (data.length > 0) {
        setCurrentData([data[0]]);
      }
      
    } catch (err) {
      console.error('載入資料失敗:', err);
      setError(err instanceof Error ? err.message : '載入資料失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const play = useCallback(() => {
    if (historicalData.length === 0) {
      setError('請先載入資料');
      return;
    }
    
    if (currentIndex >= historicalData.length) {
      setError('播放完成');
      return;
    }

    // 先清除任何現有的定時器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsPlaying(true);
    setError(null);
    
    const baseInterval = 1000; // 基礎間隔 1 秒
    const interval = baseInterval / speed;
    
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prevIndex => {
        const newIndex = prevIndex + 1;
        
        if (newIndex < historicalData.length) {
          setCurrentData(prevData => [...prevData, historicalData[newIndex]]);
          return newIndex;
        } else {
          // 播放完成
          setIsPlaying(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return prevIndex;
        }
      });
    }, interval);
  }, [historicalData, currentIndex, speed]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    pause();
    setCurrentData([]);
    setCurrentIndex(0);
  }, [pause]);

  const reset = useCallback(() => {
    pause();
    setCurrentIndex(0);
    if (historicalData.length > 0) {
      setCurrentData([historicalData[0]]);
    }
  }, [pause, historicalData]);

  const seekTo = useCallback((progressPercent: number) => {
    if (historicalData.length === 0) return;
    
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      pause();
    }
    
    const targetIndex = Math.floor((progressPercent / 100) * historicalData.length);
    const newIndex = Math.max(0, Math.min(targetIndex, historicalData.length - 1));
    
    setCurrentIndex(newIndex);
    setCurrentData(historicalData.slice(0, newIndex + 1));
    
    if (wasPlaying && newIndex < historicalData.length - 1) {
      // 使用 setTimeout 確保狀態更新後再播放
      setTimeout(() => play(), 100);
    }
  }, [historicalData, isPlaying, pause, play]);

  // 清理定時器
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // 當速度改變時，如果正在播放，重新開始播放
  useEffect(() => {
    if (isPlaying && intervalRef.current) {
      // 清除當前的定時器
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      
      // 重新設定新速度的定時器
      const baseInterval = 1000;
      const interval = baseInterval / speed;
      
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prevIndex => {
          const newIndex = prevIndex + 1;
          
          if (newIndex < historicalData.length) {
            setCurrentData(prevData => [...prevData, historicalData[newIndex]]);
            return newIndex;
          } else {
            // 播放完成
            setIsPlaying(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return prevIndex;
          }
        });
      }, interval);
    }
  }, [speed, isPlaying, historicalData]);

  return {
    historicalData,
    currentData,
    isLoading,
    error,
    isPlaying,
    currentIndex,
    progress,
    loadData,
    play,
    pause,
    stop,
    reset,
    seekTo,
    setSpeed,
  };
}