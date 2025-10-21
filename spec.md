# 加密貨幣 K 線播放器 - 技術規格文件

## 專案概述

一個現代化的加密貨幣 K 線（蠟燭圖）圖表播放器應用程式，允許使用者以可變播放速度重播歷史交易資料。系統採用 FastAPI（Python）後端搭配 PostgreSQL 資料庫，以及 React（TypeScript）前端與現代化 UI 元件。

**版本**: 1.0.0
**最後更新**: 2025-10-16

---

## 1. 系統架構

### 1.1 高階架構

```
┌─────────────────┐         ┌─────────────────┐         ┌──────────────────┐
│                 │         │                 │         │                  │
│  React 前端     │◄───────►│  FastAPI 後端   │◄───────►│  PostgreSQL DB   │
│  (Port 5173)    │   HTTP  │  (Port 5002)    │   SQL   │  (Port 5432)     │
│                 │         │                 │         │                  │
└─────────────────┘         └────────┬────────┘         └──────────────────┘
                                     │
                                     │ HTTP
                                     ▼
                            ┌─────────────────┐
                            │                 │
                            │  Binance API    │
                            │                 │
                            └─────────────────┘
```

### 1.2 技術堆疊

#### 後端
- **框架**: FastAPI 0.104.1
- **ASGI 伺服器**: Uvicorn 0.24.0
- **ORM**: SQLAlchemy 2.0.23
- **資料庫**: PostgreSQL 12+
- **身份驗證**: JWT (python-jose) + OTP (pyotp)
- **密碼雜湊**: Passlib with bcrypt
- **排程器**: APScheduler 3.10.4
- **API 客戶端**: Requests 2.31.0
- **電子郵件**: aiosmtplib 3.0.1
- **QR Code 生成**: qrcode 7.4.2

#### 前端
- **框架**: React 19.1.1
- **建置工具**: Vite 7.1.2
- **語言**: TypeScript 5.8.3
- **路由器**: React Router DOM 7.9.1
- **UI 函式庫**: shadcn/ui (Radix UI primitives)
- **樣式**: Tailwind CSS 3.4.17
- **圖表**:
  - Chart.js 4.5.0
  - react-chartjs-2 5.3.0
  - chartjs-chart-financial 0.2.1
  - chartjs-plugin-zoom 2.2.0
- **日期處理**: date-fns 4.1.0
- **圖示**: lucide-react 0.542.0

---

## 2. 資料庫設計

### 2.1 資料庫綱要

#### 資料表: `kline5m`
儲存 5 分鐘蠟燭圖資料。

```sql
CREATE TABLE kline5m (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    open_time TIMESTAMP NOT NULL,
    close_time TIMESTAMP NOT NULL,
    open_price NUMERIC(20, 8) NOT NULL,
    high_price NUMERIC(20, 8) NOT NULL,
    low_price NUMERIC(20, 8) NOT NULL,
    close_price NUMERIC(20, 8) NOT NULL,
    volume NUMERIC(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, open_time)
);

CREATE INDEX idx_kline5m_symbol_time ON kline5m(symbol, open_time);
```

#### 資料表: `kline1h`
儲存 1 小時蠟燭圖資料。

```sql
CREATE TABLE kline1h (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    open_time TIMESTAMP NOT NULL,
    close_time TIMESTAMP NOT NULL,
    open_price NUMERIC(20, 8) NOT NULL,
    high_price NUMERIC(20, 8) NOT NULL,
    low_price NUMERIC(20, 8) NOT NULL,
    close_price NUMERIC(20, 8) NOT NULL,
    volume NUMERIC(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, open_time)
);

CREATE INDEX idx_kline1h_symbol_time ON kline1h(symbol, open_time);
```

#### 資料表: `kline1d`
儲存 1 日蠟燭圖資料。

```sql
CREATE TABLE kline1d (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    open_time TIMESTAMP NOT NULL,
    close_time TIMESTAMP NOT NULL,
    open_price NUMERIC(20, 8) NOT NULL,
    high_price NUMERIC(20, 8) NOT NULL,
    low_price NUMERIC(20, 8) NOT NULL,
    close_price NUMERIC(20, 8) NOT NULL,
    volume NUMERIC(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, open_time)
);

CREATE INDEX idx_kline1d_symbol_time ON kline1d(symbol, open_time);
```

#### 資料表: `symbols`
管理交易對及其狀態。

```sql
CREATE TABLE symbols (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    base_asset VARCHAR(10) NOT NULL,
    quote_asset VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_symbols_symbol ON symbols(symbol);
```

