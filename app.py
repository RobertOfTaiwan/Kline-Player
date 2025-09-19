from fastapi import FastAPI, HTTPException, Query, Depends, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Numeric, text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
from decimal import Decimal
import os
import logging
import requests
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, EmailStr
from apscheduler.schedulers.background import BackgroundScheduler
import numpy as np
import atexit
from passlib.context import CryptContext
from jose import JWTError, jwt
import pyotp
import qrcode
from io import BytesIO
import base64
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from enum import Enum
import psutil
import subprocess

# 載入環境變數
load_dotenv()

# 建立 FastAPI 應用程式
app = FastAPI(title="Kline Chart API", version="1.0.0", description="加密貨幣 K線圖 API")

# 設定 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://localhost:5176", "http://localhost:5177"],
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

# 初始化背景排程器
scheduler = BackgroundScheduler()
atexit.register(lambda: scheduler.shutdown())

# 全局變數：存儲最新價格數據
latest_prices = {}  # 格式: {symbol: {'price': float, 'timestamp': datetime, 'open_time': datetime}}

def init_latest_prices():
    """從資料庫初始化最新價格數據"""
    global latest_prices
    logger.info("正在從資料庫初始化最新價格數據...")
    
    try:
        session = SessionLocal()
        
        # 獲取所有活躍的交易對
        symbols = session.query(Symbol).filter(Symbol.is_active == True).all()
        
        for symbol in symbols:
            try:
                # 從 5m 資料表獲取最新價格
                latest_5m = session.query(Kline5m).filter(
                    Kline5m.symbol == symbol.symbol
                ).order_by(Kline5m.open_time.desc()).first()
                
                if latest_5m:
                    latest_prices[symbol.symbol] = {
                        'price': float(latest_5m.close_price),
                        'timestamp': datetime.now(),
                        'open_time': latest_5m.open_time
                    }
                    logger.debug(f"初始化 {symbol.symbol} 價格: {latest_5m.close_price}")
            
            except Exception as e:
                logger.error(f"初始化 {symbol.symbol} 價格失敗: {e}")
                continue
        
        session.close()
        logger.info(f"成功初始化 {len(latest_prices)} 個交易對的價格數據")
        
    except Exception as e:
        logger.error(f"初始化最新價格數據失敗: {e}")
        latest_prices = {}

# 認證配置
SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-change-this-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 郵件設定
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USERNAME)

# 密碼加密
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Bearer
security = HTTPBearer()

# 用戶角色枚舉
class UserRole(str, Enum):
    GUEST = "guest"           # 一般使用者(未註冊者)
    USER = "user"             # 已註冊且被核可者
    ADMIN = "admin"           # 管理者

# 定義數據模型
class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    otp_secret = Column(String(32), nullable=False)
    role = Column(String(20), default=UserRole.USER)
    is_approved = Column(Boolean, default=False)
    login_count = Column(Integer, default=0)
    last_login_date = Column(DateTime)
    last_login_ip = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = {'extend_existing': True}

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

class Kline1d(Base):
    __tablename__ = 'kline1d'

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

class Symbol(Base):
    __tablename__ = 'symbols'

    id = Column(Integer, primary_key=True)
    symbol = Column(String(20), nullable=False, unique=True)
    name = Column(String(50), nullable=False)
    base_asset = Column(String(10), nullable=False)
    quote_asset = Column(String(10), nullable=False)
    is_active = Column(Boolean, default=True)
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

class LivePriceResponse(BaseModel):
    symbol: str
    label: str
    price: float
    update_time: str
    kline_time: str

class MovingAverageRequest(BaseModel):
    symbol: str
    interval: str
    period: int
    ma_type: str  # 'SMA', 'EMA', 'VWMA'
    startTime: int
    endTime: int

class MovingAverageResponse(BaseModel):
    timestamp: int
    value: float

# 用戶相關 Pydantic 模型
class UserRegister(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    otp_code: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_approved: bool
    login_count: int
    last_login_date: Optional[datetime]
    last_login_ip: Optional[str]
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

# 交易對管理相關 Pydantic 模型
class SymbolAdminResponse(BaseModel):
    id: int
    symbol: str
    name: str
    base_asset: str
    quote_asset: str
    is_active: bool
    created_at: datetime

class SymbolCreate(BaseModel):
    symbol: str
    name: str
    base_asset: str
    quote_asset: str

class SymbolUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class OTPQRResponse(BaseModel):
    qr_code: str  # base64 編碼的 QR code 圖片
    secret_key: str

class RegisterResponse(BaseModel):
    message: str
    email_sent: bool

# 創建資料表
Base.metadata.create_all(bind=engine)

# 認證和OTP輔助函數
def get_password_hash(password: str) -> str:
    """加密密碼"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """驗證密碼"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """創建JWT訪問令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_otp_secret() -> str:
    """生成OTP密鑰"""
    return pyotp.random_base32()

def generate_qr_code(email: str, secret: str) -> str:
    """生成QR碼給Google Authenticator使用"""
    # 創建TOTP URI
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name="Kline Player"
    )

    # 生成QR碼
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)

    # 轉換為圖片
    img = qr.make_image(fill_color="black", back_color="white")

    # 轉換為base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()

    return f"data:image/png;base64,{img_str}"

