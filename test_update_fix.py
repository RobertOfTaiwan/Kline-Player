#!/usr/bin/env python3
"""
測試修復後的背景更新邏輯
"""
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
load_dotenv()

# 添加當前目錄到 path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 導入應用模組
from app import update_latest_data, SessionLocal, Symbol, Kline5m, get_interval_milliseconds

def test_timestamp_calculation():
    """測試時間戳計算邏輯"""
    print("=== 測試修復後的時間戳計算邏輯 ===")

    session = SessionLocal()

    # 測試 BTCUSDT 5m 的邏輯
    symbol = "BTCUSDT"
    interval = "5m"

    latest_record = session.query(Kline5m).filter_by(symbol=symbol).order_by(Kline5m.open_time.desc()).first()

    if latest_record:
        print(f"資料庫中最新記錄: {latest_record.open_time}")

        # 原始邏輯（錯誤的）
        old_start_time = int(latest_record.close_time.timestamp() * 1000) + 1
        old_start_dt = datetime.utcfromtimestamp(old_start_time / 1000)

        # 新邏輯（修復後的）
        interval_ms = get_interval_milliseconds(interval)
        next_open_time = latest_record.open_time.timestamp() * 1000 + interval_ms
        new_start_time = int(next_open_time)
        new_start_dt = datetime.utcfromtimestamp(new_start_time / 1000)

        end_time = int(datetime.utcnow().timestamp() * 1000)
        end_dt = datetime.utcfromtimestamp(end_time / 1000)

        print(f"舊邏輯開始時間: {old_start_dt}")
        print(f"新邏輯開始時間: {new_start_dt}")
        print(f"結束時間: {end_dt}")
        print(f"舊邏輯是否需要更新: {old_start_time < end_time}")
        print(f"新邏輯是否需要更新: {new_start_time < end_time}")

        if new_start_time < end_time:
            time_diff = (end_time - new_start_time) / 1000 / 60
            print(f"需要更新的時間範圍: {time_diff:.1f} 分鐘")
        else:
            print("無需更新")

    session.close()

def manual_update_test():
    """手動測試一次更新"""
    print("\n=== 手動執行一次背景更新測試 ===")
    try:
        update_latest_data()
        print("✅ 背景更新執行完成")
    except Exception as e:
        print(f"❌ 背景更新失敗: {e}")

if __name__ == "__main__":
    test_timestamp_calculation()
    manual_update_test()