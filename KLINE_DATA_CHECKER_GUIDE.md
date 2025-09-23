# K線資料診斷與修復工具使用說明

## 工具概述

提供兩個版本的 K線資料檢查工具：

1. **fix_kline_data.py** - 基礎版本，互動式介面
2. **advanced_kline_checker.py** - 高級版本，命令行介面，更多功能

## 高級版本功能特色

### 🔍 診斷功能
- **時間缺口檢測** - 找出資料時間序列中的中斷
- **連續性評分** - 評估資料完整性百分比
- **價格異常檢測** - 識別不正常的價格跳躍
- **資料範圍分析** - 統計每個交易對的資料覆蓋情況

### 🔧 修復功能
- **智能補資料** - 自動從 Binance API 獲取缺失資料
- **批量處理** - 支援多交易對和多時間間隔同時處理
- **安全限制** - 避免修復過大的缺口，防止資料庫過載
- **進度追蹤** - 詳細的修復過程報告

## 使用方法

### 基礎檢查（所有交易對，所有間隔）
```bash
python advanced_kline_checker.py
```

### 只運行診斷
```bash
python advanced_kline_checker.py --mode diagnostic
```

### 只運行修復
```bash
python advanced_kline_checker.py --mode repair
```

### 指定特定交易對
```bash
python advanced_kline_checker.py --symbols BTCUSDT,ETHUSDT
```

### 指定時間間隔
```bash
python advanced_kline_checker.py --intervals 5m,1h
```

### 設定最大修復天數
```bash
python advanced_kline_checker.py --max-days 7
```

### 完整範例
```bash
python advanced_kline_checker.py --mode both --symbols BTCUSDT,ETHUSDT --intervals 5m,1h --max-days 10
```

## 輸出說明

### 診斷模式輸出
```
📊 診斷交易對: BTCUSDT
📈 檢查 5m 資料:
    📅 時間範圍: 2024-01-01 00:00:00 到 2024-01-31 23:55:00
    📊 總記錄數: 8928
    🔗 連續性得分: 98.50%
    ⚠️ 發現 3 個時間缺口，缺失 134 筆資料
      缺口 1: 2024-01-15 10:30:00 - 2024-01-15 15:25:00 (缺失 59 筆)
    ✅ 價格連續性正常
```

### 修復模式輸出
```
🔧 修復交易對: BTCUSDT
📈 修復 5m 資料:
    📊 發現 3 個缺口，開始修復...
      🔧 修復缺口 1: 2024-01-15 10:30:00 - 2024-01-15 15:25:00
      ✅ 補充 59 筆資料
    📊 5m 修復完成，共補充 134 筆資料
```

## 安全特性

1. **資料完整性檢查** - 避免重複插入資料
2. **API 限制保護** - 自動延遲避免超出 Binance API 限制
3. **錯誤恢復** - 單筆失敗不影響整體處理
4. **缺口大小限制** - 防止修復過大的歷史缺口

## 最佳實踐

### 首次檢查
```bash
# 先運行診斷了解資料狀況
python advanced_kline_checker.py --mode diagnostic

# 然後選擇性修復重要交易對
python advanced_kline_checker.py --mode repair --symbols BTCUSDT,ETHUSDT --max-days 7
```

### 日常維護
```bash
# 修復近期小缺口
python advanced_kline_checker.py --mode repair --max-days 3

# 檢查特定問題交易對
python advanced_kline_checker.py --symbols PROBLEMATIC_SYMBOL --intervals 5m
```

### 生產環境
```bash
# 保守的修復策略
python advanced_kline_checker.py --mode repair --max-days 1 --intervals 5m
```

## 技術詳情

### 支援的時間間隔
- `5m` - 5分鐘 K線 (kline5m 表)
- `1h` - 1小時 K線 (kline1h 表) 
- `1d` - 1天 K線 (kline1d 表)

### 連續性評分計算
```
連續性得分 = (實際記錄數 / 期望記錄數) × 100%
```

### 價格異常檢測
- 預設閾值：10% 價格變動
- 檢測相鄰 K線間的異常跳躍
- 有助於識別資料品質問題

## 疑難排解

### 常見問題

1. **資料庫連接失敗**
   - 檢查 DB_CONFIG 設定
   - 確認網路連接

2. **Binance API 錯誤**
   - 檢查網路連接
   - 可能遇到 API 限制，工具會自動重試

3. **記憶體使用過高**
   - 減少同時處理的交易對數量
   - 設定較小的 max-days 值

### 效能調優

- 單次處理建議不超過 10 個交易對
- max-days 設定建議不超過 30 天
- 對於大量資料，分批執行

## 監控建議

建議設定定期執行：
```bash
# 每天修復小缺口
0 1 * * * cd /path/to/kline && python advanced_kline_checker.py --mode repair --max-days 1

# 每週完整診斷
0 2 * * 0 cd /path/to/kline && python advanced_kline_checker.py --mode diagnostic > weekly_report.txt
```
