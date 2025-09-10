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
}

export const KlineChart: React.FC<KlineChartProps> = ({ data, symbol, interval, movingAverageConfig }) => {
  const chartRef = useRef<ChartJS<'candlestick'>>(null);

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
  const movingAverageDatasets = [];
  if (movingAverageConfig && data.length > 0) {
    // 轉換數據格式為均線計算所需
    const klineData: KlineDataPoint[] = data.map(item => ({
      timestamp: item.timestamp,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    // 為每個啟用的均線創建數據集
    Object.entries(movingAverageConfig).forEach(([key, config]) => {
      if (config.enabled && config.period > 0 && config.period <= klineData.length) {
        const maData = calculateMovingAverage(klineData, config.type, config.period);
        
        if (maData.length > 0) {
          movingAverageDatasets.push({
            label: `${config.label} ${config.type}${config.period}`,
            type: 'line' as const,
            data: maData.map(point => ({
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
        mode: 'index' as const,
        intersect: false,
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
            if (dataIndex < data.length) {
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