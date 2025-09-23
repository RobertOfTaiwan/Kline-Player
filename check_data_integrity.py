#!/usr/bin/env python3
"""
檢查資料庫歷史資料完整性
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import pandas as pd
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import SessionLocal, Symbol, Kline5m, Kline1h, Kline1d, get_interval_milliseconds
from sqlalchemy import text, func

def check_data_coverage():
    """檢查資料覆蓋範圍"""
    print("=== 資料覆蓋範圍檢查 ===")

    session = SessionLocal()

    # 獲取所有活躍的交易對
    symbols = session.query(Symbol).filter(Symbol.is_active == True).all()

    intervals = [
        ('5m', Kline5m, '5分鐘'),
        ('1h', Kline1h, '1小時'),
        ('1d', Kline1d, '1天')
    ]

    coverage_data = []

    for symbol in symbols:
        print(f"\n--- {symbol.symbol} ({symbol.base_asset}/{symbol.quote_asset}) ---")

        for interval_name, model, display_name in intervals:
            # 獲取第一筆和最後一筆資料
            first_record = session.query(model).filter_by(symbol=symbol.symbol).order_by(model.open_time.asc()).first()
            last_record = session.query(model).filter_by(symbol=symbol.symbol).order_by(model.open_time.desc()).first()

            # 獲取總數量
            total_count = session.query(model).filter_by(symbol=symbol.symbol).count()

            if first_record and last_record:
                time_span = last_record.open_time - first_record.open_time

                coverage_data.append({
                    'symbol': symbol.symbol,
                    'interval': interval_name,
                    'display_name': display_name,
                    'first_time': first_record.open_time,
                    'last_time': last_record.open_time,
                    'time_span_days': time_span.days,
                    'total_records': total_count,
                    'first_price': float(first_record.open_price),
                    'last_price': float(last_record.close_price)
                })

                print(f"  {display_name:6}: {first_record.open_time} ~ {last_record.open_time}")
                print(f"          時間跨度: {time_span.days} 天, 資料筆數: {total_count:,}")
                print(f"          價格範圍: {first_record.open_price} ~ {last_record.close_price}")
            else:
                print(f"  {display_name:6}: 無資料")
                coverage_data.append({
                    'symbol': symbol.symbol,
                    'interval': interval_name,
                    'display_name': display_name,
                    'first_time': None,
                    'last_time': None,
                    'time_span_days': 0,
                    'total_records': 0,
                    'first_price': None,
                    'last_price': None
                })

    session.close()
    return coverage_data

def check_data_continuity():
    """檢查資料連續性"""
    print("\n=== 資料連續性檢查 ===")

    session = SessionLocal()
    symbols = session.query(Symbol).filter(Symbol.is_active == True).all()

    continuity_issues = []

    for symbol in symbols:
        print(f"\n--- {symbol.symbol} 連續性檢查 ---")

        # 檢查 5分鐘資料的連續性
        print("檢查 5分鐘資料...")

        # 獲取最近7天的5分鐘資料
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

        records = session.query(Kline5m).filter(
            Kline5m.symbol == symbol.symbol,
            Kline5m.open_time >= seven_days_ago
        ).order_by(Kline5m.open_time).all()

        if len(records) < 2:
            print(f"  資料不足，只有 {len(records)} 筆記錄")
            continue

        gaps = []
        expected_interval = timedelta(minutes=5)

        for i in range(1, len(records)):
            prev_time = records[i-1].open_time
            curr_time = records[i].open_time
            actual_gap = curr_time - prev_time

            if actual_gap > expected_interval:
                gap_minutes = actual_gap.total_seconds() / 60
                gaps.append({
                    'from': prev_time,
                    'to': curr_time,
                    'gap_minutes': gap_minutes,
                    'missing_periods': int(gap_minutes / 5) - 1
                })

        if gaps:
            print(f"  發現 {len(gaps)} 個資料缺口:")
            for gap in gaps[:5]:  # 只顯示前5個
                print(f"    {gap['from']} ~ {gap['to']} (缺失 {gap['missing_periods']} 個5分鐘週期)")
            if len(gaps) > 5:
                print(f"    ... 還有 {len(gaps) - 5} 個缺口")
        else:
            print("  ✅ 5分鐘資料連續")

        continuity_issues.extend([{
            'symbol': symbol.symbol,
            'interval': '5m',
            **gap
        } for gap in gaps])

    session.close()
    return continuity_issues

def check_data_quality():
    """檢查資料品質"""
    print("\n=== 資料品質檢查 ===")

    session = SessionLocal()
    symbols = session.query(Symbol).filter(Symbol.is_active == True).all()

    quality_issues = []

    for symbol in symbols:
        print(f"\n--- {symbol.symbol} 品質檢查 ---")

        # 檢查 5分鐘資料的品質
        # 1. 檢查是否有價格為0或負數
        zero_price_query = session.query(Kline5m).filter(
            Kline5m.symbol == symbol.symbol,
            (Kline5m.open_price <= 0) |
            (Kline5m.high_price <= 0) |
            (Kline5m.low_price <= 0) |
            (Kline5m.close_price <= 0)
        ).count()

        if zero_price_query > 0:
            print(f"  ❌ 發現 {zero_price_query} 筆價格異常資料 (≤0)")
            quality_issues.append({
                'symbol': symbol.symbol,
                'issue': 'zero_or_negative_price',
                'count': zero_price_query
            })
        else:
            print("  ✅ 價格資料正常")

        # 2. 檢查 OHLC 邏輯是否正確 (High >= Low, Open/Close 在 High-Low 範圍內)
        ohlc_error_query = session.query(Kline5m).filter(
            Kline5m.symbol == symbol.symbol,
            (Kline5m.high_price < Kline5m.low_price) |
            (Kline5m.open_price > Kline5m.high_price) |
            (Kline5m.open_price < Kline5m.low_price) |
            (Kline5m.close_price > Kline5m.high_price) |
            (Kline5m.close_price < Kline5m.low_price)
        ).count()

        if ohlc_error_query > 0:
            print(f"  ❌ 發現 {ohlc_error_query} 筆 OHLC 邏輯錯誤")
            quality_issues.append({
                'symbol': symbol.symbol,
                'issue': 'ohlc_logic_error',
                'count': ohlc_error_query
            })
        else:
            print("  ✅ OHLC 邏輯正確")

        # 3. 檢查成交量是否有負數
        negative_volume_query = session.query(Kline5m).filter(
            Kline5m.symbol == symbol.symbol,
            Kline5m.volume < 0
        ).count()

        if negative_volume_query > 0:
            print(f"  ❌ 發現 {negative_volume_query} 筆負成交量")
            quality_issues.append({
                'symbol': symbol.symbol,
                'issue': 'negative_volume',
                'count': negative_volume_query
            })
        else:
            print("  ✅ 成交量資料正常")

        # 4. 檢查最近24小時的資料完整性
        now = datetime.now(timezone.utc)
        yesterday = now - timedelta(days=1)

        recent_count = session.query(Kline5m).filter(
            Kline5m.symbol == symbol.symbol,
            Kline5m.open_time >= yesterday
        ).count()

        expected_count = 24 * 60 // 5  # 24小時 * 60分鐘 / 5分鐘 = 288
        completion_rate = (recent_count / expected_count) * 100 if expected_count > 0 else 0

        print(f"  最近24小時完整性: {recent_count}/{expected_count} ({completion_rate:.1f}%)")

        if completion_rate < 95:
            quality_issues.append({
                'symbol': symbol.symbol,
                'issue': 'recent_data_incomplete',
                'completion_rate': completion_rate,
                'actual_count': recent_count,
                'expected_count': expected_count
            })

    session.close()
    return quality_issues

def generate_summary_report(coverage_data, continuity_issues, quality_issues):
    """生成總結報告"""
    print("\n" + "="*60)
    print("資料完整性檢查總結報告")
    print("="*60)

    # 資料覆蓋範圍總結
    print("\n📊 資料覆蓋範圍總結:")
    df_coverage = pd.DataFrame(coverage_data)

    if not df_coverage.empty:
        for interval in ['5m', '1h', '1d']:
            interval_data = df_coverage[df_coverage['interval'] == interval]
            if not interval_data.empty:
                total_records = interval_data['total_records'].sum()
                symbols_with_data = len(interval_data[interval_data['total_records'] > 0])
                print(f"  {interval:3}: {symbols_with_data} 個交易對, 總計 {total_records:,} 筆資料")

    # 連續性問題總結
    print(f"\n⚠️  資料連續性問題: {len(continuity_issues)} 個缺口")
    if continuity_issues:
        gap_by_symbol = defaultdict(int)
        for issue in continuity_issues:
            gap_by_symbol[issue['symbol']] += issue['missing_periods']

        print("  各交易對缺失週期數:")
        for symbol, missing_periods in sorted(gap_by_symbol.items()):
            print(f"    {symbol}: {missing_periods} 個5分鐘週期")

    # 品質問題總結
    print(f"\n🔍 資料品質問題: {len(quality_issues)} 個問題")
    if quality_issues:
        issue_types = defaultdict(int)
        for issue in quality_issues:
            issue_types[issue['issue']] += 1

        print("  問題類型分布:")
        issue_names = {
            'zero_or_negative_price': '價格異常 (≤0)',
            'ohlc_logic_error': 'OHLC邏輯錯誤',
            'negative_volume': '負成交量',
            'recent_data_incomplete': '最近資料不完整'
        }

        for issue_type, count in issue_types.items():
            print(f"    {issue_names.get(issue_type, issue_type)}: {count} 個交易對")

    # 整體評估
    print(f"\n📈 整體評估:")
    total_symbols = len(set(item['symbol'] for item in coverage_data if item['total_records'] > 0))
    symbols_with_gaps = len(set(issue['symbol'] for issue in continuity_issues))
    symbols_with_quality_issues = len(set(issue['symbol'] for issue in quality_issues))

    print(f"  總交易對數: {total_symbols}")
    print(f"  有資料缺口的交易對: {symbols_with_gaps}")
    print(f"  有品質問題的交易對: {symbols_with_quality_issues}")

    if symbols_with_gaps == 0 and symbols_with_quality_issues == 0:
        print("  ✅ 資料完整性良好")
    elif symbols_with_gaps < total_symbols * 0.2 and symbols_with_quality_issues < total_symbols * 0.1:
        print("  ⚠️  資料品質可接受，建議關注缺口問題")
    else:
        print("  ❌ 資料品質需要改善")

def main():
    """主函數"""
    print("開始檢查資料庫歷史資料完整性...")
    print(f"檢查時間: {datetime.now()}")

    try:
        # 1. 檢查資料覆蓋範圍
        coverage_data = check_data_coverage()

        # 2. 檢查資料連續性
        continuity_issues = check_data_continuity()

        # 3. 檢查資料品質
        quality_issues = check_data_quality()

        # 4. 生成總結報告
        generate_summary_report(coverage_data, continuity_issues, quality_issues)

    except Exception as e:
        print(f"檢查過程中發生錯誤: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()