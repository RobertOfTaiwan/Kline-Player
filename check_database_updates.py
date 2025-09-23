#!/usr/bin/env python3
"""
檢查資料庫中最新的更新狀態
"""
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import pandas as pd

# 載入環境變數
from dotenv import load_dotenv
load_dotenv()

# 資料庫設定
DB_HOST = os.getenv('DB_HOST', '61.218.12.227')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'trade')
DB_USER = os.getenv('postgreSQL_user')
DB_PASS = os.getenv('postgreSQL_pass')

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def check_latest_data():
    try:
        engine = create_engine(DATABASE_URL)

        print("=== 檢查資料庫最新更新狀態 ===")
        print(f"檢查時間: {datetime.now()}")
        print()

        # 檢查各個交易對的最新資料
        symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'NEARUSDT']
        intervals = ['5m', '1h', '1d']

        for symbol in symbols:
            print(f"--- {symbol} ---")
            for interval in intervals:
                table_name = f"kline{interval}"

                query = text(f"""
                    SELECT open_time, close_price
                    FROM {table_name}
                    WHERE symbol = :symbol
                    ORDER BY open_time DESC
                    LIMIT 1
                """)

                with engine.connect() as conn:
                    result = conn.execute(query, {"symbol": symbol}).fetchone()

                    if result:
                        open_time, close_price = result
                        time_diff = datetime.utcnow() - open_time
                        print(f"  {interval}: {open_time} ({time_diff.total_seconds()/60:.1f}分鐘前) - 價格: {close_price}")
                    else:
                        print(f"  {interval}: 無資料")
            print()

        # 檢查最近1小時內的更新數量
        print("=== 最近1小時內的更新數量 ===")
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)

        for symbol in symbols:
            print(f"--- {symbol} ---")
            for interval in intervals:
                table_name = f"kline{interval}"

                query = text(f"""
                    SELECT COUNT(*)
                    FROM {table_name}
                    WHERE symbol = :symbol
                    AND open_time >= :time_threshold
                """)

                with engine.connect() as conn:
                    count = conn.execute(query, {
                        "symbol": symbol,
                        "time_threshold": one_hour_ago
                    }).scalar()

                    print(f"  {interval}: {count} 筆新資料")
            print()

    except Exception as e:
        print(f"檢查資料庫失敗: {e}")

if __name__ == "__main__":
    check_latest_data()