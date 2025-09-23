#!/usr/bin/env python3
"""
K線資料與幣安API驗證工具
檢查我們的資料是否與幣安的實際資料一致
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2
import requests
import time
import argparse
from typing import List, Dict, Optional, Tuple

# 載入環境變數
load_dotenv()

# 資料庫設定
DB_CONFIG = {
    'host': '61.218.12.227',
    'port': '5432',
    'database': 'trade',
    'user': 'sa',
    'password': 'S0920D1124d0911'
}

# 時間間隔配置
INTERVAL_CONFIG = {
    '5m': {
        'table': 'kline5m',
        'binance_interval': '5m'
    },
    '1h': {
        'table': 'kline1h', 
        'binance_interval': '1h'
    },
    '1d': {
        'table': 'kline1d',
        'binance_interval': '1d'
    }
}

class BinanceDataValidator:
    def __init__(self):
        self.conn = None
        
    def get_connection(self):
        """獲取資料庫連接"""
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(**DB_CONFIG)
        return self.conn
    
    def close_connection(self):
        """關閉資料庫連接"""
        if self.conn and not self.conn.closed:
            self.conn.close()
    
    def get_symbols(self, active_only: bool = True) -> List[str]:
        """獲取交易對列表"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if active_only:
            cursor.execute("SELECT symbol FROM symbols WHERE is_active = true ORDER BY symbol")
        else:
            cursor.execute("SELECT symbol FROM symbols ORDER BY symbol")
        
        symbols = [row[0] for row in cursor.fetchall()]
        cursor.close()
        return symbols
    
    def get_database_klines(self, symbol: str, interval: str, start_time: datetime, end_time: datetime) -> List[Dict]:
        """從資料庫獲取K線資料"""
        table = INTERVAL_CONFIG[interval]['table']
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(f"""
            SELECT open_time, open_price, high_price, low_price, close_price, volume
            FROM {table}
            WHERE symbol = %s AND open_time >= %s AND open_time <= %s
            ORDER BY open_time
        """, (symbol, start_time, end_time))
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'open_time': row[0],
                'open_price': float(row[1]),
                'high_price': float(row[2]),
                'low_price': float(row[3]),
                'close_price': float(row[4]),
                'volume': float(row[5])
            })
        
        cursor.close()
        return results
    
    def get_binance_klines(self, symbol: str, interval: str, start_time: datetime, end_time: datetime) -> List[Dict]:
        """從幣安API獲取K線資料"""
        binance_interval = INTERVAL_CONFIG[interval]['binance_interval']
        start_ms = int(start_time.timestamp() * 1000)
        end_ms = int(end_time.timestamp() * 1000)
        
        url = "https://api.binance.com/api/v3/klines"
        params = {
            "symbol": symbol,
            "interval": binance_interval,
            "startTime": start_ms,
            "endTime": end_ms,
            "limit": 1000
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                results = []
                
                for kline in data:
                    results.append({
                        'open_time': datetime.fromtimestamp(kline[0] / 1000),
                        'open_price': float(kline[1]),
                        'high_price': float(kline[2]),
                        'low_price': float(kline[3]),
                        'close_price': float(kline[4]),
                        'volume': float(kline[5])
                    })
                
                return results
            else:
                print(f"    ❌ Binance API 錯誤: {response.status_code}")
                return []
        except Exception as e:
            print(f"    ❌ API 請求失敗: {e}")
            return []
    
    def compare_klines(self, db_klines: List[Dict], binance_klines: List[Dict], tolerance: float = 0.0001) -> Dict:
        """比較資料庫和幣安的K線資料"""
        # 建立時間索引
        db_dict = {kline['open_time']: kline for kline in db_klines}
        binance_dict = {kline['open_time']: kline for kline in binance_klines}
        
        # 找出共同的時間點
        common_times = set(db_dict.keys()) & set(binance_dict.keys())
        
        mismatches = []
        perfect_matches = 0
        
        for time_point in sorted(common_times):
            db_data = db_dict[time_point]
            binance_data = binance_dict[time_point]
            
            # 檢查各個價格欄位
            price_diffs = {}
            has_mismatch = False
            
            for field in ['open_price', 'high_price', 'low_price', 'close_price']:
                db_price = db_data[field]
                binance_price = binance_data[field]
                
                if binance_price != 0:
                    relative_diff = abs(db_price - binance_price) / binance_price
                    price_diffs[field] = {
                        'db_value': db_price,
                        'binance_value': binance_price,
                        'diff_pct': relative_diff * 100
                    }
                    
                    if relative_diff > tolerance:
                        has_mismatch = True
            
            if has_mismatch:
                mismatches.append({
                    'time': time_point,
                    'price_diffs': price_diffs
                })
            else:
                perfect_matches += 1
        
        return {
            'total_compared': len(common_times),
            'perfect_matches': perfect_matches,
            'mismatches': mismatches,
            'mismatch_count': len(mismatches),
            'accuracy_pct': (perfect_matches / len(common_times) * 100) if common_times else 0,
            'db_only': len(db_dict) - len(common_times),
            'binance_only': len(binance_dict) - len(common_times)
        }
    
    def validate_symbol_interval(self, symbol: str, interval: str, days_back: int = 3) -> Dict:
        """驗證特定交易對和時間間隔的資料"""
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_back)
        
        print(f"    📊 驗證時間範圍: {start_time.strftime('%Y-%m-%d %H:%M')} 到 {end_time.strftime('%Y-%m-%d %H:%M')}")
        
        # 獲取資料庫資料
        print("    📥 獲取資料庫資料...")
        db_klines = self.get_database_klines(symbol, interval, start_time, end_time)
        
        # 獲取幣安資料
        print("    🌐 獲取幣安API資料...")
        binance_klines = self.get_binance_klines(symbol, interval, start_time, end_time)
        
        if not binance_klines:
            return {'error': '無法獲取幣安資料'}
        
        # 比較資料
        print("    🔍 比較資料...")
        comparison = self.compare_klines(db_klines, binance_klines)
        
        return comparison
    
    def check_open_price_logic(self, symbol: str, interval: str, sample_size: int = 10) -> Dict:
        """檢查開盤價連續性邏輯是否正確"""
        end_time = datetime.now()
        start_time = end_time - timedelta(days=7)  # 檢查最近7天的資料
        
        print(f"    🔍 檢查開盤價連續性邏輯（樣本大小: {sample_size}）")
        
        # 獲取幣安資料
        binance_klines = self.get_binance_klines(symbol, interval, start_time, end_time)
        
        if len(binance_klines) < 2:
            return {'error': '資料不足'}
        
        # 檢查連續的K線是否開盤價等於上一根收盤價
        consecutive_matches = 0
        total_checks = 0
        exceptions = []
        
        for i in range(1, min(len(binance_klines), sample_size + 1)):
            prev_kline = binance_klines[i-1]
            curr_kline = binance_klines[i]
            
            prev_close = prev_kline['close_price']
            curr_open = curr_kline['open_price']
            
            # 計算差異
            if prev_close != 0:
                diff_pct = abs(curr_open - prev_close) / prev_close * 100
                
                if diff_pct < 0.01:  # 0.01% 容差
                    consecutive_matches += 1
                else:
                    exceptions.append({
                        'prev_time': prev_kline['open_time'],
                        'curr_time': curr_kline['open_time'],
                        'prev_close': prev_close,
                        'curr_open': curr_open,
                        'diff_pct': diff_pct
                    })
                
                total_checks += 1
        
        return {
            'total_checks': total_checks,
            'consecutive_matches': consecutive_matches,
            'match_rate': (consecutive_matches / total_checks * 100) if total_checks > 0 else 0,
            'exceptions': exceptions
        }