async def send_email(to_email: str, subject: str, html_content: str):
    """發送郵件"""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured, skipping email send")
        return False

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = FROM_EMAIL
    msg['To'] = to_email

    html_part = MIMEText(html_content, 'html')
    msg.attach(html_part)

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_SERVER,
            port=SMTP_PORT,
            start_tls=True,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
        )
        logger.info(f"郵件發送成功: {to_email}")
        return True
    except Exception as e:
        logger.error(f"郵件發送失敗: {e}")
        return False

def generate_registration_email_html(name: str, secret: str, qr_code: str) -> str:
    """生成註冊確認郵件的HTML內容"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>K線播放器 - 註冊確認</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb; text-align: center;">歡迎使用 K線播放器！</h1>

            <p>親愛的 {name}，</p>

            <p>感謝您註冊 K線播放器帳號！為了保障您的帳號安全，我們採用雙因子認證（2FA）機制。</p>

            <h2 style="color: #2563eb;">設定 Google Authenticator</h2>

            <p>請按照以下步驟設定您的 Google Authenticator：</p>

            <ol>
                <li>在您的手機上下載並安裝 <strong>Google Authenticator</strong> 應用程式</li>
                <li>打開應用程式，點擊「新增帳號」或「+」按鈕</li>
                <li>選擇「掃描 QR 碼」，然後掃描下方的 QR 碼</li>
            </ol>

            <div style="text-align: center; margin: 20px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                <img src="{qr_code}" alt="Google Authenticator QR Code" style="max-width: 300px;">
            </div>

            <h3 style="color: #2563eb;">手動設定密鑰</h3>
            <p>如果無法掃描 QR 碼，您也可以手動輸入以下密鑰：</p>
            <div style="background-color: #f1f5f9; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 16px; text-align: center; word-break: break-all;">
                {secret}
            </div>

            <div style="margin-top: 30px; padding: 15px; background-color: #fef3cd; border-left: 4px solid #fbbf24; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #92400e;">重要提醒：</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>請務必保存好此密鑰，遺失後將無法恢復</li>
                    <li>每次登入都需要提供 Google Authenticator 驗證碼</li>
                    <li>請確保您的裝置時間正確，否則驗證碼可能無效</li>
                </ul>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <p>設定完成後，您就可以使用帳號登入 K線播放器了！</p>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

            <div style="text-align: center; color: #6b7280; font-size: 14px;">
                <p>此郵件由 K線播放器 系統自動發送，請勿回覆。</p>
                <p>如有疑問，請聯繫系統管理員。</p>
            </div>
        </div>
    </body>
    </html>
    """

def verify_otp(secret: str, otp_code: str) -> bool:
    """驗證OTP碼"""
    totp = pyotp.TOTP(secret)
    return totp.verify(otp_code)

def get_db():
    """獲取資料庫會話"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """獲取當前用戶"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user

def require_role(required_roles: List[UserRole]):
    """角色權限檢查裝飾器"""
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        if current_user.role == UserRole.USER and not current_user.is_approved:
            raise HTTPException(status_code=403, detail="User account not approved")
        return current_user
    return role_checker

def get_client_ip(request):
    """獲取客戶端IP地址"""
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host

# 初始化 symbols 資料
def init_symbols():
    """初始化幣種資料表"""
    try:
        session = SessionLocal()

        # 檢查是否已有資料
        if session.query(Symbol).count() > 0:
            session.close()
            return

        # 添加預設幣種
        default_symbols = [
            {'symbol': 'BTCUSDT', 'name': 'Bitcoin', 'base_asset': 'BTC', 'quote_asset': 'USDT'},
            {'symbol': 'ETHUSDT', 'name': 'Ethereum', 'base_asset': 'ETH', 'quote_asset': 'USDT'},
            {'symbol': 'SOLUSDT', 'name': 'Solana', 'base_asset': 'SOL', 'quote_asset': 'USDT'}
        ]

        for sym in default_symbols:
            symbol = Symbol(**sym)
            session.add(symbol)

        session.commit()
        logger.info("成功初始化 symbols 資料表")

    except Exception as e:
        session.rollback()
        logger.error(f"初始化 symbols 資料表失敗: {e}")
    finally:
        session.close()

