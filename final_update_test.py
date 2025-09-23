#!/usr/bin/env python3
"""
最終更新測試 - 檢查當前時間範圍的資料獲取
"""
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import (SessionLocal, Kline5m, get_interval_milliseconds,
                 fetch_from_binance, save_to_database)

def test_current_time_range():
    """測試當前時間範圍的資料獲取"""
    print("=== 測試當前時間範圍的資料獲取 ===")

    session = SessionLocal()
    symbol = "BTCUSDT"
    interval = "5m"

    # 獲取資料庫中的最新記錄
    latest_record = session.query(Kline5m).filter_by(symbol=symbol).order_by(Kline5m.open_time.desc()).first()

    if latest_record:
        print(f"資料庫最新記錄: {latest_record.open_time}")

        # 計算下一個時間間隔的開始時間
        interval_ms = get_interval_milliseconds(interval)
        next_open_time = latest_record.open_time.timestamp() * 1000 + interval_ms
        start_time = int(next_open_time)
        end_time = int(datetime.utcnow().timestamp() * 1000)

        start_dt = datetime.utcfromtimestamp(start_time / 1000)
        end_dt = datetime.utcfromtimestamp(end_time / 1000)

        print(f"計算的開始時間: {start_dt}")
        print(f"結束時間: {end_dt}")
        print(f"時間範圍: {(end_time - start_time) / 1000 / 60:.1f} 分鐘")

        if start_time < end_time:
            print("\n正在從 Binance 獲取資料...")
            try:
                new_data = fetch_from_binance(symbol, interval, start_time, end_time)
                print(f"獲取到 {len(new_data)} 筆資料")

                if new_data:
                    print("前3筆資料:")
                    for i, item in enumerate(new_data[:3]):
                        open_time = datetime.utcfromtimestamp(item[0] / 1000)
                        close_price = item[4]
                        print(f"  {i+1}. {open_time} - {close_price}")

                    print("後3筆資料:")
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

if __name__ == "__main__":
    test_current_time_range()