#### 資料表: `users`
使用者帳號管理，支援雙因素認證。

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    otp_secret VARCHAR(32) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_approved BOOLEAN DEFAULT FALSE,
    login_count INTEGER DEFAULT 0,
    last_login_date TIMESTAMP,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 2.2 資料聚合策略

- **5m 和 1h 資料**: 從 Binance API 取得並直接儲存於資料庫
- **15m 資料**: 從 5m 資料動態計算（不儲存）
- **4h 資料**: 從 1h 資料動態計算（不儲存）
- **1d 資料**: 從 Binance API 取得並儲存於資料庫
- **1w 資料**: 從 1d 資料動態計算（不儲存）

---

## 3. 後端 API 規格

### 3.1 基本 URL
```
http://127.0.0.1:5002/api
```

### 3.2 API 端點

#### 3.2.1 K 線資料端點

##### GET `/api/klines`
取得 K 線蠟燭圖資料。

**查詢參數**:
- `symbol` (必要): 交易對符號 (例如 "BTCUSDT")
- `interval` (必要): 時間間隔 ("5m", "15m", "1h", "4h", "1d", "1w")
- `startTime` (必要): 開始時間戳（毫秒）
- `endTime` (必要): 結束時間戳（毫秒）

**回應**: 蠟燭圖資料陣列
```json
[
  [
    1609459200000,    // 開盤時間（時間戳）
    "29000.00000000", // 開盤價
    "29100.00000000", // 最高價
    "28900.00000000", // 最低價
    "29050.00000000", // 收盤價
    "100.50000000",   // 成交量
    1609459499999,    // 收盤時間（時間戳）
    0, 0, 0, 0        // 額外欄位
  ]
]
```

**狀態碼**:
- 200: 成功
- 400: 無效參數
- 500: 伺服器錯誤

---

##### GET `/api/symbols`
取得支援的交易對清單。

**回應**:
```json
[
  {
    "value": "BTCUSDT",
    "label": "BTC/USDT"
  },
  {
    "value": "ETHUSDT",
    "label": "ETH/USDT"
  }
]
```

---

##### GET `/api/intervals`
取得支援的時間間隔清單。

**回應**:
```json
[
  { "value": "5m", "label": "5分鐘" },
  { "value": "15m", "label": "15分鐘" },
  { "value": "1h", "label": "1小時" },
  { "value": "4h", "label": "4小時" },
  { "value": "1d", "label": "1天" },
  { "value": "1w", "label": "1週" }
]
```

---

##### GET `/api/live-prices`
取得所有活躍交易對的即時價格資料（從記憶體快取）。

**回應**:
```json
[
  {
    "symbol": "BTCUSDT",
    "label": "BTC/USDT",
    "price": 42500.50,
    "update_time": "2025-10-16T12:30:00",
    "kline_time": "2025-10-16T12:25:00"
  }
]
```

---

##### GET `/api/health`
健康檢查端點。

**回應**:
```json
{
  "status": "OK",
  "database": "connected",
  "error": null
}
```

---

#### 3.2.2 移動平均線端點

##### GET `/api/moving-average`
計算移動平均線資料。

**查詢參數**:
- `symbol` (必要): 交易對符號
- `interval` (必要): 時間間隔
- `period` (必要): 移動平均線週期（整數）
- `ma_type` (必要): MA 類型 ("SMA", "EMA", "VWMA")
- `startTime` (必要): 開始時間戳（毫秒）
- `endTime` (必要): 結束時間戳（毫秒）

**回應**:
```json
[
  {
    "timestamp": 1609459200000,
    "value": 29050.25
  }
]
```

**MA 類型**:
- **SMA**: 簡單移動平均線
- **EMA**: 指數移動平均線
- **VWMA**: 成交量加權移動平均線

---

#### 3.2.3 身份驗證端點

##### POST `/api/auth/register`
註冊新的使用者帳號。

**請求本體**:
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securePassword123"
}
```

**回應**:
```json
{
  "message": "註冊成功！請檢查您的郵箱以完成 Google Authenticator 設定。",
  "email_sent": true
}
```

**狀態碼**:
- 200: 成功
- 400: 電子郵件已註冊

---

##### POST `/api/auth/login`
使用電子郵件、密碼和 OTP 碼登入。

**請求本體**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "otp_code": "123456"
}
```

**回應**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**狀態碼**:
- 200: 成功
- 401: 無效的憑證或 OTP
- 403: 帳號未獲批准

---

##### GET `/api/auth/me`
取得當前使用者資訊（需要驗證）。