def init_admin_user():
    """初始化管理員用戶"""
    try:
        session = SessionLocal()

        # 檢查是否已有管理員
        admin_exists = session.query(User).filter(User.role == UserRole.ADMIN).first()
        if admin_exists:
            session.close()
            return

        # 創建預設管理員
        admin_email = "admin@klineplayer.com"
        admin_password = "admin123"  # 實際部署時應該改為更安全的密碼
        admin_otp_secret = generate_otp_secret()

        admin_user = User(
            email=admin_email,
            name="Administrator",
            password_hash=get_password_hash(admin_password),
            otp_secret=admin_otp_secret,
            role=UserRole.ADMIN,
            is_approved=True
        )

        session.add(admin_user)
        session.commit()

        logger.info(f"成功創建管理員用戶: {admin_email}")
        logger.info(f"管理員OTP密鑰: {admin_otp_secret}")

    except Exception as e:
        session.rollback()
        logger.error(f"初始化管理員用戶失敗: {e}")
    finally:
        session.close()

# 移動平均線計算函數
def calculate_sma(prices: List[float], period: int) -> List[Optional[float]]:
    """計算簡單移動平均線 (SMA)"""
    if len(prices) < period:
        return [None] * len(prices)

    sma_values = []
    for i in range(len(prices)):
        if i < period - 1:
            sma_values.append(None)
        else:
            sma = sum(prices[i - period + 1:i + 1]) / period
            sma_values.append(sma)

    return sma_values

def calculate_ema(prices: List[float], period: int) -> List[Optional[float]]:
    """計算指數移動平均線 (EMA)"""
    if len(prices) < period:
        return [None] * len(prices)

    multiplier = 2 / (period + 1)
    ema_values = []

    # 第一個 EMA 值使用 SMA
    sma = sum(prices[:period]) / period
    ema_values.extend([None] * (period - 1))
    ema_values.append(sma)

    # 後續 EMA 值
    for i in range(period, len(prices)):
        ema = (prices[i] * multiplier) + (ema_values[i - 1] * (1 - multiplier))
        ema_values.append(ema)

    return ema_values

def calculate_vwma(prices: List[float], volumes: List[float], period: int) -> List[Optional[float]]:
    """計算成交量加權移動平均線 (VWMA)"""
    if len(prices) < period or len(volumes) < period:
        return [None] * len(prices)

    vwma_values = []
    for i in range(len(prices)):
        if i < period - 1:
            vwma_values.append(None)
        else:
            price_volume_sum = sum(prices[j] * volumes[j] for j in range(i - period + 1, i + 1))
            volume_sum = sum(volumes[i - period + 1:i + 1])

            if volume_sum == 0:
                vwma_values.append(None)
            else:
                vwma = price_volume_sum / volume_sum
                vwma_values.append(vwma)

    return vwma_values

# 計算當前未完成蠟燭圖的函數
def calculate_current_candle_from_5m(symbol: str, target_interval: str) -> dict:
    """基於 5m 資料計算當前未完成的 1h 或 1d 蠟燭圖"""
    try:
        session = SessionLocal()

        # 獲取當前時間並計算目標時間間隔的開始時間
        now = datetime.utcnow()

        if target_interval == '1h':
            # 計算當前小時的開始時間 (例如 14:25 -> 14:00)
            current_period_start = now.replace(minute=0, second=0, microsecond=0)
            next_period_start = current_period_start + timedelta(hours=1)
        elif target_interval == '1d':
            # 計算當前日的開始時間 (00:00 UTC)
            current_period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            next_period_start = current_period_start + timedelta(days=1)
        else:
            raise ValueError(f"不支援的目標間隔: {target_interval}")

        # 獲取當前週期內的所有 5m 資料
        five_min_data = session.query(Kline5m).filter(
            Kline5m.symbol == symbol,
            Kline5m.open_time >= current_period_start,
            Kline5m.open_time < now
        ).order_by(Kline5m.open_time).all()

        session.close()

        if not five_min_data:
            return None

        # 計算 OHLCV
        open_price = five_min_data[0].open_price
        close_price = five_min_data[-1].close_price
        high_price = max(item.high_price for item in five_min_data)
        low_price = min(item.low_price for item in five_min_data)
        volume = sum(item.volume for item in five_min_data)

        # 計算關閉時間（未完成的蠟燭圖使用下一個週期開始時間-1ms）
        close_time = next_period_start - timedelta(milliseconds=1)

        return {
            'symbol': symbol,
            'open_time': current_period_start,
            'close_time': close_time,
            'open_price': open_price,
            'high_price': high_price,
            'low_price': low_price,
            'close_price': close_price,
            'volume': volume,
            'interval': target_interval
        }

    except Exception as e:
        logger.error(f"計算當前 {target_interval} 蠟燭圖失敗 {symbol}: {e}")
        return None