def run_validation(validator: BinanceDataValidator, symbols: List[str], intervals: List[str], days_back: int):
    """運行驗證模式"""
    print(f"\n🔍 運行資料驗證模式（檢查最近 {days_back} 天）")
    print("="*80)
    
    for symbol in symbols:
        print(f"\n📊 驗證交易對: {symbol}")
        print("-" * 60)
        
        for interval in intervals:
            print(f"\n📈 驗證 {interval} 資料:")
            
            # 驗證資料準確性
            result = validator.validate_symbol_interval(symbol, interval, days_back)
            
            if 'error' in result:
                print(f"    ❌ 錯誤: {result['error']}")
                continue
            
            print(f"    📊 比較結果:")
            print(f"      總比較數: {result['total_compared']}")
            print(f"      完全匹配: {result['perfect_matches']}")
            print(f"      不匹配數: {result['mismatch_count']}")
            print(f"      準確率: {result['accuracy_pct']:.2f}%")
            
            if result['db_only'] > 0:
                print(f"      資料庫獨有: {result['db_only']} 筆")
            if result['binance_only'] > 0:
                print(f"      幣安獨有: {result['binance_only']} 筆")
            
            # 顯示主要不匹配
            if result['mismatches']:
                print(f"    ⚠️ 主要不匹配 (前5個):")
                for i, mismatch in enumerate(result['mismatches'][:5]):
                    print(f"      {i+1}. {mismatch['time']}")
                    for field, diff_data in mismatch['price_diffs'].items():
                        if diff_data['diff_pct'] > 0.01:  # 只顯示顯著差異
                            print(f"         {field}: DB={diff_data['db_value']:.6f} vs 幣安={diff_data['binance_value']:.6f} (差異: {diff_data['diff_pct']:.4f}%)")
            
            # 檢查開盤價連續性邏輯
            logic_check = validator.check_open_price_logic(symbol, interval, 20)
            if 'error' not in logic_check:
                print(f"    🔗 開盤價連續性邏輯檢查:")
                print(f"      連續性匹配率: {logic_check['match_rate']:.2f}% ({logic_check['consecutive_matches']}/{logic_check['total_checks']})")
                
                if logic_check['exceptions']:
                    print(f"      例外情況 (前3個):")
                    for i, exc in enumerate(logic_check['exceptions'][:3]):
                        print(f"        {i+1}. {exc['curr_time']}: 開盤 {exc['curr_open']:.6f} ≠ 上收盤 {exc['prev_close']:.6f} (差異: {exc['diff_pct']:.4f}%)")
            
            time.sleep(0.2)  # 避免API限制

