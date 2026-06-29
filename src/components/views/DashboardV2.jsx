import { useState, useEffect, useMemo, useRef } from "react";

// Helper components
function InfoDot({ title }) {
  return (
    <span 
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 14, height: 14, borderRadius: "50%",
        background: "#1e2d45", color: "#6b7fa3",
        fontSize: 9, fontWeight: 700, cursor: "help",
        marginLeft: 3, verticalAlign: "middle"
      }}
      title={title}
    >
      ?
    </span>
  );
}

export default function DashboardV2({ 
  trades = [], 
  allProfileTrades = [],
  liveTrades = [], 
  prices = {}, 
  initialCapital = 0,
  isMobile = false
}) {
  const [range, setRange] = useState("1M");
  const [clock, setClock] = useState("--:--:--");

  const { balance, totalDeposits, totalWithdrawals } = useMemo(() => {
    const allProfileClosed = (allProfileTrades && allProfileTrades.length ? allProfileTrades : trades).filter(t => t.status === "closed");
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
    return { 
      balance: startingCapital + otherDepositsVal - withdrawalsVal + profileRealizedPnl + profileTotalFees,
      totalDeposits: startingCapital + otherDepositsVal,
      totalWithdrawals: withdrawalsVal
    };
  }, [allProfileTrades, trades, initialCapital]);

  // Active clock ticks in UTC
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(n.toLocaleTimeString("en-US", { hour12: false }) + " UTC");
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter closed trades by range
  const rangeFilteredTrades = useMemo(() => {
    const now = Date.now();
    const allClosed = trades.filter(t => t.status === "closed" && t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
    const cut = {
      "1D": 864e5,
      "1W": 7 * 864e5,
      "1M": 30 * 864e5,
      "3M": 90 * 864e5,
      "ALL": Infinity
    }[range] || Infinity;
    
    return cut === Infinity ? allClosed : allClosed.filter(t => t.closeTime >= now - cut);
  }, [trades, range]);

  // Compute stats
  const stats = useMemo(() => {
    const closed = rangeFilteredTrades;
    const wins = closed.filter(t => t.pnl > 0);
    const losses = closed.filter(t => t.pnl < 0);
    const realizedPnl = closed.reduce((s, t) => s + t.pnl, 0);
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
    const totalFees = closed.reduce((s, t) => s + (t.fees || 0) + (t.fundingFees || 0), 0);
    
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 9.99 : 0;
    const avgWin = wins.length ? grossProfit / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 1;
    const ev = closed.length ? (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss) : 0;
    const rr = avgWin / avgLoss;
    
    const spotTrades = closed.filter(t => t.tradeType === "Spot");
    const futTrades = closed.filter(t => t.tradeType !== "Spot");
    const spotHold = spotTrades.length ? spotTrades.reduce((s, t) => s + (t.closeTime - t.openTime), 0) / spotTrades.length : 0;
    const futHold = futTrades.length ? futTrades.reduce((s, t) => s + (t.closeTime - t.openTime), 0) / futTrades.length : 0;
    const best = closed.reduce((b, t) => t.pnl > b ? t.pnl : b, -Infinity) === -Infinity ? 0 : closed.reduce((b, t) => t.pnl > b ? t.pnl : b, -Infinity);
    const worst = closed.reduce((b, t) => t.pnl < b ? t.pnl : b, Infinity) === Infinity ? 0 : closed.reduce((b, t) => t.pnl < b ? t.pnl : b, Infinity);

    // Equity series + max drawdown
    const sorted = [...closed].sort((a, b) => a.closeTime - b.closeTime);
    let run = 0, peak = 0, dd = 0;
    const eq = [{ date: "Start", val: 0 }, ...sorted.map(t => {
      run += t.pnl;
      if (run > peak) peak = run;
      dd = Math.min(dd, run - peak);
      return { date: new Date(t.closeTime).toLocaleDateString(), val: parseFloat(run.toFixed(2)) };
    })];

    // Today's P&L
    const todayCut = new Date(); 
    todayCut.setHours(0, 0, 0, 0);
    const todayPnl = closed.filter(t => t.closeTime >= todayCut.getTime()).reduce((s, t) => s + t.pnl, 0);

    return {
      wins, losses, realizedPnl, winRate, totalFees, pf, avgWin, avgLoss, ev, rr,
      spotTrades, futTrades, spotHold, futHold, best, worst, eq, dd, todayPnl, sorted
    };
  }, [rangeFilteredTrades]);

  // Compute live unrealized PNL
  const liveStats = useMemo(() => {
    let totalUpnl = 0;
    const list = liveTrades.map(t => {
      const p = prices[t.symbol]?.price || t.entry;
      const dir = t.side === "Long" ? 1 : -1;
      const pnl = (p - t.entry) * t.qty * dir * (t.leverage || 1);
      totalUpnl += pnl;

      const rangeWidth = Math.abs((t.tp1 || t.entry * 1.05) - (t.sl || t.entry * 0.95));
      const progress = rangeWidth > 0 ? Math.min(Math.max(((p - t.entry) * dir) / rangeWidth * 100, 0), 100) : 0;
      
      return { ...t, currentPrice: p, pnl, progress };
    });
    return { list, totalUpnl };
  }, [liveTrades, prices]);

  // Ref hooks for canvas drawings
  const sparklineRef = useRef(null);
  const gaugeRef = useRef(null);
  const equityChartRef = useRef(null);

  // Draw Sparkline
  useEffect(() => {
    const canvas = sparklineRef.current;
    if (!canvas) return;
    const vals = stats.eq.map(e => e.val);
    if (!vals.length) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement.clientWidth || 200;
    const H = 36;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);

    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const rangeVal = mx - mn || 1;
    const x = i => (i / (vals.length - 1)) * W;
    const y = v => H - ((v - mn) / rangeVal) * (H - 4) - 2;

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.moveTo(x(0), y(vals[0]));
    vals.forEach((v, i) => {
      if (i > 0) ctx.lineTo(x(i), y(v));
    });
    const color = stats.realizedPnl >= 0 ? "#10d98a" : "#f0445a";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill gradient
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + "40");
    grad.addColorStop(1, color + "00");
    ctx.fillStyle = grad;
    ctx.fill();
  }, [stats.eq, stats.realizedPnl]);

  // Draw Win Rate Gauge
  useEffect(() => {
    const canvas = gaugeRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 64 * dpr;
    canvas.height = 64 * dpr;
    canvas.style.width = "64px";
    canvas.style.height = "64px";
    ctx.scale(dpr, dpr);

    const cx = 32, cy = 32, r = 26, sw = 5;
    const pct = stats.winRate / 100;

    ctx.clearRect(0, 0, 64, 64);
    // Track ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#1e2d45";
    ctx.lineWidth = sw;
    ctx.stroke();

    // Fill arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = pct >= 0.5 ? "#10d98a" : pct >= 0.35 ? "#f5a623" : "#f0445a";
    ctx.lineWidth = sw;
    ctx.lineCap = "round";
    ctx.stroke();

    // Center text
    ctx.fillStyle = "#e2eaf5";
    ctx.font = "bold 11px -apple-system,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.round(pct * 100) + "%", cx, cy);
  }, [stats.winRate]);

  // Draw Equity Chart
  useEffect(() => {
    const canvas = equityChartRef.current;
    if (!canvas) return;
    const vals = stats.eq.map(e => e.val);
    if (!vals.length) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement.clientWidth - 32;
    const H = 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);

    const mn = Math.min(...vals, 0);
    const mx = Math.max(...vals, 1);
    const rangeVal = mx - mn;
    const x = i => (i / (vals.length - 1)) * (W - 20) + 10;
    const y = v => H - 8 - ((v - mn) / rangeVal) * (H - 16);
    const zero = y(0);

    ctx.clearRect(0, 0, W, H);

    // Draw horizontal grids
    ctx.strokeStyle = "#1e2d45";
    ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
      const yy = H - 8 - t * (H - 16);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(W, yy);
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Zero baseline
    ctx.beginPath();
    ctx.moveTo(0, zero);
    ctx.lineTo(W, zero);
    ctx.strokeStyle = "#3a4d6b";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Equity path line
    const lastVal = vals[vals.length - 1] || 0;
    const lineColor = lastVal >= 0 ? "#10d98a" : "#f0445a";
    ctx.beginPath();
    ctx.moveTo(x(0), y(vals[0]));
    vals.forEach((v, i) => {
      if (i > 0) ctx.lineTo(x(i), y(v));
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill positive
    ctx.beginPath();
    ctx.moveTo(x(0), Math.min(y(vals[0]), zero));
    vals.forEach((v, i) => ctx.lineTo(x(i), Math.min(y(v), zero)));
    ctx.lineTo(x(vals.length - 1), zero);
    ctx.lineTo(x(0), zero);
    ctx.closePath();
    const gPos = ctx.createLinearGradient(0, 0, 0, zero);
    gPos.addColorStop(0, "#10d98a45");
    gPos.addColorStop(1, "#10d98a00");
    ctx.fillStyle = gPos;
    ctx.fill();

    // Fill negative
    ctx.beginPath();
    ctx.moveTo(x(0), Math.max(y(vals[0]), zero));
    vals.forEach((v, i) => ctx.lineTo(x(i), Math.max(y(v), zero)));
    ctx.lineTo(x(vals.length - 1), zero);
    ctx.lineTo(x(0), zero);
    ctx.closePath();
    const gNeg = ctx.createLinearGradient(0, zero, 0, H);
    gNeg.addColorStop(0, "#f0445a35");
    gNeg.addColorStop(1, "#f0445a00");
    ctx.fillStyle = gNeg;
    ctx.fill();
  }, [stats.eq]);

  // Compute monthly PNL bars
  const monthlyBars = useMemo(() => {
    const monthly = {};
    rangeFilteredTrades.forEach(t => {
      const k = new Date(t.closeTime).toLocaleDateString("en-US", { month: "short" });
      monthly[k] = (monthly[k] || 0) + t.pnl;
    });
    const entries = Object.entries(monthly).slice(-8);
    const maxVal = Math.max(...entries.map(e => Math.abs(e[1])), 1);
    return { entries, maxVal };
  }, [rangeFilteredTrades]);

  // Compute activity heatmap grid (last 90 days)
  const heatmapCells = useMemo(() => {
    const daily = {};
    rangeFilteredTrades.forEach(t => {
      const d = new Date(t.closeTime).toDateString();
      daily[d] = (daily[d] || 0) + 1;
    });
    const cells = [];
    for (let i = 89; i >= 0; i--) {
      const dateObj = new Date(Date.now() - i * 864e5);
      const k = dateObj.toDateString();
      const count = daily[k] || 0;
      const bg = count === 0 ? "#1e2d45" : count === 1 ? "#0a3d22" : count <= 3 ? "#0d6b39" : "#10d98a";
      cells.push({ date: dateObj.toLocaleDateString(), count, bg });
    }
    return cells;
  }, [rangeFilteredTrades]);

  const fmtTime = (ts) => {
    const h = Math.floor(ts / 3600000);
    const m = Math.floor((ts % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const isUpnlPositive = liveStats.totalUpnl >= 0;

  return (
    <div style={{ background: "#080c12", color: "#e2eaf5", minHeight: "100%", paddingBottom: 24, fontSize: 13 }}>
      
      {/* Sub Topbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #1e2d45", paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>v2 Dashboard</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#10d98a", fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, background: "#10d98a", borderRadius: "50%", display: "inline-block" }} /> LIVE FEED
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Range pills */}
          <div style={{ display: "flex", background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 8, padding: 3 }}>
            {["1D", "1W", "1M", "3M", "ALL"].map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6,
                  padding: "4px 10px", cursor: "pointer", transition: "all 0.15s",
                  background: range === r ? "#4d9fff" : "transparent",
                  color: range === r ? "#fff" : "#6b7fa3"
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#6b7fa3", fontFamily: "monospace" }}>{clock}</div>
        </div>
      </div>

      {/* KPI GRID ROW */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 12, marginBottom: 14 }}>
        
        {/* Net P&L */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16, position: "relative", overflow: "hidden", gridColumn: isMobile ? "span 2" : "span 1" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", filter: "blur(40px)", opacity: 0.15, pointerEvents: "none", background: stats.realizedPnl >= 0 ? "#10d98a" : "#f0445a" }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7fa3", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 }}>
            Net P&L <InfoDot title="Realized net profit after all fees" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: stats.realizedPnl >= 0 ? "#10d98a" : "#f0445a", fontFamily: "monospace" }}>
            {stats.realizedPnl >= 0 ? "+" : ""}${stats.realizedPnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ 
            display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, marginTop: 8,
            background: stats.todayPnl >= 0 ? "rgba(16,217,138,0.1)" : "rgba(240,68,90,0.1)",
            color: stats.todayPnl >= 0 ? "#10d98a" : "#f0445a",
            border: stats.todayPnl >= 0 ? "1px solid rgba(16,217,138,0.2)" : "1px solid rgba(240,68,90,0.2)"
          }}>
            {stats.todayPnl >= 0 ? "↑" : "↓"} ${Math.abs(stats.todayPnl).toFixed(2)} today
          </div>
          <div style={{ marginTop: 8 }}><canvas ref={sparklineRef} height="36" style={{ width: "100%" }} /></div>
        </div>

        {/* Win Rate */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7fa3", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 }}>
            Win Rate <InfoDot title="Percentage of closed trades that closed in profit" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "monospace", color: "#e2eaf5" }}>
                {stats.winRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: "#6b7fa3", fontFamily: "monospace", marginTop: 4 }}>
                {stats.wins.length}W · {stats.losses.length}L
              </div>
            </div>
            <canvas ref={gaugeRef} width="64" height="64" />
          </div>
        </div>

        {/* Profit Factor */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7fa3", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 }}>
            Profit Factor <InfoDot title="Gross profit ÷ gross loss" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "monospace", color: stats.pf >= 1.5 ? "#10d98a" : stats.pf >= 1 ? "#f5a623" : "#f0445a" }}>
            {stats.pf.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: "#6b7fa3", marginTop: 4, fontFamily: "monospace" }}>
            Expectancy: <span style={{ color: stats.ev >= 0 ? "#10d98a" : "#f0445a" }}>${stats.ev.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 11, color: "#6b7fa3", marginTop: 2, fontFamily: "monospace" }}>
            Avg RR: <span style={{ color: "#e2eaf5" }}>{stats.rr.toFixed(2)}</span>
          </div>
        </div>

        {/* Balance */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7fa3", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 }}>
            Balance <InfoDot title="Wallet balance (Initial + Deposits - Withdrawals + PNL + Fees)" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#4d9fff", fontFamily: "monospace" }}>
            ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e2d45" }}>
            <div>
              <div style={{ fontSize: 9, color: "#6b7fa3" }}>Deposited</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#10d98a", fontFamily: "monospace" }}>${totalDeposits.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#6b7fa3" }}>Withdrawn</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f0445a", fontFamily: "monospace" }}>${totalWithdrawals.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Fees Paid */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7fa3", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 }}>
            Fees Paid <InfoDot title="Total transaction and funding fees" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#f0445a", fontFamily: "monospace" }}>
            -${stats.totalFees.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: "#6b7fa3", fontFamily: "monospace", marginTop: 2 }}>
            {rangeFilteredTrades.length} closed trades
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <div style={{ flex: 1, background: "#141d2e", border: "1px solid #1e2d45", borderRadius: 6, padding: "4px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#6b7fa3" }}>SPOT</div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{stats.spotTrades.length}</div>
            </div>
            <div style={{ flex: 1, background: "#141d2e", border: "1px solid #1e2d45", borderRadius: 6, padding: "4px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#6b7fa3" }}>FUTURES</div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{stats.futTrades.length}</div>
            </div>
          </div>
        </div>

      </div>

      {/* MID ROW: Equity Curve & Live Positions */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 14 }}>
        
        {/* Equity Curve */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, fontSize: 12, fontWeight: 700 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 3, height: 14, background: "#4d9fff", borderRadius: 2 }} /> Equity Curve
            </div>
          </div>
          <canvas ref={equityChartRef} height="160" style={{ width: "100%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, borderTop: "1px solid #1e2d45", paddingTop: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: "#6b7fa3" }}>MAX DRAWDOWN</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f0445a", fontFamily: "monospace" }}>
                -${Math.abs(stats.dd).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#6b7fa3" }}>BEST TRADE</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10d98a", fontFamily: "monospace" }}>
                +${stats.best.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#6b7fa3" }}>WORST TRADE</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f0445a", fontFamily: "monospace" }}>
                -${Math.abs(stats.worst).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Live Positions */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, fontSize: 12, fontWeight: 700 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 3, height: 14, background: "#4d9fff", borderRadius: 2 }} /> Live Positions
              <span style={{ fontSize: 10, background: "#f0445a", color: "#fff", borderRadius: 10, padding: "1px 6px", fontWeight: 700 }}>{liveStats.list.length}</span>
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 150 }}>
            {liveStats.list.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7fa3" }}>
                No active positions running
              </div>
            ) : (
              liveStats.list.map(t => (
                <div key={t.id} style={{ border: "1px solid #1e2d45", background: "#141d2e", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{t.symbol}</span>
                        <span style={{ 
                          fontSize: 9, fontWeight: 800, padding: "1px 4px", borderRadius: 4, textTransform: "uppercase",
                          background: t.side === "Long" ? "rgba(16,217,138,0.12)" : "rgba(240,68,90,0.12)",
                          color: t.side === "Long" ? "#10d98a" : "#f0445a"
                        }}>{t.side}</span>
                        {t.leverage > 1 && <span style={{ fontSize: 10, color: "#f5a623", fontFamily: "monospace" }}>{t.leverage}x</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7fa3", fontFamily: "monospace", marginTop: 2 }}>
                        ${t.currentPrice ? t.currentPrice.toLocaleString() : t.entry.toLocaleString()} · {t.tradeType}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", color: t.pnl >= 0 ? "#10d98a" : "#f0445a" }}>
                        {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 9, color: "#6b7fa3" }}>Entry ${t.entry}</div>
                    </div>
                  </div>
                  <div style={{ height: 3, background: "#1e2d45", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
                    <div style={{ height: "100%", width: `${t.progress}%`, background: t.pnl >= 0 ? "#10d98a" : "#f0445a", transition: "width .3s" }} />
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div style={{ height: 1, background: "#1e2d45", margin: "10px 0" }} />
          <div>
            <div style={{ fontSize: 9, color: "#6b7fa3", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 2 }}>Total Unrealized P&L</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: isUpnlPositive ? "#10d98a" : "#f0445a" }}>
              {isUpnlPositive ? "+" : ""}${liveStats.totalUpnl.toFixed(2)}
            </div>
          </div>
        </div>

      </div>

      {/* BOT ROW: Monthly PNL | Heatmap | Recent Trades */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
        
        {/* Monthly P&L */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            <span style={{ width: 3, height: 14, background: "#4d9fff", borderRadius: 2 }} /> Monthly P&L
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div style={{ background: "#141d2e", border: "1px solid #1e2d45", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: "#6b7fa3" }}>Avg Win</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#10d98a" }}>+${stats.avgWin.toFixed(2)}</div>
            </div>
            <div style={{ background: "#141d2e", border: "1px solid #1e2d45", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: "#6b7fa3" }}>Avg Loss</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#f0445a" }}>-${Math.abs(stats.avgLoss).toFixed(2)}</div>
            </div>
          </div>
          {/* Monthly Bars */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60, marginTop: 8 }}>
            {monthlyBars.entries.length === 0 ? (
              <div style={{ width: "100%", textAlign: "center", color: "#6b7fa3", fontSize: 11 }}>No monthly data yet</div>
            ) : (
              monthlyBars.entries.map(([m, v]) => (
                <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }} title={`${m}: $${v.toFixed(2)}`}>
                  <div style={{ width: "100%", borderRadius: "3px 3px 0 0", minHeight: 2, height: `${Math.abs(v) / monthlyBars.maxVal * 42 + 4}px`, background: v >= 0 ? "#10d98a" : "#f0445a" }} />
                  <div style={{ fontSize: 8, color: "#6b7fa3", fontFamily: "monospace" }}>{m}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Heatmap */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            <span style={{ width: 3, height: 14, background: "#4d9fff", borderRadius: 2 }} /> Activity Heatmap
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "#6b7fa3" }}>Spot Hold: <span style={{ color: "#e2eaf5", fontFamily: "monospace" }}>{fmtTime(stats.spotHold)}</span></div>
            <div style={{ fontSize: 10, color: "#6b7fa3" }}>Futures: <span style={{ color: "#e2eaf5", fontFamily: "monospace" }}>{fmtTime(stats.futHold)}</span></div>
          </div>
          {/* Heatmap Grid */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginTop: 8 }}>
            {heatmapCells.map((c, i) => (
              <div 
                key={i} 
                style={{ width: 11, height: 11, borderRadius: 2, background: c.bg, transition: "transform .1s" }} 
                title={`${c.date}: ${c.count} trade${c.count !== 1 ? "s" : ""}`}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 9, color: "#6b7fa3" }}>Less</span>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: "#1e2d45" }} />
            <div style={{ width: 9, height: 9, borderRadius: 2, background: "#0a3d22" }} />
            <div style={{ width: 9, height: 9, borderRadius: 2, background: "#0d6b39" }} />
            <div style={{ width: 9, height: 9, borderRadius: 2, background: "#10d98a" }} />
            <span style={{ fontSize: 9, color: "#6b7fa3" }}>More</span>
          </div>
        </div>

        {/* Recent Trades */}
        <div style={{ background: "#1a2540", border: "1px solid #1e2d45", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            <span style={{ width: 3, height: 14, background: "#4d9fff", borderRadius: 2 }} /> Recent Trades
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", maxHeight: 150 }}>
            {stats.sorted.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#6b7fa3" }}>No closed trades yet</div>
            ) : (
              stats.sorted.slice(-5).reverse().map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1e2d45" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{t.symbol}</span>
                      <span style={{ 
                        fontSize: 8, fontWeight: 800, padding: "1px 4px", borderRadius: 3, textTransform: "uppercase",
                        background: t.side === "Long" ? "rgba(16,217,138,0.1)" : "rgba(240,68,90,0.1)",
                        color: t.side === "Long" ? "#10d98a" : "#f0445a"
                      }}>{t.side}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7fa3", fontFamily: "monospace", marginTop: 2 }}>
                      {new Date(t.closeTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.tradeType}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: t.pnl >= 0 ? "#10d98a" : "#f0445a" }}>
                      {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7fa3", fontFamily: "monospace" }}>
                      {(t.pnl / Math.max(Math.abs(t.entry * t.qty), 1) * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
      
    </div>
  );
}