def upsert_candle_data(candle_data: dict):
    """插入或更新蠟燭圖資料"""
    try:
        session = SessionLocal()
        interval = candle_data['interval']

        if interval == '1h':
            model = Kline1h
        elif interval == '1d':
            model = Kline1d
        else:
            raise ValueError(f"不支援的間隔: {interval}")

        # 檢查是否已存在
        existing = session.query(model).filter_by(
            symbol=candle_data['symbol'],
            open_time=candle_data['open_time']
        ).first()

        if existing:
            # 更新現有記錄
            existing.close_time = candle_data['close_time']
            existing.open_price = candle_data['open_price']
            existing.high_price = candle_data['high_price']
            existing.low_price = candle_data['low_price']
            existing.close_price = candle_data['close_price']
            existing.volume = candle_data['volume']
            logger.info(f"更新 {candle_data['symbol']} {interval} 蠟燭圖: {candle_data['open_time']}")
        else:
            # 插入新記錄
            new_candle = model(
                symbol=candle_data['symbol'],
                open_time=candle_data['open_time'],
                close_time=candle_data['close_time'],
                open_price=candle_data['open_price'],
                high_price=candle_data['high_price'],
                low_price=candle_data['low_price'],
                close_price=candle_data['close_price'],
                volume=candle_data['volume']
            )
            session.add(new_candle)
            logger.info(f"插入 {candle_data['symbol']} {interval} 蠟燭圖: {candle_data['open_time']}")

        session.commit()
        session.close()

    except Exception as e:
        session.rollback()
        session.close()
        logger.error(f"更新蠟燭圖資料失敗: {e}")

