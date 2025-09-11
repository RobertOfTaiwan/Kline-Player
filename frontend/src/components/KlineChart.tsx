import React, { useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import { type MovingAverageConfig } from './MovingAverageConfig';
import { calculateMovingAverage, type KlineDataPoint } from '../utils/movingAverages';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  CandlestickController,
  CandlestickElement,
  zoomPlugin
);

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

interface KlineChartProps {
  data: KlineData[];
  symbol: string;
  interval: string;
  movingAverageConfig?: MovingAverageConfig;
  historicalData?: KlineData[]; // 新增：完整的歷史資料用於均線計算
}

export const KlineChart: React.FC<KlineChartProps> = ({ 
  data, 
  symbol, 
  interval, 
  movingAverageConfig, 
  historicalData 
}) => {
  const chartRef = useRef<ChartJS<'candlestick'>>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 清理 tooltip 計時器
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && data.length > 0) {
      const chart = chartRef.current;
      const visibleDataCount = 50;

      if (chart.options && chart.options.scales && chart.options.scales.x) {
        if (data.length > visibleDataCount) {
          chart.options.scales.x.min = data[data.length - visibleDataCount].timestamp.getTime();
          chart.options.scales.x.max = data[data.length - 1].timestamp.getTime();
        } else {
          chart.options.scales.x.min = data[0].timestamp.getTime();
          chart.options.scales.x.max = data[data.length - 1].timestamp.getTime();
        }
      }
      
      chart.update('none');
    }
  }, [data, movingAverageConfig]);

  // 計算均線數據
  const movingAverageDatasets: any[] = [];
  if (movingAverageConfig && data.length > 0) {
    // 使用完整的歷史資料計算均線，如果沒有則使用當前資料
    const calculationData = historicalData && historicalData.length > 0 ? historicalData : data;
    
    // 轉換數據格式為均線計算所需
    const klineData: KlineDataPoint[] = calculationData.map(item => ({
      timestamp: item.timestamp,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    // 獲取當前顯示範圍的時間戳範圍
    const displayStartTime = data[0]?.timestamp.getTime();
    const displayEndTime = data[data.length - 1]?.timestamp.getTime();

    // 為每個啟用的均線創建數據集
    Object.entries(movingAverageConfig).forEach(([, config]) => {
      if (config.enabled && config.period > 0) {
        // 計算完整的均線
        const maData = calculateMovingAverage(klineData, config.type, config.period);
        
        if (maData.length > 0) {
          // 只顯示當前時間範圍內的均線資料
          const filteredMaData = maData.filter(point => {
            const pointTime = point.timestamp.getTime();
            return pointTime >= displayStartTime && pointTime <= displayEndTime;
          });
          
          // 如果過濾後的資料為空，嘗試找到最接近顯示範圍的均線資料
          let finalMaData = filteredMaData;
          if (finalMaData.length === 0 && maData.length > 0) {
            // 找到最後一個在顯示範圍開始時間之前的均線點
            const lastBeforeDisplay = maData
              .filter(point => point.timestamp.getTime() <= displayStartTime)
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
            
            if (lastBeforeDisplay) {
              // 添加一個虛擬點，使均線能夠延續到顯示範圍
              finalMaData = [
                { ...lastBeforeDisplay, timestamp: data[0].timestamp },
                ...maData.filter(point => point.timestamp.getTime() > displayStartTime && point.timestamp.getTime() <= displayEndTime)
              ];
            }
          }
          
          if (finalMaData.length > 0) {
            movingAverageDatasets.push({
              label: `${config.label} ${config.type}${config.period}`,
              type: 'line' as const,
              data: finalMaData.map(point => ({
                x: point.timestamp.getTime(),
                y: point.value,
              })),
              borderColor: config.color,
              backgroundColor: config.color + '20', // 添加透明度
              borderWidth: 2,
              pointRadius: 0, // 不顯示點
              pointHoverRadius: 4,
              fill: false,
              tension: 0.1, // 線條平滑
            });
          }
        }
      }
    });
  }

  const chartData = {
    datasets: [
      {
        label: `${symbol} K線圖`,
        type: 'candlestick' as const,
        data: data.map(item => ({
          x: item.timestamp.getTime(),
          o: item.open,
          h: item.high,
          l: item.low,
          c: item.close,
        })),
        // @ts-ignore
        borderColor: (ctx) => {
          const { o, c } = ctx.raw as { o: number; c: number };
          return c >= o ? '#00c896' : '#ff4757';
        },
        // @ts-ignore
        backgroundColor: (ctx) => {
          const { o, c } = ctx.raw as { o: number; c: number };
          return c >= o ? 'rgba(0, 200, 150, 0.8)' : 'rgba(255, 71, 87, 0.8)';
        },
        borderWidth: 1,
      },
      ...movingAverageDatasets,
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${symbol} K線圖 - ${interval}`,
        font: {
          size: 16,
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x' as const,
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x' as const,
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false,
        animation: {
          duration: 200,
        },
        // 過濾函數，只顯示 K線 數據
        filter: function(tooltipItem: any) {
          return tooltipItem.dataset.label && tooltipItem.dataset.label.includes('K線圖');
        },
        callbacks: {
          title: function(context: any) {
            if (context.length > 0) {
              const dataIndex = context[0].dataIndex;
              if (dataIndex < data.length) {
                return data[dataIndex].timestamp.toLocaleString();
              }
            }
            return '';
          },
          label: function(context: any) {
            const dataIndex = context.dataIndex;
            if (dataIndex < data.length && context.dataset.label?.includes('K線圖')) {
              const item = data[dataIndex];
              const change = item.close - item.open;
              const changePercent = ((change / item.open) * 100).toFixed(2);
              const changeText = change >= 0 ? `+${change.toFixed(4)} (+${changePercent}%)` : `${change.toFixed(4)} (${changePercent}%)`;
              
              return [
                `開盤: ${item.open.toFixed(4)}`,
                `最高: ${item.high.toFixed(4)}`,
                `最低: ${item.low.toFixed(4)}`,
                `收盤: ${item.close.toFixed(4)}`,
                `漲跌: ${changeText}`,
                `成交量: ${item.volume.toFixed(2)}`,
              ];
            }
            return '';
          },
        },
      },
      // 使用 interaction 設定來添加延遲
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
      onHover: (event: any, elements: any, chart: any) => {
        // 清除現有的計時器
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }

        if (elements.length > 0) {
          // 設定 1 秒延遲顯示 tooltip
          tooltipTimeoutRef.current = setTimeout(() => {
            // 讓 Chart.js 正常處理 hover
            if (chart.tooltip) {
              chart.tooltip.setActiveElements(elements, event);
              chart.update('none');
            }
          }, 1000);
        } else {
          // 如果沒有 hover 到元素，立即隱藏 tooltip
          if (chart.tooltip) {
            chart.tooltip.setActiveElements([], event);
            chart.update('none');
          }
        }
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          displayFormats: {
            minute: 'HH:mm',
            hour: 'MM/dd HH:mm',
            day: 'MM/dd',
            week: 'MM/dd',
          },
        },
        title: {
          display: true,
          text: '時間',
        },
      },
      y: {
        title: {
          display: true,
          text: '價格 (USDT)',
        },
        beginAtZero: false,
      },
    },
  };

  return (
    <div className="h-full w-full">
      <Chart 
        ref={chartRef} 
        type="candlestick" 
        data={chartData} 
        options={options} 
      />
    </div>
  );
};