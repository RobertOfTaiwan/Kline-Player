#!/usr/bin/env python3
"""
檢查 symbols 表結構和內容
"""

import psycopg2

DB_CONFIG = {
    'host': '61.218.12.227',
    'port': '5432',
    'database': 'trade',
    'user': 'sa',
    'password': 'S0920D1124d0911'
}

def check_symbols_table():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    print('=== symbols 表結構 ===')
    cursor.execute("""
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'symbols' 
        ORDER BY ordinal_position
    """)
    for row in cursor.fetchall():
        print(f'{row[0]}: {row[1]} ({"可空" if row[2] == "YES" else "非空"})')

    print('\n=== symbols 表資料範例 ===')
    cursor.execute('SELECT * FROM symbols LIMIT 10')
    columns = [desc[0] for desc in cursor.description]
    print('|'.join(f'{col:15}' for col in columns))
    print('-' * (15 * len(columns)))
    for row in cursor.fetchall():
        print('|'.join(f'{str(col):15}' for col in row))

    print('\n=== 活躍交易對統計 ===')
    cursor.execute('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM symbols')
    total, active = cursor.fetchone()
    print(f'總交易對: {total}, 活躍交易對: {active}')

    print('\n=== 主要交易對列表（活躍的） ===')
    cursor.execute('SELECT symbol FROM symbols WHERE is_active = true ORDER BY symbol LIMIT 20')
    active_symbols = [row[0] for row in cursor.fetchall()]
    print(f'前20個活躍交易對: {", ".join(active_symbols)}')

    cursor.close()
    conn.close()

if __name__ == "__main__":
    check_symbols_table()