# 背景資料更新函數
def update_latest_data():
    """背景更新最新的 K線資料"""
    try:
        session = SessionLocal()
        symbols = session.query(Symbol).filter(Symbol.is_active == True).all()
        session.close()

        for symbol in symbols:
            for interval in ['5m', '1h', '1d']:
                try:
                    # 獲取最新時間戳
                    session = SessionLocal()
                    if interval == '5m':
                        model = Kline5m
                    elif interval == '1h':
                        model = Kline1h
                    elif interval == '1d':
                        model = Kline1d

                    latest_record = session.query(model).filter_by(symbol=symbol.symbol).order_by(model.open_time.desc()).first()

                    if latest_record:
                        start_time = int(latest_record.close_time.timestamp() * 1000) + 1
                    else:
                        # 如果沒有記錄，從 24 小時前開始
                        start_time = int((datetime.utcnow().timestamp() - 24 * 3600) * 1000)

                    end_time = int(datetime.utcnow().timestamp() * 1000)
                    session.close()

                    # 從 Binance 獲取最新資料
                    new_data = fetch_from_binance(symbol.symbol, interval, start_time, end_time)

                    if new_data:
                        save_to_database(symbol.symbol, interval, new_data)
                        logger.info(f"背景更新: 已取得 {len(new_data)} 筆 {symbol.symbol} {interval} 最新資料")
                        
                        # 如果是5分鐘數據，更新內存中的最新價格
                        if interval == '5m' and new_data:
                            latest_kline = new_data[-1]  # 獲取最新的K線數據
                            latest_prices[symbol.symbol] = {
                                'price': float(latest_kline[4]),  # 收盤價
                                'timestamp': datetime.utcnow(),  # 更新時間
                                'open_time': datetime.fromtimestamp(latest_kline[0] / 1000)  # K線開盤時間
                            }
                            logger.info(f"更新內存價格: {symbol.symbol} = {latest_prices[symbol.symbol]['price']}")

                except Exception as e:
                    logger.error(f"背景更新 {symbol.symbol} {interval} 失敗: {e}")

        # 2. 計算和更新當前未完成的 1h 和 1d 蠟燭圖（基於 5m 資料）
        logger.info("開始更新當前未完成的 1h 和 1d 蠟燭圖...")
        for symbol in symbols:
            try:
                # 計算並更新當前 1h 蠟燭圖
                current_1h_candle = calculate_current_candle_from_5m(symbol.symbol, '1h')
                if current_1h_candle:
                    upsert_candle_data(current_1h_candle)

                # 計算並更新當前 1d 蠟燭圖
                current_1d_candle = calculate_current_candle_from_5m(symbol.symbol, '1d')
                if current_1d_candle:
                    upsert_candle_data(current_1d_candle)

            except Exception as e:
                logger.error(f"更新當前蠟燭圖失敗 {symbol.symbol}: {e}")

        logger.info("背景資料更新完成")

    except Exception as e:
        logger.error(f"背景資料更新失敗: {e}")

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
        if interval == '5m':
            model = Kline5m
        elif interval == '1h':
            model = Kline1h
        elif interval == '1d':
            model = Kline1d
        else:
            raise ValueError(f"不支援的時間間隔: {interval}")
        
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
        if interval == '5m':
            model = Kline5m
        elif interval == '1h':
            model = Kline1h
        elif interval == '1d':
            model = Kline1d
        else:
            raise ValueError(f"不支援的時間間隔: {interval}")
        
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
        # 對於 5m、1h 和 1d，直接處理
        if interval in ['5m', '1h', '1d']:
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
        
        # 對於 1w，從 1d 資料生成
        elif interval == '1w':
            # 1. 確保 1d 的基礎資料是最新的
            logger.info(f"正在從 Binance 獲取 {symbol} 1d 的最新基礎資料...")
            daily_data = fetch_from_binance(symbol, '1d', startTime, endTime)

            # 2. 存儲 1d 的資料
            if daily_data:
                save_to_database(symbol, '1d', daily_data)

            # 3. 從資料庫讀取完整的 1d 資料
            logger.info(f"正在從資料庫讀取 {symbol} 1d 的完整資料以生成 {interval}...")
            base_data = get_from_database(symbol, '1d', startTime, endTime)

            # 4. 生成目標時間間隔的資料
            logger.info(f"正在從 1d 資料生成 {symbol} {interval} 資料...")
            data = generate_from_base_data(base_data, interval)

        # 其他不支援的間隔
        else:
            raise HTTPException(status_code=400, detail=f"不支援的時間間隔: {interval}")
        
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
    try:
        session = SessionLocal()
        db_symbols = session.query(Symbol).filter(Symbol.is_active == True).all()
        session.close()

        symbols = []
        for symbol in db_symbols:
            symbols.append(SymbolResponse(
                value=symbol.symbol,
                label=f"{symbol.base_asset}/{symbol.quote_asset}"
            ))

        return symbols

    except Exception as e:
        logger.error(f"獲取 symbols 失敗: {e}")
        # 如果資料庫查詢失敗，返回預設值
        return [
            SymbolResponse(value="BTCUSDT", label="BTC/USDT"),
            SymbolResponse(value="ETHUSDT", label="ETH/USDT"),
            SymbolResponse(value="SOLUSDT", label="SOL/USDT")
        ]

@app.get("/api/live-prices", response_model=List[LivePriceResponse])
async def get_live_prices():
    """獲取實時價格數據（從內存中獲取，不查詢資料庫）"""
    try:
        session = SessionLocal()
        db_symbols = session.query(Symbol).filter(Symbol.is_active == True).all()
        session.close()

        live_prices = []
        for symbol in db_symbols:
            if symbol.symbol in latest_prices:
                price_data = latest_prices[symbol.symbol]
                live_prices.append(LivePriceResponse(
                    symbol=symbol.symbol,
                    label=f"{symbol.base_asset}/{symbol.quote_asset}",
                    price=price_data['price'],
                    update_time=price_data['timestamp'].isoformat(),
                    kline_time=price_data['open_time'].isoformat()
                ))
            else:
                # 如果內存中沒有價格數據，返回預設值
                live_prices.append(LivePriceResponse(
                    symbol=symbol.symbol,
                    label=f"{symbol.base_asset}/{symbol.quote_asset}",
                    price=0.0,
                    update_time="--:--:--",
                    kline_time="--:--:--"
                ))

        return live_prices

    except Exception as e:
        logger.error(f"獲取實時價格失敗: {e}")
        # 如果查詢失敗，返回預設值
        return [
            LivePriceResponse(symbol="BTCUSDT", label="BTC/USDT", price=0.0, update_time="--:--:--", kline_time="--:--:--"),
            LivePriceResponse(symbol="ETHUSDT", label="ETH/USDT", price=0.0, update_time="--:--:--", kline_time="--:--:--"),
            LivePriceResponse(symbol="SOLUSDT", label="SOL/USDT", price=0.0, update_time="--:--:--", kline_time="--:--:--")
        ]

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

