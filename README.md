# TradePulse

TradePulse is a full-stack paper trading and market simulation platform designed for Indian equity markets. It provides real-time simulated market price streaming via WebSockets, an interactive candlestick charting interface, multi-timeframe historical data analytics, watchlist management, and a virtual order execution engine with automated portfolio accounting.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [High-Level Architecture](#high-level-architecture)
- [Project Structure](#project-structure)
- [Authentication & Security](#authentication--security)
- [Paper Trading Engine](#paper-trading-engine)
- [Simulated Market Engine](#simulated-market-engine)
- [Instrument Universe](#instrument-universe)
- [Historical Data & Charting](#historical-data--charting)
- [Watchlist & Favorites](#watchlist--favorites)
- [Orders, Holdings & Positions](#orders-holdings--positions)
- [WebSocket Architecture](#websocket-architecture)
- [Database Models](#database-models)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
  - [Local Development Configuration](#local-development-configuration)
  - [Production Configuration](#production-configuration)
- [Local Setup Instructions](#local-setup-instructions)
- [Testing](#testing)
- [Production Deployment Considerations](#production-deployment-considerations)
- [Platform Limitations](#platform-limitations)

---

## Overview

TradePulse provides a realistic paper trading experience without financial risk. New user accounts are initialized with **₹100,000 in virtual funds**. Users can explore 46 Indian equity and index instruments, view real-time simulated market price updates, analyze interactive intraday and daily candlestick charts, place market and limit buy/sell orders, and monitor virtual portfolio performance, profit and loss (P&L), and margins.

---

## Key Features

- **Password and Email OTP Authentication**: User registration, email verification, and login authenticated via email One-Time Passwords (OTP).
- **Single-Use Password Reset**: Password recovery backed by server-tracked, single-use hashed reset authorization tokens.
- **Simulated Market Engine**: Authoritative backend price generator using a persistent, continuous random-walk model with momentum, sector-specific volatility profiles, and reference price anchor bounds.
- **Hierarchical Intraday Candles**: Real-time aggregation of underlying simulated price ticks into 1-minute (375 per session) and 15-minute (25 per session) candles for the Indian market session (09:15 to 15:30 IST).
- **Interactive Candlestick Charts**: Multi-timeframe chart visualization (`1H`, `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`) with volume bars, customizable intervals (`1m`, `15m`, `1D`), and data provenance badges (`SIMULATED • 1 MIN`, `SIMULATED • 15 MIN`, `YAHOO FINANCE • EOD`).
- **Unified Market State**: Single source of truth for market prices across Explore Stocks, My Favorites, Watchlist, Stock Detail header, order windows, and chart endpoints.
- **Watchlist & Favorites Sync**: Persistent per-user watchlists with drag-and-drop row reordering, immediate favorite toggling across views without page reloads, and user isolation via JWT verification.
- **Virtual Order Execution**: Execution engine supporting MARKET and LIMIT orders, cash margin reservations, transaction ledgers, position tracking, and holdings accounting.
- **Real-Time WebSocket Feed**: Simulated market price tick broadcasting over WebSockets for automated price updates across dashboard components.
- **Market Hours Enforcement**: Market calendar engine supporting standard Indian market hours (09:15 to 15:30 IST) with a development/testing override (`MARKET_SIMULATION_FORCE_OPEN=true`). In production environments, `MARKET_SIMULATION_FORCE_OPEN` must be set to `false`.

---

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-Time Streaming**: `ws` (WebSocket library)
- **Authentication & Security**: JSON Web Tokens (JWT), Bcrypt.js, Passport.js
- **Email Delivery**: Nodemailer (SMTP integration)
- **Testing**: Jest, Supertest, MongoDB Memory Server

### Frontend Applications
- **Dashboard App**: React.js, React Router v6, Material-UI (MUI), Chart.js, `chartjs-chart-financial`, Axios
- **Landing & Auth App**: React.js, React Router v7, Bootstrap 5, Axios

---

## High-Level Architecture

```
                                ┌───────────────────────────┐
                                │     Landing & Auth App    │
                                └─────────────┬─────────────┘
                                              │ Auth / Token
                                              ▼
┌───────────────────────────┐  HTTP / REST   ┌───────────────────────────┐
│     Dashboard Trading App ├───────────────►│    Express Backend API    │
│                           │◄───────────────┤                           │
└─────────────┬─────────────┘  WebSocket Feed └─────────────┬─────────────┘
              │                                             │
              │                                     ┌───────┴───────┐
              │                                     │               │
              ▼                                     ▼               ▼
┌───────────────────────────┐               ┌───────────────┐ ┌───────────┐
│       Browser DOM         │               │ MongoDB Store │ │ Market    │
│  (MUI / Chart.js Charts)  │               │ (User/Orders) │ │ Simulator │
└───────────────────────────┘               └───────────────┘ └───────────┘
```

---

## Project Structure

```
TradePulse/
├── backend/
│   ├── config/              # Database connection and environment config
│   ├── controllers/         # Auth, trading, and historical data controllers
│   ├── middleware/          # JWT authentication and error handling middleware
│   ├── models/              # Mongoose schemas (User, Account, Order, Holding, etc.)
│   ├── routes/              # Express API route handlers
│   ├── services/            # Simulation, intraday candles, market calendar, email services
│   ├── utils/               # Money formatting and email validation utilities
│   ├── tests/               # Backend Jest test suites
│   ├── index.js             # Main HTTP and WebSocket server entry point
│   └── package.json
│
├── dashboard/               # Trading workspace and analytics dashboard
│   ├── public/              # Static HTML template and favicon
│   ├── src/
│   │   ├── components/      # React components (StockDetail, OHLCChart, WatchList, etc.)
│   │   ├── hooks/           # Custom React hooks (useWebSocket, useHistoricalData)
│   │   ├── services/        # Axios API client setup
│   │   └── index.js
│   └── package.json
│
└── frontend/                # Landing pages and user authentication portal
    ├── public/              # Branding assets and landing page media
    ├── src/
    │   ├── landing/         # Landing, products, pricing, about, support components
    │   └── index.js
    └── package.json
```

---

## Authentication & Security

1. **User Registration & Verification**:
   - Accepts name, email, and password.
   - Validates email formatting and domain MX records before creating unverified user records.
   - Dispatches a 6-digit verification OTP to the user's email via Nodemailer SMTP.
   - Account activation initializes a virtual trading account with ₹100,000 margin.

2. **Login & Password Authentication**:
   - Supports password authentication and optional email OTP login verification.
   - Issues a signed JSON Web Token (JWT) with a 7-day expiration upon successful authentication.

3. **Single-Use Password Reset**:
   - Dispatches a reset OTP to verified user emails.
   - Upon successful OTP verification, the server generates a short-lived reset authorization token stored as a SHA-256 hash in MongoDB (`ResetToken` collection).
   - Password reset marks the token as used (`used: true`). Subsequent reset attempts with the same token are rejected.

---

## Paper Trading Engine

- **Initial Virtual Balance**: ₹100,000 credited automatically upon email verification.
- **Order Placement**: Supports `BUY` and `SELL` transactions for `MARKET` and `LIMIT` orders.
- **Margin Reservation**: Placing a BUY limit order reserves cash from `availableMargin`. Canceling an open limit order releases reserved funds.
- **Automated Execution Engine**: Evaluates open limit orders against live simulated price ticks every 2 seconds. When price criteria are satisfied, orders transition from `OPEN` to `EXECUTED`.
- **Holdings & Portfolio Accounting**:
  - Executing a BUY order updates holdings quantity, average purchase price, total investment, and current market value.
  - Executing a SELL order calculates realized profit and loss (P&L), adjusts virtual cash balance, and appends an account financial ledger record.

---

## Simulated Market Engine

- **Authoritative Provider**: `SimulatedMarketDataProvider` acts as the single source of truth for market prices across the system.
- **Sequential Tick Generation**: Prices evolve sequentially from the previous tick price using a persistent random walk with momentum and mean reversion toward the reference price:
  $$\text{Price}_{t} = \text{Price}_{t-1} \times (1 + \text{DeltaPercent})$$
- **Sector Volatility Profiles**:
  - Index instruments: `0.05%` base volatility.
  - Large-cap Banking/IT equities: `0.15%` base volatility.
  - Mid-cap equities: `0.25%` base volatility.
- **Market Hours Enforcement**:
  - Respects standard Indian stock market hours (09:15 to 15:30 IST).
  - Outside market hours, price tick generation freezes, and UI status displays `MARKET CLOSED`.
  - Development/Testing override: `MARKET_SIMULATION_FORCE_OPEN=true` permits continuous price movement for testing outside trading hours. Production environments must set this to `false`.

---

## Instrument Universe

The platform supports **46 Indian equity and index instruments**, including:
- **Indices**: NIFTY 50 (`NIFTY50`), NIFTY BANK (`BANKNIFTY`), SENSEX (`SENSEX`).
- **Equities**: RELIANCE, INFY, TCS, HDFCBANK, ICICIBANK, WIPRO, TATAMOTORS, ITC, BHARTIARTL, and 34 other major listed instruments.

---

## Historical Data & Charting

TradePulse clearly distinguishes backend-simulated real-time intraday data from historical End-of-Day (EOD) data:

| Timeframe | Default Interval | Available Intervals | Data Provenance & Source | Provenance Label |
| :--- | :--- | :--- | :--- | :--- |
| **1H** | `1m` | `1m` | Simulated 1-Minute Stream (Latest 60 candles) | `SIMULATED • 1 MIN` |
| **1D** | `15m` | `1m`, `15m` | Simulated Intraday Stream (375 1m / 25 15m candles) | `SIMULATED • 1 MIN` / `SIMULATED • 15 MIN` |
| **1W** | `1D` | `1D` | Historical EOD Dataset | `YAHOO FINANCE • EOD` |
| **1M** | `1D` | `1D`, `1W` | Historical EOD Dataset | `YAHOO FINANCE • EOD` |
| **3M** | `1D` | `1D`, `1W`, `1M` | Historical EOD Dataset | `YAHOO FINANCE • EOD` |
| **6M** | `1D` | `1D`, `1W`, `1M` | Historical EOD Dataset | `YAHOO FINANCE • EOD` |
| **1Y** | `1D` | `1D`, `1W`, `1M` | Historical EOD Dataset | `YAHOO FINANCE • EOD` |

### Chart Features
- Built with Chart.js and `chartjs-chart-financial`.
- Renders candlestick bars and volume histograms.
- Formats timestamps in Indian Standard Time (IST / Asia/Kolkata).
- Displays tooltip details (Open, High, Low, Close, Volume) on hover.

---

## Watchlist & Favorites

- **User Isolation**: Watchlist documents are stored per user (`userId` in MongoDB). Users only access their own favorites.
- **Synchronized UI**: Adding or removing a symbol from Explore Stocks immediately reflects in Dashboard My Favorites and Stock Detail header without requiring full page reloads.
- **Drag-and-Drop Reordering**: Drag watchlist rows in the UI to persist custom order via `POST /api/watchlist/reorder`.

---

## Orders, Holdings & Positions

- **Orders Tab**: Displays open, executed, and canceled virtual orders with status badges and timestamps.
- **Holdings Tab**: Shows long-term equity holdings, total investment, current portfolio value, P&L, and daily performance metrics.
- **Positions Tab**: Tracks open trading positions resulting from executed orders, displaying quantity, buy price, product type, and real-time unrealized P&L based on current simulated market prices.
- **Funds Tab**: Displays margin available, margin used, total cash balance, and account summary.

---

## WebSocket Architecture

- **Protocol Path**: `/ws` on the backend server.
- **Initial Connection**: Transmits a `SNAPSHOT` message containing current simulated market prices for all 46 instruments.
- **Real-Time Broadcasts**: Transmits `TICK` messages every 2 seconds containing updated prices, percentage changes, daily high/low, and market status.
- **Frontend Hook**: Dashboard components consume the WebSocket feed via the `useWebSocket` hook for automated UI price updates.

---

## Database Models

The MongoDB database includes 12 Mongoose collections:
- `User`: User identity, hashed passwords, verification state.
- `Account`: Virtual cash balance, margin tracking.
- `Ledger`: Financial ledger records for order fills and balance updates.
- `Order`: Order metadata (symbol, type, side, quantity, price, status).
- `Trade`: Execution records for completed orders.
- `Holding`: Equity portfolio positions.
- `Position`: Active trading position records.
- `Watchlist`: User favorite symbol lists and custom ordering.
- `ResetToken`: Single-use password reset authorization hashes.
- `OHLC`: Historical daily market data records.
- `Instrument`: Master catalog of equity and index instruments.
- `Otp`: One-time password records with expiration timestamps.

---

## API Reference

### Authentication Endpoints (`/api/auth`)
- `POST /api/auth/signup`: Create unverified account & send OTP.
- `POST /api/auth/verify-otp`: Verify email OTP & activate account.
- `POST /api/auth/resend-otp`: Resend email verification OTP.
- `POST /api/auth/login`: Authenticate email & password.
- `POST /api/auth/send-login-otp`: Request login OTP.
- `POST /api/auth/verify-login-otp`: Complete login via OTP.
- `POST /api/auth/forgot-password`: Request password reset OTP.
- `POST /api/auth/verify-reset-otp`: Verify reset OTP & obtain reset token.
- `POST /api/auth/reset-password`: Complete password reset using token.
- `GET /api/auth/me`: Fetch authenticated user profile.

### Trading & Market Endpoints (`/api`)
- `GET /api/instruments`: List all master instruments.
- `GET /api/instruments/search?q={query}`: Search instruments by symbol/name.
- `GET /api/historical/{symbol}?range={range}&interval={interval}`: Fetch candlestick data.
- `GET /api/watchlist`: Retrieve user's watchlist.
- `POST /api/watchlist/add`: Add symbol to watchlist.
- `POST /api/watchlist/remove`: Remove symbol from watchlist.
- `POST /api/watchlist/reorder`: Persist custom watchlist order.
- `GET /api/orders`: List user's orders.
- `POST /api/orders`: Place new market/limit order.
- `DELETE /api/orders/{id}`: Cancel an open order.
- `GET /api/trades`: List executed trades.
- `GET /api/holdings`: Retrieve equity holdings.
- `GET /api/positions`: Retrieve open positions.
- `GET /api/funds`: Fetch account margin and balance.
- `GET /api/summary`: Fetch portfolio summary metrics.

---

## Environment Variables

### Local Development Configuration

For local development environments, configure environment parameters in `.env` files within `backend/`, `dashboard/`, and `frontend/`:

**`backend/.env` (Local Development)**
```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/tradepulse
JWT_SECRET=your_local_jwt_secret_key

MARKET_DATA_MODE=SIMULATION
MARKET_SIMULATION_FORCE_OPEN=true

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="TradePulse" <noreply@example.com>
```

**`dashboard/.env` (Local Development)**
```env
REACT_APP_API_URL=http://localhost:8080/api
REACT_APP_WS_URL=ws://localhost:8080/ws
REACT_APP_FRONTEND_URL=http://localhost:3000
```

**`frontend/.env` (Local Development)**
```env
REACT_APP_API_URL=http://localhost:8080/api
REACT_APP_DASHBOARD_URL=http://localhost:3001
```

---

### Production Configuration

For production deployments, set domain-qualified hostnames, secure database URIs, strong cryptographic secrets, and set `MARKET_SIMULATION_FORCE_OPEN=false` so the market calendar enforces standard trading hours:

**`backend/.env` (Production Configuration)**
```env
PORT=8080
MONGO_URI=mongodb+srv://<db_user>:<db_password>@<database-cluster-host>/tradepulse?retryWrites=true&w=majority
JWT_SECRET=your_production_jwt_secret_key

MARKET_DATA_MODE=SIMULATION
MARKET_SIMULATION_FORCE_OPEN=false

SMTP_HOST=<production-smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<production-smtp-user>
SMTP_PASS=<production-smtp-password>
SMTP_FROM="TradePulse" <production-sender-email>
```

**`dashboard/.env` (Production Configuration)**
```env
REACT_APP_API_URL=https://<backend-domain>/api
REACT_APP_WS_URL=wss://<backend-domain>/ws
REACT_APP_FRONTEND_URL=https://<frontend-domain>
```

**`frontend/.env` (Production Configuration)**
```env
REACT_APP_API_URL=https://<backend-domain>/api
REACT_APP_DASHBOARD_URL=https://<dashboard-domain>
```

---

## Local Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas cluster

### 1. Clone Repository
```bash
git clone <repository-url>
cd TradePulse
```

### 2. Install Dependencies
```bash
# Backend dependencies
cd backend
npm install

# Dashboard dependencies
cd ../dashboard
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 3. Start Backend Server
```bash
cd backend
npm start
```

### 4. Start Dashboard Application
```bash
cd dashboard
npm start
```

### 5. Start Frontend Landing Application
```bash
cd frontend
npm start
```

---

## Testing

The project includes test coverage across backend API services, simulation logic, and React dashboard components.

### Running Backend Tests
```bash
cd backend
npm test
```
*Runs 21 Jest test suites covering authentication, password reset security, market simulation, intraday candle aggregation, paper trading accounting, and watchlist isolation.*

### Running Dashboard Component Tests
```bash
cd dashboard
npm test -- --watchAll=false
```
*Runs React Testing Library component tests covering navigation, timeframe selectors, chart data badges, and header states.*

---

## Production Deployment Considerations

1. **Environment Security**: Configure production environment variables for `JWT_SECRET`, `MONGO_URI`, and `SMTP` credentials.
2. **CORS Configuration**: Restrict backend CORS middleware to authorized production domain origins.
3. **Database Scalability**: Utilize MongoDB replica sets or managed database clusters for transactional reliability and high availability.
4. **WebSocket Scaling**: Implement a pub/sub message broker (such as Redis) if distributing WebSocket server nodes across multiple processes or instances.
5. **Static Asset Bundling**: Compile production builds for React frontend applications using `npm run build` and serve static assets through reverse proxies or web application hosting infrastructure.

---

## Platform Limitations

- **Simulated Trading Only**: TradePulse is a paper trading platform built for educational and demonstration purposes. All orders, balances, margins, and trades are completely virtual.
- **Simulated Intraday Market Data**: Intraday prices (`1H` and `1D` timeframes) are generated by an internal simulation engine streaming via WebSockets and do not represent live exchange price feeds.
- **No External Brokerage Integration**: The application operates independently and does not connect to live stock exchanges or commercial brokerage APIs.
