# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cryptocurrency K-line (candlestick) chart player application with a FastAPI (Python) backend and React (TypeScript) frontend. The system intelligently stores data in PostgreSQL and fetches from Binance API when needed.

## Development Commands

### Backend (Python FastAPI)
```bash
# Start backend server (runs on port 5000)
python app.py

# Install dependencies
pip install -r requirements.txt

# Production deployment with Gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Frontend (React + Vite)
```bash
# Development server (runs on port 5173)
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Lint code
cd frontend && npm run lint

# Preview production build
cd frontend && npm run preview

# Install dependencies
cd frontend && npm install
```

## Architecture

### Backend Structure
- **Framework**: FastAPI with SQLAlchemy ORM
- **Database**: PostgreSQL with two main tables:
  - `kline5m`: 5-minute candlestick data
  - `kline1h`: 1-hour candlestick data
- **API Integration**: Binance API for fetching historical data
- **Data Strategy**: Database-first approach - check PostgreSQL first, fetch from Binance API only if data doesn't exist

### Frontend Structure
- **Framework**: React 19 with TypeScript and Vite
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Charts**: Chart.js with react-chartjs-2 and chartjs-chart-financial for candlestick charts
- **Styling**: Tailwind CSS with custom configuration

### Key Components
- `App.tsx`: Main application component with legacy inline logic
- `ControlPanel.tsx`: Parameter selection interface (symbol, interval, time range, speed)
- `PlayerControls.tsx`: Play/pause/stop/reset controls with progress bar
- `KlineChart.tsx`: Chart.js wrapper for displaying candlestick charts
- `useKlinePlayer.ts`: Modern React hook containing the core player logic

### Data Flow
1. User selects parameters in ControlPanel
2. Backend checks PostgreSQL for existing data
3. If data missing, fetches from Binance API and stores in database
4. Frontend receives data and initializes player
5. Player progressively displays candlestick data with configurable speed (1x-10x)

## Environment Configuration

Required `.env` file in root directory:
```env
postgreSQL_user=your_username
postgreSQL_pass=your_password
DB_HOST=61.218.12.227
DB_PORT=5432
DB_NAME=trade
```

## API Endpoints

- `GET /api/klines` - Fetch K-line data (symbol, interval, startTime, endTime)
- `GET /api/symbols` - Get supported cryptocurrency symbols
- `GET /api/intervals` - Get supported time intervals
- `GET /api/health` - Database health check

## Development Notes

### Data Aggregation Logic
- 5m and 1h data: Stored directly in database
- 1d and 1w data: Dynamically calculated from 1h data in backend
- Unique constraints prevent duplicate data insertion

### Frontend State Management
The project is transitioning from inline state management in `App.tsx` to the cleaner `useKlinePlayer` hook. New features should use the hook-based approach.

### Chart Integration
Uses Chart.js with financial chart plugin for OHLC (Open, High, Low, Close) candlestick visualization. The chart supports zoom and pan interactions via chartjs-plugin-zoom.

### Supported Assets
- BTC (Bitcoin)
- ETH (Ethereum)  
- BNB (Binance Coin)
- ADA (Cardano)
- SOL (Solana)

All symbols use USDT trading pairs (e.g., BTCUSDT, ETHUSDT).