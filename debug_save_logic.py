#!/usr/bin/env python3
"""
調試保存邏輯問題
"""
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import SessionLocal, Kline5m
from sqlalchemy import text

def check_recent_saves():
    """檢查最近的保存操作"""
    print("=== 檢查最近的保存操作 ===")

    session = SessionLocal()

    # 獲取 BTCUSDT 5m 的最新10筆資料
    results = session.query(Kline5m).filter_by(symbol="BTCUSDT").order_by(Kline5m.open_time.desc()).limit(10).all()

    print("最新10筆 BTCUSDT 5m 資料:")
    for i, record in enumerate(results):
        print(f"{i+1:2d}. {record.open_time} - {record.close_price}")

    # 檢查今天的資料數量
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())

    count_query = session.query(Kline5m).filter(
        Kline5m.symbol == "BTCUSDT",
        Kline5m.open_time >= today_start
    ).count()

    print(f"\n今天 ({today}) 的 BTCUSDT 5m 資料數量: {count_query}")

    # 檢查最近1小時的資料
    one_hour_ago = datetime.utcnow().timestamp() - 3600
    one_hour_ago_dt = datetime.utcfromtimestamp(one_hour_ago)

    recent_count = session.query(Kline5m).filter(
        Kline5m.symbol == "BTCUSDT",
        Kline5m.open_time >= one_hour_ago_dt
    ).count()

    print(f"最近1小時 ({one_hour_ago_dt}) 的 BTCUSDT 5m 資料數量: {recent_count}")

    # 檢查具體的時間戳
    print(f"\n當前 UTC 時間: {datetime.utcnow()}")
    print(f"1小時前 UTC 時間: {one_hour_ago_dt}")

    # 直接查詢最新的時間戳
    latest_time_query = text("""
        SELECT open_time, close_time, close_price
        FROM kline5m
        WHERE symbol = 'BTCUSDT'
        ORDER BY open_time DESC
        LIMIT 1
    """)

    result = session.execute(latest_time_query).fetchone()
    if result:
        print(f"資料庫最新記錄: open_time={result[0]}, close_time={result[1]}, price={result[2]}")

    session.close()

def test_duplicate_check():
    """測試重複檢查邏輯"""
    print("\n=== 測試重複檢查邏輯 ===")

    # 模擬新的 K線資料（當前時間的5分鐘 K線）
    now = datetime.utcnow()
    # 計算5分鐘對齊的時間
    minutes = (now.minute // 5) * 5
    aligned_time = now.replace(minute=minutes, second=0, microsecond=0)

    print(f"當前對齊的5分鐘時間: {aligned_time}")

    session = SessionLocal()

    # 檢查這個時間是否已經存在
    existing = session.query(Kline5m).filter_by(
        symbol="BTCUSDT",
        open_time=aligned_time
    ).first()

    if existing:
        print(f"❌ 時間 {aligned_time} 已存在於資料庫")
        print(f"   existing record: {existing.open_time} - {existing.close_price}")
    else:
        print(f"✅ 時間 {aligned_time} 不存在於資料庫，可以插入")

    session.close()

if __name__ == "__main__":
    check_recent_saves()
    test_duplicate_check()