# 用戶管理 API
@app.post("/api/auth/register", response_model=RegisterResponse)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """用戶註冊"""
    # 檢查郵箱是否已存在
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 生成OTP密鑰
    otp_secret = generate_otp_secret()

    # 創建用戶
    new_user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=get_password_hash(user_data.password),
        otp_secret=otp_secret,
        role=UserRole.USER,
        is_approved=False
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 生成QR碼
    qr_code = generate_qr_code(user_data.email, otp_secret)

    # 發送註冊確認郵件
    email_html = generate_registration_email_html(user_data.name, otp_secret, qr_code)
    email_sent = await send_email(
        to_email=user_data.email,
        subject="K線播放器 - 註冊確認及 Google Authenticator 設定",
        html_content=email_html
    )

    logger.info(f"用戶註冊成功: {user_data.email}, 郵件發送: {email_sent}")

    return RegisterResponse(
        message="註冊成功！請檢查您的郵箱以完成 Google Authenticator 設定。" if email_sent else "註冊成功！但郵件發送失敗，請聯繫管理員獲取設定信息。",
        email_sent=email_sent
    )


@app.post("/api/auth/login", response_model=Token)
async def login(request: Request, user_login: UserLogin, db: Session = Depends(get_db)):
    """用戶登入"""
    # 驗證用戶
    user = db.query(User).filter(User.email == user_login.email).first()
    if not user or not verify_password(user_login.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # 驗證OTP
    if not verify_otp(user.otp_secret, user_login.otp_code):
        raise HTTPException(status_code=401, detail="Invalid OTP code")

    # 檢查是否被核可（管理員不需要核可）
    if user.role == UserRole.USER and not user.is_approved:
        raise HTTPException(status_code=403, detail="Account not approved. Please wait for admin approval.")

    # 更新登入資訊
    client_ip = get_client_ip(request)
    user.login_count += 1
    user.last_login_date = datetime.utcnow()
    user.last_login_ip = client_ip
    db.commit()

    # 創建訪問令牌
    access_token = create_access_token(data={"sub": str(user.id)})

    logger.info(f"用戶登入成功: {user.email} from {client_ip}")

    return Token(access_token=access_token, token_type="bearer")

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """獲取當前用戶資訊"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        is_approved=current_user.is_approved,
        login_count=current_user.login_count,
        last_login_date=current_user.last_login_date,
        last_login_ip=current_user.last_login_ip,
        created_at=current_user.created_at
    )

# 管理員 API
@app.get("/api/admin/users", response_model=List[UserResponse])
async def get_all_users(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """獲取所有用戶列表"""
    users = db.query(User).all()
    return [UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_approved=user.is_approved,
        login_count=user.login_count,
        last_login_date=user.last_login_date,
        last_login_ip=user.last_login_ip,
        created_at=user.created_at
    ) for user in users]

@app.put("/api/admin/users/{user_id}/approve")
async def approve_user(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """核可用戶"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_approved = True
    user.updated_at = datetime.utcnow()
    db.commit()

    logger.info(f"用戶 {user.email} 已被 {current_user.email} 核可")

    return {"message": "User approved successfully"}

@app.put("/api/admin/users/{user_id}/reject")
async def reject_user(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """拒絕核可用戶"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_approved = False
    user.updated_at = datetime.utcnow()
    db.commit()

    logger.info(f"用戶 {user.email} 已被 {current_user.email} 拒絕核可")

    return {"message": "User approval rejected"}

@app.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """刪除用戶"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete admin user")

    db.delete(user)
    db.commit()

    logger.info(f"用戶 {user.email} 已被 {current_user.email} 刪除")

    return {"message": "User deleted successfully"}

@app.post("/api/admin/users/{user_id}/regenerate-otp", response_model=OTPQRResponse)
async def regenerate_otp(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """重新生成用戶OTP密鑰"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 生成新的OTP密鑰
    new_otp_secret = generate_otp_secret()
    user.otp_secret = new_otp_secret
    user.updated_at = datetime.utcnow()
    db.commit()

    # 生成新的QR碼
    qr_code = generate_qr_code(user.email, new_otp_secret)

    logger.info(f"用戶 {user.email} 的OTP密鑰已被 {current_user.email} 重新生成")

    return OTPQRResponse(qr_code=qr_code, secret_key=new_otp_secret)

# 交易對管理 API
@app.get("/api/admin/symbols", response_model=List[SymbolAdminResponse])
async def get_admin_symbols(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """獲取所有交易對列表（管理員）"""
    symbols = db.query(Symbol).order_by(Symbol.symbol).all()
    return [SymbolAdminResponse(
        id=symbol.id,
        symbol=symbol.symbol,
        name=symbol.name,
        base_asset=symbol.base_asset,
        quote_asset=symbol.quote_asset,
        is_active=symbol.is_active,
        created_at=symbol.created_at
    ) for symbol in symbols]

@app.post("/api/admin/symbols", response_model=SymbolAdminResponse)
async def create_symbol(
    symbol_data: SymbolCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """創建新交易對"""
    # 檢查交易對是否已存在
    existing_symbol = db.query(Symbol).filter(Symbol.symbol == symbol_data.symbol).first()
    if existing_symbol:
        raise HTTPException(status_code=400, detail="Symbol already exists")

    new_symbol = Symbol(
        symbol=symbol_data.symbol.upper(),
        name=symbol_data.name,
        base_asset=symbol_data.base_asset.upper(),
        quote_asset=symbol_data.quote_asset.upper(),
        is_active=True
    )

    db.add(new_symbol)
    db.commit()
    db.refresh(new_symbol)

    logger.info(f"交易對 {symbol_data.symbol} 已被 {current_user.email} 創建")

    return SymbolAdminResponse(
        id=new_symbol.id,
        symbol=new_symbol.symbol,
        name=new_symbol.name,
        base_asset=new_symbol.base_asset,
        quote_asset=new_symbol.quote_asset,
        is_active=new_symbol.is_active,
        created_at=new_symbol.created_at
    )

@app.patch("/api/admin/symbols/{symbol_id}")
async def update_symbol(
    symbol_id: int,
    symbol_data: SymbolUpdate,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """更新交易對"""
    symbol = db.query(Symbol).filter(Symbol.id == symbol_id).first()
    if not symbol:
        raise HTTPException(status_code=404, detail="Symbol not found")

    if symbol_data.name is not None:
        symbol.name = symbol_data.name
    if symbol_data.is_active is not None:
        symbol.is_active = symbol_data.is_active

    db.commit()

    logger.info(f"交易對 {symbol.symbol} 已被 {current_user.email} 更新")

    return {"message": "Symbol updated successfully"}

@app.delete("/api/admin/symbols/{symbol_id}")
async def delete_symbol(
    symbol_id: int,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """刪除交易對"""
    symbol = db.query(Symbol).filter(Symbol.id == symbol_id).first()
    if not symbol:
        raise HTTPException(status_code=404, detail="Symbol not found")

    db.delete(symbol)
    db.commit()

    logger.info(f"交易對 {symbol.symbol} 已被 {current_user.email} 刪除")

    return {"message": "Symbol deleted successfully"}

@app.get("/api/moving-average", response_model=List[MovingAverageResponse])
async def get_moving_average(
    symbol: str = Query(..., description="交易對符號"),
    interval: str = Query(..., description="時間間隔"),
    period: int = Query(..., description="移動平均週期"),
    ma_type: str = Query(..., description="移動平均類型 (SMA/EMA/VWMA)"),
    startTime: int = Query(..., description="開始時間戳"),
    endTime: int = Query(..., description="結束時間戳")
):
    """獲取移動平均線資料"""
    try:
        # 為了計算移動平均線，需要額外獲取歷史資料
        extended_start_time = startTime
        if interval in ['5m', '1h']:
            # 根據週期和間隔計算需要的額外資料量
            interval_ms = get_interval_milliseconds(interval)
            extended_start_time = startTime - (period * interval_ms)

        # 獲取擴展的 K線資料
        if interval in ['5m', '1h', '1d']:
            # 確保有最新資料
            binance_data = fetch_from_binance(symbol, interval, extended_start_time, endTime)
            if binance_data:
                save_to_database(symbol, interval, binance_data)
            data = get_from_database(symbol, interval, extended_start_time, endTime)

        elif interval == '15m':
            base_data = fetch_from_binance(symbol, '5m', extended_start_time, endTime)
            if base_data:
                save_to_database(symbol, '5m', base_data)
            base_data = get_from_database(symbol, '5m', extended_start_time, endTime)
            data = generate_from_base_data(base_data, interval)

        elif interval == '4h':
            base_data = fetch_from_binance(symbol, '1h', extended_start_time, endTime)
            if base_data:
                save_to_database(symbol, '1h', base_data)
            base_data = get_from_database(symbol, '1h', extended_start_time, endTime)
            data = generate_from_base_data(base_data, interval)

        elif interval == '1w':  # 1w 使用 1d 資料
            daily_data = fetch_from_binance(symbol, '1d', extended_start_time, endTime)
            if daily_data:
                save_to_database(symbol, '1d', daily_data)
            base_data = get_from_database(symbol, '1d', extended_start_time, endTime)
            data = generate_from_base_data(base_data, interval)

        else:
            raise HTTPException(status_code=400, detail=f"不支援的時間間隔: {interval}")

        if not data:
            raise HTTPException(status_code=404, detail="無法獲取足夠的資料來計算移動平均線")

        # 提取價格和成交量
        timestamps = [int(item[0]) for item in data]
        close_prices = [float(item[4]) for item in data]
        volumes = [float(item[5]) for item in data]

        # 計算移動平均線
        if ma_type.upper() == 'SMA':
            ma_values = calculate_sma(close_prices, period)
        elif ma_type.upper() == 'EMA':
            ma_values = calculate_ema(close_prices, period)
        elif ma_type.upper() == 'VWMA':
            ma_values = calculate_vwma(close_prices, volumes, period)
        else:
            raise HTTPException(status_code=400, detail="不支援的移動平均類型，支援的類型: SMA, EMA, VWMA")

        # 只返回請求時間範圍內的資料
        result = []
        for i, (timestamp, ma_value) in enumerate(zip(timestamps, ma_values)):
            if startTime <= timestamp <= endTime and ma_value is not None:
                result.append(MovingAverageResponse(
                    timestamp=timestamp,
                    value=ma_value
                ))

        logger.info(f"返回 {len(result)} 個 {ma_type.upper()}{period} 移動平均值")
        return result

    except Exception as e:
        logger.error(f"計算移動平均線失敗: {e}")
        raise HTTPException(status_code=500, detail=f"計算移動平均線失敗: {str(e)}")

if __name__ == "__main__":
    # 初始化 symbols 資料
    init_symbols()

    # 初始化管理員用戶
    init_admin_user()

    # 初始化最新價格數據
    init_latest_prices()

    # 建立索引
    try:
        session = SessionLocal()
        session.execute(text('CREATE INDEX IF NOT EXISTS idx_kline5m_symbol_time ON kline5m(symbol, open_time)'))
        session.execute(text('CREATE INDEX IF NOT EXISTS idx_kline1h_symbol_time ON kline1h(symbol, open_time)'))
        session.execute(text('CREATE INDEX IF NOT EXISTS idx_kline1d_symbol_time ON kline1d(symbol, open_time)'))
        session.execute(text('CREATE INDEX IF NOT EXISTS idx_symbols_symbol ON symbols(symbol)'))
        session.execute(text('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'))
        session.execute(text('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)'))
        session.commit()
        session.close()
        logger.info("資料庫索引建立完成")
    except Exception as e:
        logger.error(f"建立索引失敗: {e}")

    # 設定背景排程更新資料 (每 5 分鐘執行一次)
    scheduler.add_job(
        func=update_latest_data,
        trigger="interval",
        minutes=5,
        id='update_latest_data',
        name='Update latest kline data',
        replace_existing=True
    )
    logger.info("背景排程已啟動，每 5 分鐘更新一次資料")

    # 啟動背景排程
    scheduler.start()
    
    # 立即執行一次資料更新
    try:
        update_latest_data()
        logger.info("初始資料更新完成")
    except Exception as e:
        logger.error(f"初始資料更新失敗: {e}")

    # 啟動 FastAPI 伺服器
    import uvicorn
    
    # 清理占用 port 5002 的進程
    port = 5002
    logger.info(f"檢查並清理占用 port {port} 的進程...")
    
    try:
        for proc in psutil.process_iter(['pid', 'name', 'connections']):
            try:
                connections = proc.info['connections']
                if connections:
                    for conn in connections:
                        if conn.laddr.port == port:
                            logger.info(f"發現進程 {proc.info['pid']} ({proc.info['name']}) 占用 port {port}")
                            proc.kill()
                            logger.info(f"已強制終止進程 {proc.info['pid']}")
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
    except Exception as e:
        logger.warning(f"清理 port 進程時發生錯誤: {e}")
    
    logger.info("正在啟動 FastAPI 伺服器...")
    logger.info("伺服器將運行在 http://127.0.0.1:5002")
    logger.info("按 Ctrl+C 停止伺服器")
    
    uvicorn.run(app, host="127.0.0.1", port=5002, log_level="info")