# CapitalLab — Technical Documentation

**Version:** 1.0  
**Last updated:** June 2026  
**Project type:** Single-file Web Application (SPA)  
**Stack:** HTML5 · Vanilla CSS · Vanilla JavaScript (ES6+)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Global Constants & Configuration](#3-global-constants--configuration)
4. [Application State](#4-application-state)
5. [Pricing Engine](#5-pricing-engine)
6. [Market Session Lifecycle](#6-market-session-lifecycle)
7. [Asset Data Model](#7-asset-data-model)
8. [Financial Calculations](#8-financial-calculations)
9. [Module Reference](#9-module-reference)
10. [Persistence Layer](#10-persistence-layer)
11. [UI Architecture & Layout](#11-ui-architecture--layout)
12. [Data Export & Import](#12-data-export--import)
13. [Teacher Mode](#13-teacher-mode)
14. [Known Constraints & Design Decisions](#14-known-constraints--design-decisions)
15. [Extending the Simulator](#15-extending-the-simulator)

---

## 1. Project Overview

CapitalLab is a **client-side financial markets simulator** delivered as a single HTML file. It requires no server, no build step, and no installation. All logic, state, styling, and markup are self-contained.

The application targets university students in finance programs. It simulates a NYSE-style trading session with live price updates, portfolio management, risk metrics, and a guided laboratory module for instructor-led exercises.

### Versions

| File | Markets | Assets | Purpose |
|---|---|---|---|
| `CapitalLab.html` | 5 (Stocks, Bonds, Forex, Futures, Derivatives) | 150 | Main version, continuous development |
| `CapitalLab_3Mercados.html` | 3 (Stocks, Bonds, Forex) | 90 | Social service deployment; Futures/Derivatives reserved for future release |

---

## 2. Architecture

```
CapitalLab.html  (~4,850 lines)
│
├── <head>
│   ├── Google Fonts (Syne, DM Sans, DM Mono)         — CDN; graceful degradation without network
│   └── Tabler Icons webfont                           — CDN; icons degrade to empty on no network
│
├── <style>  (~1,100 lines)
│   ├── CSS custom properties (design tokens)
│   ├── Layout shell (grid + flexbox)
│   ├── Component styles (cards, badges, modals, charts)
│   └── Responsive breakpoints (768px, 480px)
│
├── <body>
│   ├── Mobile sidebar overlay
│   ├── Topbar (brand + session status + capital pill)
│   ├── Capital edit modal
│   ├── Confirm/reset modal
│   ├── Watchlist sidebar
│   └── Main content area
│       ├── #page-mercado      — Candlestick chart, trade panel, news feed
│       ├── #page-analisis     — Asset analysis and risk/return scatter
│       ├── #page-personalizado — Custom assets
│       ├── #page-cartera      — Portfolio with multi-strategy support
│       ├── #page-laboratorio  — Guided lab module with Monte Carlo
│       ├── #page-resultados   — Session results and CL-30 index
│       └── #page-resultados-lab — Lab simulation history
│
└── <script>  (~3,400 lines)
    ├── Asset data (ALL_STOCKS, ALL_BONDS, ALL_FOREX, ALL_FUTURES, ALL_DERIVATIVES)
    ├── Global constants and configuration
    ├── Application state (mutable variables)
    ├── Pricing engine (GBM + CAPM correlation)
    ├── Market session controller
    ├── UI renderers (one per page/component)
    ├── Persistence layer (localStorage)
    ├── Export/import utilities
    └── initApp() — bootstrap function
```

### Dependency Model

The simulator operates in two modes depending on network availability:

| Condition | Effect |
|---|---|
| **Online** | Google Fonts, Tabler Icons, and Chart.js 4.4.1 load from CDN. Full visual fidelity. |
| **Offline** | All financial logic, state management, and navigation work normally. Charts will not render (Chart.js unavailable). Fonts fall back to system sans-serif. |

Chart.js is loaded via a `<script>` tag with no `defer` or `async`. If CDN is unreachable, `Chart` is undefined and chart render calls silently fail — they do not block other functionality.

---

## 3. Global Constants & Configuration

All constants are declared at the top of the `<script>` block. They are `const` — **never mutate these at runtime**. To change simulator behavior, edit these values and reload.

### Financial Constants

```javascript
const RF = 4.5;                   // Risk-free rate (%) — used in Sharpe ratio calculation
const INITIAL_CAPITAL = 50000;    // Starting cash for the market session (USD)
const MARGIN_RATIO    = 0.5;      // Max leverage: 50% of initial capital
const MARGIN_LIMIT    = -25000;   // Derived: MARGIN_RATIO × INITIAL_CAPITAL (negative)
const COMMISSION_RATE = 0.0015;   // Brokerage commission: 0.15% of trade value
const COMMISSION_MIN  = 1.00;     // Minimum commission per trade (USD)
```

### Pricing Engine Constants

```javascript
const SESSION_DURATION_MS  = 14_400_000; // 4-hour simulated NYSE session
const TICK_MS              = 5_000;      // Price update interval (5 seconds real time)
const TICKS_PER_SESSION    = 2_880;      // SESSION_DURATION_MS / TICK_MS
const TRADING_DAYS_YEAR    = 252;        // Standard trading calendar
const TICKS_PER_YEAR       = 725_760;    // TICKS_PER_SESSION × TRADING_DAYS_YEAR
const EFFECTIVE_PERIODS    = 1_400;      // GBM denominator — lower = higher intraday volatility
const RISK_MULTIPLIER      = 3.2;        // Global amplifier applied to all per-tick σ
```

### Spread by Asset Type

```javascript
const SPREAD_BY_TYPE = {
  accion:   0.0010,   // 0.10% — liquid equities
  bono:     0.0020,   // 0.20% — fixed income; lower intraday liquidity
  divisa:   0.0006,   // 0.06% — major FX pairs; tightest spreads
  futuro:   0.0008,   // 0.08% — standardized futures; high liquidity
  derivado: 0.0035,   // 0.35% — OTC derivatives; widest spreads
};
```

### Passive Income Constants

```javascript
const INCOME_CYCLE_MS   = 90_000;   // Dividend/coupon payment interval (90 seconds)
const INCOME_DAY_FRAC   = INCOME_CYCLE_MS / SESSION_DURATION_MS;  // ≈ 1/160 of session
const INCOME_PEDAGOGIC  = 63;       // Pedagogic acceleration factor
// Net effect: one full session ≈ one quarter of annual yield (perceptible in a class period)
const INCOME_ACCRUAL    = (1 / TRADING_DAYS_YEAR) * INCOME_DAY_FRAC * INCOME_PEDAGOGIC;
```

### Storage Keys

```javascript
const STORAGE_KEY   = 'capitallab_v1';          // Student session state
const TEACHER_KEY   = 'capitallab_teacher_v1';  // Teacher roster (isolated)
```

---

## 4. Application State

All mutable state lives in module-level `let` variables inside the script block. There is no state management library — state is shared directly between functions.

### Capital & Portfolio

```javascript
let capital       = INITIAL_CAPITAL; // Available market cash (USD). Never modified by MtM.
let labCapital    = 50_000;          // Lab module cash — completely independent from market capital.
let portfolio     = [];              // Active positions (see Position schema below).
let txHistory     = [];              // Chronological transaction log.
let navHistory    = [];              // NAV snapshots per tick: [{ t, value, invested }]
let pendingOrders = [];              // Limit/stop-loss orders awaiting trigger.
```

### Session

```javascript
let marketSession = {
  open:        false,
  openTime:    null,       // Date object — set on openMarket()
  closeTime:   null,       // Date object — set on closeMarket()
  tickTimer:   null,       // setInterval handle for tickPrices()
  clockTimer:  null,       // setInterval handle for countdown display
  newsTimer:   null,       // setInterval handle — fires generatePeriodicNews() every 60 s
  incomeTimer: null,       // setInterval handle — fires payPassiveIncome() every 90 s
};
let marketSessionLog = []; // Records of each open/close cycle for the Results page.
```

### Live Prices

```javascript
// These arrays are initialized in initApp() as shallow copies of ALL_* with
// currentPrice injected. ALL_* arrays are never mutated — they are the source of truth
// for static asset data (name, sigma, ret, etc.).
let STOCKS, BONDS, FOREX, FUTURES, DERIVATIVES;
```

### Multi-Portfolio

```javascript
let savedPortfolios  = []; // Up to 3 saved strategies: [{ name, capital, portfolio, txHistory, savedAt, color }]
let activePortfolioIdx = -1; // -1 = current unsaved session; 0–2 = saved slot index
```

### News & Impacts

```javascript
let newsFeed     = [];   // [{ id, time, headline, body, type, ticker, movePct, unread }]
let newsImpacts  = {};   // { assetId: { perTick: float, ticks: int } } — causal price effect
let newsUnreadCount = 0;
```

### Lab

```javascript
let labConfig = {
  capital:      50_000,
  horizon:      6,        // months (used only for annualized return display in Lab)
  target:       8,        // target return % for evaluation
  started:      false,
  startCapital: 0,
};
let labPickedIds = []; // Asset IDs selected for the lab portfolio
let labHistory   = []; // Past Monte Carlo simulation results
```

### UI State

```javascript
let selectedAsset         = null;    // Currently displayed asset object (live reference)
let mktTypeFilter         = 'all';   // Active watchlist type filter
let currentHorizonMonths  = 12;      // Internal horizon for annualized calculations (not user-facing)
let wlFilter              = 'all';   // Watchlist type filter
let wlSort                = 'default'; // Watchlist sort order: 'default' | 'gainers' | 'losers' | 'az'
```

---

## 5. Pricing Engine

The pricing engine drives all live price updates. It runs on every tick while the market session is open.

### Entry Point

```
setInterval(tickPrices, TICK_MS)  →  set in openMarket()
```

### `tickPrices()` — Full Execution Flow

```
1. Snapshot previous prices → prevPrices{}
2. Generate market-wide random factor → marketZ (Box-Muller normal)
3. Roll for market regime event (3% probability per tick):
     60% → crash:  −3% to −12%
     40% → rally:  +2% to +7%
4. For each asset in [STOCKS, BONDS, FOREX, FUTURES, DERIVATIVES]:
     a. Compute per-tick σ via candleSigma(asset.sigma)
     b. Compute drift = (asset.ret / 100) / EFFECTIVE_PERIODS
     c. Look up beta (explicit for stocks; type-based for others)
     d. systematic   = beta × MARKET_VOL × marketZ
     e. idiosyncratic = candleSigma × randn() × 0.7
     f. shock = drift + systematic + idiosyncratic + (beta × marketEvent)
     g. Roll for asset-specific shock (3% probability, 58% downward bias)
     h. Apply causal news impact from newsImpacts[asset.id] if active
     i. newPrice = max(0.0001, currentPrice × (1 + shock))
     j. Update asset.currentPrice, asset.change
     k. Record candle → addCandle(asset)
5. Mark-to-market portfolio positions (pos.currentPrice sync)
6. Re-render watchlist ticker
7. Re-render active page (market, analysis, portfolio, or results)
8. Check margin call → checkMarginCall()
9. Check pending orders → checkPendingOrders()
10. Autosave → autosave()
```

### Beta Mapping

Assets without an explicit `beta` field are assigned one by type:

| Type | Default Beta |
|---|---|
| `accion` | Field value from asset data |
| `bono` | 0.25 |
| `divisa` | 0.45 |
| `futuro` | 1.15 |
| `derivado` | 1.30 |

### Per-Tick Volatility

```javascript
function candleSigma(annualSigma) {
  return ((annualSigma / 100) / Math.sqrt(EFFECTIVE_PERIODS)) * RISK_MULTIPLIER;
}
```

This converts an asset's annualized sigma (%) to a per-tick standard deviation, amplified by `RISK_MULTIPLIER` for pedagogically visible intraday swings.

### Random Number Generation

```javascript
// Box-Muller transform — standard normal N(0,1)
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
```

`Math.random()` (Xorshift128+ in V8) is sufficient for simulation purposes. No cryptographic RNG is required.

### Execution Price & Commission

```javascript
// Spread model: buyer pays ask, seller receives bid
function execPrice(midPrice, type, side) {
  const half = spreadFor(type) / 2;
  return side === 'buy' ? midPrice * (1 + half) : midPrice * (1 - half);
}

// Commission: percentage of notional with a minimum floor
function commissionFor(value) {
  return Math.max(COMMISSION_MIN, Math.abs(value) * COMMISSION_RATE);
}
```

---

## 6. Market Session Lifecycle

```
User clicks "Abrir Mercado"
        │
        ▼
openMarket()
  ├── marketSession.open = true
  ├── Snapshot session open prices → asset.sessionOpenPrice
  ├── Generate 4 staggered opening news items (generateOpeningNews)
  ├── Start tickTimer  → setInterval(tickPrices, TICK_MS)
  ├── Start clockTimer → setInterval(updateSessionBadge, 1000)
  ├── Start newsTimer  → setInterval(generatePeriodicNews, 60_000)
  └── Start incomeTimer → setInterval(payPassiveIncome, INCOME_CYCLE_MS)

        │
        │  Every 5 seconds: tickPrices()
        │  Every 60 seconds: generatePeriodicNews()
        │  Every 90 seconds: payPassiveIncome()
        │
        ▼
User clicks "Cerrar Mercado" (or session expires)
        │
        ▼
closeMarket()
  ├── marketSession.open = false
  ├── Clear all 4 timers (clearInterval)
  ├── Generate closing news items (generateClosingNews)
  ├── Log session to marketSessionLog[]
  └── saveProgress()
```

### Session Expiration

The countdown is visual only — the session does **not** auto-close when the timer hits zero. The user must explicitly close the market. This is intentional: it allows classroom exercises to run beyond the nominal 4-hour window.

---

## 7. Asset Data Model

### Static Asset Schema (ALL_* arrays)

These are read-only source arrays. They are never mutated during runtime.

```javascript
// Stocks
{
  id:       'AAPL',
  name:     'Apple Inc.',
  ticker:   'AAPL',
  sector:   'Tecnología',
  country:  'EE.UU.',
  price:    189.50,        // reference/base price (USD)
  beta:     1.19,          // market sensitivity (stocks only)
  sigma:    22.1,          // annualized volatility (%)
  ret:      12.4,          // expected annual return (%)
  profile:  '...',         // narrative description for Analysis module
  rating:   'AAA',         // credit rating
  dividend: 0.92,          // annual dividend per share (USD)
  type:     'accion',
  fs: {                    // financial statements (3-year history)
    income:  [{ year, revenue, grossProfit, ebit, netIncome }],
    balance: [{ year, assets, equity, debt }],
    cashflow:[{ year, operating, investing, financing }],
  }
}

// Bonds
{
  id, name, ticker, sector, country, price, sigma, ret, profile, rating,
  coupon:   5.25,   // annual coupon rate (%)
  maturity: '2034', // maturity year
  type:     'bono',
}

// Forex
{
  id, name, ticker, price, sigma, ret, profile, rating,
  country: 'USD/EUR',
  gdp:     '26.9T',   // GDP of base currency country
  type:    'divisa',
}

// Futures
{
  id, name, ticker, sector, country, price, sigma, ret, profile, rating,
  type: 'futuro',
}

// Derivatives
{
  id, name, ticker, sector, country, price, sigma, ret, profile, rating,
  type: 'derivado',
}
```

### Live Asset (runtime extension)

When `initApp()` runs, each asset is shallow-copied into the live arrays (STOCKS, BONDS, etc.) with additional runtime fields injected:

```javascript
asset.currentPrice      // float — updated every tick
asset.change            // float — % change vs. asset.price (open)
asset.sessionOpenPrice  // float — price at session open (set in openMarket)
asset.candles           // stored in candleHistory[asset.id] — not on the object itself
```

### Position Schema (portfolio[])

```javascript
{
  id:           'AAPL',
  type:         'accion',
  name:         'Apple Inc.',
  ticker:       'AAPL',
  qty:          10,
  buyPrice:     191.25,     // average cost basis (execPrice at time of purchase)
  currentPrice: 193.80,     // synced from live asset on every tick
  invested:     1912.50,    // buyPrice × qty (cost basis total)
  sigma:        22.1,       // copied from asset for portfolio-level calculations
  beta:         1.19,
  ret:          12.4,
  dividend:     0.92,       // or coupon — for passive income
  coupon:       null,       // set for bonds
}
```

---

## 8. Financial Calculations

### Sharpe Ratio

```javascript
function computeSharpe(asset) {
  // (Expected annual return − Risk-free rate) / Annual volatility
  return (asset.ret - RF) / asset.sigma;
}
// RF = 4.5% (constant)
```

### Portfolio Metrics (`computePortfolioMetrics`)

Computes weighted metrics across all open positions using a **one-factor CAPM model**:

```
portSigma = √(sysSigmaW² + idioVar)

where:
  sysSigmaW = Σ(wᵢ × βᵢ × MARKET_SIGMA_ANNUAL)   // systematic risk
  idioVar   = Σ(wᵢ² × max(0, σᵢ² − (βᵢ × σₘ)²)) // idiosyncratic variance

MARKET_SIGMA_ANNUAL = 12%  // reference market volatility
```

Returns: `{ value, wRet, wSigma, sharpe, var95, beta }`

### Historical VaR (`computeHistVaR`)

Primary method — Historical Simulation:

```
1. Collect intraday candle returns for the session: rᵢ = (cᵢ − cᵢ₋₁) / cᵢ₋₁
2. Sort returns ascending (worst to best)
3. VaR(95%) = |returns[floor(0.05 × n)]|  (left tail, 5th percentile)
4. Expressed as % loss per candle period
```

Fallback (< 10 candles) — Parametric:

```
VaR(95%) = asset.sigma × 1.645   (annual, not intraday)
```

> **Design note:** The historical VaR is intentionally **not annualized** because the underlying returns are from the amplified intraday simulation. Annualizing would produce misleadingly large figures given `RISK_MULTIPLIER = 3.2`.

### Beta for Portfolio Asset

```javascript
function betaForAsset(asset) {
  if (typeof asset.beta === 'number') return asset.beta;
  switch (asset.type) {
    case 'bono':     return 0.25;
    case 'divisa':   return 0.45;
    case 'futuro':   return 1.15;
    case 'derivado': return 1.30;
    default:         return 1.0;
  }
}
```

### Passive Income Accrual

Dividends (stocks) and coupons (bonds) are credited to cash every `INCOME_CYCLE_MS`:

```javascript
// Stocks:
income = asset.dividend × INCOME_ACCRUAL × qty

// Bonds (on face value, not market price):
income = (asset.coupon / 100) × INCOME_ACCRUAL × (asset.price × qty)
```

Where `INCOME_ACCRUAL = (1 / 252) × (90_000 / 14_400_000) × 63`.

This results in one full session yielding approximately **one quarter** of annual yield — a deliberate pedagogic calibration.

### Margin Call

```javascript
function checkMarginCall() {
  if (capital < MARGIN_LIMIT) {
    // Force-liquidate all positions at current market price
    // Record as LIQUIDACIÓN FORZADA in txHistory
    // Notify user
  }
}
// MARGIN_LIMIT = -25_000 (derived from INITIAL_CAPITAL × MARGIN_RATIO)
```

### Price Projection (Lab / Analysis)

Uses a **deterministic seeded simulation** for reproducible projections:

```javascript
function computePrices(months) {
  const seed = months * 1000;
  function rnd(i) {
    let x = Math.sin(seed + i) * 10_000;
    return x - Math.floor(x);  // pseudo-random in [0, 1)
  }
  // Projects price = basePrice × (1 + monthlyReturn)^months × (1 + noise)
}
```

---

## 9. Module Reference

### `openMarket()` / `closeMarket()` / `toggleMarketSession()`

Controls the session lifecycle. `toggleMarketSession` is the button handler that calls one or the other based on `marketSession.open`.

### `tickPrices()`

Core pricing loop. See [Section 5](#5-pricing-engine) for full execution flow.

### `renderWatchlist()`

Renders the sidebar asset list. Respects `wlFilter` (type), `wlSort` (order), and pagination state. Called on every tick and on filter/sort changes.

### `wlSelect(id, type)`

Sets `selectedAsset` and calls `showAssetDetail()`. Entry point for all asset-level views.

### `showAssetDetail(id, type)`

Switches the main panel to the Market page and populates all KPIs, the candlestick chart, and the trade panel for the selected asset.

### `updateMarketToolbar(asset)`

Refreshes all KPI chips in the market toolbar (current price, session open, session change %, bid, ask, VaR, Sharpe). Called on every tick for the currently selected asset.

### `drawCandlestickChart(asset)`

Renders or updates the OHLC candlestick chart using Chart.js. Creates a new chart instance if none exists; updates data otherwise. Handles canvas resize via double `requestAnimationFrame` to avoid zero-size canvas on tab return.

### `executeDirect(side)` / `executeOrderAt(asset, side, qty)`

Trade execution. `executeDirect` reads qty from the trade panel input. `executeOrderAt` is the shared execution kernel — computes `execPrice`, `commissionFor`, updates `capital` and `portfolio`, records to `txHistory`, and calls `notify()`.

### `checkMarginCall()`

Runs after every tick. If `capital < MARGIN_LIMIT`, force-liquidates the entire portfolio.

### `checkPendingOrders()`

Evaluates all entries in `pendingOrders[]` against current prices. Triggers `executeOrderAt` for limit/stop orders whose condition is met.

### `payPassiveIncome()`

Computes dividend and coupon income for current portfolio, credits to `capital`, records transactions, and generates a news item. Runs every 90 seconds while the market is open.

### `computePortfolioMetrics(positions)`

CAPM-based portfolio analytics. Returns weighted return, sigma, Sharpe, VaR, and beta. Used by both the Portfolio page and the Results page.

### `computeHistVaR(asset, confidence)`

Historical simulation VaR from session candle data. Falls back to parametric if insufficient data. See [Section 8](#8-financial-calculations).

### `simulateLab()`

Monte Carlo simulation for the Laboratory module. Runs N paths over the selected horizon and plots the distribution of outcomes against the student's target return.

### `renderPortfolio()` / `renderResults()` / `renderResultsLab()`

Full page renderers. Each reconstructs the entire page DOM on call. Called on tick (if page is active) and on explicit navigation.

### `saveProgress()` / `loadProgress()`

Serializes/deserializes the full application state to/from `localStorage`. See [Section 10](#10-persistence-layer).

### `generateOpeningNews()` / `generatePeriodicNews()` / `generateClosingNews()`

News generation functions. Opening fires 4 staggered items at session open. Periodic fires every 60 seconds. Closing fires at session close. All write to `newsFeed[]` and trigger `renderNewsFeed()`.

### `generateNewsItem(asset, movePct)`

Creates a single news item object for a given asset and price movement. Selects a random template from a pool of 31 across 5 asset types. Positive `movePct` → bullish framing; negative → bearish.

### `saveCurrentPortfolio()` / `switchPortfolio(idx)` / `togglePortfolioCompare()`

Multi-portfolio management. Up to 3 strategies can be saved as named snapshots. `switchPortfolio` swaps the entire application state (capital, portfolio, txHistory) to a saved slot.

### `exportForTeacher()` / `importStudent(event)` / `renderTeacher()`

Teacher mode functions. See [Section 13](#13-teacher-mode).

### `initApp()`

Bootstrap IIFE that runs on page load:
1. Deep-clones ALL_* arrays into live STOCKS/BONDS/FOREX/FUTURES/DERIVATIVES, injecting `currentPrice`
2. Calls `loadProgress()` — restores prior session if available
3. Initializes watchlist, Analysis select, and default page
4. Registers event listeners (keyboard shortcuts, resize)

---

## 10. Persistence Layer

### Storage Key: `capitallab_v1`

The full session state is serialized to JSON and written to `localStorage` on every tick (via `autosave()`) and on explicit user actions (trades, resets, portfolio saves).

### State Payload

```javascript
{
  capital,
  labCapital,
  portfolio,           // Position[]
  txHistory,           // Transaction[]
  labHistory,          // Lab simulation results
  navHistory,          // [{ t, value, invested }]
  pendingOrders,
  marketSessionLog,
  savedPortfolios,
  newsFeed,
  labConfig,
  labPickedIds,
  savedAt: ISO string,
}
```

### Teacher Storage Key: `capitallab_teacher_v1`

Teacher roster is stored under a **separate key**, completely isolated from the student session. It persists independently of `resetSession()`.

### Storage Failure Handling

Both `saveProgress()` and `loadProgress()` are wrapped in `try/catch`. Failures log a warning to `console.warn` and are otherwise silent — they do not interrupt the user experience. This handles quota-exceeded errors (e.g., incognito mode with full localStorage).

---

## 11. UI Architecture & Layout

### Layout Shell

```css
.shell {
  display: grid;
  grid-template-rows: 48px 30px 1fr;  /* topbar / market-bar / content */
  height: 100vh;                        /* overridden by --vh on mobile */
}
.shell-body {
  display: grid;
  grid-template-columns: 230px 1fr;    /* sidebar / main */
}
```

### Mobile Layout (`max-width: 768px`)

The shell switches from grid to flexbox to prevent `1fr` from resolving to zero in certain iOS Safari versions:

```css
@media (max-width: 768px) {
  .shell { display: flex; flex-direction: column; }
  .shell-body { flex: 1; min-height: 0; }
}
```

### iOS Safari `100vh` Fix

```javascript
(function fixViewportHeight() {
  function setVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  setVH();
  window.addEventListener('resize', setVH);
})();
```

Used as `height: calc(var(--vh, 1vh) * 100)` on the shell. This resolves the Safari bug where `100vh` includes the address bar height, causing layout overflow.

### Design Tokens (CSS Custom Properties)

```css
:root {
  /* Background scale */
  --c0: #0b0e14;   /* page background */
  --c1: #10141d;   /* sidebar / topbar */
  --c2: #151a27;   /* card surface */
  --c3: #1c2333;   /* input background */
  --c4: #242d42;   /* borders */
  --c5: #2d3a55;   /* scrollbar thumb */

  /* Accent colors */
  --accent:  #2962ff;  /* primary blue */
  --accent2: #00c4ff;  /* cyan highlight */
  --green:   #00d084;
  --red:     #ff4757;
  --amber:   #ffb400;
  --gold:    #d4af37;

  /* Text scale */
  --t1: #e8edf8;   /* primary text */
  --t2: #7a8ab0;   /* secondary text */
  --t3: #3d4d72;   /* muted text */
  --t4: #2a3650;   /* disabled text */

  /* Typography */
  --font-head: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'DM Mono', monospace;

  /* Border radius scale */
  --r:  8px;
  --r2: 12px;
  --r3: 16px;
}
```

### Navigation

Page switching is handled by `goPage(pageId)`:

```javascript
function goPage(p) {
  // Hide all .page elements
  // Show #page-{p}
  // Update nav button active states
  // Trigger page-specific render if needed (e.g., renderPortfolio on 'cartera')
}
```

Page IDs: `mercado`, `analisis`, `personalizado`, `cartera`, `laboratorio`, `resultados`, `resultados-lab`.

### Chart Instances

All Chart.js instances are stored in module-level variables to allow destruction before recreation (prevents canvas memory leaks):

```javascript
let mktChartInst, anPriceChart, anRvChart, cProjChartInst,
    portDonutInst, portEvolInst, portPnlBarInst, portRetBarInst,
    portScatterInst, labChartInst, resBarInst, resScatterInst;

function dc(chart) {
  if (chart) chart.destroy();
  return null;
}
// Usage: mktChartInst = dc(mktChartInst); // destroy before recreating
```

---

## 12. Data Export & Import

### JSON Backup (`exportProgress`)

Exports the full session state as a `.json` file. Filename includes the current date:
`CapitalLab_progreso_YYYY-MM-DD.json`

### JSON Import (`importProgress`)

Reads a previously exported JSON file via `FileReader`, validates structure, and calls `loadProgress()` to restore the state.

### CSV Transaction Log (`exportTransactionsCSV`)

Exports `txHistory[]` as a UTF-8 CSV with BOM (`\uFEFF`) for Excel compatibility.

Columns: `Hora, Operación, Activo, Tipo, Cantidad, Precio ejecución, Valor bruto, Comisión, Efecto neto sobre capital`

Net effect convention:
- **Buy:** `−(gross + commission)` → capital decreases
- **Sell / Income:** `+(gross − commission)` → capital increases

### PDF Export (`exportPDF`)

Generates a multi-section PDF of the current session using the browser's print engine (CSS `@media print` with `window.print()`). No external PDF library required.

### Student Export (`exportForTeacher`)

Serializes anonymized student metrics to a JSON file for submission to the instructor:

```javascript
{
  _capitallab_student: true,     // validation marker
  version: 'CapitalLab Student v1',
  student: 'Full name',
  metrics: { retPct, sharpe, pnl, sigma, var95, txCount, posCount, portVal, capital },
  holdings: [{ ticker, type, qty }],   // no internal pricing data
  exportedAt: 'locale string',
}
```

---

## 13. Teacher Mode

Teacher mode is a **separate, isolated module** within the same file. It does **not** share state with the student session — it has its own storage key and its own roster array.

### Flow

```
Student:
  1. Completes session
  2. Clicks "Exportar para Profesor"
  3. Enters name → file downloads: CapitalLab_estudiante_{name}.json

Teacher:
  1. Opens same CapitalLab.html
  2. Navigates to Teacher mode
  3. Imports one or more student JSON files
  4. renderTeacher() displays ranked roster
  5. Can sort by: retPct | sharpe | pnl
  6. Can export full roster as CSV (exportTeacherCSV)
```

### `computeStudentMetrics()`

Computes real-time metrics from the current live session for export:

```javascript
{
  retPct,    // total portfolio return %
  sharpe,    // portfolio Sharpe ratio
  pnl,       // absolute P&L (USD)
  sigma,     // portfolio weighted sigma
  var95,     // portfolio VaR at 95% confidence
  txCount,   // total transactions
  posCount,  // open positions
  portVal,   // current portfolio value (MtM)
  capital,   // available cash
}
```

---

## 14. Known Constraints & Design Decisions

| Constraint | Rationale |
|---|---|
| Single HTML file | Zero deployment friction for educational environments. No server, no npm, no build. |
| No framework | Avoids build toolchain as a dependency. Vanilla JS is sufficient for the complexity level. |
| Chart.js via CDN only | Keeps file size manageable. Offline mode degrades gracefully (charts hidden, logic intact). |
| `Math.random()` for GBM | Cryptographic randomness is unnecessary; simulation fidelity is the goal, not unpredictability. |
| `localStorage` for persistence | No user account system. Data is device-local, session-portable via JSON export. |
| `RISK_MULTIPLIER = 3.2` | Deliberate amplification so price movements are visible within a 60–90 minute class period. |
| VaR not annualized | Annualizing amplified intraday returns would produce misleading numbers given the pedagogic risk multiplier. |
| `currentHorizonMonths` not user-facing | Horizon selector was removed as incoherent with a real-time market. Variable retained for internal annualized return display only. |
| Session does not auto-close | Allows classroom flexibility; instructors may extend a session beyond the nominal 4-hour window. |
| Passive income accelerated (63×) | Without acceleration, income would be imperceptible in a class-length session. Factor is documented and auditable. |

---

## 15. Extending the Simulator

### Adding a New Asset

1. Add an object to the appropriate `ALL_*` constant array following the schema in [Section 7](#7-asset-data-model).
2. Ensure `id` is unique across **all** five arrays.
3. Reload — the asset will appear in the watchlist and all calculations automatically.

### Adding a New Asset Type

1. Add a new `ALL_NEWTYPE` array with a consistent `type` field value.
2. Add a `SPREAD_BY_TYPE` entry.
3. Add a beta default in `betaForAsset()`.
4. Add to `allAssets()` and `allBase()`.
5. Handle in `payPassiveIncome()`, `renderPortfolio()`, and `renderResults()` as needed.

### Modifying Risk Parameters

All risk parameters are in [Section 3](#3-global-constants--configuration). Key levers:

| To achieve | Change |
|---|---|
| More volatile prices | Increase `RISK_MULTIPLIER` or decrease `EFFECTIVE_PERIODS` |
| Longer sessions | Increase `SESSION_DURATION_MS` |
| Faster updates | Decrease `TICK_MS` (minimum ~2000ms recommended; lower stresses the render loop) |
| More crashes | Increase the `0.03` crash probability or the `0.6` downward bias in `tickPrices()` |
| Tighter spreads | Decrease values in `SPREAD_BY_TYPE` |

### Validating JavaScript Changes

After any edit to the script block:

```bash
# Extract the script block
node -e "
const fs = require('fs');
const html = fs.readFileSync('CapitalLab.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
new Function(match[1]);
console.log('Syntax OK');
"
```

Or open the file in Chrome DevTools and check the Console for runtime errors immediately after load.

---

*CapitalLab Technical Documentation — Universidad de Panamá, Facultad de Economía, 2026*  
*Authors: Justin Jones, Dustin Jones, Emanuel Iturriaga, Fabián Montenegro*
