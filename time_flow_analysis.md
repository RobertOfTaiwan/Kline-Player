# K線圖時間處理邏輯流程分析

## 1. 前台時間輸入與預設值

### 時間輸入框預設值設定：
```javascript
// 開始時間：7天前的UTC時間
defaultValue={getUTCDateTimeLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))}

// 結束時間：當前UTC時間
defaultValue={getUTCDateTimeLocal()}

// getUTCDateTimeLocal 函數：
const getUTCDateTimeLocal = (date: Date = new Date()): string => {
  return date.toISOString().slice(0, 16);
};
```

### 用戶看到的時間：
- 輸入框標籤：「開始時間 (UTC時間)」、「結束時間 (UTC時間)」
- 格式：`2025-09-21T15:00` （YYYY-MM-DDTHH:mm）

## 2. 前台讀取用戶輸入並轉換

### 讀取輸入值：
```javascript
const startInput = (document.querySelector('input[data-start]') as HTMLInputElement)?.value || '';
const endInput = (document.querySelector('input[data-end]') as HTMLInputElement)?.value || '';
```

### 轉換為UTC時間戳：
```javascript
const getUTCTimestampFromInput = (inputValue: string): number => {
  if (!inputValue) return 0;
  // 在 datetime-local 值後加 'Z' 使其被解釋為 UTC 時間
  return new Date(inputValue + 'Z').getTime();
};

const userStartTime = getUTCTimestampFromInput(startInput);
const endTime = getUTCTimestampFromInput(endInput);
```

### 實際時間戳計算：
- 用戶輸入：`2025-09-21T15:00`
- 加上'Z'：`2025-09-21T15:00Z`
- 轉換結果：UTC時間戳（毫秒）

## 3. 發送API請求到後台

### API請求構造：
```javascript
const response = await apiRequest(`${API_ENDPOINTS.KLINES}?symbol=${symbol}&interval=${interval}&startTime=${actualStartTime}&endTime=${endTime}`);
```

### 實際發送的參數：
- symbol: 交易對 (如 BTCUSDT)
- interval: 時間間隔 (如 1h)
- startTime: UTC時間戳（毫秒）- 包含均線計算所需的額外歷史資料
- endTime: UTC時間戳（毫秒）

## 4. 後台API處理（app.py）

### API端點：
```python
@app.get("/api/klines")
async def get_klines(
    symbol: str,
    interval: str,
    startTime: int,
    endTime: int
):
```

### 後台時間戳處理：
```python
# 從資料庫獲取資料
start_dt = datetime.utcfromtimestamp(startTime / 1000)
end_dt = datetime.utcfromtimestamp(endTime / 1000)

results = session.query(model).filter(
    model.symbol == symbol,
    model.open_time >= start_dt,
    model.open_time <= end_dt
).order_by(model.open_time).all()
```

### 資料庫查詢：
- 資料庫中的 open_time 欄位：naive datetime (實際是UTC時間)
- 查詢條件：`open_time >= start_dt AND open_time <= end_dt`

## 5. 後台返回資料格式

### 資料轉換：
```python
for item in results:
    data.append([
        int(item.open_time.timestamp() * 1000),  # 時間戳
        str(item.open_price),
        str(item.high_price),
        str(item.low_price),
        str(item.close_price),
        str(item.volume),
        int(item.close_time.timestamp() * 1000),
        0, 0, 0, 0
    ])
```

### 關鍵問題點：
```python
int(item.open_time.timestamp() * 1000)
```
⚠️ 這裡可能有問題！如果 item.open_time 是 naive datetime，`.timestamp()` 會將其視為本地時間！

## 6. 前台接收並處理資料

### 資料處理：
```javascript
const processedData: KlineData[] = result.map((item: any[]) => ({
  x: item[0],           // 時間戳
  y: parseFloat(item[4]), // 收盤價
  timestamp: new Date(item[0]), // 轉換為Date對象
  open: parseFloat(item[1]),
  high: parseFloat(item[2]),
  low: parseFloat(item[3]),
  close: parseFloat(item[4]),
  volume: parseFloat(item[5]),
}));
```

### 圖表顯示：
- Chart.js 使用 timestamp 和其他OHLC資料繪製K線圖
- 時間軸顯示基於 timestamp

## 可能的問題點分析：

### 🔍 問題1：後台資料庫時間戳轉換
在 `app.py` 中：
```python
int(item.open_time.timestamp() * 1000)
```
如果 `item.open_time` 是 naive datetime，Python會將其視為本地時間進行轉換！

### 🔍 問題2：資料庫查詢時間轉換
```python
start_dt = datetime.utcfromtimestamp(startTime / 1000)
```
這個轉換是正確的，會產生UTC時間。

### 🔍 問題3：前台時間處理
前台的轉換看起來是正確的，但需要驗證。

## 建議檢查點：

1. **檢查資料庫中實際的時間值**
2. **檢查後台返回的時間戳是否正確**
3. **檢查前台接收到的時間戳與預期是否一致**
4. **修復後台的 timestamp() 調用，確保正確處理UTC時間**