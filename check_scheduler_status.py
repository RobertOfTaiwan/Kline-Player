#!/usr/bin/env python3
"""
檢查排程器運行狀態
"""
import os
import sys
import psutil
import requests
from datetime import datetime, timezone

def check_app_process():
    """檢查應用進程是否在運行"""
    print("=== 檢查應用進程狀態 ===")

    python_processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if 'python' in proc.info['name'].lower():
                cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                if 'app.py' in cmdline:
                    python_processes.append({
                        'pid': proc.info['pid'],
                        'cmdline': cmdline
                    })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    if python_processes:
        print("✅ 找到應用進程:")
        for proc in python_processes:
            print(f"  PID: {proc['pid']}")
            print(f"  命令: {proc['cmdline']}")
    else:
        print("❌ 未找到運行中的 app.py 進程")

    return len(python_processes) > 0

def check_api_status():
    """檢查 API 是否響應"""
    print("\n=== 檢查 API 狀態 ===")

    try:
        # 測試健康檢查端點
        response = requests.get("http://localhost:5000/api/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ API 正常響應")
            print(f"  狀態: {data.get('status')}")
            print(f"  資料庫: {data.get('database')}")
            return True
        else:
            print(f"⚠️ API 響應異常: HTTP {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到 API (可能應用未運行)")
        return False
    except Exception as e:
        print(f"❌ API 檢查失敗: {e}")
        return False

def check_recent_data_updates():
    """檢查最近的資料更新"""
    print("\n=== 檢查最近資料更新 ===")

    try:
        response = requests.get("http://localhost:5000/api/live-prices", timeout=5)
        if response.status_code == 200:
            prices = response.json()
            print("✅ 成功獲取實時價格:")

            for price in prices:
                symbol = price['symbol']
                update_time = price['update_time']
                kline_time = price['kline_time']
                price_value = price['price']

                print(f"  {symbol}: ${price_value}")
                print(f"    更新時間: {update_time}")
                print(f"    K線時間: {kline_time}")

                # 檢查時間差
                if update_time != "--:--:--":
                    try:
                        update_dt = datetime.fromisoformat(update_time.replace('Z', '+00:00'))
                        now = datetime.now(timezone.utc)
                        time_diff = (now - update_dt).total_seconds() / 60
                        print(f"    時間差: {time_diff:.1f} 分鐘前")
                    except:
                        print(f"    時間解析失敗")
                print()

            return True
        else:
            print(f"❌ 無法獲取實時價格: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 檢查實時價格失敗: {e}")
        return False

def check_log_file():
    """檢查日誌文件中的最近更新"""
    print("\n=== 檢查日誌文件 ===")

    log_file = "output.log"
    if os.path.exists(log_file):
        try:
            # 讀取最後50行
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                last_lines = lines[-50:] if len(lines) > 50 else lines

            print("最近的日誌條目:")
            scheduler_executions = []
            background_updates = []

            for line in last_lines:
                if "Job \"Update latest kline data" in line and "executed successfully" in line:
                    scheduler_executions.append(line.strip())
                elif "背景更新: 已取得" in line:
                    background_updates.append(line.strip())

            if scheduler_executions:
                print("✅ 排程器執行記錄:")
                for exec_line in scheduler_executions[-3:]:  # 最近3次
                    print(f"  {exec_line}")
            else:
                print("❌ 未找到排程器執行記錄")

            if background_updates:
                print("\n✅ 背景更新記錄:")
                for update_line in background_updates[-5:]:  # 最近5次
                    print(f"  {update_line}")
            else:
                print("\n❌ 未找到背景更新記錄")

            return len(scheduler_executions) > 0 or len(background_updates) > 0

        except Exception as e:
            print(f"❌ 讀取日誌文件失敗: {e}")
            return False
    else:
        print("❌ 日誌文件不存在")
        return False

def main():
    """主函數"""
    print(f"開始檢查後台排程器狀態... {datetime.now()}")
    print("="*60)

    app_running = check_app_process()
    api_working = check_api_status()
    data_fresh = check_recent_data_updates()
    log_active = check_log_file()

    print("\n" + "="*60)
    print("檢查結果摘要:")
    print(f"應用進程運行: {'✅' if app_running else '❌'}")
    print(f"API 正常工作: {'✅' if api_working else '❌'}")
    print(f"資料更新正常: {'✅' if data_fresh else '❌'}")
    print(f"日誌顯示活動: {'✅' if log_active else '❌'}")

    if not app_running:
        print("\n🔧 建議: 啟動應用程序 (python app.py)")
    elif not log_active:
        print("\n🔧 建議: 排程器可能沒有正常啟動，檢查排程器配置")
    elif app_running and api_working and not data_fresh:
        print("\n🔧 建議: 應用在運行但資料更新有問題，檢查背景更新邏輯")

if __name__ == "__main__":
    main()