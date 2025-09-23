#!/usr/bin/env python3
"""
高級 K線資料診斷與修復工具
提供多種檢查模式和修復策略
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2
import requests
import time
from typing import List, Tuple, Dict, Optional
import argparse
from collections import defaultdict

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
        'minutes': 5,
        'table': 'kline5m',
        'binance_interval': '5m'
    },
    '1h': {
        'minutes': 60,
        'table': 'kline1h', 
        'binance_interval': '1h'
    },
    '1d': {
        'minutes': 1440,
        'table': 'kline1d',
        'binance_interval': '1d'
    }
}

class KlineDataChecker:
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
    
    def get_data_range(self, symbol: str, interval: str) -> Tuple[Optional[datetime], Optional[datetime], int]:
        """獲取資料的時間範圍和總數"""
        table = INTERVAL_CONFIG[interval]['table']
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(f"""
            SELECT MIN(open_time), MAX(open_time), COUNT(*)
            FROM {table}
            WHERE symbol = %s
        """, (symbol,))
        
        result = cursor.fetchone()
        cursor.close()
        
        return result[0], result[1], result[2]
    
    def check_data_gaps(self, symbol: str, interval: str) -> Dict:
        """檢查資料缺口"""
        config = INTERVAL_CONFIG[interval]
        table = config['table']
        interval_minutes = config['minutes']
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 獲取所有時間戳
        cursor.execute(f"""
            SELECT open_time FROM {table}
            WHERE symbol = %s
            ORDER BY open_time
        """, (symbol,))
        
        timestamps = [row[0] for row in cursor.fetchall()]
        cursor.close()
        
        if len(timestamps) < 2:
            return {
                'total_records': len(timestamps),
                'gaps': [],
                'total_missing': 0,
                'continuity_score': 0.0
            }
        
        # 檢查缺口
        gaps = []
        interval_delta = timedelta(minutes=interval_minutes)
        total_missing = 0
        
        for i in range(len(timestamps) - 1):
            current_time = timestamps[i]
            next_time = timestamps[i + 1]
            expected_next = current_time + interval_delta
            
            if next_time != expected_next:
                gap_duration = next_time - expected_next
                missing_count = int(gap_duration.total_seconds() / (interval_minutes * 60))
                
                gaps.append({
                    'start': expected_next,
                    'end': next_time - interval_delta,
                    'duration': gap_duration,
                    'missing_count': missing_count
                })
                total_missing += missing_count
        
        # 計算連續性得分
        total_expected = int((timestamps[-1] - timestamps[0]).total_seconds() / (interval_minutes * 60)) + 1
        continuity_score = (len(timestamps) / total_expected) * 100 if total_expected > 0 else 0
        
        return {
            'total_records': len(timestamps),
            'gaps': gaps,
            'total_missing': total_missing,
            'continuity_score': continuity_score,
            'first_record': timestamps[0] if timestamps else None,
            'last_record': timestamps[-1] if timestamps else None
        }
    
    def check_price_continuity(self, symbol: str, interval: str, threshold: float = 0.1) -> Dict:
        """檢查價格連續性（檢測異常跳躍和開盤價不連續）"""
        table = INTERVAL_CONFIG[interval]['table']
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(f"""
            SELECT open_time, open_price, close_price,
                   LAG(close_price) OVER (ORDER BY open_time) as prev_close,
                   LAG(open_time) OVER (ORDER BY open_time) as prev_time
            FROM {table}
            WHERE symbol = %s
            ORDER BY open_time
        """, (symbol,))
        
        results = cursor.fetchall()
        cursor.close()
        
        price_jumps = []
        open_price_errors = []
        
        for i, (timestamp, open_price, close_price, prev_close, prev_time) in enumerate(results):
            if prev_close is not None:
                # 檢查收盤價異常跳躍
                change_pct = abs(float(close_price) - float(prev_close)) / float(prev_close)
                
                if change_pct > threshold:
                    price_jumps.append({
                        'timestamp': timestamp,
                        'prev_price': float(prev_close),
                        'current_price': float(close_price),
                        'change_pct': change_pct * 100
                    })
                
                # 檢查開盤價是否等於上一根的收盤價
                open_price_val = float(open_price)
                prev_close_val = float(prev_close)
                price_diff = abs(open_price_val - prev_close_val)
                
                # 使用相對誤差檢查，避免浮點數精度問題
                relative_error = price_diff / prev_close_val if prev_close_val != 0 else 0
                
                if relative_error > 0.0001:  # 0.01% 的容錯範圍
                    open_price_errors.append({
                        'timestamp': timestamp,
                        'prev_time': prev_time,
                        'open_price': open_price_val,
                        'expected_open': prev_close_val,
                        'difference': price_diff,
                        'error_pct': relative_error * 100
                    })
        
        return {
            'total_records': len(results),
            'price_jumps': price_jumps,
            'jump_count': len(price_jumps),
            'threshold_pct': threshold * 100,
            'open_price_errors': open_price_errors,
            'open_error_count': len(open_price_errors)
        }
    
    def fetch_and_insert_missing_data(self, symbol: str, interval: str, 
                                     start_time: datetime, end_time: datetime) -> int:
        """獲取並插入缺失的資料"""
        config = INTERVAL_CONFIG[interval]
        table = config['table']
        binance_interval = config['binance_interval']
        
        start_ms = int(start_time.timestamp() * 1000)
        end_ms = int(end_time.timestamp() * 1000)
        
        # 從 Binance 獲取資料
        binance_data = self.fetch_binance_klines(symbol, binance_interval, start_ms, end_ms)
        
        if not binance_data:
            return 0
        
        # 插入資料
        conn = self.get_connection()
        inserted_count = 0
        
        for kline in binance_data:
            if self.insert_kline_record(conn, table, symbol, kline):
                inserted_count += 1
        
        return inserted_count
    
    def fetch_binance_klines(self, symbol: str, interval: str, start_time: int, end_time: int) -> List[List]:
        """從 Binance 獲取 K線資料"""
        url = "https://api.binance.com/api/v3/klines"
        params = {
            "symbol": symbol,
            "interval": interval,
            "startTime": start_time,
            "endTime": end_time,
            "limit": 1000
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"    ❌ Binance API 錯誤: {response.status_code}")
                return []
        except Exception as e:
            print(f"    ❌ API 請求失敗: {e}")
            return []
    
    def fix_open_price_continuity(self, symbol: str, interval: str, dry_run: bool = False) -> int:
        """修復開盤價連續性問題"""
        table = INTERVAL_CONFIG[interval]['table']
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 獲取有問題的記錄
        cursor.execute(f"""
            WITH price_check AS (
                SELECT open_time, open_price, close_price,
                       LAG(close_price) OVER (ORDER BY open_time) as prev_close,
                       LAG(open_time) OVER (ORDER BY open_time) as prev_time
                FROM {table}
                WHERE symbol = %s
                ORDER BY open_time
            )
            SELECT open_time, open_price, prev_close
            FROM price_check
            WHERE prev_close IS NOT NULL 
              AND ABS(open_price - prev_close) / prev_close > 0.0001
            ORDER BY open_time
        """, (symbol,))
        
        problematic_records = cursor.fetchall()
        
        if not problematic_records:
            cursor.close()
            return 0
        
        fixed_count = 0
        
        for open_time, current_open, correct_open in problematic_records:
            if dry_run:
                print(f"      [模擬] 修復 {open_time}: {current_open:.4f} -> {correct_open:.4f}")
                fixed_count += 1
            else:
                try:
                    cursor.execute(f"""
                        UPDATE {table}
                        SET open_price = %s
                        WHERE symbol = %s AND open_time = %s
                    """, (float(correct_open), symbol, open_time))
                    
                    if cursor.rowcount > 0:
                        fixed_count += 1
                        print(f"      ✅ 修復 {open_time}: {current_open:.4f} -> {correct_open:.4f}")
                    
                except Exception as e:
                    print(f"      ❌ 修復失敗 {open_time}: {e}")
        
        if not dry_run:
            conn.commit()
        
        cursor.close()
        return fixed_count
        """插入單筆 K線記錄"""
        try:
            cursor = conn.cursor()
            
            open_time = datetime.fromtimestamp(kline_data[0] / 1000)
            close_time = datetime.fromtimestamp(kline_data[6] / 1000)
            
            # 檢查是否已存在
            cursor.execute(f"""
                SELECT COUNT(*) FROM {table} 
                WHERE symbol = %s AND open_time = %s
            """, (symbol, open_time))
            
            if cursor.fetchone()[0] > 0:
                cursor.close()
                return False
            
            # 插入新記錄
            cursor.execute(f"""
                INSERT INTO {table} (
                    symbol, open_time, close_time, open_price, high_price,
                    low_price, close_price, volume
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                symbol,
                open_time,
                close_time,
                float(kline_data[1]),
                float(kline_data[2]),
                float(kline_data[3]),
                float(kline_data[4]),
                float(kline_data[5])
            ))
            
            conn.commit()
            cursor.close()
            return True
            
        except Exception as e:
            conn.rollback()
            cursor.close()
            print(f"    ❌ 插入記錄失敗: {e}")
            return False

