#!/usr/bin/env python3
"""
測試最終修復後的更新邏輯
"""
import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import (SessionLocal, Kline5m, get_interval_milliseconds,
                 fetch_from_binance, save_to_database, update_latest_data)

def test_fixed_logic():
    """測試修復後的邏輯"""
    print("=== 測試修復後的時區邏輯 ===")

    session = SessionLocal()
    symbol = "BTCUSDT"
    interval = "5m"

    # 獲取資料庫中的最新記錄
    latest_record = session.query(Kline5m).filter_by(symbol=symbol).order_by(Kline5m.open_time.desc()).first()

    if latest_record:
        print(f"資料庫最新記錄: {latest_record.open_time}")

        # 使用修復後的邏輯計算時間
        interval_ms = get_interval_milliseconds(interval)
        if latest_record.open_time.tzinfo is None:
            # 資料庫時間是 naive datetime，但實際是 UTC
            utc_timestamp = latest_record.open_time.replace(tzinfo=timezone.utc).timestamp()
        else:
            utc_timestamp = latest_record.open_time.timestamp()

        next_open_time = utc_timestamp * 1000 + interval_ms
        start_time = int(next_open_time)
        end_time = int(datetime.utcnow().timestamp() * 1000)

        start_dt = datetime.utcfromtimestamp(start_time / 1000)
        end_dt = datetime.utcfromtimestamp(end_time / 1000)

        print(f"修復後計算的開始時間: {start_dt}")
        print(f"結束時間: {end_dt}")
        print(f"時間範圍: {(end_time - start_time) / 1000 / 60:.1f} 分鐘")

        if start_time < end_time:
            print("\n正在從 Binance 獲取資料...")
            try:
                new_data = fetch_from_binance(symbol, interval, start_time, end_time)
                print(f"獲取到 {len(new_data)} 筆資料")

                if new_data:
                    print("最新幾筆資料:")
                    for i, item in enumerate(new_data[-3:]):
                        open_time = datetime.utcfromtimestamp(item[0] / 1000)
                        close_price = item[4]
                        print(f"  {len(new_data)-2+i}. {open_time} - {close_price}")

                    # 保存到資料庫
                    print("\n保存到資料庫...")
                    save_to_database(symbol, interval, new_data)

                    # 再次檢查資料庫最新記錄
                    session.close()
                    session = SessionLocal()
                    latest_after = session.query(Kline5m).filter_by(symbol=symbol).order_by(Kline5m.open_time.desc()).first()
                    print(f"保存後最新記錄: {latest_after.open_time} - {latest_after.close_price}")
                else:
                    print("沒有獲取到新資料")

            except Exception as e:
                print(f"獲取資料失敗: {e}")
        else:
            print("時間範圍無效，無需更新")

    session.close()

def test_full_update():
    """測試完整的背景更新"""
    print("\n=== 測試完整的背景更新 ===")
    try:
        update_latest_data()
        print("✅ 背景更新執行完成")

        # 檢查更新後的結果
        session = SessionLocal()
        latest_btc = session.query(Kline5m).filter_by(symbol="BTCUSDT").order_by(Kline5m.open_time.desc()).first()
        if latest_btc:
            print(f"更新後 BTCUSDT 最新記錄: {latest_btc.open_time} - {latest_btc.close_price}")

            # 檢查是否是最近的時間
            time_diff = datetime.utcnow() - latest_btc.open_time
            print(f"與當前時間差: {time_diff.total_seconds() / 60:.1f} 分鐘")

        session.close()
    except Exception as e:
        print(f"❌ 背景更新失敗: {e}")

if __name__ == "__main__":
    test_fixed_logic()
    test_full_update()