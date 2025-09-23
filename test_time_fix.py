#!/usr/bin/env python3
"""
測試時間修復是否正確
"""
import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import SessionLocal, Kline1h, get_from_database

def test_time_conversion():
    """測試時間轉換是否正確"""
    print("=== 測試後台時間轉換修復 ===")

    session = SessionLocal()

    # 獲取資料庫中最新的一筆 1h 資料
    latest_record = session.query(Kline1h).filter_by(symbol="BTCUSDT").order_by(Kline1h.open_time.desc()).first()

    if latest_record:
        print(f"資料庫中的原始時間: {latest_record.open_time}")
        print(f"資料庫時間類型: {type(latest_record.open_time)}")
        print(f"是否有時區資訊: {latest_record.open_time.tzinfo}")

        # 測試舊的轉換方式（有問題的）
        old_timestamp = int(latest_record.open_time.timestamp() * 1000)
        old_datetime = datetime.utcfromtimestamp(old_timestamp / 1000)

        # 測試新的轉換方式（修復後的）
        open_time_utc = latest_record.open_time.replace(tzinfo=timezone.utc) if latest_record.open_time.tzinfo is None else latest_record.open_time
        new_timestamp = int(open_time_utc.timestamp() * 1000)
        new_datetime = datetime.utcfromtimestamp(new_timestamp / 1000)

        print(f"\n舊方式轉換:")
        print(f"  時間戳: {old_timestamp}")
        print(f"  轉回日期: {old_datetime}")

        print(f"\n新方式轉換:")
        print(f"  時間戳: {new_timestamp}")
        print(f"  轉回日期: {new_datetime}")

        # 計算差異
        time_diff = (new_timestamp - old_timestamp) / 1000 / 3600
        print(f"\n時間差異: {time_diff} 小時")

        if abs(time_diff - 8) < 0.1:
            print("✅ 修復正確：新方式比舊方式多了約8小時（修正了時區問題）")
        else:
            print(f"⚠️ 時間差異異常: {time_diff} 小時")

    session.close()

def test_api_response():
    """測試 API 響應是否正確"""
    print(f"\n=== 測試 API 響應 ===")

    # 測試最近1小時的資料
    now = datetime.now(timezone.utc)
    one_hour_ago = datetime(now.year, now.month, now.day, now.hour - 1, 0, 0, tzinfo=timezone.utc)

    start_time = int(one_hour_ago.timestamp() * 1000)
    end_time = int(now.timestamp() * 1000)

    print(f"請求時間範圍:")
    print(f"  開始: {one_hour_ago} ({start_time})")
    print(f"  結束: {now} ({end_time})")

    try:
        data = get_from_database("BTCUSDT", "1h", start_time, end_time)

        if data:
            print(f"\n獲取到 {len(data)} 筆資料:")
            for i, item in enumerate(data):
                timestamp = item[0]
                price = item[4]
                dt = datetime.utcfromtimestamp(timestamp / 1000)
                print(f"  {i+1}. {dt} - ${price}")
        else:
            print("沒有獲取到資料")

    except Exception as e:
        print(f"API 測試失敗: {e}")

if __name__ == "__main__":
    test_time_conversion()
    test_api_response()