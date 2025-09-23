# GEMINI.md

## 專案概觀

本專案是一個加密貨幣K線（蠟燭圖）圖表播放器。它允許使用者以不同的時間間隔查看各種加密貨幣的歷史價格數據。此應用程式由 Python 後端和 React 前端組成。

**後端:**

*   **框架:** FastAPI
*   **資料庫:** PostgreSQL
*   **資料來源:** 幣安 (Binance) API
*   **主要功能:**
    *   提供K線數據的 RESTful API。
    *   在 PostgreSQL 資料庫中進行數據快取，以減少對幣安 API 的呼叫。
    *   使用背景排程器自動更新數據。
    *   支援 JWT 和 OTP 的使用者身份驗證。
    *   計算各種移動平均線（SMA, EMA, VWMA）。

**前端:**

*   **框架:** React (使用 TypeScript)
*   **建置工具:** Vite
*   **UI:** shadcn/ui 和 Tailwind CSS
*   **圖表函式庫:** Chart.js
*   **主要功能:**
    *   互動式K線圖表顯示。
    *   用於選擇加密貨幣、時間間隔和日期範圍的控制項。
    *   用於播放、暫停、停止和重設圖表播放的播放器控制項。
    *   用於啟用和自訂移動平均線的設定面板。
    *   兩種視圖模式：靜態模式和播放器模式。

## 建置與執行

### 後端

1.  **安裝依賴套件:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **設定環境變數:**
    在專案根目錄中建立一個 `.env` 檔案，並新增以下變數：
    ```
    postgreSQL_user=your_username
    postgreSQL_pass=your_password
    DB_HOST=61.218.12.227
    DB_PORT=5432
    DB_NAME=trade
    ```

3.  **執行開發伺服器:**
    ```bash
    python app.py
    ```
    後端伺服器將會執行在 `http://127.0.0.1:5002`。

### 前端

1.  **切換到前端目錄:**
    ```bash
    cd frontend
    ```

2.  **安裝依賴套件:**
    ```bash
    npm install
    ```

3.  **執行開發伺服器:**
    ```bash
    npm run dev
    ```
    前端開發伺服器將會執行在 `http://localhost:5173`。

## 開發慣例

*   **後端:**
    *   後端使用 Python 和 FastAPI 框架編寫。
    *   遵循模組化結構，將不同功能放在獨立的檔案中。
    *   使用 SQLAlchemy 進行資料庫互動。
    *   有一個用於數據更新的背景排程器。
*   **前端:**
    *   前端是一個使用 TypeScript 編寫的 React 應用程式。
    *   使用函式元件 (functional components) 搭配 hooks。
    *   使用 `shadcn/ui` 和 Tailwind CSS 進行樣式設計。
    *   使用 Chart.js 渲染K線圖。
    *   API 請求集中在 `src/config/api.ts` 中管理。
*   **程式碼風格:**
    *   程式碼庫有良好的中英文註釋。
    *   程式碼遵循標準的 Python 和 TypeScript 格式慣例。