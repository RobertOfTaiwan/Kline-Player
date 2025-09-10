// 均線計算工具函數

export interface KlineDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MovingAveragePoint {
  timestamp: Date;
  value: number;
}

export interface MovingAverageTypeEnum {
  SMA: 'SMA';
  EMA: 'EMA';
  VWMA: 'VWMA';
}

export type MovingAverageType = 'SMA' | 'EMA' | 'VWMA';

/**
 * 計算簡單移動平均線 (Simple Moving Average)
 * @param data K線資料
 * @param period 週期
 * @returns 移動平均線資料點
 */
export function calculateSMA(data: KlineDataPoint[], period: number): MovingAveragePoint[] {
  if (data.length < period) return [];

  const result: MovingAveragePoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    
    result.push({
      timestamp: data[i].timestamp,
      value: sum / period
    });
  }

  return result;
}

/**
 * 計算指數移動平均線 (Exponential Moving Average)
 * @param data K線資料
 * @param period 週期
 * @returns 移動平均線資料點
 */
export function calculateEMA(data: KlineDataPoint[], period: number): MovingAveragePoint[] {
  if (data.length < period) return [];

  const result: MovingAveragePoint[] = [];
  const multiplier = 2 / (period + 1);

  // 第一個EMA值使用SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;

  result.push({
    timestamp: data[period - 1].timestamp,
    value: ema
  });

  // 後續使用EMA公式
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close * multiplier) + (ema * (1 - multiplier));
    result.push({
      timestamp: data[i].timestamp,
      value: ema
    });
  }

  return result;
}

/**
 * 計算成交量加權移動平均線 (Volume Weighted Moving Average)
 * @param data K線資料
 * @param period 週期
 * @returns 移動平均線資料點
 */
export function calculateVWMA(data: KlineDataPoint[], period: number): MovingAveragePoint[] {
  if (data.length < period) return [];

  const result: MovingAveragePoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let priceVolumeSum = 0;
    let volumeSum = 0;

    for (let j = i - period + 1; j <= i; j++) {
      priceVolumeSum += data[j].close * data[j].volume;
      volumeSum += data[j].volume;
    }

    if (volumeSum > 0) {
      result.push({
        timestamp: data[i].timestamp,
        value: priceVolumeSum / volumeSum
      });
    }
  }

  return result;
}

/**
 * 根據類型計算移動平均線
 * @param data K線資料
 * @param type 均線類型
 * @param period 週期
 * @returns 移動平均線資料點
 */
export function calculateMovingAverage(
  data: KlineDataPoint[],
  type: MovingAverageType,
  period: number
): MovingAveragePoint[] {
  switch (type) {
    case 'SMA':
      return calculateSMA(data, period);
    case 'EMA':
      return calculateEMA(data, period);
    case 'VWMA':
      return calculateVWMA(data, period);
    default:
      return [];
  }
}

/**
 * 驗證週期是否合理
 * @param period 週期
 * @param dataLength 資料長度
 * @returns 是否有效
 */
export function isValidPeriod(period: number, dataLength: number): boolean {
  return period > 0 && period <= dataLength && period <= 200; // 最大週期限制為200
}

/**
 * 獲取建議的預設週期
 * @param interval K線時間間隔
 * @returns 短期、中期、長期週期建議
 */
export function getDefaultPeriods(interval: string): { short: number; medium: number; long: number } {
  const defaults = {
    '5m': { short: 12, medium: 26, long: 50 },
    '15m': { short: 10, medium: 20, long: 40 },
    '1h': { short: 12, medium: 26, long: 50 },
    '4h': { short: 6, medium: 12, long: 24 },
    '1d': { short: 5, medium: 10, long: 20 },
    '1w': { short: 4, medium: 8, long: 12 }
  };

  return defaults[interval as keyof typeof defaults] || { short: 12, medium: 26, long: 50 };
}