def run_diagnostic_mode(checker: KlineDataChecker, symbols: List[str], intervals: List[str]):
    """運行診斷模式"""
    print("\n🔍 運行診斷模式...")
    
    for symbol in symbols:
        print(f"\n{'='*60}")
        print(f"📊 診斷交易對: {symbol}")
        print(f"{'='*60}")
        
        for interval in intervals:
            print(f"\n📈 檢查 {interval} 資料:")
            
            # 獲取基本資訊
            start_time, end_time, total_count = checker.get_data_range(symbol, interval)
            
            if total_count == 0:
                print(f"    ❌ 無資料")
                continue
            
            print(f"    📅 時間範圍: {start_time} 到 {end_time}")
            print(f"    📊 總記錄數: {total_count}")
            
            # 檢查時間缺口
            gap_info = checker.check_data_gaps(symbol, interval)
            print(f"    🔗 連續性得分: {gap_info['continuity_score']:.2f}%")
            
            if gap_info['gaps']:
                print(f"    ⚠️ 發現 {len(gap_info['gaps'])} 個時間缺口，缺失 {gap_info['total_missing']} 筆資料")
                
                # 顯示最大的幾個缺口
                sorted_gaps = sorted(gap_info['gaps'], key=lambda x: x['missing_count'], reverse=True)
                for i, gap in enumerate(sorted_gaps[:3]):
                    print(f"      缺口 {i+1}: {gap['start']} - {gap['end']} (缺失 {gap['missing_count']} 筆)")
            else:
                print(f"    ✅ 時間序列完整")
            
            # 檢查價格連續性
            price_info = checker.check_price_continuity(symbol, interval, 0.1)
            if price_info['jump_count'] > 0:
                print(f"    ⚠️ 發現 {price_info['jump_count']} 個異常價格跳躍 (>{price_info['threshold_pct']:.1f}%)")
                
                # 顯示最大的幾個跳躍
                sorted_jumps = sorted(price_info['price_jumps'], key=lambda x: x['change_pct'], reverse=True)
                for i, jump in enumerate(sorted_jumps[:3]):
                    print(f"      跳躍 {i+1}: {jump['timestamp']} {jump['prev_price']:.4f} -> {jump['current_price']:.4f} ({jump['change_pct']:.2f}%)")
            else:
                print(f"    ✅ 價格連續性正常")
            
            # 檢查開盤價連續性
            if price_info['open_error_count'] > 0:
                print(f"    ❌ 發現 {price_info['open_error_count']} 個開盤價不連續錯誤")
                
                # 顯示最嚴重的幾個錯誤
                sorted_errors = sorted(price_info['open_price_errors'], key=lambda x: x['error_pct'], reverse=True)
                for i, error in enumerate(sorted_errors[:5]):
                    print(f"      錯誤 {i+1}: {error['timestamp']} 開盤 {error['open_price']:.4f} ≠ 預期 {error['expected_open']:.4f} (差異: {error['error_pct']:.4f}%)")
            else:
                print(f"    ✅ 開盤價連續性正常")

