import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createChart } from "lightweight-charts";
import CryptoJS from "crypto-js";
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

import { T } from "./utils/theme.js";
import {
  STABLES, QUOTES, getQuoteCurrency, fetchUsdtRate,
  fmt$, fmtPnl, fmtDate, fmtDateShort, formatMaskedDate, parseMaskedDate,
  getOrdinal, sequenceTransactions,
} from "./utils/helpers.js";
import {
  SETUPS, MISTAKES, CLOSE_REASONS, SIDES, EXCHANGES,
  CRYPTO_TRADE_TYPES, DEFAULT_SYMBOLS, DEFAULT_PROFILES, NAV_ITEMS,
} from "./utils/constants.js";
import { calculatePnL, calculateWinRate, calculateProfitFactor, calculateExpectancy } from "./utils/calculations.js";
import { useDashboard } from "./context/DashboardContext.jsx";
import { usePrices } from "./context/PricesContext.jsx";
import AlertsEngine from "./components/AlertsEngine.jsx";
import {
  Sidebar, TopNav, BottomNav,
  TradeLog, TradeSummary, RiskCalculator, TradingCalendar, Analytics,
  Tag, CoinIcon, InfoDot, Card, ML, MV,
  Placeholder, EmptyState, Skeleton, SemiGauge, DonutGauge, MaskedDateInput,
  Sparkline, WinLossRatioBar, AccountsManager, TradeSetupsManager,
  AddTradeModal, EditTradeModal, CSVImportModal, SecuritySettingsModal, ProfileManagerModal
} from "./components";
import AddLiveTradeModal from "./components/modals/AddLiveTradeModal.jsx";
import CloseLiveTradeModal from "./components/modals/CloseLiveTradeModal.jsx";
import SellSpotModal from "./components/modals/SellSpotModal.jsx";
import LiveTradesView from "./components/views/LiveTradesView.jsx";
import OpenSpotView from "./components/views/OpenSpotView.jsx";
import WatchlistView from "./components/views/WatchlistView.jsx";
import AlertsView from "./components/views/AlertsView.jsx";

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTip({ active, payload, label, prefix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.panel2, border: `1px solid ${T.border2}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: T.mono }}>
      <div style={{ color: T.dim, marginBottom: 4 }}>{label}</div>
      <div style={{ color: payload[0].value >= 0 ? T.green : T.red, fontWeight: 700 }}>{fmt$(payload[0].value)}</div>
    </div>
  );
}

function EquityCurveChart({ equityData }) {
  const containerRef = useRef();
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0].contentRect.width > 0) {
        setWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (equityData.length < 2) return <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim }}>Not enough data for chart.</div>;

  const height = 240;
  const padding = 20;

  const minVal = Math.min(...equityData.map(d => d.val), 0);
  const maxVal = Math.max(...equityData.map(d => d.val), 1);
  const range = maxVal - minVal || 1;

  const points = equityData.map((d, i) => {
    const x = padding + (i / (equityData.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d.val - minVal) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(" L ");

  const pathD = `M ${points}`;
  const fillPath = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;
  const zeroY = height - padding - ((0 - minVal) / range) * (height - 2 * padding);

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.bright, letterSpacing: 1 }}>CUMULATIVE P&L (EQUITY CURVE)</div>
      </div>
      <div style={{ position: "relative", width: "100%", height: "100%" }} ref={containerRef}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
          <defs>
            <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={T.blue} stopOpacity={0.4} />
              <stop offset="100%" stopColor={T.blue} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          {minVal < 0 && maxVal > 0 && <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke={T.dim} strokeWidth="1" strokeDasharray="4 4" />}
          <path d={fillPath} fill="url(#curveGrad)" />
          <path d={pathD} fill="none" stroke={T.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {equityData.map((d, i) => {
            const x = padding + (i / (equityData.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((d.val - minVal) / range) * (height - 2 * padding);
            return <circle key={i} cx={x} cy={y} r="4" fill={T.panel} stroke={T.blue} strokeWidth="2" />;
          })}
        </svg>
      </div>
    </div>
  );
}

function ConsistencyHeatmap({ trades }) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pnlByTime = {};
  trades.forEach(t => {
    if (t.status !== "closed") return;
    const d = new Date(t.closeTime);
    d.setHours(0, 0, 0, 0);
    const key = d.getTime();
    pnlByTime[key] = (pnlByTime[key] || 0) + t.pnl;
  });

  for (let i = 59; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = d.getTime();
    days.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      pnl: pnlByTime[key] || 0,
      hasTrade: pnlByTime[key] !== undefined
    });
  }

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.bright, letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>CONSISTENCY (LAST 60 DAYS)</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {days.map((d, i) => {
          let bg = T.panel2;
          let border = T.border;
          if (d.hasTrade) {
            bg = d.pnl >= 0 ? T.greenDim : T.redDim;
            border = d.pnl >= 0 ? T.green + "50" : T.red + "50";
          }
          return (
            <div key={i} title={`${d.date}: ${d.hasTrade ? fmt$(d.pnl) : "No trades"}`} style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: `1px solid ${border}`, cursor: "pointer" }} />
          );
        })}
      </div>
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function Overview({ trades, allProfileTrades, initialCapital = 0, profiles = [], liveTrades = [], isMobile }) {
  const { closed, wins, losses, realizedPnl, winRate, totalFees, totalInvested, avgWin, avgLoss, avgRR, profitFactor, expectedValue, spotClosed, futClosed, spotH, spotM, futH, futM, equitySeries, dailyPnl } = useMemo(() => {
    const allClosed = trades.filter(t => t.status === "closed");
    const closed = allClosed.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
    const wins = closed.filter(t => (t.pnl - (t.fundingFees || 0)) > 0);
    const losses = closed.filter(t => (t.pnl - (t.fundingFees || 0)) < 0);
    const realizedPnl = closed.reduce((s, t) => s + t.pnl + (t.fees || 0) - (t.fundingFees || 0), 0);
    const winRate = calculateWinRate(closed);
    const totalFees = closed.reduce((s, t) => s + (t.fees || 0) + (t.fundingFees || 0), 0);
    const totalInvested = closed.reduce((s, t) => s + ((t.entry * t.qty * (t.usdtRate || 1)) / (t.leverage || 1)), 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl - (t.fundingFees || 0), 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl - (t.fundingFees || 0), 0) / losses.length) : 1;
    const avgRR = avgWin / avgLoss;
    const profitFactor = calculateProfitFactor(closed);
    const expectedValue = calculateExpectancy(closed);
    const spotClosed = closed.filter(t => t.tradeType === "Spot");
    const futClosed = closed.filter(t => t.tradeType !== "Spot");
    const spotAvgHold = spotClosed.length ? spotClosed.reduce((s, t) => s + (t.closeTime - t.openTime), 0) / spotClosed.length : 0;
    const futAvgHold = futClosed.length ? futClosed.reduce((s, t) => s + (t.closeTime - t.openTime), 0) / futClosed.length : 0;
    
    let running = 0, peak = 0, maxDD = 0, maxRunup = 0;
    const equitySeries = [{ date: "Start", val: 0 }, ...closed.sort((a, b) => a.closeTime - b.closeTime).map(t => {
      running += t.pnl + (t.fees || 0) - (t.fundingFees || 0);
      if (running > peak) { maxRunup = Math.max(maxRunup, running); peak = running; }
      maxDD = Math.min(maxDD, running - peak);
      return { date: fmtDate(t.closeTime), val: parseFloat(running.toFixed(2)) };
    })];

    const dailyPnl = Object.entries(closed.reduce((acc, t) => {
      const d = fmtDateShort(t.closeTime);
      acc[d] = (acc[d] || 0) + t.pnl + (t.fees || 0) - (t.fundingFees || 0);
      return acc;
    }, {})).map(([date, val]) => ({ date, val: parseFloat(val.toFixed(2)) }));

    return { 
      closed, wins, losses, realizedPnl, winRate, totalFees, totalInvested, 
      avgWin, avgLoss, avgRR, profitFactor, expectedValue, spotClosed, futClosed, 
      spotH: Math.floor((spotAvgHold || 0) / 3600000), spotM: Math.floor(((spotAvgHold || 0) % 3600000) / 60000),
      futH: Math.floor((futAvgHold || 0) / 3600000), futM: Math.floor(((futAvgHold || 0) % 3600000) / 60000),
      equitySeries, dailyPnl
    };
  }, [trades]);

  const INITIAL_CAPITAL = initialCapital;

  const { balance } = useMemo(() => {
    const allProfileClosed = (allProfileTrades || trades).filter(t => t.status === "closed");
    const firstDeposit = allProfileClosed.find(t => t.entryType === "Deposit" || t.symbol === "Deposit");
    const startingCapital = firstDeposit ? firstDeposit.qty : (initialCapital || 0);
    const otherDepositsVal = allProfileClosed
      .filter(t => (t.entryType === "Deposit" || t.symbol === "Deposit") && t.id !== (firstDeposit ? firstDeposit.id : null))
      .reduce((s, t) => s + t.qty, 0);
    const withdrawalsVal = allProfileClosed
      .filter(t => t.entryType === "Withdrawal" || t.symbol === "Withdrawal")
      .reduce((s, t) => s + t.qty, 0);

    const profileClosedTrades = allProfileClosed.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
    const profileRealizedPnl = profileClosedTrades.reduce((s, t) => s + t.pnl, 0);
    const profileTotalFees = profileClosedTrades.reduce((s, t) => s + (t.fees || 0) - (t.fundingFees || 0), 0);
    return { balance: startingCapital + otherDepositsVal - withdrawalsVal + profileRealizedPnl + profileTotalFees };
  }, [allProfileTrades, trades, initialCapital]);

  const { prices } = usePrices();
  const totalUnrealizedPnl = liveTrades.reduce((sum, t) => {
    const p = prices[t.symbol];
    if (!p) return sum;
    const qc = t.quoteCurrency || getQuoteCurrency(t.symbol);
    const liveUsdtRate = qc === "USDT" ? 1 : (prices[`${qc}USDT`]?.price || t.usdtRate || 1);
    
    const { pnl: unrealPnl } = calculatePnL({
      entry: t.entry,
      exit: p.price,
      qty: t.qty,
      side: t.side,
      leverage: t.leverage || 1,
      tradeType: t.tradeType,
      marginType: t.marginType,
      quoteRateOpen: t.usdtRate || 1,
      quoteRateClose: liveUsdtRate,
      action: t.side
    });
    return sum + unrealPnl;
  }, 0);

  if (!isMobile) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(250px, 1fr) 2fr minmax(250px, 1fr)", gap: 16, height: "100%", alignItems: "start" }}>
        
        {/* Left Column: KPIs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div style={ML}>Net PNL <InfoDot title="Realized profit/loss after transaction fees" /></div>
            <div style={{ ...MV, color: realizedPnl >= 0 ? T.green : T.red, fontSize: 32 }}>{fmt$(realizedPnl)}</div>
          </Card>
          <Card>
            <div style={ML}>Win Rate <InfoDot title="Percentage of trades that were profitable" /></div>
            <div style={{ ...MV, fontSize: 32 }}>{winRate.toFixed(2)}%</div>
            <div style={{ fontSize: 13, color: T.dim, marginTop: 5, fontFamily: T.mono }}>{wins.length} wins · {losses.length} losses</div>
          </Card>
          <Card>
            <div style={ML}>Profit Factor <InfoDot title="Gross profit divided by gross loss" /></div>
            <div style={{ ...MV, fontSize: 32 }}>{profitFactor.toFixed(2)}</div>
          </Card>
          <Card>
            <div style={ML}>Expected Value <InfoDot title="Average monetary value won/lost per trade" /></div>
            <div style={{ ...MV, fontSize: 32, color: expectedValue >= 0 ? T.green : T.red }}>{expectedValue.toFixed(2)}</div>
          </Card>
          <Card>
            <div style={ML}>Total Invested</div>
            <div style={{ ...MV, fontSize: 26, color: T.blue }}>
              {totalInvested.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 14, color: T.dim, fontWeight: 400 }}>USDT</span>
            </div>
            <div style={{ fontSize: 13, color: T.dim, marginTop: 6, fontFamily: T.mono }}>
              {closed.length} closed trade{closed.length !== 1 ? "s" : ""}
            </div>
          </Card>
        </div>

        {/* Center Column: Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <EquityCurveChart equityData={equitySeries} />
          <ConsistencyHeatmap trades={closed} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
             <Card>
               <div style={ML}>Average Hold Times</div>
               <div style={{ ...MV, fontSize: 20, color: T.bright, marginTop: 6 }}>
                 <div style={{ marginBottom: 4 }}>Spot: {spotH}h {spotM}m</div>
                 <div>Futures: {futH}h {futM}m</div>
               </div>
             </Card>
             <Card>
               <div style={ML}>Average RR</div>
               <div style={{ ...MV, fontSize: 30 }}>{avgRR.toFixed(2)}</div>
               <div style={{ fontSize: 12, color: T.dim, marginTop: 5, fontFamily: T.mono }}><span style={{ color: T.green }}>+{avgWin.toFixed(2)}</span> / <span style={{ color: T.red }}>-{avgLoss.toFixed(2)}</span></div>
             </Card>
          </div>
        </div>

        {/* Right Column: Live & Recent */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.bright, marginBottom: 14 }}>Live Trades</div>
            {liveTrades.length === 0 ? <div style={{ color: T.dim, fontSize: 14 }}>No active trades</div> : (
              liveTrades.map(t => {
                 const p = prices[t.symbol];
                 const pnl = p ? (p.price - t.entry) * t.qty * (t.side === "Long" ? 1 : -1) * (t.leverage || 1) : 0;
                 return (
                   <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                     <div>
                       <div style={{ fontSize: 14, fontWeight: 700 }}>{t.symbol}</div>
                       <div style={{ fontSize: 12, color: T.dim }}>{t.side} {t.leverage ? `${t.leverage}x` : ""}</div>
                     </div>
                     <div style={{ color: pnl >= 0 ? T.green : T.red, fontWeight: 700, fontSize: 15 }}>{fmt$(pnl)}</div>
                   </div>
                 );
              })
            )}
            <div style={{ marginTop: liveTrades.length > 0 ? 0 : 16 }}>
              <div style={ML}>Total Unrealized PNL</div>
              <div style={{ ...MV, fontSize: 24, color: totalUnrealizedPnl >= 0 ? T.green : T.red }}>
                {totalUnrealizedPnl >= 0 ? "+" : ""}{totalUnrealizedPnl.toFixed(2)}
              </div>
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.bright, marginBottom: 14 }}>Recent Closed Trades</div>
            {closed.length === 0 ? <div style={{ color: T.dim, fontSize: 14 }}>No recent trades</div> : (
              closed.slice(-7).reverse().map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.symbol}</div>
                    <div style={{ fontSize: 12, color: T.dim }}>{fmtDateShort(t.closeTime)}</div>
                  </div>
                  <div style={{ color: t.pnl >= 0 ? T.green : T.red, fontWeight: 700, fontSize: 15 }}>{fmt$(t.pnl)}</div>
                </div>
              ))
            )}
          </Card>
        </div>

      </div>
    );
  }

  return (
    <div>
      {/* Row 1: PNL | Win Rate | Avg RR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 10, marginBottom: 10 }}>
        <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={ML}>Net PNL <InfoDot title="Realized profit/loss after transaction fees" /></div>
            <div style={{ ...MV, color: realizedPnl >= 0 ? T.green : T.red, fontSize: 30 }}>{fmt$(realizedPnl)}</div>
          </div>
          <Sparkline data={equitySeries.map(d => d.val)} color={realizedPnl >= 0 ? T.green : T.red} width={90} height={40} />
        </Card>
        <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={ML}>Win Rate <InfoDot title="Percentage of trades that were profitable" /></div>
            <div style={{ ...MV, fontSize: 30 }}>{winRate.toFixed(2)}%</div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 5, fontFamily: T.mono }}>{wins.length} wins · {losses.length} losses</div>
          </div>
          <SemiGauge pct={winRate / 100} wins={wins.length} total={closed.length} size={92} />
        </Card>
        <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={ML}>Average RR <InfoDot title="Ratio of average winning trade to average losing trade" /></div>
            <div style={{ ...MV, fontSize: 30 }}>{avgRR.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 5, fontFamily: T.mono }}><span style={{ color: T.green }}>+{avgWin.toFixed(2)}</span> / <span style={{ color: T.red }}>-{avgLoss.toFixed(2)}</span></div>
          </div>
          <WinLossRatioBar win={avgWin} loss={avgLoss} width={70} height={8} />
        </Card>
      </div>

      {/* Row 2: Profit Factor | Expectancy | Hold Times */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 10, marginBottom: 10 }}>
        <Card>
          <div style={ML}>Profit Factor <InfoDot title="Gross profit divided by gross loss. >1 means profitable system." /></div>
          <div style={{ ...MV, fontSize: 30 }}>{profitFactor.toFixed(2)}</div>
        </Card>
        <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={ML}>Expected Value <InfoDot title="Average monetary value won/lost per trade" /></div>
            <div style={{ ...MV, fontSize: 30, color: expectedValue >= 0 ? T.green : T.red }}>{expectedValue.toFixed(2)}</div>
          </div>
          <Sparkline data={closed.slice(-15).map(t => t.pnl)} type="bar" width={90} height={40} />
        </Card>
        <Card>
          <div style={ML}>Average Hold Times <InfoDot title="Average duration trades were held open" /></div>
          <div style={{ ...MV, fontSize: 18, color: T.bright, marginTop: 6 }}>
            <div>Spot: {spotH}h {spotM}m</div>
            <div style={{ marginTop: 4 }}>Futures: {futH}h {futM}m</div>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 10 }}>
        <EquityCurveChart equityData={equitySeries} />
        <ConsistencyHeatmap trades={closed} />
      </div>

      {/* Row 3: Invested | Balance | Live PNL | Fees */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 10, marginBottom: 10 }}>
        <Card>
          <div style={ML}>Total Invested <InfoDot title="Sum of (entry price × qty × USDT rate) across all closed trades" /></div>
          <div style={{ ...MV, fontSize: 24, color: T.blue }}>
            {totalInvested.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 13, color: T.dim, fontWeight: 400 }}>USDT</span>
          </div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 4, fontFamily: T.mono }}>
            {closed.length} closed trade{closed.length !== 1 ? "s" : ""}
          </div>
        </Card>
        <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={ML}>Balance <InfoDot title="Initial Capital + Realized PNL + Total Fees" /></div>
            <div style={{ ...MV, fontSize: 22 }}>{balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ background: T.blueDim, color: T.blue, border: `1px solid ${T.blue}40`, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontFamily: T.mono, whiteSpace: "nowrap" }}>
            {profiles.length || 1} Portfolio{(profiles.length || 1) !== 1 ? "s" : ""}
          </div>
        </Card>
        <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={ML}>Futures PNL <InfoDot title="Unrealized PNL from active Futures/Margin trades" /></div>
            <div style={{ ...MV, fontSize: 22, color: totalUnrealizedPnl >= 0 ? T.green : T.red }}>
              {totalUnrealizedPnl >= 0 ? "+" : ""}{totalUnrealizedPnl.toFixed(2)}
            </div>
          </div>
          <div style={{ background: T.border, color: T.dim, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontFamily: T.mono }}>
            {liveTrades.length} Trade{liveTrades.length !== 1 ? "s" : ""}
          </div>
        </Card>
        <Card>
          <div style={ML}>Total Fees <InfoDot title="Total fees paid across all closed trades" /></div>
          <div style={{ ...MV, fontSize: 22, color: T.red }}>{fmt$(totalFees)}</div>
        </Card>
      </div>
    </div>
  );
}


function ChartModal({ trade, onClose }) {
  const chartContainerRef = useRef();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trade || !chartContainerRef.current) return;

    let chart;
    const fetchKlineData = async () => {
      try {
        if (CapApp && Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
          // Can't easily fetch Binance directly on mobile without CORS issues
          setLoading(false);
          return;
        }
        const start = trade.openTime - 3 * 86400000;
        const end = (trade.closeTime || Date.now()) + 3 * 86400000;
        const symbol = trade.symbol.replace(/[^A-Z0-9]/ig, "").toUpperCase();
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${start}&endTime=${end}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        const klines = data.map(d => ({
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        chart = createChart(chartContainerRef.current, {
          layout: { background: { type: "solid", color: T.panel }, textColor: T.text },
          grid: { vertLines: { color: T.border }, horzLines: { color: T.border } },
          width: chartContainerRef.current.clientWidth,
          height: 400,
          timeScale: { timeVisible: true, secondsVisible: false }
        });

        const candlestickSeries = chart.addCandlestickSeries({
          upColor: T.green, downColor: T.red, borderVisible: false,
          wickUpColor: T.green, wickDownColor: T.red
        });
        candlestickSeries.setData(klines);

        const markers = [];
        markers.push({
          time: Math.floor(trade.openTime / 1000),
          position: trade.side === "Long" || trade.action === "Buy" ? "belowBar" : "aboveBar",
          color: trade.side === "Long" || trade.action === "Buy" ? T.green : T.red,
          shape: trade.side === "Long" || trade.action === "Buy" ? "arrowUp" : "arrowDown",
          text: `Entry: ${trade.entry}`
        });

        if (trade.closeTime && trade.exit) {
          markers.push({
            time: Math.floor(trade.closeTime / 1000),
            position: trade.side === "Long" || trade.action === "Buy" ? "aboveBar" : "belowBar",
            color: trade.side === "Long" || trade.action === "Buy" ? T.red : T.green,
            shape: trade.side === "Long" || trade.action === "Buy" ? "arrowDown" : "arrowUp",
            text: `Exit: ${trade.exit}`
          });
        }

        candlestickSeries.setMarkers(markers.sort((a, b) => a.time - b.time));

        if (trade.entry) {
          candlestickSeries.createPriceLine({
            price: parseFloat(trade.entry),
            color: T.blue,
            lineWidth: 2,
            lineStyle: 1, // Dashed
            axisLabelVisible: true,
            title: "Entry",
          });
        }
        if (trade.stopLoss) {
          candlestickSeries.createPriceLine({
            price: parseFloat(trade.stopLoss),
            color: T.red,
            lineWidth: 1.5,
            lineStyle: 2, // Dotted
            axisLabelVisible: true,
            title: "Stop Loss",
          });
        }
        if (trade.takeProfit) {
          candlestickSeries.createPriceLine({
            price: parseFloat(trade.takeProfit),
            color: T.green,
            lineWidth: 1.5,
            lineStyle: 2, // Dotted
            axisLabelVisible: true,
            title: "Take Profit",
          });
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to load chart", err);
        setLoading(false);
      }
    };
    fetchKlineData();

    return () => {
      if (chart) chart.remove();
    };
  }, [trade]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000b0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 14, padding: 26, width: "min(800px,95vw)", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright }}>{trade?.symbol} Chart (1H)</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>
        <div style={{ position: "relative", width: "100%", height: 400, background: T.panel2, borderRadius: 6, overflow: "hidden" }}>
          {loading && <div style={{ position: "absolute", inset: 0, padding: 20, display: "flex", flexDirection: "column", gap: 10, zIndex: 10, background: T.panel2 }}>
            <Skeleton height={20} />
            <Skeleton height={320} />
          </div>}
          <div ref={chartContainerRef} style={{ width: "100%", height: 400 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10, marginTop: 14 }}>
          <div style={{ background: T.panel2, padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>PnL</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: trade?.pnl >= 0 ? T.green : T.red }}>
              {trade?.pnl >= 0 ? "+" : ""}{trade?.pnl?.toFixed(2)}
            </div>
          </div>
          <div style={{ background: T.panel2, padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Hold Duration</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.bright }}>
              {trade?.closeTime ? `${((trade.closeTime - trade.openTime) / 3600000).toFixed(1)}h` : "Open"}
            </div>
          </div>
          <div style={{ background: T.panel2, padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Risk Reward</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.cyan }}>
              {trade?.stopLoss && trade?.exit ? `${(Math.abs(trade.exit - trade.entry) / Math.abs(trade.entry - trade.stopLoss)).toFixed(1)}R` : "N/A"}
            </div>
          </div>
          <div style={{ background: T.panel2, padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Setup</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.bright }}>
              {trade?.setup || "None"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Time Metrics ─────────────────────────────────────────────────────────────
function TimeMetrics({ trades }) {
  const closed = trades.filter(t => t.status === "closed");

  // Hold time buckets
  const buckets = { "<30m": 0, "30m–2h": 0, "2h–8h": 0, "8h–24h": 0, ">24h": 0 };
  const bucketPnl = { "<30m": 0, "30m–2h": 0, "2h–8h": 0, "8h–24h": 0, ">24h": 0 };
  closed.forEach(t => {
    const h = (t.closeTime - t.openTime) / 3600000;
    const k = h < 0.5 ? "<30m" : h < 2 ? "30m–2h" : h < 8 ? "2h–8h" : h < 24 ? "8h–24h" : ">24h";
    buckets[k]++;
    bucketPnl[k] += t.pnl;
  });
  const bucketData = Object.entries(buckets).map(([label, count]) => ({
    label, count, pnl: parseFloat(bucketPnl[label].toFixed(2)),
    avg: count > 0 ? parseFloat((bucketPnl[label] / count).toFixed(2)) : 0,
  }));

  // Hour of day performance (0–23)
  const hourData = Array.from({ length: 24 }, (_, h) => {
    const ts = closed.filter(t => new Date(t.closeTime).getHours() === h);
    const pnl = ts.reduce((s, t) => s + t.pnl, 0);
    return { hour: `${h}:00`, count: ts.length, pnl: parseFloat(pnl.toFixed(2)), avg: ts.length ? parseFloat((pnl / ts.length).toFixed(2)) : 0 };
  });

  // Day of week performance
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowData = DOW.map((day, i) => {
    const ts = closed.filter(t => new Date(t.closeTime).getDay() === i);
    const pnl = ts.reduce((s, t) => s + t.pnl, 0);
    const wins = ts.filter(t => t.pnl > 0).length;
    return { day, count: ts.length, pnl: parseFloat(pnl.toFixed(2)), winRate: ts.length ? Math.round((wins / ts.length) * 100) : 0 };
  });

  // Best and worst hours
  const activeHours = hourData.filter(h => h.count > 0);
  const bestHour = activeHours.length ? activeHours.reduce((a, b) => a.avg > b.avg ? a : b) : null;
  const worstHour = activeHours.length ? activeHours.reduce((a, b) => a.avg < b.avg ? a : b) : null;
  const bestDow = dowData.filter(d => d.count > 0).reduce((a, b) => a.pnl > b.pnl ? a : b, { pnl: 0, day: "–" });
  const worstDow = dowData.filter(d => d.count > 0).reduce((a, b) => a.pnl < b.pnl ? a : b, { pnl: 0, day: "–" });

  const maxCount = Math.max(...bucketData.map(b => b.count), 1);
  const maxHourPnl = Math.max(...hourData.map(h => Math.abs(h.pnl)), 1);
  const maxDowPnl = Math.max(...dowData.map(d => Math.abs(d.pnl)), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Summary chips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10 }}>
        {[
          { label: "Best Hour", val: bestHour ? bestHour.hour : "–", sub: bestHour ? fmt$(bestHour.avg) + " avg" : "", color: T.green },
          { label: "Worst Hour", val: worstHour ? worstHour.hour : "–", sub: worstHour ? fmt$(worstHour.avg) + " avg" : "", color: T.red },
          { label: "Best Day", val: bestDow.day, sub: fmt$(bestDow.pnl) + " total", color: T.green },
          { label: "Worst Day", val: worstDow.day, sub: fmt$(worstDow.pnl) + " total", color: T.red },
        ].map((s, i) => (
          <Card key={i}>
            <div style={ML}>{s.label}</div>
            <div style={{ fontFamily: T.mono, fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Hold time breakdown */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.bright, marginBottom: 14 }}>Performance by Hold Duration</div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ minWidth: 450, display: "flex", flexDirection: "column", gap: 10 }}>
            {bucketData.map((b) => (
              <div key={b.label} style={{ display: "grid", gridTemplateColumns: "80px 1fr 70px 80px 70px", alignItems: "center", gap: 12 }}>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: T.text }}>{b.label}</div>
                <div style={{ background: T.border, borderRadius: 3, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${(b.count / maxCount) * 100}%`, height: "100%", background: b.avg >= 0 ? T.green : T.red, borderRadius: 3, transition: "width .4s ease" }} />
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: T.dim, textAlign: "right" }}>{b.count} trades</div>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: b.pnl >= 0 ? T.green : T.red, textAlign: "right" }}>{fmt$(b.pnl)}</div>
                <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim, textAlign: "right" }}>avg {fmt$(b.avg)}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Hour of day heatmap */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.bright, marginBottom: 14 }}>PnL by Hour of Day (Close Time)</div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 8 }}>
          <div style={{ minWidth: 600, display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 3 }}>
            {hourData.map((h) => {
              const intensity = h.count === 0 ? 0 : Math.min(Math.abs(h.pnl) / maxHourPnl, 1);
              const bg = h.count === 0 ? T.border : h.pnl >= 0 ? `rgba(0,212,163,${0.1 + intensity * 0.7})` : `rgba(255,77,121,${0.1 + intensity * 0.7})`;
              return (
                <div key={h.hour} title={`${h.hour}: ${h.count} trades, ${fmt$(h.pnl)}`} style={{ background: bg, borderRadius: 3, height: 36, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 3, cursor: h.count > 0 ? "pointer" : "default" }}>
                  <span style={{ fontSize: 11, color: h.count > 0 ? T.bright : T.dim, fontFamily: T.mono }}>{h.hour.split(":")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: T.green }} /><span style={{ fontSize: 12, color: T.dim }}>Profitable hour</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: T.red }} /><span style={{ fontSize: 12, color: T.dim }}>Loss hour</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: T.border }} /><span style={{ fontSize: 12, color: T.dim }}>No trades</span></div>
        </div>
      </Card>

      {/* Day of week */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.bright, marginBottom: 14 }}>Performance by Day of Week</div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 8 }}>
          <div style={{ minWidth: 550, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {dowData.map((d) => (
              <div key={d.day} style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.dim, letterSpacing: 1, fontFamily: T.mono, marginBottom: 8 }}>{d.day.toUpperCase()}</div>
                <div style={{ position: "relative", height: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 8 }}>
                  <div style={{ width: "60%", background: d.pnl >= 0 ? T.green : T.red, borderRadius: "3px 3px 0 0", height: d.count > 0 ? `${Math.max(8, (Math.abs(d.pnl) / maxDowPnl) * 100)}%` : "4px", opacity: d.count === 0 ? 0.2 : 1, transition: "height .4s ease" }} />
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: d.pnl >= 0 ? T.green : T.red }}>{d.count > 0 ? fmt$(d.pnl) : "–"}</div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 3 }}>{d.count} trades</div>
                {d.count > 0 && <div style={{ fontSize: 11, color: T.cyan, marginTop: 2, fontFamily: T.mono }}>{d.winRate}% wr</div>}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// AddLiveTradeModal moved to components/modals