**標頭**:
```
Authorization: Bearer <access_token>
```

**回應**:
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "is_approved": true,
  "login_count": 5,
  "last_login_date": "2025-10-16T12:30:00",
  "last_login_ip": "192.168.1.1",
  "created_at": "2025-10-01T10:00:00"
}
```

---

#### 3.2.4 管理員端點

所有管理員端點需要 `admin` 角色的身份驗證。

##### GET `/api/admin/users`
取得所有使用者清單。

**標頭**:
```
Authorization: Bearer <admin_token>
```

**回應**: UserResponse 物件陣列

---

##### PUT `/api/admin/users/{user_id}/approve`
批准使用者帳號。

**回應**:
```json
{
  "message": "User approved successfully"
}
```

---

##### PUT `/api/admin/users/{user_id}/reject`
拒絕使用者批准。

---

##### DELETE `/api/admin/users/{user_id}`
刪除使用者帳號（無法刪除管理員使用者）。

---

##### POST `/api/admin/users/{user_id}/regenerate-otp`
為使用者重新生成 OTP 金鑰。

**回應**:
```json
{
  "qr_code": "data:image/png;base64,...",
  "secret_key": "JBSWY3DPEHPK3PXP"
}
```

---

##### GET `/api/admin/symbols`
取得所有交易對（管理員視圖）。

---

##### POST `/api/admin/symbols`
建立新的交易對。

**請求本體**:
```json
{
  "symbol": "ADAUSDT",
  "name": "Cardano",
  "base_asset": "ADA",
  "quote_asset": "USDT"
}
```

---

##### PATCH `/api/admin/symbols/{symbol_id}`
更新交易對資訊。

**請求本體**:
```json
{
  "name": "Updated Name",
  "is_active": false
}
```

---

##### DELETE `/api/admin/symbols/{symbol_id}`
刪除交易對。

---

### 3.3 身份驗證與授權

#### 使用者角色
- **guest**: 非註冊使用者（有限存取）
- **user**: 已註冊且已批准的使用者
- **admin**: 系統管理員

#### 身份驗證流程
1. 使用者使用電子郵件和密碼註冊
2. 系統生成 OTP 金鑰和 QR Code
3. 透過電子郵件發送 QR Code
4. 使用者設定 Google Authenticator
5. 使用者使用電子郵件、密碼和 OTP 碼登入
6. 管理員批准使用者帳號
7. 使用者收到 JWT 存取權杖（有效期 30 分鐘）

#### 安全功能
- 使用 bcrypt 進行密碼雜湊
- 使用 HS256 演算法的 JWT 權杖
- 雙因素驗證（TOTP）
- 登入追蹤（次數、日期、IP 位址）
- 基於角色的存取控制（RBAC）

---

## 4. 前端架構

### 4.1 元件結構

```
src/
├── components/
│   ├── ui/                     # shadcn/ui 元件
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── select.tsx
│   │   ├── slider.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── avatar.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── navigation-menu.tsx
│   │   ├── alert.tsx
│   │   └── PriceTicker.tsx     # 即時價格跑馬燈
│   ├── auth/                   # 身份驗證元件
│   │   ├── AuthModal.tsx
│   │   ├── RegisterForm.tsx
│   │   └── LoginForm.tsx
│   ├── kline/                  # K 線播放器元件
│   │   ├── KlinePlayer.tsx
│   │   ├── KlinePlayerNew.tsx
│   │   ├── KlinePlayerSidebar.tsx
│   │   ├── KlineChart.tsx
│   │   └── KlineSettingsPanel.tsx
│   ├── admin/                  # 管理員儀表板
│   │   ├── AdminDashboard.tsx
│   │   ├── UserManagement.tsx
│   │   └── SymbolManagement.tsx
│   ├── layout/                 # 版面元件
│   │   ├── MainLayout.tsx
│   │   └── BreadcrumbPath.tsx
│   ├── pages/
│   │   └── HomePage.tsx
│   ├── ControlPanel.tsx        # 舊版控制面板
│   ├── PlayerControls.tsx      # 舊版播放器控制
│   └── MovingAverageConfig.tsx # MA 配置
├── contexts/
│   ├── AuthContext.tsx         # 身份驗證狀態
│   └── KlinePlayerContext.tsx  # K 線播放器狀態
├── hooks/
│   └── useKlinePlayer.ts       # K 線播放器邏輯 hook
├── lib/
│   ├── api.ts                  # API 客戶端函式
│   └── utils.ts                # 工具函式
├── utils/
│   └── movingAverages.ts       # MA 計算工具
├── config/
│   └── api.ts                  # API 配置
├── App.tsx                     # 主應用程式元件（舊版）
├── AppRouter.tsx               # React Router 設定
└── main.tsx                    # 進入點
```

### 4.2 關鍵元件

#### 4.2.1 KlinePlayer
主要播放器元件，編排 K 線播放。

**Props**:
- 交易對選擇
- 間隔選擇
- 時間範圍選擇
- 播放速度控制
- 移動平均線配置

**功能**:
- 漸進式資料顯示
- 可變播放速度（1x-10x）
- 播放/暫停/停止/重置控制
- 帶尋找功能的進度條
- 圖表縮放和平移

---

#### 4.2.2 KlineChart
顯示蠟燭圖的 Chart.js 包裝器。

**技術**:
- Chart.js 用於渲染
- chartjs-chart-financial 用於 OHLC 蠟燭圖
- chartjs-plugin-zoom 用於互動
- chartjs-adapter-date-fns 用於時間軸

**功能**:
- 即時資料更新
- 移動平均線覆蓋
- 響應式設計
- 縮放和平移控制

---

#### 4.2.3 PriceTicker
顯示即時價格的即時價格跑馬燈元件。

**功能**:
- 每 5 秒自動更新
- 捲動動畫
- 多個交易對顯示

---

### 4.3 狀態管理

#### Context Providers

##### AuthContext
管理身份驗證狀態。

**狀態**:
```typescript
{
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email, password, otp) => Promise<void>
  logout: () => void
  register: (email, name, password) => Promise<void>
}
```

##### KlinePlayerContext
管理 K 線播放器狀態（如果使用）。

---

### 4.4 路由

```typescript
路由:
  / - 首頁（公開）
  /kline - K 線播放器（需要驗證）
  /admin - 管理員儀表板（需要管理員角色）
  /admin/users - 使用者管理
  /admin/symbols - 交易對管理
