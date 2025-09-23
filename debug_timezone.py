#!/usr/bin/env python3
"""
調試時區問題
"""
import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import SessionLocal, Kline5m, get_interval_milliseconds

def debug_timezone_issue():
    """調試時區問題"""
    print("=== 調試時區問題 ===")

    session = SessionLocal()
    symbol = "BTCUSDT"

    # 獲取資料庫中的最新記錄
    latest_record = session.query(Kline5m).filter_by(symbol=symbol).order_by(Kline5m.open_time.desc()).first()

    if latest_record:
        print(f"資料庫最新記錄: {latest_record.open_time}")
        print(f"記錄類型: {type(latest_record.open_time)}")

        # 檢查不同的時間戳轉換方式
        db_timestamp = latest_record.open_time.timestamp()
        print(f"timestamp(): {db_timestamp}")
        print(f"對應日期時間: {datetime.fromtimestamp(db_timestamp)}")
        print(f"對應UTC時間: {datetime.utcfromtimestamp(db_timestamp)}")

        # 當前時間的不同表示
        now_local = datetime.now()
        now_utc = datetime.utcnow()
        now_utc_timestamp = now_utc.timestamp()

        print(f"\n當前本地時間: {now_local}")
        print(f"當前UTC時間: {now_utc}")
        print(f"UTC時間戳: {now_utc_timestamp}")

        # 計算下一個間隔的不同方式
        interval_ms = get_interval_milliseconds("5m")
        print(f"\n5分鐘間隔毫秒數: {interval_ms}")

        # 方式1：直接使用 timestamp() (可能有問題)
        next_open_time_1 = latest_record.open_time.timestamp() * 1000 + interval_ms
        start_time_1 = int(next_open_time_1)
        start_dt_1 = datetime.utcfromtimestamp(start_time_1 / 1000)

        # 方式2：確保使用 UTC
        if latest_record.open_time.tzinfo is None:
            # 假設資料庫時間是 UTC
            utc_timestamp = latest_record.open_time.replace(tzinfo=timezone.utc).timestamp()
        else:
            utc_timestamp = latest_record.open_time.timestamp()

        next_open_time_2 = utc_timestamp * 1000 + interval_ms
        start_time_2 = int(next_open_time_2)
        start_dt_2 = datetime.utcfromtimestamp(start_time_2 / 1000)

        print(f"\n方式1 (直接timestamp):")
        print(f"  下一個開盤時間: {start_dt_1}")
        print(f"  時間戳: {start_time_1}")

        print(f"\n方式2 (確保UTC):")
        print(f"  下一個開盤時間: {start_dt_2}")
        print(f"  時間戳: {start_time_2}")

        # 檢查哪個是對的
        expected_next = latest_record.open_time.replace(minute=latest_record.open_time.minute + 5)
        print(f"\n期望的下一個開盤時間: {expected_next}")

    session.close()

if __name__ == "__main__":
    debug_timezone_issue()