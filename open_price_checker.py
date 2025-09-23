#!/usr/bin/env python3
"""
K線開盤價連續性檢查與修復工具
專門檢查和修復相鄰K線的開盤價連續性問題
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2
import argparse
from typing import List, Tuple, Dict, Optional

# 載入環境變數
load_dotenv()

# 資料庫設定
DB_CONFIG = {
    'host': '61.218.12.227',
    'port': '5432',
    'database': 'trade',
    'user': 'sa',
    'password': 'S0920D1124d0911'
}

# 時間間隔配置
TABLES = ['kline5m', 'kline1h', 'kline1d']

class OpenPriceContinuityChecker:
    def __init__(self):
        self.conn = None
        
    def get_connection(self):
        """獲取資料庫連接"""
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(**DB_CONFIG)
        return self.conn
    
    def close_connection(self):
        """關閉資料庫連接"""
        if self.conn and not self.conn.closed:
            self.conn.close()
    
    def get_symbols(self, active_only: bool = True) -> List[str]:
        """獲取交易對列表"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if active_only:
            cursor.execute("SELECT symbol FROM symbols WHERE is_active = true ORDER BY symbol")
        else:
            cursor.execute("SELECT symbol FROM symbols ORDER BY symbol")
        
        symbols = [row[0] for row in cursor.fetchall()]
        cursor.close()
        return symbols
    
    def check_open_price_continuity(self, symbol: str, table: str) -> Dict:
        """檢查開盤價連續性"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(f"""
            WITH price_check AS (
                SELECT 
                    open_time, 
                    open_price, 
                    close_price,
                    LAG(close_price) OVER (ORDER BY open_time) as prev_close,
                    LAG(open_time) OVER (ORDER BY open_time) as prev_time
                FROM {table}
                WHERE symbol = %s
                ORDER BY open_time
            )
            SELECT 
                open_time,
                prev_time,
                open_price,
                prev_close,
                ABS(open_price - COALESCE(prev_close, open_price)) as price_diff,
                CASE 
                    WHEN prev_close IS NOT NULL AND prev_close != 0 
                    THEN ABS(open_price - prev_close) / prev_close * 100
                    ELSE 0 
                END as error_pct
            FROM price_check
            WHERE prev_close IS NOT NULL
            ORDER BY open_time
        """, (symbol,))
        
        results = cursor.fetchall()
        cursor.close()
        
        errors = []
        total_checks = len(results)
        
        for open_time, prev_time, open_price, prev_close, price_diff, error_pct in results:
            if float(error_pct) > 0.01:  # 0.01% 容錯範圍
                errors.append({
                    'timestamp': open_time,
                    'prev_timestamp': prev_time,
                    'open_price': float(open_price),
                    'expected_open': float(prev_close),
                    'difference': float(price_diff),
                    'error_pct': float(error_pct)
                })
        
        return {
            'total_checks': total_checks,
            'errors': errors,
            'error_count': len(errors),
            'accuracy_pct': ((total_checks - len(errors)) / total_checks * 100) if total_checks > 0 else 100
        }
    
    def fix_open_price_continuity(self, symbol: str, table: str, dry_run: bool = False) -> int:
        """修復開盤價連續性問題"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 獲取需要修復的記錄
        cursor.execute(f"""
            WITH price_check AS (
                SELECT 
                    open_time, 
                    open_price,
                    LAG(close_price) OVER (ORDER BY open_time) as prev_close
                FROM {table}
                WHERE symbol = %s
                ORDER BY open_time
            )
            SELECT open_time, open_price, prev_close
            FROM price_check
            WHERE prev_close IS NOT NULL 
              AND ABS(open_price - prev_close) / prev_close > 0.0001
            ORDER BY open_time
        """, (symbol,))
        
        problematic_records = cursor.fetchall()
        
        if not problematic_records:
            cursor.close()
            return 0
        
        fixed_count = 0
        
        for open_time, current_open, correct_open in problematic_records:
            if dry_run:
                print(f"        [模擬] {open_time}: {current_open:.6f} -> {correct_open:.6f}")
                fixed_count += 1
            else:
                try:
                    cursor.execute(f"""
                        UPDATE {table}
                        SET open_price = %s
                        WHERE symbol = %s AND open_time = %s
                    """, (float(correct_open), symbol, open_time))
                    
                    if cursor.rowcount > 0:
                        fixed_count += 1
                
                except Exception as e:
                    print(f"        ❌ 修復失敗 {open_time}: {e}")
        
        if not dry_run and fixed_count > 0:
            conn.commit()
            print(f"        ✅ 成功修復 {fixed_count} 筆記錄")
        
        cursor.close()
        return fixed_count
    
    def get_detailed_errors(self, symbol: str, table: str, limit: int = 10) -> List[Dict]:
        """獲取詳細的錯誤資訊"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(f"""
            WITH price_check AS (
                SELECT 
                    open_time, 
                    open_price, 
                    close_price,
                    LAG(close_price) OVER (ORDER BY open_time) as prev_close,
                    LAG(open_time) OVER (ORDER BY open_time) as prev_time
                FROM {table}
                WHERE symbol = %s
                ORDER BY open_time
            )
            SELECT 
                prev_time,
                open_time,
                prev_close,
                open_price,
                ABS(open_price - prev_close) as price_diff,
                ABS(open_price - prev_close) / prev_close * 100 as error_pct
            FROM price_check
            WHERE prev_close IS NOT NULL 
              AND ABS(open_price - prev_close) / prev_close > 0.0001
            ORDER BY error_pct DESC
            LIMIT %s
        """, (symbol, limit))
        
        results = cursor.fetchall()
        cursor.close()
        
        return [{
            'prev_time': row[0],
            'current_time': row[1],
            'expected_open': float(row[2]),
            'actual_open': float(row[3]),
            'difference': float(row[4]),
            'error_pct': float(row[5])
        } for row in results]

def run_check_mode(checker: OpenPriceContinuityChecker, symbols: List[str], tables: List[str]):
    """運行檢查模式"""
    print("\n🔍 開盤價連續性檢查模式")
    print("="*80)
    
    total_errors = 0
    total_checks = 0
    
    for symbol in symbols:
        print(f"\n📊 檢查交易對: {symbol}")
        print("-" * 60)
        
        symbol_has_errors = False
        
        for table in tables:
            result = checker.check_open_price_continuity(symbol, table)
            
            total_checks += result['total_checks']
            total_errors += result['error_count']
            
            if result['error_count'] > 0:
                symbol_has_errors = True
                print(f"  ❌ {table}: {result['error_count']}/{result['total_checks']} 錯誤 (準確率: {result['accuracy_pct']:.2f}%)")
                
                # 顯示前5個最嚴重的錯誤
                detailed_errors = checker.get_detailed_errors(symbol, table, 5)
                for i, error in enumerate(detailed_errors[:5]):
                    print(f"      {i+1}. {error['current_time']}: {error['actual_open']:.6f} ≠ {error['expected_open']:.6f} (差異: {error['error_pct']:.4f}%)")
            else:
                print(f"  ✅ {table}: 完全準確 ({result['total_checks']} 筆檢查)")
        
        if not symbol_has_errors:
            print(f"  🎉 {symbol} 所有資料表開盤價連續性正常")
    
    print(f"\n📈 總體統計:")
    print(f"  總檢查數: {total_checks}")
    print(f"  總錯誤數: {total_errors}")
    print(f"  整體準確率: {((total_checks - total_errors) / total_checks * 100):.2f}%" if total_checks > 0 else "100.00%")

def run_fix_mode(checker: OpenPriceContinuityChecker, symbols: List[str], tables: List[str], dry_run: bool = False):
    """運行修復模式"""
    mode_text = "模擬修復" if dry_run else "實際修復"
    print(f"\n🔧 開盤價連續性{mode_text}模式")
    print("="*80)
    
    total_fixed = 0
    
    for symbol in symbols:
        print(f"\n🔧 修復交易對: {symbol}")
        print("-" * 60)
        
        symbol_fixed = 0
        
        for table in tables:
            # 先檢查問題數量
            check_result = checker.check_open_price_continuity(symbol, table)
            
            if check_result['error_count'] == 0:
                print(f"  ✅ {table}: 無需修復")
                continue
            
            print(f"  🔧 {table}: 發現 {check_result['error_count']} 個問題，開始修復...")
            
            # 執行修復
            fixed_count = checker.fix_open_price_continuity(symbol, table, dry_run)
            symbol_fixed += fixed_count
            
            if dry_run:
                print(f"      [模擬] 可修復 {fixed_count} 筆記錄")
            else:
                print(f"      ✅ 實際修復 {fixed_count} 筆記錄")
        
        total_fixed += symbol_fixed
        
        if symbol_fixed > 0:
            print(f"  📊 {symbol} 修復完成，共處理 {symbol_fixed} 筆記錄")
        else:
            print(f"  🎉 {symbol} 無需修復")
    
    print(f"\n✅ 修復完成！總共處理 {total_fixed} 筆記錄")

def main():
    """主函數"""
    parser = argparse.ArgumentParser(description='K線開盤價連續性檢查與修復工具')
    parser.add_argument('--mode', choices=['check', 'fix', 'dry-run'], 
                       default='check', help='運行模式')
    parser.add_argument('--symbols', help='指定交易對（逗號分隔）')
    parser.add_argument('--tables', help='指定資料表（逗號分隔）', 
                       default='kline5m,kline1h,kline1d')
    parser.add_argument('--yes', action='store_true', help='自動確認所有操作，不提示')
    
    args = parser.parse_args()
    
    print("="*80)
    print("🔧 K線開盤價連續性檢查與修復工具")
    print("="*80)
    
    checker = OpenPriceContinuityChecker()
    
    try:
        # 獲取交易對
        if args.symbols:
            symbols = [s.strip() for s in args.symbols.split(',')]
        else:
            symbols = checker.get_symbols()
        
        # 獲取資料表
        tables = [t.strip() for t in args.tables.split(',')]
        tables = [t for t in tables if t in TABLES]
        
        if not symbols:
            print("❌ 沒有找到交易對")
            return
        
        if not tables:
            print("❌ 沒有有效的資料表")
            return
        
        print(f"📈 交易對: {', '.join(symbols[:5])}{'...' if len(symbols) > 5 else ''} (共 {len(symbols)} 個)")
        print(f"📊 資料表: {', '.join(tables)}")
        
        # 運行指定模式
        if args.mode == 'check':
            run_check_mode(checker, symbols, tables)
        elif args.mode == 'dry-run':
            run_fix_mode(checker, symbols, tables, dry_run=True)
        elif args.mode == 'fix':
            if args.yes:
                run_fix_mode(checker, symbols, tables, dry_run=False)
            else:
                print("\n⚠️  即將執行實際修復操作！")
                confirm = input("確認要繼續嗎？(y/N): ")
                if confirm.lower() == 'y':
                    run_fix_mode(checker, symbols, tables, dry_run=False)
                else:
                    print("操作已取消")
        
    finally:
        checker.close_connection()

if __name__ == "__main__":
    main()