```

---

## 5. 資料流

### 5.1 K 線資料流

```
┌────────────┐
│   使用者   │
│  選擇參數  │
└─────┬──────┘
      │
      ▼
┌─────────────────┐
│ 前端發送        │
│ API 請求        │
└─────┬───────────┘
      │
      ▼
┌─────────────────────────────┐
│ 後端接收請求                │
│ 檢查資料庫是否有資料        │
└─────┬───────────────────────┘
      │
      ├─── 資料存在 ─────────────┐
      │                          │
      │                          ▼
      │                  ┌───────────────┐
      │                  │ 從資料庫      │
      │                  │ 回傳資料      │
      │                  └───────┬───────┘
      │                          │
      ▼                          │
┌─────────────────┐             │
│ 資料缺失        │             │
│ 從 Binance API  │             │
│ 取得資料        │             │
└─────┬───────────┘             │
      │                         │
      ▼                         │
┌─────────────────┐             │
│ 儲存至資料庫    │             │
└─────┬───────────┘             │
      │                         │
      └──────────┬──────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ 回傳資料至      │
        │ 前端            │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ 前端顯示圖表    │
        │ 並加上動畫      │
        └─────────────────┘
```

### 5.2 背景資料更新

背景排程器每 5 分鐘執行一次：
1. 從 Binance API 取得所有活躍交易對的最新資料
2. 使用新的蠟燭圖更新資料庫
3. 從 5m 資料計算當前未完成的蠟燭圖（1h、1d）
4. 更新記憶體內的價格快取

---

## 6. 配置

### 6.1 環境變數

#### 後端 (.env)
```env
# 資料庫配置
postgreSQL_user=your_username
postgreSQL_pass=your_password
DB_HOST=61.218.12.227
DB_PORT=5432
DB_NAME=trade

