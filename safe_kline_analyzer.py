#!/usr/bin/env python3
"""
謹慎的K線資料修復策略
1. 先從幣安API獲取最新正確資料
2. 比較並識別真正的錯誤
3. 只修復明確確認的錯誤
"""

import psycopg2
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import time

DB_CONFIG = {
    'host': '61.218.12.227',
    'port': '5432',
    'database': 'trade',
    'user': 'sa',
    'password': 'S0920D1124d0911'
}

class SafeKlineRepairer:
    def __init__(self):
        self.conn = None
        
    def get_connection(self):
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(**DB_CONFIG)
        return self.conn
    
    def close_connection(self):
        if self.conn and not self.conn.closed:
            self.conn.close()
    
    def get_binance_reference_data(self, symbol: str, interval: str, hours_back: int = 24) -> List[Dict]:
        """獲取幣安參考資料用於驗證"""
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours_back)
        
        start_ms = int(start_time.timestamp() * 1000)
        end_ms = int(end_time.timestamp() * 1000)
        
        url = "https://api.binance.com/api/v3/klines"
        params = {
            "symbol": symbol,
            "interval": interval,
            "startTime": start_ms,
            "endTime": end_ms,
            "limit": 1000
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                return [{
                    'open_time': datetime.fromtimestamp(kline[0] / 1000),
                    'open_price': float(kline[1]),
                    'close_price': float(kline[4])
                } for kline in data]
            else:
                print(f"❌ Binance API 錯誤: {response.status_code}")
                return []
        except Exception as e:
            print(f"❌ API 請求失敗: {e}")
            return []
    
    def analyze_open_price_errors(self, symbol: str, table: str) -> Dict:
        """分析開盤價錯誤，但不修復"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 獲取有問題的記錄
        cursor.execute(f"""
            WITH price_analysis AS (
                SELECT 
                    open_time,
                    open_price,
                    close_price,
                    LAG(close_price) OVER (ORDER BY open_time) as prev_close,
                    LAG(open_time) OVER (ORDER BY open_time) as prev_time
                FROM {table}
                WHERE symbol = %s
                ORDER BY open_time DESC
                LIMIT 100  -- 只檢查最近100筆
            )
            SELECT 
                open_time,
                prev_time,
                open_price,
                prev_close,
                ABS(open_price - COALESCE(prev_close, open_price)) as price_diff,
                CASE 
                    WHEN prev_close IS NOT NULL AND prev_close != 0 
                    THEN ABS(open_price - prev_close) / prev_close * 100
                    ELSE 0 
                END as error_pct
            FROM price_analysis
            WHERE prev_close IS NOT NULL
              AND ABS(open_price - prev_close) / prev_close > 0.001  -- 0.1% 閾值
            ORDER BY error_pct DESC
        """, (symbol,))
        
        problems = cursor.fetchall()
        cursor.close()
        
        return {
            'symbol': symbol,
            'table': table,
            'problem_count': len(problems),
            'problems': [{
                'open_time': row[0],
                'prev_time': row[1],
                'current_open': float(row[2]),
                'expected_open': float(row[3]),
                'difference': float(row[4]),
                'error_pct': float(row[5])
            } for row in problems[:10]]  # 只返回前10個最嚴重的
        }
    
    def verify_with_binance_before_fix(self, symbol: str, table: str, problem_time: datetime) -> Dict:
        """在修復前與幣安資料驗證"""
        interval_map = {'kline5m': '5m', 'kline1h': '1h', 'kline1d': '1d'}
        interval = interval_map.get(table, '5m')
        
        # 獲取問題時間前後的幣安資料
        start_time = problem_time - timedelta(hours=2)
        end_time = problem_time + timedelta(hours=2)
        
        binance_data = self.get_binance_reference_data(symbol, interval, 4)
        
        # 找到對應時間的資料
        target_kline = None
        prev_kline = None
        
        for i, kline in enumerate(binance_data):
            if abs((kline['open_time'] - problem_time).total_seconds()) < 300:  # 5分鐘容差
                target_kline = kline
                if i > 0:
                    prev_kline = binance_data[i-1]
                break
        
        if target_kline and prev_kline:
            return {
                'verified': True,
                'binance_open': target_kline['open_price'],
                'binance_prev_close': prev_kline['close_price'],
                'should_match': abs(target_kline['open_price'] - prev_kline['close_price']) < 0.01
            }
        else:
            return {'verified': False, 'reason': '無法獲取對應的幣安資料'}

def main():
    print("🔍 K線資料安全分析工具")
    print("=" * 60)
    
    repairer = SafeKlineRepairer()
    
    try:
        # 獲取活躍交易對
        conn = repairer.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT symbol FROM symbols WHERE is_active = true")
        symbols = [row[0] for row in cursor.fetchall()]
        cursor.close()
        
        for symbol in symbols:
            print(f"\n📊 分析交易對: {symbol}")
            print("-" * 40)
            
            for table in ['kline5m', 'kline1h', 'kline1d']:
                analysis = repairer.analyze_open_price_errors(symbol, table)
                
                if analysis['problem_count'] == 0:
                    print(f"  ✅ {table}: 無開盤價問題")
                else:
                    print(f"  ⚠️ {table}: 發現 {analysis['problem_count']} 個潛在問題")
                    
                    # 顯示最嚴重的幾個問題
                    for i, problem in enumerate(analysis['problems'][:3]):
                        print(f"    {i+1}. {problem['open_time']}: 開盤 {problem['current_open']:.6f} vs 預期 {problem['expected_open']:.6f} (差異: {problem['error_pct']:.4f}%)")
                        
                        # 與幣安驗證（只檢查最近的問題）
                        if i == 0 and (datetime.now() - problem['open_time']).days <= 1:
                            verification = repairer.verify_with_binance_before_fix(
                                symbol, table, problem['open_time']
                            )
                            
                            if verification.get('verified'):
                                if verification.get('should_match'):
                                    print(f"      🔍 幣安驗證: 開盤價應該等於上一收盤價 - 修復建議: ✅")
                                else:
                                    print(f"      🔍 幣安驗證: 開盤價與上一收盤價不同 - 修復建議: ❌")
                            else:
                                print(f"      🔍 幣安驗證失敗: {verification.get('reason', '未知')}")
                            
                            time.sleep(0.5)  # API限制
        
        print(f"\n💡 建議:")
        print(f"1. 檢查資料收集系統是否正常運行")
        print(f"2. 只修復經過幣安API驗證確認的錯誤")
        print(f"3. 考慮重新從幣安API同步最近的資料")
        print(f"4. 檢查是否有時區或時間同步問題")
        
    finally:
        repairer.close_connection()

if __name__ == "__main__":
    main()