def run_repair_mode(checker: KlineDataChecker, symbols: List[str], intervals: List[str], max_days: int):
    """運行修復模式"""
    print(f"\n🔧 運行修復模式（最大修復 {max_days} 天缺口）...")
    
    total_fixed = 0
    
    for symbol in symbols:
        print(f"\n{'='*60}")
        print(f"🔧 修復交易對: {symbol}")
        print(f"{'='*60}")
        
        for interval in intervals:
            print(f"\n📈 修復 {interval} 資料:")
            
            # 檢查缺口
            gap_info = checker.check_data_gaps(symbol, interval)
            
            if not gap_info['gaps']:
                print(f"    ✅ 無需修復")
                continue
            
            print(f"    📊 發現 {len(gap_info['gaps'])} 個缺口，開始修復...")
            
            fixed_count = 0
            for i, gap in enumerate(gap_info['gaps']):
                gap_days = gap['duration'].days
                
                if gap_days > max_days:
                    print(f"      ⚠️ 缺口 {i+1} 太大（{gap_days} 天），跳過")
                    continue
                
                print(f"      🔧 修復缺口 {i+1}: {gap['start']} - {gap['end']}")
                
                inserted = checker.fetch_and_insert_missing_data(
                    symbol, interval, gap['start'], gap['end']
                )
                
                fixed_count += inserted
                print(f"      ✅ 補充 {inserted} 筆資料")
                
                # 避免 API 限制
                time.sleep(0.1)
            
            total_fixed += fixed_count
            print(f"    📊 {interval} 修復完成，共補充 {fixed_count} 筆資料")
            
            # 檢查並修復開盤價連續性
            print(f"    🔧 檢查開盤價連續性...")
            open_fixed = checker.fix_open_price_continuity(symbol, interval, dry_run=False)
            if open_fixed > 0:
                print(f"    ✅ 修復 {open_fixed} 個開盤價連續性問題")
            else:
                print(f"    ✅ 開盤價連續性正常")
    
    print(f"\n✅ 修復完成！總共補充 {total_fixed} 筆資料")

