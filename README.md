# 加密貨幣 K線圖播放器

一個現代化的加密貨幣歷史資料 K線圖播放器，採用 Python Flask + PostgreSQL 後端和 React + shadcn/ui 前端架構。

## 🚀 功能特色

- **🎮 智慧資料儲存**: 優先從 PostgreSQL 資料庫讀取，不存在才從 Binance API 獲取
- **📊 多時間週期**: 支援 5分鐘、1小時、1天、1週 K線圖
- **⚡ 可變播放速度**: 1x, 2x, 3x, 5x, 10x 播放速度
- **🎯 完整播放控制**: 播放、暫停、停止、重置、進度條拖拽
- **💰 多幣種支援**: BTC, ETH, BNB, ADA, SOL
- **🎨 現代化 UI**: 使用 shadcn/ui 組件庫，響應式設計
- **📱 跨平台支援**: 適配桌面和移動設備

## 🏗️ 系統架構

### 後端 (Python Flask)
- **框架**: Flask + SQLAlchemy
- **資料庫**: PostgreSQL
- **API 來源**: Binance API
- **功能**: RESTful API, 資料快取, 自動去重

### 前端 (React + TypeScript)
- **構建工具**: Vite
- **UI 框架**: shadcn/ui + Tailwind CSS
- **圖表庫**: Chart.js + react-chartjs-2
- **狀態管理**: React Hooks
- **型別支援**: TypeScript

## 📋 資料表結構

### kline5m (5分鐘 K線資料)
```sql
CREATE TABLE kline5m (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    open_time TIMESTAMP NOT NULL,
    close_time TIMESTAMP NOT NULL,
    open_price DECIMAL(20, 8) NOT NULL,
    high_price DECIMAL(20, 8) NOT NULL,
    low_price DECIMAL(20, 8) NOT NULL,
    close_price DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, open_time)
);
```

### kline1h (1小時 K線資料)
```sql
CREATE TABLE kline1h (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    open_time TIMESTAMP NOT NULL,
    close_time TIMESTAMP NOT NULL,
    open_price DECIMAL(20, 8) NOT NULL,
    high_price DECIMAL(20, 8) NOT NULL,
    low_price DECIMAL(20, 8) NOT NULL,
    close_price DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, open_time)
);
```

## ⚙️ 安裝與設定

### 環境需求
- Python 3.8+
- Node.js 16+
- PostgreSQL 12+
- 網路連線 (用於首次資料獲取)

### 1. 克隆專案
```bash
git clone <repository-url>
cd kline
```

### 2. 後端設定
```bash
# 安裝 Python 依賴
pip install -r requirements.txt

# 設定環境變數
cp .env.example .env
# 編輯 .env 檔案設定資料庫連線
```

### 3. 前端設定
```bash
cd frontend
npm install
```

### 4. 環境變數設定
建立 `.env` 檔案：
```env
postgreSQL_user=your_username
postgreSQL_pass=your_password
DB_HOST=61.218.12.227
DB_PORT=5432
DB_NAME=trade
```

### 5. 啟動服務

**後端 (Port 5000)**:
```bash
python app.py
```

**前端 (Port 5173)**:
```bash
cd frontend
npm run dev
```

### 6. 開啟應用程式
瀏覽器開啟 `http://localhost:5173`

## 🎯 使用方式

1. **選擇參數**
   - 選擇加密貨幣幣種 (BTC, ETH, BNB, ADA, SOL)
   - 設定時間區間 (5m, 1h, 1d, 1w)
   - 選擇起始和結束時間
   - 調整播放速度 (1x-10x)

2. **載入資料**
   - 點擊「載入資料」按鈕
   - 系統會優先檢查資料庫
   - 如資料不存在，自動從 Binance API 獲取並儲存

3. **播放控制**
   - **播放**: 開始動態顯示 K線圖
   - **暫停**: 暫停播放
   - **停止**: 停止並清空圖表
   - **重置**: 回到第一筆資料
   - **進度條**: 可拖拽跳轉到指定位置

## 🔄 資料處理邏輯

- **5分鐘 & 1小時**: 直接儲存於對應資料表
- **1天 & 1週**: 由1小時資料動態計算生成
- **智慧快取**: 先查詢資料庫，不存在才呼叫外部 API
- **自動去重**: 使用 UNIQUE 約束避免重複資料

## 📡 API 端點

### 後端 API (Port 5000)

#### `GET /api/klines`
獲取 K線資料
- `symbol`: 幣種 (如: BTCUSDT)
- `interval`: 時間間隔 (5m, 1h, 1d, 1w)
- `startTime`: 開始時間戳
- `endTime`: 結束時間戳

#### `GET /api/symbols`
獲取支援的幣種列表

#### `GET /api/intervals`
獲取支援的時間間隔

#### `GET /api/health`
健康檢查，確認資料庫連線狀態

## 🎨 UI 組件

### 主要組件
- **ControlPanel**: 參數控制面板
- **PlayerControls**: 播放控制器
- **KlineChart**: K線圖表顯示
- **useKlinePlayer**: 播放邏輯 Hook

### shadcn/ui 組件
- Button, Card, Select, Slider, Label
- 完整的設計系統支援
- 深色/淺色主題切換

## 🔧 開發

### 項目結構
```
kline/
├── app.py                 # Flask 後端主程式
├── requirements.txt       # Python 依賴
├── .env.example          # 環境變數範例
├── frontend/             # React 前端
│   ├── src/
│   │   ├── components/   # React 組件
│   │   ├── hooks/        # 自定義 Hooks
│   │   ├── lib/          # 工具函數和 API
│   │   └── App.tsx       # 主應用程式
│   ├── package.json      # 前端依賴
│   └── vite.config.ts    # Vite 配置
└── README.md             # 說明文件
```

### 開發指令
```bash
# 後端開發
python app.py

# 前端開發
cd frontend && npm run dev

# 前端建構
cd frontend && npm run build

# 型別檢查
cd frontend && npm run type-check
```

## 🚀 生產部署

### 後端部署
```bash
# 使用 Gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 前端部署
```bash
cd frontend
npm run build
# 將 dist/ 目錄部署到靜態檔案伺服器
```

## 📝 注意事項

- 確保 PostgreSQL 伺服器可正常連線
- Binance API 有頻率限制，建議合理使用
- 大量歷史資料可能需要較長載入時間
- 建議定期清理過期資料以節省儲存空間

## 🤝 貢獻

歡迎提交 Issues 和 Pull Requests 來改進專案。

## 📄 授權

MIT License