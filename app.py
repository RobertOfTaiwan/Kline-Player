from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Numeric, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from decimal import Decimal
import os
import logging
import requests
from dotenv import load_dotenv
from typing import List, Dict, Any
from pydantic import BaseModel

# 載入環境變數
load_dotenv()

# 建立 FastAPI 應用程式
app = FastAPI(title="Kline Chart API", version="1.0.0", description="加密貨幣 K線圖 API")

# 設定 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PostgreSQL 配置
DB_USER = os.getenv('postgreSQL_user')
DB_PASS = os.getenv('postgreSQL_pass')
DB_HOST = os.getenv('DB_HOST', '61.218.12.227')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'trade')

DATABASE_URL = f'postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}'

# SQLAlchemy 設置
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 定義數據模型
class Kline5m(Base):
    __tablename__ = 'kline5m'
    
    id = Column(Integer, primary_key=True)
    symbol = Column(String(20), nullable=False)
    open_time = Column(DateTime, nullable=False)
    close_time = Column(DateTime, nullable=False)
    open_price = Column(Numeric(20, 8), nullable=False)
    high_price = Column(Numeric(20, 8), nullable=False)
    low_price = Column(Numeric(20, 8), nullable=False)
    close_price = Column(Numeric(20, 8), nullable=False)
    volume = Column(Numeric(20, 8), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = {'extend_existing': True}

class Kline1h(Base):
    __tablename__ = 'kline1h'
    
    id = Column(Integer, primary_key=True)
    symbol = Column(String(20), nullable=False)
    open_time = Column(DateTime, nullable=False)
    close_time = Column(DateTime, nullable=False)
    open_price = Column(Numeric(20, 8), nullable=False)
    high_price = Column(Numeric(20, 8), nullable=False)
    low_price = Column(Numeric(20, 8), nullable=False)
    close_price = Column(Numeric(20, 8), nullable=False)
    volume = Column(Numeric(20, 8), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = {'extend_existing': True}


# Pydantic 模型
class SymbolResponse(BaseModel):
    value: str
    label: str

class IntervalResponse(BaseModel):
    value: str
    label: str

class HealthResponse(BaseModel):
    status: str
    database: str
    error: str = None

# 創建資料表
Base.metadata.create_all(bind=engine)

def get_interval_milliseconds(interval: str) -> int:
    """獲取時間間隔的毫秒數"""
    intervals = {
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000
    }
    return intervals.get(interval, 60 * 60 * 1000)

def fetch_from_binance(symbol: str, interval: str, start_time: int, end_time: int) -> List[List]:
    """從 Binance API 獲取資料"""
    all_data = []
    current_start_time = start_time
    
    while current_start_time <= end_time:
        try:
            url = 'https://api.binance.com/api/v3/klines'
            params = {
                'symbol': symbol,
                'interval': interval,
                'startTime': current_start_time,
                'endTime': end_time,
                'limit': 1000
            }
            
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if not data:
                break

            all_data.extend(data)
            
            last_timestamp = data[-1][0]
            current_start_time = last_timestamp + 1
            
            logger.info(f"從 Binance 獲取到 {len(data)} 筆 {symbol} {interval} 資料, 下次開始時間: {current_start_time}")

            if len(data) < 1000:
                break
                
        except Exception as e:
            logger.error(f"從 Binance API 獲取資料失敗: {e}")
            raise HTTPException(status_code=500, detail=f"無法從 Binance 獲取資料: {str(e)}")

    logger.info(f"總共從 Binance 獲取到 {len(all_data)} 筆 {symbol} {interval} 資料")
    return all_data

def save_to_database(symbol: str, interval: str, data: List[List]):
    """保存資料到資料庫"""
    try:
        session = SessionLocal()
        model = Kline5m if interval == '5m' else Kline1h
        
        for item in data:
            # 檢查是否已存在
            existing = session.query(model).filter_by(
                symbol=symbol,
                open_time=datetime.utcfromtimestamp(item[0] / 1000)
            ).first()
            
            if not existing:
                kline = model(
                    symbol=symbol,
                    open_time=datetime.utcfromtimestamp(item[0] / 1000),
                    close_time=datetime.utcfromtimestamp(item[6] / 1000),
                    open_price=Decimal(str(item[1])),
                    high_price=Decimal(str(item[2])),
                    low_price=Decimal(str(item[3])),
                    close_price=Decimal(str(item[4])),
                    volume=Decimal(str(item[5]))
                )
                session.add(kline)
        
        session.commit()
        logger.info(f"已保存 {len(data)} 筆 {symbol} {interval} 資料到資料庫")
        
    except Exception as e:
        session.rollback()
        logger.error(f"保存到資料庫失敗: {e}")
        raise HTTPException(status_code=500, detail=f"資料庫保存失敗: {str(e)}")
    finally:
        session.close()

def get_from_database(symbol: str, interval: str, start_time: int, end_time: int) -> List[List]:
    """從資料庫獲取資料"""
    try:
        session = SessionLocal()
        model = Kline5m if interval == '5m' else Kline1h
        
        # 使用 UTC 時間戳轉換，避免時區問題
        start_dt = datetime.utcfromtimestamp(start_time / 1000)
        end_dt = datetime.utcfromtimestamp(end_time / 1000)
        
        results = session.query(model).filter(
            model.symbol == symbol,
            model.open_time >= start_dt,
            model.open_time <= end_dt
        ).order_by(model.open_time).all()
        
        # 轉換為 Binance API 格式
        data = []
        for item in results:
            data.append([
                int(item.open_time.timestamp() * 1000),
                str(item.open_price),
                str(item.high_price),
                str(item.low_price),
                str(item.close_price),
                str(item.volume),
                int(item.close_time.timestamp() * 1000),
                0, 0, 0, 0  # 其他欄位
            ])
        
        return data
        
    except Exception as e:
        logger.error(f"從資料庫獲取資料失敗: {e}")
        raise HTTPException(status_code=500, detail=f"資料庫查詢失敗: {str(e)}")
    finally:
        session.close()

def generate_from_base_data(base_data: List[List], target_interval: str) -> List[List]:
    """從基礎資料生成其他時間間隔的資料"""
    if not base_data:
        return []
    
    interval_ms = get_interval_milliseconds(target_interval)
    groups = {}
    
    # 按目標時間間隔分組
    for item in base_data:
        open_time = int(item[0])
        group_key = (open_time // interval_ms) * interval_ms
        
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(item)
    
    # 生成 OHLCV 資料
    result = []
    for group_key in sorted(groups.keys()):
        group = groups[group_key]
        if not group:
            continue
            
        open_price = float(group[0][1])
        close_price = float(group[-1][4])
        high_price = max(float(item[2]) for item in group)
        low_price = min(float(item[3]) for item in group)
        volume = sum(float(item[5]) for item in group)
        
        result.append([
            group_key,
            str(open_price),
            str(high_price),
            str(low_price),
            str(close_price),
            str(volume),
            group_key + interval_ms - 1000,
            0, 0, 0, 0
        ])
    
    return result

# API 端點
@app.get("/api/klines")
async def get_klines(
    symbol: str = Query(..., description="交易對符號"),
    interval: str = Query(..., description="時間間隔"),
    startTime: int = Query(..., description="開始時間戳"),
    endTime: int = Query(..., description="結束時間戳")
):
    """獲取 K線資料 API"""
    try:
        # 對於 5m 和 1h，直接處理
        if interval in ['5m', '1h']:
            # 1. 從 Binance 獲取完整資料
            logger.info(f"正在從 Binance 獲取 {symbol} {interval} 的最新資料...")
            binance_data = fetch_from_binance(symbol, interval, startTime, endTime)
            
            # 2. 將新資料存入資料庫 (會自動忽略重複項)
            if binance_data:
                save_to_database(symbol, interval, binance_data)
            
            # 3. 從資料庫讀取完整且排序好的資料返回
            logger.info(f"正在從資料庫讀取 {symbol} {interval} 的完整資料...")
            data = get_from_database(symbol, interval, startTime, endTime)
        
        # 對於 15m，從 5m 資料生成
        elif interval == '15m':
            # 1. 確保 5m 的基礎資料是最新的
            logger.info(f"正在從 Binance 獲取 {symbol} 5m 的最新基礎資料...")
            base_data = fetch_from_binance(symbol, '5m', startTime, endTime)
            # 2. 存儲 5m 的資料
            if base_data:
                save_to_database(symbol, '5m', base_data)
            # 3. 從資料庫讀取完整的 5m 資料
            logger.info(f"正在從資料庫讀取 {symbol} 5m 的完整資料以生成 {interval}...")
            base_data = get_from_database(symbol, '5m', startTime, endTime)
            # 4. 生成 15m 資料
            logger.info(f"正在從 5m 資料生成 {symbol} {interval} 資料...")
            data = generate_from_base_data(base_data, interval)
        
        # 對於 4h，從 1h 資料生成
        elif interval == '4h':
            # 1. 確保 1h 的基礎資料是最新的
            logger.info(f"正在從 Binance 獲取 {symbol} 1h 的最新基礎資料...")
            base_data = fetch_from_binance(symbol, '1h', startTime, endTime)
            # 2. 存儲 1h 的資料
            if base_data:
                save_to_database(symbol, '1h', base_data)
            # 3. 從資料庫讀取完整的 1h 資料
            logger.info(f"正在從資料庫讀取 {symbol} 1h 的完整資料以生成 {interval}...")
            base_data = get_from_database(symbol, '1h', startTime, endTime)
            # 4. 生成 4h 資料
            logger.info(f"正在從 1h 資料生成 {symbol} {interval} 資料...")
            data = generate_from_base_data(base_data, interval)
        
        # 對於 1d 和 1w，從 1h 資料生成
        else:
            # 1. 確保 1h 的基礎資料是最新的
            logger.info(f"正在從 Binance 獲取 {symbol} 1h 的最新基礎資料...")
            hourly_data = fetch_from_binance(symbol, '1h', startTime, endTime)

            # 2. 存儲 1h 的資料
            if hourly_data:
                save_to_database(symbol, '1h', hourly_data)

            # 3. 從資料庫讀取完整的 1h 資料
            logger.info(f"正在從資料庫讀取 {symbol} 1h 的完整資料以生成 {interval}...")
            base_data = get_from_database(symbol, '1h', startTime, endTime)

            # 4. 生成目標時間間隔的資料
            logger.info(f"正在從 1h 資料生成 {symbol} {interval} 資料...")
            data = generate_from_base_data(base_data, interval)
        
        logger.info(f"請求完成，返回 {len(data)} 筆資料。")
        return data
        
    except Exception as e:
        logger.error(f"API 錯誤: {e}")
        raise HTTPException(status_code=500, detail="內部伺服器錯誤")

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """健康檢查"""
    try:
        session = SessionLocal()
        session.execute(text('SELECT 1'))
        session.close()
        return HealthResponse(status="OK", database="connected")
    except Exception as e:
        return HealthResponse(status="ERROR", database="disconnected", error=str(e))

@app.get("/api/symbols", response_model=List[SymbolResponse])
async def get_symbols():
    """獲取支援的幣種列表"""
    symbols = [
        SymbolResponse(value="BTCUSDT", label="BTC/USDT"),
        SymbolResponse(value="ETHUSDT", label="ETH/USDT"),
        SymbolResponse(value="BNBUSDT", label="BNB/USDT"),
        SymbolResponse(value="ADAUSDT", label="ADA/USDT"),
        SymbolResponse(value="SOLUSDT", label="SOL/USDT")
    ]
    return symbols

@app.get("/api/intervals", response_model=List[IntervalResponse])
async def get_intervals():
    """獲取支援的時間間隔"""
    intervals = [
        IntervalResponse(value="5m", label="5分鐘"),
        IntervalResponse(value="15m", label="15分鐘"),
        IntervalResponse(value="1h", label="1小時"),
        IntervalResponse(value="4h", label="4小時"),
        IntervalResponse(value="1d", label="1天"),
        IntervalResponse(value="1w", label="1週")
    ]
    return intervals

if __name__ == "__main__":
    # 建立索引
    try:
        session = SessionLocal()
        session.execute(text('CREATE INDEX IF NOT EXISTS idx_kline5m_symbol_time ON kline5m(symbol, open_time)'))
        session.execute(text('CREATE INDEX IF NOT EXISTS idx_kline1h_symbol_time ON kline1h(symbol, open_time)'))
        session.commit()
        session.close()
        logger.info("資料庫索引建立完成")
    except Exception as e:
        logger.error(f"建立索引失敗: {e}")
    
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000, log_level="info")