// CloseLiveTradeModal moved to components/modals
// LiveTradesView moved to components/views

// ─── Risk Calculator ──────────────────────────────────────────────────────────


// ─── Daily / Weekly Review Modal ─────────────────────────────────────────────
const MOODS = ["😤", "😞", "😐", "🙂", "🔥"];
function ReviewModal({ reviewKey, existing, onSave, onClose }) {
  const [form, setForm] = useState(existing || { mood: 3, bestTrade: "", worstTrade: "", lesson: "", followedPlan: 3, emotion: "", improvement: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const IS = { background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, padding: "9px 12px", fontSize: 14, width: "100%", outline: "none", resize: "vertical", minHeight: 60, fontFamily: T.sans, boxSizing: "border-box" };
  const LS = { fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 6, marginTop: 14 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, width: "min(560px,95vw)", maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright, letterSpacing: 1 }}>MONTHLY REVIEW</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>
        <div>
          <label style={LS}>Overall Mood</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {MOODS.map((m, i) => (
              <button key={i} onClick={() => set("mood", i + 1)} style={{ flex: 1, background: form.mood === i + 1 ? T.blueDim : T.panel2, border: `1px solid ${form.mood === i + 1 ? T.blue + "60" : T.border}`, borderRadius: 8, padding: "10px 0", cursor: "pointer", fontSize: 22 }}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={LS}>Plan Adherence (1 = emotional, 5 = disciplined)</label>
          <input type="range" min="1" max="5" value={form.followedPlan} onChange={e => set("followedPlan", parseInt(e.target.value))} style={{ width: "100%", accentColor: T.green, marginTop: 8 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 2 }}><span>Emotional</span><span>Disciplined</span></div>
        </div>
        <div><label style={LS}>Best Trade / Decision</label><textarea style={IS} value={form.bestTrade} onChange={e => set("bestTrade", e.target.value)} placeholder="What went well? Why did it work?" /></div>
        <div><label style={LS}>Worst Trade / Decision</label><textarea style={IS} value={form.worstTrade} onChange={e => set("worstTrade", e.target.value)} placeholder="What went wrong? What would you do differently?" /></div>
        <div><label style={LS}>Key Lesson</label><textarea style={IS} value={form.lesson} onChange={e => set("lesson", e.target.value)} placeholder="One thing you're taking away from this month." /></div>
        <div><label style={LS}>Emotional State Notes</label><textarea style={IS} value={form.emotion} onChange={e => set("emotion", e.target.value)} placeholder="Anxious? Overconfident? FOMO?" /></div>
        <div><label style={LS}>Focus for Next Month</label><textarea style={IS} value={form.improvement} onChange={e => set("improvement", e.target.value)} placeholder="One specific thing you will do better." /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontFamily: T.mono }}>Cancel</button>
          <button onClick={() => { onSave(reviewKey, form); onClose(); }} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>Save Review</button>
        </div>
      </div>
    </div>
  );
}

// SellSpotModal moved to components/modals

// OpenSpotView moved to components/views

function TradeFilterBar({ filterSetup, setFilterSetup, filterCoin, setFilterCoin, filterResult, setFilterResult, filterTrade, setFilterTrade, onDownload, coins, setups }) {
  const S = { background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "6px 12px", fontSize: 13, fontFamily: T.mono, outline: "none", flex: "1 1 auto", minWidth: 100 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: T.dim, fontWeight: 700, letterSpacing: 1 }}>FILTERS</span>
        <select style={S} value={filterCoin} onChange={e => setFilterCoin(e.target.value)}>
          <option value="All">All Coins</option>
          {coins.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={S} value={filterSetup} onChange={e => setFilterSetup(e.target.value)}>
          <option value="All">All Setups</option>
          {setups.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={S} value={filterResult} onChange={e => setFilterResult(e.target.value)}>
          <option value="All">All Results</option>
          <option value="Win">Wins Only</option>
          <option value="Loss">Losses Only</option>
        </select>
        <select style={S} value={filterTrade} onChange={e => setFilterTrade(e.target.value)}>
          <option value="All">All Types</option>
          <option value="spot">Spot Only</option>
          <option value="futures">Futures Only</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
        </select>
      </div>
    </div>
  );
}

function ExchangeSyncModal({ onClose, onSync, keys, setKeys }) {
  const [apiKey, setApiKey] = useState(keys.apiKey || "");
  const [apiSecret, setApiSecret] = useState(keys.apiSecret || "");
  const [status, setStatus] = useState("");

  const handleSync = async () => {
    setStatus("Syncing...");
    setKeys({ apiKey, apiSecret });
    saveApiKeys({ apiKey, apiSecret });
    try {
      await onSync(apiKey, apiSecret);
      setStatus("Sync Complete! ✅");
      setTimeout(onClose, 2000);
    } catch (err) {
      setStatus(`Error: ${err.message}. (Note: You may need a CORS extension like 'Allow CORS' in Chrome to hit Binance API from localhost).`);
    }
  };

  const IS = { background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 14, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box", marginBottom: 16 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000b0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}>
      <div style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 14, padding: 26, width: "min(460px,95vw)", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright }}>🔄 Binance API Sync</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: T.dim, marginBottom: 16, lineHeight: 1.5 }}>
          Enter a Read-Only Binance API key to automatically pull your open Futures positions into the Live Trades tab.
        </div>
        <label style={{ fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5 }}>API Key</label>
        <input style={IS} value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" />
        <label style={{ fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5 }}>API Secret</label>
        <input style={IS} value={apiSecret} onChange={e => setApiSecret(e.target.value)} type="password" />
        {status && <div style={{ fontSize: 13, color: status.includes("Error") ? T.red : T.cyan, marginBottom: 16, background: status.includes("Error") ? T.redDim : T.panel2, padding: 10, borderRadius: 6 }}>{status}</div>}
        <button onClick={handleSync} style={{ background: T.blue, border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: T.mono, width: "100%" }}>Start Sync</button>
      </div>
    </div>
  );
}

