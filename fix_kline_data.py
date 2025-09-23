#!/usr/bin/env python3
"""
K線資料完整性檢查與修復工具
檢查 kline5m, kline1h, kline1d 資料表中的時間間隔是否連續
並從 Binance API 補齊缺失的資料
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2
import requests
import time
from typing import List, Tuple, Dict

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

def get_db_connection():
    """獲取資料庫連接"""
    return psycopg2.connect(**DB_CONFIG)

def fetch_binance_klines(symbol: str, interval: str, start_time: int, end_time: int) -> List[List]:
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
            data = response.json()
            print(f"    從 Binance 獲取到 {len(data)} 筆 {symbol} {interval} 資料")
            return data
        else:
            print(f"    ❌ Binance API 錯誤: {response.status_code}")
            return []
    except Exception as e:
        print(f"    ❌ API 請求失敗: {e}")
        return []

def insert_kline_record(conn, table: str, symbol: str, kline_data: List) -> bool:
    """插入單筆 K線記錄到資料庫"""
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
            return False  # 已存在，不需要插入
        
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
            float(kline_data[1]),  # open
            float(kline_data[2]),  # high
            float(kline_data[3]),  # low
            float(kline_data[4]),  # close
            float(kline_data[5])   # volume
        ))
        
        conn.commit()
        cursor.close()
        return True
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f"    ❌ 插入記錄失敗: {e}")
        return False

def get_existing_timestamps(conn, table: str, symbol: str) -> List[datetime]:
    """獲取資料庫中已有的時間戳列表"""
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT open_time FROM {table} 
        WHERE symbol = %s 
        ORDER BY open_time
    """, (symbol,))
    
    timestamps = [row[0] for row in cursor.fetchall()]
    cursor.close()
    return timestamps

def find_missing_intervals(timestamps: List[datetime], interval_minutes: int) -> List[Tuple[datetime, datetime]]:
    """找出缺失的時間間隔"""
    if len(timestamps) < 2:
        return []
    
    missing_ranges = []
    interval_delta = timedelta(minutes=interval_minutes)
    
    for i in range(len(timestamps) - 1):
        current_time = timestamps[i]
        next_time = timestamps[i + 1]
        expected_next_time = current_time + interval_delta
        
        # 如果下一個時間戳不是預期的時間，說明有缺失
        if next_time != expected_next_time:
            missing_start = expected_next_time
            missing_end = next_time - interval_delta
            
            # 確保缺失範圍有效
            if missing_start <= missing_end:
                missing_ranges.append((missing_start, missing_end))
    
    return missing_ranges

def generate_missing_timestamps(start_time: datetime, end_time: datetime, interval_minutes: int) -> List[datetime]:
    """生成缺失時間範圍內的所有時間戳"""
    timestamps = []
    current_time = start_time
    interval_delta = timedelta(minutes=interval_minutes)
    
    while current_time <= end_time:
        timestamps.append(current_time)
        current_time += interval_delta
    
    return timestamps

def check_and_fix_symbol_data(symbol: str, interval: str, max_days: int = 30) -> Dict:
    """檢查並修復單個交易對的資料"""
    config = INTERVAL_CONFIG[interval]
    table = config['table']
    interval_minutes = config['minutes']
    binance_interval = config['binance_interval']
    
    print(f"\n🔍 檢查 {symbol} {interval} 資料...")
    
    conn = get_db_connection()
    
    # 獲取現有時間戳
    existing_timestamps = get_existing_timestamps(conn, table, symbol)
    
    if len(existing_timestamps) < 2:
        print(f"    ⚠️ 資料太少（{len(existing_timestamps)} 筆），跳過檢查")
        conn.close()
        return {'symbol': symbol, 'interval': interval, 'missing_count': 0, 'fixed_count': 0}
    
    print(f"    📊 現有資料: {len(existing_timestamps)} 筆")
    print(f"    📅 時間範圍: {existing_timestamps[0]} 到 {existing_timestamps[-1]}")
    
    # 找出缺失的時間間隔
    missing_ranges = find_missing_intervals(existing_timestamps, interval_minutes)
    
    if not missing_ranges:
        print(f"    ✅ 資料完整，無缺失")
        conn.close()
        return {'symbol': symbol, 'interval': interval, 'missing_count': 0, 'fixed_count': 0}
    
    print(f"    ⚠️ 發現 {len(missing_ranges)} 個缺失時間段")
    
    total_missing = 0
    total_fixed = 0
    
    # 處理每個缺失範圍
    for i, (start_time, end_time) in enumerate(missing_ranges):
        # 限制修復範圍，避免一次性處理太多資料
        duration_days = (end_time - start_time).days
        if duration_days > max_days:
            print(f"    ⚠️ 缺失範圍 {i+1} 太大（{duration_days} 天），限制為 {max_days} 天")
            end_time = start_time + timedelta(days=max_days)
        
        print(f"    🔧 修復缺失範圍 {i+1}: {start_time} 到 {end_time}")
        
        # 生成缺失的時間戳
        missing_timestamps = generate_missing_timestamps(start_time, end_time, interval_minutes)
        total_missing += len(missing_timestamps)
        
        print(f"      需要補充 {len(missing_timestamps)} 筆資料")
        
        # 分批從 Binance 獲取資料
        batch_size = 1000  # Binance API 限制
        for batch_start in range(0, len(missing_timestamps), batch_size):
            batch_end = min(batch_start + batch_size, len(missing_timestamps))
            batch_timestamps = missing_timestamps[batch_start:batch_end]
            
            if not batch_timestamps:
                continue
            
            # 轉換為毫秒時間戳
            start_ms = int(batch_timestamps[0].timestamp() * 1000)
            end_ms = int(batch_timestamps[-1].timestamp() * 1000)
            
            print(f"      正在獲取批次 {batch_start//batch_size + 1} ({len(batch_timestamps)} 筆)...")
            
            # 從 Binance 獲取資料
            binance_data = fetch_binance_klines(symbol, binance_interval, start_ms, end_ms)
            
            if binance_data:
                # 插入資料到資料庫
                batch_fixed = 0
                for kline in binance_data:
                    if insert_kline_record(conn, table, symbol, kline):
                        batch_fixed += 1
                
                total_fixed += batch_fixed
                print(f"      ✅ 成功補充 {batch_fixed} 筆資料")
            
            # 避免 API 限制
            time.sleep(0.1)
    
    conn.close()
    
    print(f"    📊 修復完成: 缺失 {total_missing} 筆，補充 {total_fixed} 筆")
    
    return {
        'symbol': symbol, 
        'interval': interval, 
        'missing_count': total_missing, 
        'fixed_count': total_fixed
    }

