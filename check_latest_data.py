#!/usr/bin/env python3
import psycopg2
from datetime import datetime

DB_CONFIG = {
    'host': '61.218.12.227',
    'port': '5432',
    'database': 'trade',
    'user': 'sa',
    'password': 'S0920D1124d0911'
}

conn = psycopg2.connect(**DB_CONFIG)
cursor = conn.cursor()

print(f"檢查時間: {datetime.now()}")

for table in ['kline5m', 'kline1h', 'kline1d']:
    cursor.execute(f'SELECT symbol, MAX(open_time), COUNT(*) FROM {table} GROUP BY symbol ORDER BY symbol')
    print(f'\n=== {table} 最新資料 ===')
    for row in cursor.fetchall():
        symbol, latest_time, count = row
        now = datetime.now()
        time_diff = now - latest_time if latest_time else None
        print(f'{symbol}: {latest_time} (共 {count} 筆) - 延遲: {time_diff}')

cursor.close()
conn.close()
