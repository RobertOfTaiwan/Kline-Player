#!/usr/bin/env python3
"""
分析資料缺失的具體原因
"""
import os
import sys
from datetime import datetime, timedelta, timezone
import pandas as pd
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import SessionLocal, Symbol, Kline5m

def analyze_24h_missing_data():
    """分析最近24小時的資料缺失"""
    print("=== 分析最近24小時資料缺失 ===")

    session = SessionLocal()
    symbols = session.query(Symbol).filter(Symbol.is_active == True).all()

    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(days=1)

    print(f"分析時間範圍: {yesterday} ~ {now}")
    print(f"期望的5分鐘資料數量: {24 * 60 // 5} = 288 筆")

    for symbol in symbols:
        print(f"\n--- {symbol.symbol} ---")

        # 獲取最近24小時的資料
        records = session.query(Kline5m).filter(
            Kline5m.symbol == symbol.symbol,
            Kline5m.open_time >= yesterday
        ).order_by(Kline5m.open_time).all()

        print(f"實際資料數量: {len(records)} 筆")

        if records:
            first_time = records[0].open_time
            last_time = records[-1].open_time
            print(f"資料時間範圍: {first_time} ~ {last_time}")

            # 確保時區一致性
            first_time_tz = first_time.replace(tzinfo=timezone.utc) if first_time.tzinfo is None else first_time
            last_time_tz = last_time.replace(tzinfo=timezone.utc) if last_time.tzinfo is None else last_time

            # 計算資料開始時間與24小時前的差距
            start_gap = first_time_tz - yesterday
            if start_gap.total_seconds() > 0:
                missing_start_periods = int(start_gap.total_seconds() / 300)  # 300秒 = 5分鐘
                print(f"開始時間缺口: {start_gap} ({missing_start_periods} 個5分鐘週期)")

            # 計算資料結束時間與當前時間的差距
            end_gap = now - last_time_tz
            if end_gap.total_seconds() > 300:  # 超過5分鐘才算缺失
                missing_end_periods = int(end_gap.total_seconds() / 300)
                print(f"結束時間缺口: {end_gap} ({missing_end_periods} 個5分鐘週期)")

            # 檢查中間是否有缺口
            gaps = []
            for i in range(1, len(records)):
                prev_time = records[i-1].open_time
                curr_time = records[i].open_time
                expected_next = prev_time + timedelta(minutes=5)

                if curr_time > expected_next:
                    gap_duration = curr_time - expected_next
                    missing_periods = int(gap_duration.total_seconds() / 300)
                    gaps.append({
                        'from': expected_next,
                        'to': curr_time,
                        'duration': gap_duration,
                        'missing_periods': missing_periods
                    })

            if gaps:
                print(f"中間缺口: {len(gaps)} 個")
                for gap in gaps:
                    print(f"  {gap['from']} ~ {gap['to']} (缺失 {gap['missing_periods']} 個週期)")
            else:
                print("✅ 中間資料連續")

        else:
            print("❌ 完全沒有資料")

    session.close()

def analyze_historical_gaps():
    """分析歷史資料的主要缺口"""
    print("\n=== 分析歷史資料主要缺口 ===")

    session = SessionLocal()
    symbols = session.query(Symbol).filter(Symbol.is_active == True).all()

    for symbol in symbols:
        print(f"\n--- {symbol.symbol} 歷史缺口分析 ---")

        # 獲取該交易對的所有5分鐘資料
        all_records = session.query(Kline5m).filter_by(symbol=symbol.symbol).order_by(Kline5m.open_time).all()

        if len(all_records) < 2:
            print("資料不足")
            continue

        first_time = all_records[0].open_time
        last_time = all_records[-1].open_time
        total_span = last_time - first_time
        expected_total = int(total_span.total_seconds() / 300) + 1  # +1 包含最後一個點

        print(f"時間跨度: {first_time} ~ {last_time}")
        print(f"總時間長度: {total_span.days} 天 {total_span.seconds // 3600} 小時")
        print(f"期望資料量: {expected_total:,} 筆")
        print(f"實際資料量: {len(all_records):,} 筆")
        print(f"完整度: {len(all_records)/expected_total*100:.1f}%")

        # 找出最大的缺口
        max_gaps = []
        for i in range(1, len(all_records)):
            prev_time = all_records[i-1].open_time
            curr_time = all_records[i].open_time
            gap_duration = curr_time - prev_time

            if gap_duration > timedelta(minutes=5):
                missing_periods = int(gap_duration.total_seconds() / 300) - 1
                max_gaps.append({
                    'from': prev_time,
                    'to': curr_time,
                    'duration': gap_duration,
                    'missing_periods': missing_periods
                })

        # 按缺失週期數排序，顯示最大的5個缺口
        max_gaps.sort(key=lambda x: x['missing_periods'], reverse=True)
        if max_gaps:
            print(f"主要缺口 (前5個):")
            for i, gap in enumerate(max_gaps[:5]):
                print(f"  {i+1}. {gap['from']} ~ {gap['to']}")
                print(f"     持續時間: {gap['duration']}, 缺失: {gap['missing_periods']} 個週期")
        else:
            print("✅ 無明顯缺口")

    session.close()

def check_data_freshness():
    """檢查資料新鮮度"""
    print("\n=== 檢查資料新鮮度 ===")

    session = SessionLocal()
    symbols = session.query(Symbol).filter(Symbol.is_active == True).all()

    now = datetime.now(timezone.utc)

    for symbol in symbols:
        # 獲取最新的資料
        latest_5m = session.query(Kline5m).filter_by(symbol=symbol.symbol).order_by(Kline5m.open_time.desc()).first()

        if latest_5m:
            latest_time_tz = latest_5m.open_time.replace(tzinfo=timezone.utc) if latest_5m.open_time.tzinfo is None else latest_5m.open_time
            time_since_last = now - latest_time_tz
            minutes_old = time_since_last.total_seconds() / 60

            print(f"{symbol.symbol:8}: 最新 5m 資料 {latest_5m.open_time} ({minutes_old:.1f} 分鐘前)")

            if minutes_old <= 10:
                status = "✅ 非常新鮮"
            elif minutes_old <= 30:
                status = "⚠️  稍微過時"
            elif minutes_old <= 60:
                status = "⚠️  需要更新"
            else:
                status = "❌ 嚴重過時"

            print(f"         狀態: {status}")
        else:
            print(f"{symbol.symbol:8}: ❌ 無資料")

    session.close()

def main():
    """主函數"""
    print(f"開始分析資料缺失情況... {datetime.now()}")

    analyze_24h_missing_data()
    analyze_historical_gaps()
    check_data_freshness()

    print("\n" + "="*60)
    print("資料缺失分析完成")

if __name__ == "__main__":
    main()