# JWT 配置
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# 電子郵件配置
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
```

### 6.2 CORS 配置

允許的來源:
- http://localhost:3000
- http://127.0.0.1:3000
- http://localhost:5173
- http://localhost:5176
- http://localhost:5177

---

## 7. 支援的加密貨幣

預設支援的交易對:
- **BTCUSDT** - 比特幣 / Tether USD
- **ETHUSDT** - 以太坊 / Tether USD
- **SOLUSDT** - Solana / Tether USD

可透過管理員面板新增其他交易對。

---

## 8. 支援的時間間隔

- **5m** - 5 分鐘（儲存於資料庫）
- **15m** - 15 分鐘（從 5m 計算）
- **1h** - 1 小時（儲存於資料庫）
- **4h** - 4 小時（從 1h 計算）
- **1d** - 1 天（儲存於資料庫）
- **1w** - 1 週（從 1d 計算）

---

## 9. 移動平均線指標

### 9.1 支援的 MA 類型

#### 簡單移動平均線 (SMA)
```
SMA = (P1 + P2 + ... + Pn) / n
```

#### 指數移動平均線 (EMA)
```
EMA = Price(t) × k + EMA(y) × (1 - k)
其中 k = 2 / (n + 1)
```

#### 成交量加權移動平均線 (VWMA)
```
VWMA = Σ(Price × Volume) / Σ(Volume)
```

### 9.2 常見週期
- 5, 10, 20, 30, 50, 100, 200

---

## 10. 效能考量

### 10.1 資料庫最佳化
- (symbol, open_time) 上的唯一約束防止重複
- symbol 和 open_time 上的索引加速查詢
- 自動資料聚合減少儲存空間

### 10.2 API 速率限制
- Binance API 速率限制：每分鐘 1200 次請求
- 資料庫優先策略最小化 API 呼叫
- 背景排程器每 5 分鐘更新

### 10.3 前端最佳化
- React 19 具備並行功能
- Vite 實現快速建置
- 透過 React Router 進行程式碼分割
- Chart.js 使用 canvas 渲染以提升效能

---

## 11. 錯誤處理

### 11.1 後端錯誤回應

所有錯誤遵循此格式:
```json
{
  "detail": "錯誤訊息說明"
}
```

常見狀態碼:
- 400: Bad Request（無效參數）
- 401: Unauthorized（無效權杖）
- 403: Forbidden（權限不足）
- 404: Not Found
- 500: Internal Server Error

### 11.2 前端錯誤處理
- 使用者面對錯誤的 Toast 通知
- 元件錯誤的備用 UI
- 失敗 API 請求的重試邏輯

---

## 12. 部署

### 12.1 後端部署

**開發環境**:
```bash
python app.py
```

**正式環境**（使用 Gunicorn）:
```bash
gunicorn -w 4 -b 0.0.0.0:5002 app:app
```

### 12.2 前端部署

**建置**:
```bash
cd frontend
npm run build
```

**輸出**: `frontend/dist/`

部署至任何靜態檔案伺服器（Nginx、Apache、CDN 等）

### 12.3 Docker 部署（選用）

可以使用以下方式容器化:
- 後端: Python 3.8+ 映像
- 前端: Node.js 建置階段 + Nginx 服務階段
- 資料庫: PostgreSQL 官方映像
- docker-compose 進行編排

---

## 13. 測試策略

### 13.1 後端測試
- 計算函式的單元測試（SMA、EMA、VWMA）
- API 端點的整合測試
- 資料庫遷移測試

### 13.2 前端測試
- 使用 React Testing Library 的元件測試
- 使用 Playwright/Cypress 的端對端測試
- 視覺回歸測試

---

## 14. 未來增強功能

### 潛在功能
- [ ] WebSocket 實現即時價格更新
- [ ] 更多技術指標（RSI、MACD、布林通道）
- [ ] 圖表上的自訂繪圖工具
- [ ] 匯出圖表為圖片/影片
- [ ] 交易模擬模式
- [ ] 多圖表版面配置
- [ ] 價格水平警報系統
- [ ] 投資組合追蹤
- [ ] 行動應用程式（React Native）

---

## 15. 版本歷史

| 版本  | 日期       | 變更內容                                 |
|-------|------------|------------------------------------------|
| 1.0.0 | 2025-10-16 | 初始版本，包含完整功能集                 |
|       |            | - 可變速度的 K 線播放器                  |
|       |            | - 移動平均線指標                         |
|       |            | - 具雙因素驗證的使用者身份驗證           |
|       |            | - 使用者/交易對管理的管理員面板          |
|       |            | - 即時價格跑馬燈                         |

---

## 16. 參考資料

- [Binance API 文件](https://binance-docs.github.io/apidocs/spot/en/)
- [Chart.js 文件](https://www.chartjs.org/docs/latest/)
- [FastAPI 文件](https://fastapi.tiangolo.com/)
- [React 文件](https://react.dev/)
- [shadcn/ui 元件](https://ui.shadcn.com/)
- [PostgreSQL 文件](https://www.postgresql.org/docs/)

---

## 17. 授權

MIT License

---

## 18. 聯絡與支援

若有問題和功能請求，請聯絡開發團隊。

**文件**: 請參閱 [CLAUDE.md](CLAUDE.md)、[README.md](README.md) 以獲取開發指南