def main():
    """主函數"""
    parser = argparse.ArgumentParser(description='K線資料檢查與修復工具')
    parser.add_argument('--mode', choices=['diagnostic', 'repair', 'both'], 
                       default='both', help='運行模式')
    parser.add_argument('--symbols', help='指定交易對（逗號分隔）')
    parser.add_argument('--intervals', help='指定時間間隔（逗號分隔）', 
                       default='5m,1h,1d')
    parser.add_argument('--max-days', type=int, default=30, 
                       help='單次修復的最大天數')
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("🔧 K線資料檢查與修復工具")
    print("=" * 80)
    
    checker = KlineDataChecker()
    
    try:
        # 獲取交易對
        if args.symbols:
            symbols = [s.strip() for s in args.symbols.split(',')]
        else:
            symbols = checker.get_symbols()
        
        # 獲取時間間隔
        intervals = [i.strip() for i in args.intervals.split(',')]
        intervals = [i for i in intervals if i in INTERVAL_CONFIG]
        
        if not symbols:
            print("❌ 沒有找到交易對")
            return
        
        if not intervals:
            print("❌ 沒有有效的時間間隔")
            return
        
        print(f"📈 交易對: {', '.join(symbols)}")
        print(f"⏰ 時間間隔: {', '.join(intervals)}")
        
        # 運行指定模式
        if args.mode in ['diagnostic', 'both']:
            run_diagnostic_mode(checker, symbols, intervals)
        
        if args.mode in ['repair', 'both']:
            run_repair_mode(checker, symbols, intervals, args.max_days)
        
    finally:
        checker.close_connection()

if __name__ == "__main__":
    main()
