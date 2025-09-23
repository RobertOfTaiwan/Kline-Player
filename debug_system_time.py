#!/usr/bin/env python3
"""
調試系統時間問題
"""
import os
from datetime import datetime, timezone
import time

def check_system_time():
    """檢查系統時間設定"""
    print("=== 系統時間檢查 ===")

    # 各種時間表示
    now_local = datetime.now()
    now_utc = datetime.utcnow()
    now_utc_tz = datetime.now(timezone.utc)

    print(f"本地時間 (datetime.now()): {now_local}")
    print(f"UTC時間 (datetime.utcnow()): {now_utc}")
    print(f"UTC時間 (datetime.now(timezone.utc)): {now_utc_tz}")

    # 時間戳
    timestamp_local = now_local.timestamp()
    timestamp_utc = now_utc.timestamp()
    timestamp_utc_tz = now_utc_tz.timestamp()

    print(f"\n本地時間戳: {timestamp_local}")
    print(f"UTC時間戳 (utcnow): {timestamp_utc}")
    print(f"UTC時間戳 (timezone.utc): {timestamp_utc_tz}")

    # 時區信息
    print(f"\n系統時區: {time.tzname}")

    # 當前毫秒時間戳
    current_ms = int(datetime.utcnow().timestamp() * 1000)
    current_ms_tz = int(datetime.now(timezone.utc).timestamp() * 1000)

    print(f"\n當前毫秒時間戳 (utcnow): {current_ms}")
    print(f"當前毫秒時間戳 (timezone.utc): {current_ms_tz}")

    # 轉換回 datetime 檢查
    back_to_dt = datetime.utcfromtimestamp(current_ms / 1000)
    back_to_dt_tz = datetime.fromtimestamp(current_ms_tz / 1000, tz=timezone.utc)

    print(f"\n轉換回 datetime (utcfromtimestamp): {back_to_dt}")
    print(f"轉換回 datetime (fromtimestamp + tz): {back_to_dt_tz}")

if __name__ == "__main__":
    check_system_time()