def main():
    """主函數"""
    parser = argparse.ArgumentParser(description='K線資料與幣安API驗證工具')
    parser.add_argument('--symbols', help='指定交易對（逗號分隔）')
    parser.add_argument('--intervals', help='指定時間間隔（逗號分隔）', 
                       default='5m,1h,1d')
    parser.add_argument('--days', type=int, default=3, 
                       help='檢查最近幾天的資料')
    
    args = parser.parse_args()
    
    print("="*80)
    print("🔧 K線資料與幣安API驗證工具")
    print("="*80)
    
    validator = BinanceDataValidator()
    
    try:
        # 獲取交易對
        if args.symbols:
            symbols = [s.strip() for s in args.symbols.split(',')]
        else:
            symbols = validator.get_symbols()
        
        # 獲取時間間隔
        intervals = [i.strip() for i in args.intervals.split(',')]
        intervals = [i for i in intervals if i in INTERVAL_CONFIG]
        
        if not symbols:
            print("❌ 沒有找到交易對")
            return
        
        if not intervals:
            print("❌ 沒有有效的時間間隔")
            return
        
        print(f"📈 交易對: {', '.join(symbols[:3])}{'...' if len(symbols) > 3 else ''} (共 {len(symbols)} 個)")
        print(f"⏰ 時間間隔: {', '.join(intervals)}")
        print(f"📅 檢查天數: {args.days}")
        
        # 運行驗證
        run_validation(validator, symbols, intervals, args.days)
        
    finally:
        validator.close_connection()

if __name__ == "__main__":
    main()
