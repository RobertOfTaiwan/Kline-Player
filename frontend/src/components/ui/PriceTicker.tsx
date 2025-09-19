import { useState, useEffect } from 'react';
import { apiRequest, API_ENDPOINTS } from '@/config/api';

interface PriceData {
  symbol: string;
  label: string;
  price: number;
  update_time: string;  // 後台更新時間
  kline_time: string;   // K線時間
}

interface PriceTickerProps {
  className?: string;
  updateInterval?: number; // 更新頻率（毫秒），預設 60000 (60秒)
}

export function PriceTicker({ className = '', updateInterval = 30000 }: PriceTickerProps) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  console.log('PriceTicker rendered, isLoading:', isLoading, 'prices count:', prices.length);

  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        console.log('開始獲取實時價格...', new Date().toLocaleTimeString());
        
        const response = await apiRequest(API_ENDPOINTS.LIVE_PRICES);
        
        if (response.ok) {
          const livePrices = await response.json();
          console.log('實時價格數據:', livePrices);
          
          setPrices(livePrices);
          setIsLoading(false);
          console.log('實時價格更新完成', livePrices.length, '個交易對');
        } else {
          console.error('無法獲取實時價格數據');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('獲取實時價格失敗:', error);
        setIsLoading(false);
      }
    };

    // 初始載入
    fetchLivePrices();

    // 使用可配置的更新頻率
    const interval = setInterval(fetchLivePrices, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  if (isLoading) {
    return (
      <div className={`${className} flex items-center text-gray-500`}>
        <span className="text-sm">載入價格資料中...</span>
      </div>
    );
  }

  // 如果沒有價格數據，顯示預設內容
  if (prices.length === 0) {
    return (
      <div className={`${className} flex items-center text-gray-500`}>
        <span className="text-sm">無價格資料</span>
      </div>
    );
  }

  return (
    <div className={`${className} overflow-hidden`}>
      <div className="flex items-center space-x-6 animate-marquee whitespace-nowrap">
        {/* 後台更新時間 */}
        <div className="flex items-center space-x-2 text-xs text-gray-600 flex-shrink-0">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          <span className="hidden sm:inline">後台更新:</span>
          <span>
            {prices.length > 0 ? 
              new Date(prices[0].update_time).toLocaleTimeString('zh-TW', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              }) : '--:--:--'
            }
          </span>
          <span className="hidden lg:inline text-gray-400">({updateInterval/1000}s)</span>
        </div>
        
          {/* 價格資訊 */}
          {prices.map((price, index) => (
            <div key={index} className="flex items-center space-x-2 text-xs flex-shrink-0">
              <span className="font-medium text-gray-800">{price.symbol.replace('USDT', '')}</span>
              <span className="font-bold text-gray-900">${price.price}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
