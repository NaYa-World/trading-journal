import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createChart } from "lightweight-charts";
import CryptoJS from "crypto-js";
import { App as CapApp } from '@capacitor/app';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

import { T, DARK, LIGHT } from "./utils/theme.js";
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
import {
  Sidebar, TopNav, BottomNav, ProfileManagerModal,
  AddTradeModal, EditTradeModal, CSVImportModal,
  TradeLog, TradeSummary, RiskCalculator, TradingCalendar, Analytics,
  Tag, CoinIcon, InfoDot, Card, ML, MV,
  Placeholder, EmptyState, Skeleton, SemiGauge, DonutGauge, MaskedDateInput,
  Sparkline, WinLossRatioBar
} from "./components";

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
function Overview({ trades, allProfileTrades, initialCapital = 0, profiles = [], liveTrades = [] }) {
  const allClosed = trades.filter(t => t.status === "closed");
  const closed = allClosed.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
  const wins = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl < 0);
  const realizedPnl = closed.reduce((s, t) => s + t.pnl + (t.fees || 0), 0);
  const winRate = calculateWinRate(closed);
  const totalFees = closed.reduce((s, t) => s + (t.fees || 0), 0);
  const totalInvested = closed.reduce((s, t) => s + (t.entry * t.qty * (t.usdtRate || 1)), 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 1;
  const avgRR = avgWin / avgLoss;
  const profitFactor = calculateProfitFactor(closed);
  const expectedValue = calculateExpectancy(closed);
  const spotClosed = closed.filter(t => t.tradeType === "Spot");
  const futClosed = closed.filter(t => t.tradeType !== "Spot");
  const spotAvgHold = spotClosed.length ? spotClosed.reduce((s, t) => s + (t.closeTime - t.openTime), 0) / spotClosed.length : 0;
  const futAvgHold = futClosed.length ? futClosed.reduce((s, t) => s + (t.closeTime - t.openTime), 0) / futClosed.length : 0;
  const spotH = Math.floor(spotAvgHold / 3600000);
  const spotM = Math.floor((spotAvgHold % 3600000) / 60000);
  const futH = Math.floor(futAvgHold / 3600000);
  const futM = Math.floor((futAvgHold % 3600000) / 60000);
  const INITIAL_CAPITAL = initialCapital;

  const allProfileClosed = (allProfileTrades || trades).filter(t => t.status === "closed");
  const firstDeposit = allProfileClosed.find(t => t.entryType === "Deposit" || t.symbol === "Deposit");
  const startingCapital = firstDeposit ? firstDeposit.qty : (initialCapital || 0);
  const otherDepositsVal = allProfileClosed
    .filter(t => (t.entryType === "Deposit" || t.symbol === "Deposit") && t.id !== (firstDeposit ? firstDeposit.id : null))
    .reduce((s, t) => s + t.qty, 0);
  const totalAccountDeposits = startingCapital + otherDepositsVal;
  const withdrawalsVal = allProfileClosed
    .filter(t => t.entryType === "Withdrawal" || t.symbol === "Withdrawal")
    .reduce((s, t) => s + t.qty, 0);

  const profileClosedTrades = allProfileClosed.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
  const profileRealizedPnl = profileClosedTrades.reduce((s, t) => s + t.pnl, 0);
  const profileTotalFees = profileClosedTrades.reduce((s, t) => s + (t.fees || 0), 0);
  const balance = totalAccountDeposits - withdrawalsVal + profileRealizedPnl + profileTotalFees;

  let running = 0, peak = 0, maxDD = 0, maxRunup = 0;
  const equitySeries = [{ date: "Start", val: 0 }, ...closed.sort((a, b) => a.closeTime - b.closeTime).map(t => {
    running += t.pnl + (t.fees || 0);
    if (running > peak) { maxRunup = Math.max(maxRunup, running); peak = running; }
    maxDD = Math.min(maxDD, running - peak);
    return { date: fmtDate(t.closeTime), val: parseFloat(running.toFixed(2)) };
  })];

  const dailyPnl = Object.entries(closed.reduce((acc, t) => {
    const d = fmtDateShort(t.closeTime);
    acc[d] = (acc[d] || 0) + t.pnl + (t.fees || 0);
    return acc;
  }, {})).map(([date, val]) => ({ date, val: parseFloat(val.toFixed(2)) }));

  const { prices } = useDashboard();
  const totalUnrealizedPnl = liveTrades.reduce((sum, t) => {
    const p = prices[t.symbol];
    if (!p) return sum;
    return sum + (p.price - t.entry) * t.qty * (t.side === "Long" ? 1 : -1) * (t.leverage || 1);
  }, 0);

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


// ─── Add Live Trade Modal ─────────────────────────────────────────────────────
function AddLiveTradeModal({ onAdd, onClose, savedSymbols, initialSymbol }) {
  const { showToast } = useDashboard();
  const [form, setForm] = useState({
    exchange: "Binance", tradeType: "Futures", symbol: initialSymbol || "", side: "Long",
    entry: "", qty: "", leverage: "1", stopLoss: "", takeProfit: "",
    openTime: "", notes: "",
  });
  const [symbolInput, setSymbolInput] = useState(initialSymbol || "");
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const cryptoSymbols = Array.isArray(savedSymbols) ? savedSymbols : DEFAULT_SYMBOLS;
  const filtered = symbolInput
    ? cryptoSymbols.filter(s => s.toLowerCase().includes(symbolInput.toLowerCase()))
    : cryptoSymbols;
  const qc = getQuoteCurrency(form.symbol) || "USDT";

  const handle = async () => {
    const e = parseFloat(form.entry), q = parseFloat(form.qty);
    if (!form.symbol.trim() || isNaN(e) || isNaN(q)) return;

    setLoading(true);
    try {
      const sym = form.symbol.trim().toUpperCase();
      let openT = parseMaskedDate(form.openTime);
      if (openT > Date.now()) {
        openT = Date.now();
        showToast("Entry time was in the future. It has been automatically set to the current time.", "warning");
      }

      const quoteCurrency = getQuoteCurrency(sym);
      const usdtRate = await fetchUsdtRate(quoteCurrency, openT);

      onAdd({
        id: Date.now(), ...form,
        symbol: sym,
        entry: e, qty: q,
        leverage: parseFloat(form.leverage) || 1,
        stopLoss: form.stopLoss ? parseFloat(form.stopLoss) : null,
        takeProfit: form.takeProfit ? parseFloat(form.takeProfit) : null,
        openTime: openT,
        status: "live",
        quoteCurrency,
        usdtRate,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const IS = { background: "#080d14", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 14, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box" };
  const LS = { fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5, marginTop: 12 };

  const showLeverage = form.tradeType === "Futures" || form.tradeType === "Margin";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.cyan}30`, borderRadius: 14, padding: 26, width: "min(560px,95vw)", maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}`, animation: "pulse 1.5s infinite" }} />
            <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright, letterSpacing: 1.5 }}>OPEN LIVE TRADE</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>

        {/* Exchange + Type row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
          <div>
            <label style={LS}>Exchange</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {EXCHANGES.map(ex => (
                <button key={ex} onClick={() => set("exchange", ex)} style={{ flex: 1, background: form.exchange === ex ? T.blueDim : T.panel2, border: `1px solid ${form.exchange === ex ? T.blue + "60" : T.border}`, color: form.exchange === ex ? T.blue : T.dim, borderRadius: 6, padding: "7px 0", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>{ex}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={LS}>Trade Type</label>
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {["Margin", "Futures"].map(tt => (
                <button key={tt} onClick={() => set("tradeType", tt)} style={{ flex: 1, minWidth: 60, background: form.tradeType === tt ? T.blueDim : T.panel2, border: `1px solid ${form.tradeType === tt ? T.blue + "60" : T.border}`, color: form.tradeType === tt ? T.blue : T.dim, borderRadius: 6, padding: "7px 4px", cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>{tt}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Symbol autocomplete */}
          <div style={{ position: "relative" }}>
            <label style={LS}>Symbol</label>
            <input style={IS} value={symbolInput}
              onChange={e => { setSymbolInput(e.target.value.toUpperCase()); set("symbol", e.target.value.toUpperCase()); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="e.g. BTCUSDT" autoComplete="off" />
            {showDrop && filtered.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.panel2, border: `1px solid ${T.border2}`, borderRadius: 6, zIndex: 10, maxHeight: 130, overflowY: "auto", WebkitOverflowScrolling: "touch", marginTop: 2, boxShadow: "0 8px 32px #00000050" }}>
                {filtered.map(s => (
                  <div key={s} onMouseDown={() => { set("symbol", s); setSymbolInput(s); setShowDrop(false); }}
                    style={{ padding: "7px 10px", fontSize: 11, fontFamily: T.mono, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = T.border}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <CoinIcon symbol={s} size={16} />
                    <span style={{ flex: 1 }}>{s}</span>
                    <span style={{ color: T.dim, fontSize: 11 }}>{getQuoteCurrency(s)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={LS}>Side</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {SIDES.map(s => (
                <button key={s} onClick={() => set("side", s)} style={{ flex: 1, background: form.side === s ? (s === "Long" ? T.greenDim : T.redDim) : T.panel2, border: `1px solid ${form.side === s ? (s === "Long" ? T.green : T.red) + "60" : T.border}`, color: form.side === s ? (s === "Long" ? T.green : T.red) : T.dim, borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>{s}</button>
              ))}
            </div>
          </div>

          <div><label style={LS}>Entry Price ({qc})</label><input style={IS} type="number" inputMode="decimal" value={form.entry} onChange={e => set("entry", e.target.value)} placeholder="0.00" /></div>
          <div><label style={LS}>Quantity</label><input style={IS} type="number" inputMode="decimal" value={form.qty} onChange={e => set("qty", e.target.value)} placeholder="0.00" /></div>

          {showLeverage && (
            <div><label style={LS}>Leverage</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input style={{ ...IS, width: 80, flexShrink: 0 }} type="number" inputMode="decimal" value={form.leverage} onChange={e => set("leverage", e.target.value)} min="1" max="125" />
                <span style={{ fontFamily: T.mono, fontSize: 16, color: T.orange, fontWeight: 700 }}>{form.leverage}×</span>
              </div>
            </div>
          )}

          <div><label style={LS}>Stop Loss ({qc})</label><input style={IS} type="number" inputMode="decimal" value={form.stopLoss} onChange={e => set("stopLoss", e.target.value)} placeholder="Optional" /></div>
          <div><label style={LS}>Take Profit ({qc})</label><input style={IS} type="number" inputMode="decimal" value={form.takeProfit} onChange={e => set("takeProfit", e.target.value)} placeholder="Optional" /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={LS}>Open Time</label><MaskedDateInput style={IS} value={form.openTime} onChange={v => set("openTime", v)} /></div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={LS}>Notes</label>
          <textarea style={{ ...IS, resize: "vertical", minHeight: 52 }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Setup reason, entry thesis..." />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontFamily: T.mono }} disabled={loading}>Cancel</button>
          <button onClick={handle} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }} disabled={loading}>
            {loading ? "Looking up rate..." : "Open Trade ↗"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Close Live Trade Modal ───────────────────────────────────────────────────
function CloseLiveTradeModal({ trade, currentPrice, onClose: onModalClose, onConfirm }) {
  const [exitPrice, setExitPrice] = useState(currentPrice ? currentPrice.toFixed(4) : "");
  const [closeReason, setCloseReason] = useState("Target Hit");
  const [mistake, setMistake] = useState("None");
  const [chartUrl, setChartUrl] = useState("");
  const [fees, setFees] = useState("");

  // Auto-calculate exit fee
  useEffect(() => {
    const x = parseFloat(exitPrice);
    if (!isNaN(x) && x > 0 && trade?.qty > 0) {
      setFees((x * trade.qty * 0.0006).toFixed(4));
    }
  }, [exitPrice, trade]);

  const exit = parseFloat(exitPrice);
  const pnl = !isNaN(exit) && trade
    ? (exit - trade.entry) * trade.qty * (trade.side === "Long" ? 1 : -1)
    : null;

  const IS = { background: "#080d14", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 14, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box" };
  const LS = { fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5, marginTop: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onModalClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.red}30`, borderRadius: 14, padding: 26, width: "min(420px,95vw)", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: T.mono, fontSize: 15, color: T.bright, letterSpacing: 1 }}>CLOSE TRADE — {trade?.symbol}</div>
          <button onClick={onModalClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>

        {currentPrice && (
          <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: T.dim, fontFamily: T.mono }}>LIVE PRICE</span>
            <span style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.cyan }}>{currentPrice.toFixed(4)}</span>
            <button onClick={() => setExitPrice(currentPrice.toFixed(4))} style={{ background: T.blueDim, border: `1px solid ${T.blue}40`, color: T.blue, borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontFamily: T.mono }}>Use Live</button>
          </div>
        )}

        <div>
          <label style={LS}>Exit Price (USDT)</label>
          <input style={IS} type="number" inputMode="decimal" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label style={LS}>Close Reason</label>
          <select style={IS} value={closeReason} onChange={e => setCloseReason(e.target.value)}>
            {CLOSE_REASONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={LS}>Mistake</label><select style={IS} value={mistake} onChange={e => setMistake(e.target.value)}>{MISTAKES.map(m => <option key={m}>{m}</option>)}</select></div>
          <div><label style={LS}>Chart URL</label><input style={IS} value={chartUrl} onChange={e => setChartUrl(e.target.value)} placeholder="https://..." /></div>
        </div>
        <div>
          <label style={LS}>Fees (USDT)</label>
          <input style={IS} type="number" inputMode="decimal" value={fees} onChange={e => setFees(e.target.value)} placeholder="0.00" />
        </div>

        {pnl !== null && (
          <div style={{ background: pnl >= 0 ? T.greenDim : T.redDim, border: `1px solid ${pnl >= 0 ? T.green : T.red}40`, borderRadius: 8, padding: "12px 16px", marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: T.dim, fontFamily: T.mono }}>ESTIMATED PnL</span>
            <span style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color: pnl >= 0 ? T.green : T.red }}>{fmtPnl(pnl)}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onModalClose} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontFamily: T.mono }}>Cancel</button>
          <button onClick={() => onConfirm({ exit: parseFloat(exitPrice), closeReason, fees: -(Math.abs(parseFloat(fees) || 0)) })}
            style={{ background: T.redDim, border: `1px solid ${T.red}50`, color: T.red, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>Close Trade</button>
        </div>
      </div>
    </div>
  );
}

// ─── Live Trades View ─────────────────────────────────────────────────────────
function LiveTrades({ liveTrades, onAdd, onClose, savedSymbols, prices, status, prefilledSymbol, clearPrefilledSymbol }) {
  const [showAdd, setShowAdd] = useState(false);
  const [closingTrade, setClosingTrade] = useState(null);

  useEffect(() => {
    if (prefilledSymbol) {
      setShowAdd(true);
    }
  }, [prefilledSymbol]);

  const totalUnrealizedPnl = liveTrades.reduce((sum, t) => {
    const p = prices[t.symbol];
    if (!p) return sum;
    return sum + (p.price - t.entry) * t.qty * (t.side === "Long" ? 1 : -1) * (t.leverage || 1);
  }, 0);

  const TYPE_COLORS = { Spot: T.green, Futures: T.orange, Margin: T.purple, Options: T.cyan };

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: status === "ok" ? T.green : status === "fetching" ? T.yellow : T.dim, boxShadow: status === "ok" ? `0 0 6px ${T.green}` : "none" }} />
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.dim, letterSpacing: 1 }}>
              {status === "ok" ? "LIVE · 3s" : status === "fetching" ? "UPDATING..." : "CONNECTING..."}
            </span>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 13, color: liveTrades.length ? T.cyan : T.dim }}>{liveTrades.length} Open Position{liveTrades.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {liveTrades.length > 0 && (
            <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: totalUnrealizedPnl >= 0 ? T.green : T.red }}>
              Unrealized: {fmtPnl(totalUnrealizedPnl)}
            </div>
          )}
          <button onClick={() => setShowAdd(true)} style={{ background: T.green, border: "none", color: "#000", borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: T.mono }}>+ Open Trade</button>
        </div>
      </div>

      {/* Empty state */}
      {liveTrades.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 14 }}>
          <div style={{ fontSize: 38 }}>◎</div>
          <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright }}>No open positions</div>
          <div style={{ fontSize: 14, color: T.dim }}>Open a trade to track it live with real-time PnL</div>
          <button onClick={() => setShowAdd(true)} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: T.mono, marginTop: 4 }}>+ Open First Trade</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {liveTrades.map(trade => {
            const p = prices[trade.symbol];
            const currentPrice = p?.price;
            const lev = trade.leverage || 1;
            const nativeUnrealizedPnl = currentPrice
              ? (currentPrice - trade.entry) * trade.qty * (trade.side === "Long" ? 1 : -1) * lev
              : null;
            const unrealizedPnl = nativeUnrealizedPnl !== null ? nativeUnrealizedPnl * (trade.usdtRate || 1) : null;
            const pnlPct = nativeUnrealizedPnl !== null ? (nativeUnrealizedPnl / (trade.entry * trade.qty * lev)) * 100 : null;
            const distToSL = trade.stopLoss && currentPrice ? ((currentPrice - trade.stopLoss) / currentPrice * 100 * (trade.side === "Long" ? 1 : -1)) : null;
            const distToTP = trade.takeProfit && currentPrice ? ((trade.takeProfit - currentPrice) / currentPrice * 100 * (trade.side === "Long" ? 1 : -1)) : null;
            const typeColor = TYPE_COLORS[trade.tradeType] || T.dim;
            const holdMs = Date.now() - trade.openTime;
            const holdH = Math.floor(holdMs / 3600000);
            const holdM = Math.floor((holdMs % 3600000) / 60000);

            return (
              <div key={trade.id} style={{ background: T.panel, border: `1px solid ${unrealizedPnl !== null ? (unrealizedPnl >= 0 ? T.green + "30" : T.red + "30") : T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CoinIcon symbol={trade.symbol} size={36} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: T.bright }}>{trade.symbol}</span>
                        <span style={{ background: trade.side === "Long" ? T.greenDim : T.redDim, color: trade.side === "Long" ? T.green : T.red, border: `1px solid ${trade.side === "Long" ? T.green : T.red}40`, borderRadius: 4, padding: "2px 7px", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>{trade.side}</span>
                        <span style={{ background: typeColor + "18", color: typeColor, border: `1px solid ${typeColor}40`, borderRadius: 4, padding: "2px 7px", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>{trade.tradeType}</span>
                        {trade.leverage > 1 && <span style={{ background: T.orangeDim, color: T.orange, border: `1px solid ${T.orange}40`, borderRadius: 4, padding: "2px 7px", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>{trade.leverage}×</span>}
                        <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{trade.exchange}</span>
                      </div>
                      <div style={{ fontSize: 12, color: T.dim, marginTop: 3, fontFamily: T.mono }}>
                        Opened {holdH}h {holdM}m ago · Entry: {trade.entry.toFixed(4)} · Qty: {trade.qty}
                      </div>
                    </div>
                  </div>

                  {/* Live price + PnL */}
                  <div style={{ textAlign: "right" }}>
                    {currentPrice ? (
                      <>
                        <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: T.cyan }}>{currentPrice.toFixed(4)}</div>
                        <div style={{ fontSize: 12, color: p.change24h >= 0 ? T.green : T.red, fontFamily: T.mono }}>{p.change24h >= 0 ? "+" : ""}{p.change24h?.toFixed(2)}% 24h</div>
                      </>
                    ) : (
                      <Skeleton width={120} height={20} />
                    )}
                  </div>
                </div>

                {/* PnL + levels row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 8, marginBottom: 12 }}>
                  <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>UNREALIZED PnL</div>
                    <div style={{ fontFamily: T.mono, fontSize: 17, fontWeight: 700, color: unrealizedPnl !== null ? (unrealizedPnl >= 0 ? T.green : T.red) : T.dim }}>
                      {unrealizedPnl !== null ? fmtPnl(unrealizedPnl) : "–"}
                    </div>
                    {trade.quoteCurrency && trade.quoteCurrency !== "USDT" && nativeUnrealizedPnl !== null && (
                      <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{nativeUnrealizedPnl > 0 ? "+" : ""}{nativeUnrealizedPnl.toFixed(4)} {trade.quoteCurrency}</div>
                    )}
                    {pnlPct !== null && <div style={{ fontSize: 12, color: pnlPct >= 0 ? T.green : T.red, fontFamily: T.mono, marginTop: 2 }}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div>}
                  </div>
                  <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>STOP LOSS</div>
                    <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: trade.stopLoss ? T.red : T.dim }}>{trade.stopLoss ? trade.stopLoss.toFixed(4) : "—"}</div>
                    {distToSL !== null && <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono }}>{distToSL.toFixed(2)}% away</div>}
                  </div>
                  <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>TAKE PROFIT</div>
                    <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: trade.takeProfit ? T.green : T.dim }}>{trade.takeProfit ? trade.takeProfit.toFixed(4) : "—"}</div>
                    {distToTP !== null && <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono }}>{distToTP.toFixed(2)}% away</div>}
                  </div>
                  <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>24H RANGE</div>
                    {p ? (
                      <>
                        <div style={{ fontSize: 12, color: T.green, fontFamily: T.mono }}>H: {p.high24h?.toFixed(2)}</div>
                        <div style={{ fontSize: 12, color: T.red, fontFamily: T.mono }}>L: {p.low24h?.toFixed(2)}</div>
                      </>
                    ) : <div style={{ fontSize: 14, color: T.dim }}>–</div>}
                  </div>
                </div>

                {/* Notes + close button */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {trade.notes ? <div style={{ fontSize: 13, color: T.dim, fontStyle: "italic", maxWidth: "70%" }}>{trade.notes}</div> : <div />}
                  <button onClick={() => setClosingTrade(trade)}
                    style={{ background: T.redDim, border: `1px solid ${T.red}40`, color: T.red, borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>
                    Close Trade
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddLiveTradeModal
          onAdd={(t) => {
            onAdd(t);
            setShowAdd(false);
            if (clearPrefilledSymbol) clearPrefilledSymbol();
          }}
          onClose={() => {
            setShowAdd(false);
            if (clearPrefilledSymbol) clearPrefilledSymbol();
          }}
          savedSymbols={savedSymbols}
          initialSymbol={prefilledSymbol}
        />
      )}
      {closingTrade && (
        <CloseLiveTradeModal
          trade={closingTrade}
          currentPrice={prices[closingTrade.symbol]?.price}
          onClose={() => setClosingTrade(null)}
          onConfirm={(closeData) => { onClose(closingTrade, closeData); setClosingTrade(null); }}
        />
      )}
    </div>
  );
}

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

function SellSpotModal({ trade, currentPrice, onClose, onConfirm }) {
  const { showToast } = useDashboard();
  const [sellPrice, setSellPrice] = useState(currentPrice ? currentPrice.toFixed(4) : trade.entry.toFixed(4));
  const [sellTime, setSellTime] = useState("");
  const [fees, setFees] = useState("");
  const [reason, setReason] = useState("Target Hit");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const exit = parseFloat(sellPrice);
  const pnl = !isNaN(exit) ? (exit - trade.entry) * trade.qty : null;
  const qc = getQuoteCurrency(trade.symbol) || "USDT";
  const IS = { background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 12, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box" };
  const LS = { fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5, marginTop: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.green}30`, borderRadius: 14, padding: 26, width: "min(440px,95vw)", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 13, color: T.bright, letterSpacing: 1 }}>RECORD SELL — {trade.symbol}</div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 2, fontFamily: T.mono }}>Bought @ {trade.entry.toFixed(4)} · {trade.qty} units</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        {currentPrice && (
          <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>LIVE PRICE</span>
            <span style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.cyan }}>{currentPrice.toFixed(4)}</span>
            <button onClick={() => setSellPrice(currentPrice.toFixed(4))} style={{ background: T.blueDim, border: `1px solid ${T.blue}40`, color: T.blue, borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontFamily: T.mono }}>Use Live</button>
          </div>
        )}

        <div><label style={LS}>Sell Price ({qc})</label><input style={IS} type="number" inputMode="decimal" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0.00" /></div>
        <div><label style={LS}>Sell Time</label><MaskedDateInput style={IS} value={sellTime} onChange={v => setSellTime(v)} /></div>
        <div><label style={LS}>Fees ({qc})</label><input style={IS} type="number" inputMode="decimal" value={fees} onChange={e => setFees(e.target.value)} placeholder="0.00" /></div>
        <div><label style={LS}>Close Reason</label>
          <select style={IS} value={reason} onChange={e => setReason(e.target.value)}>
            {CLOSE_REASONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div><label style={LS}>Notes (optional)</label>
          <textarea style={{ ...IS, resize: "vertical", minHeight: 52 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Why did you sell? What did you learn?" />
        </div>

        {pnl !== null && (
          <div style={{ background: pnl >= 0 ? T.greenDim : T.redDim, border: `1px solid ${pnl >= 0 ? T.green : T.red}40`, borderRadius: 8, padding: "12px 16px", marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>ESTIMATED PnL</span>
            <span style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: pnl >= 0 ? T.green : T.red }}>{fmt$(pnl)}</span>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: T.text, fontFamily: T.mono }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width: 16, height: 16, accentColor: T.green }} />
            I confirm these details are correct
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 11, fontFamily: T.mono }} disabled={loading}>Cancel</button>
          <button onClick={async () => {
            let closeT = parseMaskedDate(sellTime);
            let capped = false;
            if (closeT > Date.now()) { closeT = Date.now(); capped = true; }
            if (trade.openTime && closeT < trade.openTime) { closeT = trade.openTime; capped = true; }
            if (capped) {
              showToast("Sell time was invalid (in the future, or before buy time). It has been automatically corrected.", "warning");
            }
            setLoading(true);
            try { await onConfirm({ exit: parseFloat(sellPrice), closeTime: closeT, fees: -(Math.abs(parseFloat(fees) || 0)), closeReason: reason, notes }); }
            finally { setLoading(false); }
          }}
            style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }} disabled={loading || !confirmed}>
            {loading ? "Looking up rate..." : "Record Sell ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OpenSpotTrades({ spotOpen, onSell, onDelete, savedSymbols }) {
  const [sellingTrade, setSellingTrade] = useState(null);
  const { prices } = useDashboard();

  const totalValue = spotOpen.reduce((sum, t) => {
    const p = prices[t.symbol]?.price;
    const valQuote = p ? p * t.qty : t.entry * t.qty;
    return sum + (valQuote * (t.usdtRate || 1));
  }, 0);
  const totalCost = spotOpen.reduce((s, t) => s + (t.entry * t.qty * (t.usdtRate || 1)), 0);
  const totalPnl = totalValue - totalCost;

  if (!spotOpen.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 12 }}>
      <div style={{ fontSize: 32 }}>🪙</div>
      <div style={{ fontFamily: T.mono, fontSize: 14, color: T.bright }}>No open spot positions</div>
      <div style={{ fontSize: 12, color: T.dim }}>Click "+ Add Trade" → Spot → "Just Bought" to log a buy</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Positions", val: spotOpen.length, color: T.cyan },
          { label: "Invested Amount", val: `${totalCost.toFixed(2)} USDT`, color: T.bright },
          { label: "Current Value", val: `${totalValue.toFixed(2)} USDT`, color: T.blue },
          { label: "Unrealized PnL", val: fmt$(totalPnl), color: totalPnl >= 0 ? T.green : T.red },
        ].map((s, i) => (
          <div key={i} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {spotOpen.map(trade => {
          const p = prices[trade.symbol];
          const livePrice = p?.price;
          const unreal = livePrice ? (livePrice - trade.entry) * trade.qty : null;
          const unrealUsdt = unreal !== null ? unreal * (trade.usdtRate || 1) : null;
          const unrPct = unreal !== null ? (unreal / (trade.entry * trade.qty)) * 100 : null;
          const holdMs = Date.now() - trade.openTime;
          const holdDays = Math.floor(holdMs / 86400000);
          const holdH = Math.floor((holdMs % 86400000) / 3600000);
          const invested = trade.entry * trade.qty;
          const investedUsdt = invested * (trade.usdtRate || 1);

          return (
            <div key={trade.id} style={{ background: T.panel, border: `1px solid ${unreal !== null ? (unrealUsdt >= 0 ? T.green + "30" : T.red + "30") : T.border}`, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CoinIcon symbol={trade.symbol} size={36} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: T.bright }}>{trade.symbol}</span>
                      <span style={{ background: T.greenDim, color: T.green, border: `1px solid ${T.green}40`, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>SPOT BUY</span>
                      <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{trade.exchange}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 3, fontFamily: T.mono }}>
                      Bought @ {trade.entry.toFixed(4)} · {trade.qty} units · {holdDays > 0 ? `${holdDays}d ` : ""}{holdH}h ago
                      <br />
                      Invested: {invested < 10 ? Number(invested.toFixed(6)) : invested.toFixed(2)} {trade.quoteCurrency || "USDT"} {trade.quoteCurrency && trade.quoteCurrency !== "USDT" ? `(~$${investedUsdt.toFixed(2)})` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {livePrice
                    ? <><div style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color: T.cyan }}>{livePrice.toFixed(4)}</div>
                      <div style={{ fontSize: 11, color: p.change24h >= 0 ? T.green : T.red, fontFamily: T.mono }}>{p.change24h >= 0 ? "+" : ""}{p.change24h?.toFixed(2)}% 24h</div></>
                    : <Skeleton width={60} height={16} />}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "COST BASIS", val: `${(trade.entry * trade.qty).toFixed(4)} ${trade.quoteCurrency || "USDT"}`, color: T.text },
                  { label: "CURRENT VALUE", val: livePrice ? `${(livePrice * trade.qty).toFixed(4)} ${trade.quoteCurrency || "USDT"}` : "–", color: T.blue },
                  { label: "UNREALIZED PnL", val: unreal !== null ? (trade.quoteCurrency && trade.quoteCurrency !== "USDT" ? `${unreal >= 0 ? "+" : ""}${unreal.toFixed(4)} ${trade.quoteCurrency} (~${fmt$(unrealUsdt)})` : fmt$(unreal)) : "–", color: unreal !== null ? (unrealUsdt >= 0 ? T.green : T.red) : T.dim },
                  { label: "RETURN %", val: unrPct !== null ? `${unrPct >= 0 ? "+" : ""}${unrPct.toFixed(2)}%` : "–", color: unrPct !== null ? (unrPct >= 0 ? T.green : T.red) : T.dim },
                ].map((item, i) => (
                  <div key={i} style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: item.color }}>{item.val}</div>
                  </div>
                ))}
              </div>

              {trade.notes && <div style={{ fontSize: 11, color: T.dim, fontStyle: "italic", marginBottom: 10 }}>{trade.notes}</div>}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => onDelete(trade.id)} style={{ background: "none", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 11, fontFamily: T.mono }}>Delete</button>
                <button onClick={() => setSellingTrade(trade)} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>Record Sell →</button>
              </div>
            </div>
          );
        })}
      </div>

      {sellingTrade && (
        <SellSpotModal
          trade={sellingTrade}
          currentPrice={prices[sellingTrade.symbol]?.price}
          onClose={() => setSellingTrade(null)}
          onConfirm={(data) => { onSell(sellingTrade, data); setSellingTrade(null); }}
        />
      )}
    </div>
  );
}

function TradeFilterBar({ filterSetup, setFilterSetup, filterCoin, setFilterCoin, filterResult, setFilterResult, filterTrade, setFilterTrade, filterCapitalActivity, setFilterCapitalActivity, onDownload, coins, setups }) {
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
        </select>
        <select style={S} value={filterCapitalActivity} onChange={e => setFilterCapitalActivity(e.target.value)}>
          <option value="All">All </option>
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


// ─── Watchlist View ───────────────────────────────────────────────────────────
function WatchlistView({ savedSymbols, prices, status, onAddAlert, onOpenLiveTrade }) {
  const symbols = (savedSymbols || DEFAULT_SYMBOLS).slice(0, 30);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.bright, letterSpacing: 1 }}>WATCHLIST</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: status === "ok" ? T.green : T.dim, boxShadow: status === "ok" ? `0 0 6px ${T.green}` : "none" }} />
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>{status === "ok" ? "LIVE" : "CONNECTING..."}</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono }}>Auto-updates every 3s · Showing {symbols.length} symbols</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {symbols.map(sym => {
          const p = prices[sym];
          const change = p?.change24h;
          const isUp = change >= 0;
          return (
            <div key={sym} style={{ background: T.panel, border: `1px solid ${p ? (isUp ? T.green + "25" : T.red + "25") : T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, transition: "border-color 0.3s" }}>
              <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CoinIcon symbol={sym} size={32} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.bright }}>{sym}</div>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{getQuoteCurrency(sym)}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {p ? (
                    <>
                      <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.bright }}>
                        {p.price >= 1 ? p.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.price.toFixed(6)}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: T.mono, color: isUp ? T.green : T.red, marginTop: 2 }}>
                        {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                      </div>
                    </>
                  ) : (
                    <Skeleton width={80} height={16} />
                  )}
                </div>
              </div>

              {/* Actions Section */}
              <div style={{ display: "flex", gap: 6, marginTop: 4, width: "100%", justifyContent: "flex-end", borderTop: `1px solid ${T.border}30`, paddingTop: 8 }}>
                <button
                  onClick={() => onAddAlert && onAddAlert(sym)}
                  style={{ background: "transparent", border: `1px solid ${T.blue}40`, color: T.blue, borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: T.mono }}
                  onMouseEnter={e => e.currentTarget.style.background = T.blueDim}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  🔔 Alert
                </button>
                <button
                  onClick={() => onOpenLiveTrade && onOpenLiveTrade(sym)}
                  style={{ background: T.greenDim, border: `1px solid ${T.green}40`, color: T.green, borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: T.mono }}
                  onMouseEnter={e => e.currentTarget.style.background = T.greenDim + "40"}
                  onMouseLeave={e => e.currentTarget.style.background = T.greenDim}
                >
                  📈 Trade Live
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {symbols.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
          <div style={{ fontSize: 36 }}>◎</div>
          <div style={{ fontFamily: T.mono, fontSize: 15, color: T.bright }}>No symbols saved yet</div>
          <div style={{ fontSize: 13, color: T.dim }}>Add trades with crypto symbols — they'll appear here automatically.</div>
        </div>
      )}
    </div>
  );
}

// ─── Alerts View ──────────────────────────────────────────────────────────────
function AlertsView({ alerts, onAddAlert, onDeleteAlert, savedSymbols, prices, prefilledSymbol, clearPrefilledSymbol }) {
  const [symbolInput, setSymbolInput] = useState(prefilledSymbol || "");
  const [condition, setCondition] = useState("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [showDrop, setShowDrop] = useState(false);

  useEffect(() => {
    if (prefilledSymbol) {
      setSymbolInput(prefilledSymbol);
      if (clearPrefilledSymbol) clearPrefilledSymbol();
    }
  }, [prefilledSymbol]);

  const saved = savedSymbols || DEFAULT_SYMBOLS;
  const filtered = symbolInput
    ? saved.filter(s => s.toLowerCase().includes(symbolInput.toLowerCase()))
    : saved;

  const handleCreate = () => {
    const sym = symbolInput.trim().toUpperCase();
    const price = parseFloat(targetPrice);
    if (!sym || isNaN(price) || price <= 0) return;

    onAddAlert({
      symbol: sym,
      condition,
      targetPrice: price
    });

    setSymbolInput("");
    setTargetPrice("");
    setShowDrop(false);
  };

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered).sort((a, b) => b.triggeredAt - a.triggeredAt);

  return (
    <div>
      <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.bright, letterSpacing: 1, marginBottom: 18 }}>
        PRICE ALERTS
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Create Alert Panel */}
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.bright, marginBottom: 14, fontFamily: T.mono }}>+ CREATE PRICE ALERT</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Symbol Selection */}
            <div style={{ position: "relative" }}>
              <label style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Symbol</label>
              <input
                type="text"
                placeholder="BTCUSDT, ETHUSDT..."
                value={symbolInput}
                onChange={e => { setSymbolInput(e.target.value); setShowDrop(true); }}
                onFocus={() => setShowDrop(true)}
                onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 7, color: T.bright, padding: "8px 12px", width: "100%", boxSizing: "border-box", outline: "none", fontSize: 13, fontFamily: T.mono }}
              />
              {showDrop && filtered.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 7, maxHeight: 180, overflowY: "auto", WebkitOverflowScrolling: "touch", zIndex: 10, boxShadow: "0 10px 30px #00000080" }}>
                  {filtered.map(s => (
                    <div
                      key={s}
                      onClick={() => { setSymbolInput(s); setShowDrop(false); }}
                      style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, borderBottom: `1px solid ${T.border}30` }}
                      onMouseEnter={e => e.currentTarget.style.background = T.border + "30"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <CoinIcon symbol={s} size={20} />
                      <span style={{ color: T.bright }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Condition Selection */}
            <div>
              <label style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Trigger Condition</label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value)}
                style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 7, color: T.bright, padding: "8px 12px", width: "100%", fontSize: 13, outline: "none", cursor: "pointer" }}
              >
                <option value="above">Price crosses above (▲)</option>
                <option value="below">Price crosses below (▼)</option>
              </select>
            </div>

            {/* Target Price */}
            <div>
              <label style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Target Price (USD)</label>
              <input
                type="number" inputMode="decimal"
                step="any"
                placeholder="100000"
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 7, color: T.bright, padding: "8px 12px", width: "100%", boxSizing: "border-box", outline: "none", fontSize: 13, fontFamily: T.mono }}
              />
            </div>

            <button
              onClick={handleCreate}
              style={{ background: T.blueDim, border: `1px solid ${T.blue}50`, color: T.blue, borderRadius: 7, padding: "10px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: T.mono, marginTop: 6, transition: "background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.blue + "20"}
              onMouseLeave={e => e.currentTarget.style.background = T.blueDim}
            >
              🔔 Create Alert
            </button>
          </div>
        </div>

        {/* Alerts List Panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          {/* Active Alerts */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.bright, marginBottom: 12, fontFamily: T.mono }}>
              ACTIVE ALERTS ({activeAlerts.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeAlerts.map(alert => {
                const livePrice = prices[alert.symbol]?.price;
                return (
                  <div key={alert.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CoinIcon symbol={alert.symbol} size={24} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: T.bright }}>{alert.symbol}</div>
                        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 1 }}>
                          Crosses {alert.condition === "above" ? "above ▲" : "below ▼"} {alert.targetPrice.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {livePrice !== undefined && (
                        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                          Live: <span style={{ color: T.bright }}>{livePrice.toLocaleString()}</span>
                        </div>
                      )}
                      <button
                        onClick={() => onDeleteAlert(alert.id)}
                        style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 14, padding: 12 }}
                        title="Delete Alert"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
              {activeAlerts.length === 0 && (
                <div style={{ textAlign: "center", color: T.dim, fontSize: 12, padding: "20px 0", fontStyle: "italic" }}>
                  No active alerts. Create one on the left.
                </div>
              )}
            </div>
          </div>

          {/* Triggered Alerts */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.bright, marginBottom: 12, fontFamily: T.mono }}>
              TRIGGERED ALERTS ({triggeredAlerts.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              {triggeredAlerts.map(alert => (
                <div key={alert.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.panel2, border: `1px solid ${T.border}30`, borderRadius: 8, padding: "8px 12px", opacity: 0.7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CoinIcon symbol={alert.symbol} size={24} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: T.bright }}>{alert.symbol}</div>
                      <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 1 }}>
                        Crossed {alert.condition === "above" ? "above ▲" : "below ▼"} {alert.targetPrice.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {alert.triggeredAt && (
                      <div style={{ fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                        {new Date(alert.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <button
                      onClick={() => onDeleteAlert(alert.id)}
                      style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 14, padding: 12 }}
                      title="Delete Alert"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {triggeredAlerts.length === 0 && (
                <div style={{ textAlign: "center", color: T.dim, fontSize: 12, padding: "20px 0", fontStyle: "italic" }}>
                  No triggered alerts.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    undoTrade, setUndoTrade,
    reviews, setReviews, reviewKey, setReviewKey,
    showDataMenu, setShowDataMenu,
    showAddModal, setShowAddModal,
    showClearConfirm, setShowClearConfirm,
    showCSVModal, setShowCSVModal,
    showReviewModal, setShowReviewModal,
    showSyncModal, setShowSyncModal,
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
    prices, status, isMobile,
    addAlert, deleteAlert,
    deleteFinishedTrade, restoreDeletedTrade, handleEditTrade,
    saveSymbol, handleQuickAdd, addTrade, importTrades, addSpotOpen,
    closeSpotOpen, deleteSpotOpen, handleApiSync, addLiveTrade, closeLiveTrade,
    saveReview, openReview, switchProfile, addProfile, deleteProfile, clearAllData, downloadCSV
  } = useDashboard();

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────
  const DASH_TABS = ["Overview", "Trade Summary", "Calendar", "Analytics", "Time Metrics", "Risk Calc"];

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
      } else {
        CapApp.minimizeApp();
      }
    }).then(l => backListener = l);

    return () => {
      if (backListener) backListener.remove();
    };
  }, [setShowAddModal, setEditingTrade, setShowCSVModal, setShowSyncModal, setViewChartTrade, setShowClearConfirm, setShowDataMenu, setUndoTrade]);

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
      <div style={{ display: "flex", minHeight: "100dvh", maxWidth: "100vw", overflowX: "hidden", background: T.bg, fontFamily: T.sans, color: T.text, transition: "background .2s", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: isMobile ? "max(60px, env(safe-area-inset-bottom, 0px))" : 0 }}>
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Top bar */}
          <TopNav />

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

            {(view === "Dashboard" || view === "Finished Trades") && (
              <TradeFilterBar
                filterSetup={filterSetup} setFilterSetup={setFilterSetup}
                filterCoin={filterCoin} setFilterCoin={setFilterCoin}
                filterResult={filterResult} setFilterResult={setFilterResult}
                filterTrade={filterTrade} setFilterTrade={setFilterTrade}
                filterCapitalActivity={filterCapitalActivity} setFilterCapitalActivity={setFilterCapitalActivity}
                onDownload={downloadCSV}
                coins={Array.from(new Set(closed.map(t => t.symbol)))}
                setups={SETUPS}
              />
            )}
            {isJournalEmpty && view === "Dashboard"
              ? <EmptyState onAdd={() => setShowAddModal(true)} />
              : isFilteredEmpty && view === "Dashboard"
                ? <EmptyState filtered={true} />
              : <>
                {view === "Dashboard" && subTab === "Overview" && <Overview trades={trades} allProfileTrades={profileTrades} initialCapital={initialCapital} profiles={profiles} liveTrades={liveTrades} />}
                {view === "Dashboard" && subTab === "Trade Summary" && (
                  <TradeSummary
                    trades={trades}
                    allProfileTrades={profileTrades}
                    initialCapital={initialCapital}
                    profileId={activeProfileId}
                    onUpdateCapital={(val) => { setInitialCapital(val); saveCapital(val); }}
                  />
                )}
                {view === "Dashboard" && subTab === "Calendar" && <TradingCalendar />}
                {view === "Dashboard" && subTab === "Analytics" && <Analytics />}
                {view === "Dashboard" && subTab === "Time Metrics" && <TimeMetrics trades={trades} />}
                {view === "Dashboard" && subTab === "Risk Calc" && <RiskCalculator />}
                {view === "Open Spot Trades" && <OpenSpotTrades spotOpen={spotOpen} onSell={closeSpotOpen} onDelete={deleteSpotOpen} savedSymbols={savedSymbols} />}
                {view === "Live Trades(ongoing)" && (
                  <LiveTrades
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
              </>
            }
          </div>
        </div>
      </div>

      {isMobile && (
        <BottomNav
          view={view}
          setView={setView}
          spotOpenCount={spotOpen.length}
          alertsCount={alerts.filter(a => !a.triggered).length}
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