// ─── Edit Trade Modal ────────────────────────────────────────────────────────


// WatchlistView moved to components/views

// ─── Alerts View ──────────────────────────────────────────────────────────────
// AlertsView moved to components/views

export default function App() {
  const {
    isDark, setIsDark,
    view, setView,
    subTab, setSubTab,
    profiles, activeProfileId, showProfiles, setShowProfiles, activeProfile,
    initialCapital, setInitialCapital,
    apiKeys, setApiKeys,
    allTrades, allSpotOpen, allLiveTrades,
    savedSymbols, setSavedSymbols,
    tradeSetups, setTradeSetups,
    undoTrade, setUndoTrade,
    reviews, setReviews, reviewKey, setReviewKey,
    showDataMenu, setShowDataMenu,
    showAddModal, setShowAddModal,
    showClearConfirm, setShowClearConfirm,
    showCSVModal, setShowCSVModal,
    showReviewModal, setShowReviewModal,
    showSyncModal, setShowSyncModal,
    showSecurityModal, setShowSecurityModal,
    editingTrade, setEditingTrade,
    viewChartTrade, setViewChartTrade,
    dateRange, setDateRange,
    filterSetup, setFilterSetup,
    filterCoin, setFilterCoin,
    filterResult, setFilterResult,
    filterTrade, setFilterTrade,
    filterCapitalActivity, setFilterCapitalActivity,
    prefilledLiveSymbol, setPrefilledLiveSymbol,
    prefilledAlertSymbol, setPrefilledAlertSymbol,
    alerts, setAlerts,
    notifications, setNotifications,
    appToast, showToast,
    profileTrades, trades, spotOpen, liveTrades, closed, isJournalEmpty, isFilteredEmpty,
    isMobile,
    addAlert, deleteAlert,
    deleteFinishedTrade, restoreDeletedTrade, handleEditTrade,
    saveSymbol, handleQuickAdd, addTrade, importTrades, addSpotOpen,
    closeSpotOpen, deleteSpotOpen, handleApiSync, addLiveTrade, closeLiveTrade,
    saveReview, openReview, switchProfile, addProfile, updateProfile, deleteProfile, clearAllData, downloadCSV
  } = useDashboard();

  const { prices, status } = usePrices();

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────
  const DASH_TABS = ["Overview"];

  useEffect(() => {
    const onKey = (e) => {
      // Ignore when user is typing in an input/textarea/select
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n" || e.key === "N") { e.preventDefault(); setShowAddModal(true); }
      if (e.key === "Escape") {
        setShowAddModal(false);
        setEditingTrade(null);
        setShowCSVModal(false);
        setShowSyncModal(false);
        setViewChartTrade(null);
        setShowClearConfirm(false);
        setShowDataMenu(false);
        setUndoTrade(null);
      }
      // Tab shortcuts 1-6 when on Dashboard
      if (view === "Dashboard") {
        const idx = parseInt(e.key, 10);
        if (!isNaN(idx) && idx >= 1 && idx <= DASH_TABS.length) {
          e.preventDefault();
          setSubTab(DASH_TABS[idx - 1]);
        }
      }
      // Quick undo
      if ((e.key === "z" || e.key === "Z") && !e.metaKey && !e.ctrlKey && undoTrade) {
        e.preventDefault();
        restoreDeletedTrade();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view, undoTrade, restoreDeletedTrade, setShowAddModal, setEditingTrade, setShowCSVModal, setShowSyncModal, setViewChartTrade, setShowClearConfirm, setShowDataMenu, setUndoTrade, setSubTab]);

  // ── Modal state for back button ──
  const modalsRef = useRef(false);
  useEffect(() => {
    modalsRef.current = !!(showAddModal || editingTrade || showCSVModal || showSyncModal || viewChartTrade || showClearConfirm || showDataMenu || undoTrade);
  });

  useEffect(() => {
    // Capacitor hardware back button handling
    let backListener = null;
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (modalsRef.current) {
        setShowAddModal(false);
        setEditingTrade(null);
        setShowCSVModal(false);
        setShowSyncModal(false);
        setViewChartTrade(null);
        setShowClearConfirm(false);
        setShowDataMenu(false);
        setUndoTrade(null);
      } else if (view !== "Dashboard") {
        setView("Dashboard");
      } else {
        CapApp.minimizeApp();
      }
    }).then(l => backListener = l);

    return () => {
      if (backListener) backListener.remove();
    };
  }, [setShowAddModal, setEditingTrade, setShowCSVModal, setShowSyncModal, setViewChartTrade, setShowClearConfirm, setShowDataMenu, setUndoTrade, view, setView]);

  // Ensure modals close when navigating views
  useEffect(() => {
    setShowAddModal(false);
    setShowCSVModal(false);
    setShowSyncModal(false);
    setEditingTrade(null);
  }, [view, setShowAddModal, setShowCSVModal, setShowSyncModal, setEditingTrade]);

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
          overscroll-behavior-x: none;
          background: ${T.bg};
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div style={{ display: "flex", minHeight: "100dvh", maxWidth: "100vw", overflowX: "hidden", background: T.bg, fontFamily: T.sans, color: T.text, transition: "background .2s", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: isMobile ? "max(70px, env(safe-area-inset-bottom, 0px))" : 0 }}>
        {!isMobile && (
          <Sidebar
            view={view} setView={setView}
            onClear={() => setShowClearConfirm(true)}
            tradeCount={trades.length + spotOpen.length}
            spotOpenCount={spotOpen.length}
            profiles={profiles}
            activeProfileId={activeProfileId}
            onOpenProfiles={() => setShowProfiles(true)}
          />
        )}
        <AlertsEngine />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Top bar */}
          {!isMobile && <TopNav />}

          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: isMobile ? "12px 14px" : 18 }}>
            {/* Notification Banners */}
            {notifications.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {notifications.map(n => (
                  <div key={n.id} style={{
                    background: T.blueDim, border: `1px solid ${T.blue}50`, borderRadius: 8,
                    padding: "10px 14px", display: "flex", justifyContent: "space-between",
                    alignItems: "center", color: T.bright, fontFamily: T.mono, fontSize: 12,
                    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15 }}>🔔</span>
                      <span>
                        <strong>Alert Triggered:</strong> {n.symbol} crossed {n.condition === "above" ? "above ▲" : "below ▼"} {n.targetPrice.toLocaleString()} (Current: {n.currentPrice.toLocaleString()})
                      </span>
                    </div>
                    <button
                      onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                      style={{ background: "transparent", border: "none", color: T.dim, cursor: "pointer", fontSize: 16, padding: "8px 12px" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(view === "Finished Trades" || view === "Journal") && (
              <TradeFilterBar
                filterSetup={filterSetup} setFilterSetup={setFilterSetup}
                filterCoin={filterCoin} setFilterCoin={setFilterCoin}
                filterResult={filterResult} setFilterResult={setFilterResult}
                filterTrade={filterTrade} setFilterTrade={setFilterTrade}
                onDownload={downloadCSV}
                coins={Array.from(new Set(closed.map(t => t.symbol)))}
                setups={SETUPS}
              />
            )}
            {view === "Dashboard" ? (
              isJournalEmpty ? <EmptyState onAdd={() => setShowAddModal(true)} /> :
              isFilteredEmpty ? <EmptyState filtered={true} /> :
              (subTab === "Overview" && <Overview trades={trades} allProfileTrades={profileTrades} initialCapital={initialCapital} profiles={profiles} liveTrades={liveTrades} isMobile={isMobile} />)
            ) : null}
            <>
              {view === "Open Spot Trades" && <OpenSpotView spotOpen={spotOpen} onSell={closeSpotOpen} onDelete={deleteSpotOpen} onEdit={setEditingTrade} savedSymbols={savedSymbols} />}
                {view === "Live Trades(ongoing)" && (
                  <LiveTradesView
                    liveTrades={liveTrades}
                    onAdd={addLiveTrade}
                    onClose={closeLiveTrade}
                    savedSymbols={savedSymbols}
                    prices={prices}
                    status={status}
                    prefilledSymbol={prefilledLiveSymbol}
                    clearPrefilledSymbol={() => setPrefilledLiveSymbol(null)}
                  />
                )}
                {view === "Finished Trades" && (
                  <TradeLog
                    trades={closed}
                    title="Finished Trades"
                    onEdit={setEditingTrade}
                    onViewChart={setViewChartTrade}
                    onDelete={deleteFinishedTrade}
                    onSave={handleEditTrade}
                    onQuickAdd={handleQuickAdd}
                    savedSymbols={savedSymbols}
                  />
                )}
                {view === "Watchlist" && (
                  <WatchlistView
                    savedSymbols={savedSymbols}
                    setSavedSymbols={setSavedSymbols}
                    prices={prices}
                    status={status}
                    onAddAlert={(sym) => {
                      setPrefilledAlertSymbol(sym);
                      setView("Alerts");
                    }}
                    onOpenLiveTrade={(sym) => {
                      setPrefilledLiveSymbol(sym);
                      setView("Live Trades(ongoing)");
                    }}
                  />
                )}
                {view === "Alerts" && (
                  <AlertsView
                    alerts={alerts}
                    onAddAlert={addAlert}
                    onDeleteAlert={deleteAlert}
                    savedSymbols={savedSymbols}
                    prices={prices}
                    prefilledSymbol={prefilledAlertSymbol}
                    clearPrefilledSymbol={() => setPrefilledAlertSymbol(null)}
                  />
                )}
                {view === "Journal" && (
                  <TradeLog 
                    trades={trades} 
                    onEdit={setEditingTrade}
                    onViewChart={setViewChartTrade}
                    onDelete={deleteFinishedTrade}
                    onSave={handleEditTrade}
                    onQuickAdd={handleQuickAdd}
                    savedSymbols={savedSymbols}
                  />
                )}
                {view === "Setup" && (
                  <TradeSetupsManager trades={trades} tradeSetups={tradeSetups} setTradeSetups={setTradeSetups} showToast={showToast} />
                )}
                {view === "Analytics" && (
                  <div style={{ padding: isMobile ? "0" : "0", display: "flex", flexDirection: "column", flex: 1 }}>
                    {isMobile && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 16px", marginBottom: 20 }}>
                        {["Time Metrics", "Analytics", "Calendar", "Risk Calc", "Trade Summary"].map(t => (
                          <button
                            key={t}
                            onClick={() => setSubTab(t)}
                            style={{
                              background: subTab === t ? T.purple : T.panel,
                              border: `1px solid ${subTab === t ? T.purple : T.border}`,
                              color: subTab === t ? "#FFF" : T.dim,
                              padding: "12px",
                              borderRadius: 10,
                              fontSize: 13,
                              fontWeight: subTab === t ? 700 : 500,
                              cursor: "pointer",
                              textAlign: "center"
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                    {subTab === "Trade Summary" && (
                      <TradeSummary
                        trades={trades}
                        allProfileTrades={profileTrades}
                        initialCapital={initialCapital}
                        profileId={activeProfileId}
                        onUpdateCapital={(val) => { setInitialCapital(val); }}
                      />
                    )}
                    {subTab === "Calendar" && <TradingCalendar />}
                    {subTab === "Analytics" && <Analytics />}
                    {subTab === "Time Metrics" && <TimeMetrics trades={trades} />}
                    {subTab === "Risk Calc" && <RiskCalculator />}
                    </div>
                  </div>
                )}
                {view === "Profile" && (
                  <div style={{ padding: isMobile ? "0" : "0", display: "flex", flexDirection: "column", flex: 1 }}>
                    <div style={{ flex: 1 }}>
                      <AccountsManager 
                        profiles={profiles}
                        activeProfileId={activeProfileId}
                        switchProfile={switchProfile}
                        addProfile={addProfile}
                        updateProfile={updateProfile}
                        trades={profileTrades}
                        liveTrades={liveTrades}
                        addTrade={addTrade}
                        showToast={showToast}
                      />
                    </div>
                  </div>
                )}
              </>
          </div>
        </div>
      </div>

      {isMobile && (
        <BottomNav
          view={view}
          setView={(v) => {
            if (v === "Trade") {
              setShowAddModal(true);
            } else {
              setShowAddModal(false);
              setView(v);
            }
          }}
        />
      )}

      {showProfiles && (
        <ProfileManagerModal
          profiles={profiles}
          activeId={activeProfileId}
          onSwitch={switchProfile}
          onAdd={addProfile}
          onDelete={deleteProfile}
          onClose={() => setShowProfiles(false)}
        />
      )}

      {showAddModal && <AddTradeModal />}
      {showCSVModal && <CSVImportModal />}
      {showReviewModal && <ReviewModal reviewKey={reviewKey} existing={reviews[reviewKey]} onSave={saveReview} onClose={() => setShowReviewModal(false)} />}
      {viewChartTrade && <ChartModal trade={viewChartTrade} onClose={() => setViewChartTrade(null)} />}
      {showSyncModal && <ExchangeSyncModal onClose={() => setShowSyncModal(false)} onSync={handleApiSync} keys={apiKeys} setKeys={setApiKeys} />}
      {editingTrade && <EditTradeModal />}
      {showSecurityModal && <SecuritySettingsModal onClose={() => setShowSecurityModal(false)} />}

      {showClearConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(6px)" }}>
          <div style={{ background: T.panel, border: `1px solid ${T.red}40`, borderRadius: 14, padding: 28, width: "min(400px,90vw)", boxShadow: "0 30px 80px #00000070" }}>
            <div style={{ fontFamily: T.mono, fontSize: 16, color: T.red, letterSpacing: 1, marginBottom: 12 }}>⚠ CLEAR PROFILE DATA</div>
            <div style={{ fontSize: 15, color: T.text, marginBottom: 20, lineHeight: 1.6 }}>This deletes all {trades.length + spotOpen.length} trades in the active profile. Other profiles are unaffected. Cannot be undone.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowClearConfirm(false)} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontFamily: T.mono }}>Cancel</button>
              <button onClick={clearAllData} style={{ background: T.redDim, border: `1px solid ${T.red}50`, color: T.red, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>Delete Profile Trades</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Undo Delete Toast ── */}
      {undoTrade && (
        <div style={{
          position: "fixed", bottom: isMobile ? 80 : 28, left: "50%", transform: "translateX(-50%)",
          background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 12,
          padding: "13px 20px", zIndex: 9999,
          display: "flex", gap: 16, alignItems: "center",
          boxShadow: "0 12px 48px #00000070",
          fontFamily: T.mono, fontSize: 13,
          animation: "fadeInUp 0.25s ease"
        }}>
          <span style={{ color: T.dim }}>🗑 Trade deleted —</span>
          <span style={{ color: T.bright, fontWeight: 700 }}>
            {undoTrade.symbol} {undoTrade.side || undoTrade.action} {undoTrade.exit ? `@ ${undoTrade.exit}` : ""}
          </span>
          <button onClick={restoreDeletedTrade} style={{
            background: T.blueDim, border: `1px solid ${T.blue}50`,
            color: T.blue, borderRadius: 7, padding: "5px 14px",
            cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700
          }}>↩ Undo</button>
          <button onClick={() => setUndoTrade(null)} style={{
            background: "none", border: "none", color: T.dim,
            cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1
          }}>✕</button>
        </div>
      )}

      {/* ── App Toast ── */}
      {appToast && (
        <div style={{
          position: "fixed", bottom: isMobile ? 80 : 28, left: "50%", transform: "translateX(-50%)",
          background: appToast.type === "warning" ? T.redDim : T.blueDim, 
          border: `1px solid ${appToast.type === "warning" ? T.red : T.blue}50`, 
          borderRadius: 12, padding: "13px 20px", zIndex: 9999,
          display: "flex", gap: 16, alignItems: "center",
          boxShadow: "0 12px 48px #00000070", fontFamily: T.mono, fontSize: 13,
          color: T.bright, fontWeight: 700, animation: "fadeInUp 0.25s ease"
        }}>
          {appToast.type === "warning" ? "⚠️ " : "ℹ️ "}
          {appToast.msg}
        </div>
      )}

      {/* ── Keyboard shortcut hint ── */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}