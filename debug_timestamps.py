#!/usr/bin/env python3
"""
調試時間戳轉換問題
"""
import os
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()

def debug_timestamps():
    print("=== 時間戳調試 ===")

    # 當前時間
    now = datetime.now()
    now_utc = datetime.utcnow()
    now_timestamp = int(now_utc.timestamp() * 1000)

    print(f"本地時間: {now}")
    print(f"UTC時間: {now_utc}")
    print(f"UTC時間戳(毫秒): {now_timestamp}")
    print()

    # 測試 Binance API 回應
    print("=== Binance API 測試 ===")
    try:
        url = "https://api.binance.com/api/v3/klines"
        params = {
            'symbol': 'BTCUSDT',
            'interval': '5m',
            'limit': 2
        }

        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if isinstance(data, list) and len(data) > 0:
            latest_kline = data[-1]
            binance_timestamp = latest_kline[0]
            binance_close_time = latest_kline[6]

            # 轉換為 datetime
            binance_dt = datetime.utcfromtimestamp(binance_timestamp / 1000)
            close_dt = datetime.utcfromtimestamp(binance_close_time / 1000)

            print(f"Binance 最新K線開盤時間戳: {binance_timestamp}")
            print(f"轉換為 UTC 時間: {binance_dt}")
            print(f"收盤時間戳: {binance_close_time}")
            print(f"轉換為 UTC 時間: {close_dt}")
            print(f"價格: {latest_kline[4]}")

            # 檢查時間差
            time_diff = now_utc - binance_dt
            print(f"與當前時間差: {time_diff.total_seconds() / 60:.1f} 分鐘")

        else:
            print(f"API 錯誤回應: {data}")

    except Exception as e:
        print(f"API 請求失敗: {e}")

    print()

    # 測試時間戳範圍
    print("=== 時間戳範圍測試 ===")

    # 過去1小時的時間戳
    one_hour_ago = datetime.utcnow().timestamp() - 3600
    one_hour_ago_ms = int(one_hour_ago * 1000)

    print(f"1小時前的時間戳: {one_hour_ago_ms}")
    print(f"轉換回 datetime: {datetime.utcfromtimestamp(one_hour_ago)}")

    # 檢查我們的 update_latest_data 函數中使用的邏輯
    print()
    print("=== 模擬背景更新邏輯 ===")

    # 模擬從資料庫獲取最新時間
    # 這裡我們假設最新時間是資料庫中顯示的時間
    latest_db_time = datetime(2025, 9, 21, 5, 40, 0)  # 從資料庫結果看到的時間
    start_time = int((latest_db_time.timestamp() + 300) * 1000)  # 加5分鐘
    end_time = int(datetime.utcnow().timestamp() * 1000)

    print(f"資料庫最新時間: {latest_db_time}")
    print(f"計算的開始時間戳: {start_time}")
    print(f"對應的 datetime: {datetime.utcfromtimestamp(start_time / 1000)}")
    print(f"結束時間戳: {end_time}")
    print(f"對應的 datetime: {datetime.utcfromtimestamp(end_time / 1000)}")

    # 如果 start_time >= end_time，說明沒有新資料需要獲取
    if start_time >= end_time:
        print("⚠️ 開始時間 >= 結束時間，不會獲取新資料！")
    else:
        print("✅ 時間範圍正常，應該會獲取新資料")

if __name__ == "__main__":
    debug_timestamps()