def get_active_symbols() -> List[str]:
    """獲取活躍的交易對列表"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT symbol FROM symbols WHERE is_active = true ORDER BY symbol")
    symbols = [row[0] for row in cursor.fetchall()]
    
    cursor.close()
    conn.close()
    
    return symbols

def main():
    """主函數"""
    print("=" * 80)
    print("🔧 K線資料完整性檢查與修復工具")
    print("=" * 80)
    
    # 獲取活躍交易對
    symbols = get_active_symbols()
    
    if not symbols:
        print("❌ 沒有找到活躍的交易對")
        return
    
    print(f"📈 找到 {len(symbols)} 個活躍交易對: {', '.join(symbols)}")
    
    # 詢問用戶要檢查的時間間隔
    intervals = ['5m', '1h', '1d']
    print(f"\n可檢查的時間間隔: {', '.join(intervals)}")
    
    selected_intervals = input("請輸入要檢查的間隔（逗號分隔，直接按 Enter 檢查全部）: ").strip()
    
    if selected_intervals:
        intervals = [i.strip() for i in selected_intervals.split(',') if i.strip() in intervals]
    
    if not intervals:
        print("❌ 沒有有效的時間間隔")
        return
    
    print(f"將檢查時間間隔: {', '.join(intervals)}")
    
    # 詢問最大修復天數
    max_days_input = input("\n單次修復的最大天數（預設 30 天）: ").strip()
    max_days = 30
    try:
        if max_days_input:
            max_days = int(max_days_input)
    except ValueError:
        print("⚠️ 無效輸入，使用預設值 30 天")
    
    # 開始檢查和修復
    all_results = []
    total_symbols = len(symbols)
    total_intervals = len(intervals)
    
    for symbol_idx, symbol in enumerate(symbols):
        print(f"\n{'='*60}")
        print(f"處理交易對 {symbol} ({symbol_idx + 1}/{total_symbols})")
        print(f"{'='*60}")
        
        for interval_idx, interval in enumerate(intervals):
            try:
                result = check_and_fix_symbol_data(symbol, interval, max_days)
                all_results.append(result)
            except Exception as e:
                print(f"    ❌ 處理 {symbol} {interval} 時發生錯誤: {e}")
                all_results.append({
                    'symbol': symbol, 
                    'interval': interval, 
                    'missing_count': 0, 
                    'fixed_count': 0,
                    'error': str(e)
                })
    
    # 輸出總結報告
    print(f"\n{'='*80}")
    print("📊 修復總結報告")
    print(f"{'='*80}")
    
    total_missing = sum(r['missing_count'] for r in all_results)
    total_fixed = sum(r['fixed_count'] for r in all_results)
    
    print(f"總計檢查: {len(all_results)} 個任務")
    print(f"總缺失資料: {total_missing} 筆")
    print(f"總修復資料: {total_fixed} 筆")
    
    # 顯示詳細結果
    print(f"\n詳細結果:")
    print(f"{'交易對':<10} {'間隔':<5} {'缺失':<8} {'修復':<8} {'狀態'}")
    print("-" * 50)
    
    for result in all_results:
        status = "成功" if 'error' not in result else "錯誤"
        if result['missing_count'] == 0:
            status = "完整"
        
        print(f"{result['symbol']:<10} {result['interval']:<5} {result['missing_count']:<8} {result['fixed_count']:<8} {status}")
    
    print(f"\n✅ 修復完成！")

if __name__ == "__main__":
    main()
