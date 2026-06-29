import { useState, useEffect, useMemo } from "react";
import { T } from "../../utils/theme.js";
import { fmt$, fmtDateShort, fmtDate } from "../../utils/helpers.js";
import { Card } from "../shared/index.jsx";
import { calculateWinRate, calculateExpectancy } from "../../utils/calculations.js";

// ─── Position Size Calculator Sub-Component ─────────────────────────────────────
function PositionSizeCalculator({ accountBalance }) {
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [riskPct, setRiskPct] = useState("1");

  const balance = accountBalance || 30;
  const riskPercent = parseFloat(riskPct) || 1;
  const riskAmt = balance * (riskPercent / 100);

  const ep = parseFloat(entryPrice) || 0;
  const sl = parseFloat(stopLoss) || 0;
  const tp = parseFloat(takeProfit) || 0;

  const priceDiff = ep && sl ? Math.abs(ep - sl) : 0;
  const cryptoAmount = priceDiff > 0 ? riskAmt / priceDiff : 0;
  const capitalNeeded = ep ? cryptoAmount * ep : 0;

  const targetRewardPct = ep && sl && tp ? (Math.abs(tp - ep) / Math.abs(ep - sl)) * riskPercent : 0;
  const targetRewardAmt = balance * (targetRewardPct / 100);

  const IS = { background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 5, color: T.bright, padding: "5px 8px", fontSize: 12, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box", marginTop: 4 };
  const LS = { fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginTop: 6 };

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: T.bright, borderBottom: `1px solid ${T.border}`, paddingBottom: 6, marginBottom: 10 }}>POSITION SIZE CALCULATOR</div>
      
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, borderBottom: `1px solid ${T.border}30`, paddingBottom: 4 }}>
        <span style={{ color: T.dim }}>Acc. Balance:</span>
        <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.bright }}>{fmt$(balance)}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={LS}>Entry Price</label>
          <input type="number" placeholder="e.g. 4500" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} style={IS} />
        </div>
        <div>
          <label style={LS}>Stop Loss</label>
          <input type="number" placeholder="e.g. 4400" value={stopLoss} onChange={e => setStopLoss(e.target.value)} style={IS} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={LS}>Take Profit</label>
          <input type="number" placeholder="e.g. 4800" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} style={IS} />
        </div>
        <div>
          <label style={LS}>Risk %: {riskPct}%</label>
          <input type="range" min="0.5" max="10" step="0.5" value={riskPct} onChange={e => setRiskPct(e.target.value)} style={{ width: "100%", accentColor: T.blue, marginTop: 10 }} />
        </div>
      </div>

      <div style={{ marginTop: 12, background: T.panel2, borderRadius: 6, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, border: `1px solid ${T.border}40` }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <span style={{ color: T.dim }}>Risk Amount:</span>
          <span style={{ fontFamily: T.mono, color: T.red, fontWeight: 700 }}>{fmt$(riskAmt)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <span style={{ color: T.dim }}>Crypto Amount:</span>
          <span style={{ fontFamily: T.mono, color: T.bright, fontWeight: 700 }}>{cryptoAmount ? cryptoAmount.toFixed(6) : "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <span style={{ color: T.dim }}>Capital Needed:</span>
          <span style={{ fontFamily: T.mono, color: T.orange, fontWeight: 700 }}>{capitalNeeded ? fmt$(capitalNeeded) : "—"}</span>
        </div>
        {targetRewardAmt > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: `1px solid ${T.border}20`, paddingTop: 4 }}>
            <span style={{ color: T.dim }}>Target Reward:</span>
            <span style={{ fontFamily: T.mono, color: T.green, fontWeight: 700 }}>{fmt$(targetRewardAmt)} ({targetRewardPct.toFixed(1)}%)</span>
          </div>
        )}
      </div>
    </Card>
  );
}

const SideRow = ({ label, val, isPnl, isPct }) => {
  let color = T.bright;
  if (isPnl) color = val >= 0 ? T.green : T.red;
  const displayVal = isPct ? `${val >= 0 ? "+" : ""}${val.toFixed(2)}%` : (typeof val === "number" ? fmt$(val) : val);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}30` }}>
      <div style={{ fontSize: 11, color: T.dim }}>{label}</div>
      <div style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color }}>{displayVal}</div>
    </div>
  );
};

const EditableValue = ({ val, label, isEditing, setIsEditing, inputVal, setInputVal, onSave, hideEdit }) => {
  if (isEditing) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${T.border}30` }}>
        <div style={{ fontSize: 11, color: T.dim }}>{label}</div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input 
            type="number" 
            value={inputVal} 
            onChange={e => setInputVal(e.target.value)} 
            style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 4, color: T.bright, padding: "2px 6px", fontSize: 12, width: 70, fontFamily: T.mono, outline: "none" }}
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") setIsEditing(false);
            }}
          />
          <button onClick={onSave} style={{ background: T.greenDim, border: `1px solid ${T.green}40`, color: T.green, borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 10, fontFamily: T.mono }}>✓</button>
          <button onClick={() => setIsEditing(false)} style={{ background: "none", border: `1px solid ${T.border}`, color: T.dim, borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 10, fontFamily: T.mono }}>✕</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}30` }}>
      <div style={{ fontSize: 11, color: T.dim }}>{label}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color: T.bright }}>{fmt$(val)}</div>
        {!hideEdit && (
          <button onClick={() => setIsEditing(true)} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 11, padding: "0 2px" }} title="Edit">✏️</button>
        )}
      </div>
    </div>
  );
};

// ─── Main Summary View ──────────────────────────────────────────────────────────
export default function TradeSummary({ trades, allProfileTrades, initialCapital = 30, profileId = "default", onUpdateCapital }) {
  const closed = trades.filter(t => t.status === "closed");
  const sortedTrades = [...closed].sort((a, b) => a.closeTime - b.closeTime);

  const unfilteredClosed = (allProfileTrades || trades).filter(t => t.status === "closed");
  const unfilteredSortedTrades = [...unfilteredClosed].sort((a, b) => a.closeTime - b.closeTime);

  const firstDeposit = unfilteredSortedTrades.find(t => t.entryType === "Deposit" || t.symbol === "Deposit");
  const startingCapital = firstDeposit ? firstDeposit.qty : (initialCapital || 30);

  // Trading Start Date (earliest deposit timestamp)
  const startDateStr = firstDeposit ? fmtDate(firstDeposit.closeTime) : "—";

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const yrs = new Set();
    yrs.add(currentYear);
    sortedTrades.forEach(t => {
      if (t.closeTime) {
        const d = new Date(t.closeTime);
        const y = d.getFullYear();
        if (y && !isNaN(y)) {
          yrs.add(y);
        }
      }
    });
    return Array.from(yrs).sort((a, b) => a - b);
  }, [sortedTrades, currentYear]);

  const [selectedYear, setSelectedYear] = useState(() => {
    return years[years.length - 1] || currentYear;
  });

  useEffect(() => {
    if (years.length > 0 && !years.includes(selectedYear)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedYear(years[years.length - 1]);
    }
  }, [years, selectedYear]);

  const [isEditingInitial, setIsEditingInitial] = useState(false);
  const [initialInput, setInitialInput] = useState(initialCapital.toString());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialInput(initialCapital.toString());
  }, [profileId, initialCapital]);

  const handleSaveInitial = () => {
    const val = parseFloat(initialInput);
    if (!isNaN(val)) {
      onUpdateCapital(val);
    }
    setIsEditingInitial(false);
  };

  // Chronological metrics calculation
  let runningBalance = firstDeposit ? 0 : startingCapital;
  const riskMetrics = { totalRiskPctSum: 0, totalRewardPctSum: 0, rrrSum: 0, tradesWithRisk: 0 };

  const dailySheetData = {};
  const processedTrades = sortedTrades.map(t => {
    const isDeposit = t.entryType === "Deposit" || t.symbol === "Deposit";
    const isWithdrawal = t.entryType === "Withdrawal" || t.symbol === "Withdrawal";
    
    const netPnl = isDeposit ? t.qty : (isWithdrawal ? -t.qty : t.pnl + (t.fees || 0));
    const riskAmount = (!isDeposit && !isWithdrawal && t.stopLoss) ? Math.abs(t.entry - t.stopLoss) * t.qty : 0;
    const riskPct = runningBalance > 0 ? (riskAmount / runningBalance) * 100 : 0;
    const rewardPct = runningBalance > 0 ? ((isDeposit || isWithdrawal ? 0 : t.pnl) / runningBalance) * 100 : 0;
    const realizedRRR = riskAmount > 0 ? t.pnl / riskAmount : 0;

    if (riskAmount > 0) {
      riskMetrics.totalRiskPctSum += riskPct;
      riskMetrics.totalRewardPctSum += rewardPct;
      riskMetrics.rrrSum += realizedRRR;
      riskMetrics.tradesWithRisk++;
    }

    const prevBalance = runningBalance;
    // eslint-disable-next-line react-hooks/immutability
    runningBalance += netPnl;

    const dateKey = new Date(t.closeTime).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    if (!isDeposit && !isWithdrawal) {
      dailySheetData[dateKey] = (dailySheetData[dateKey] || 0) + netPnl;
    }

    return {
      ...t,
      netPnl: isDeposit || isWithdrawal ? 0 : netPnl,
      balanceBefore: prevBalance,
      balanceAfter: runningBalance,
      riskAmount,
      riskPct,
      rewardPct,
      realizedRRR
    };
  });

  // Calculate unfiltered processed trades to establish absolute A1:S5 history
  const unfilteredRunningBalanceState = { val: firstDeposit ? 0 : startingCapital };
  const unfilteredProcessedTrades = unfilteredSortedTrades.map(t => {
    const isDeposit = t.entryType === "Deposit" || t.symbol === "Deposit";
    const isWithdrawal = t.entryType === "Withdrawal" || t.symbol === "Withdrawal";
    const netPnl = isDeposit ? t.qty : (isWithdrawal ? -t.qty : t.pnl + (t.fees || 0));
    unfilteredRunningBalanceState.val += netPnl;
    return {
      ...t,
      netPnl: isDeposit || isWithdrawal ? 0 : netPnl,
      balanceAfter: unfilteredRunningBalanceState.val
    };
  });

  const sortedUnfilteredProcessed = [...unfilteredProcessedTrades].sort((a, b) => b.closeTime - a.closeTime);
  const summaryRows = sortedUnfilteredProcessed.slice(0, 5);

  const depositsInSummary = summaryRows.filter(t => t.entryType === "Deposit" || t.symbol === "Deposit");
  const withdrawalsInSummary = summaryRows.filter(t => t.entryType === "Withdrawal" || t.symbol === "Withdrawal");

  const otherDepositsVal = depositsInSummary
    .filter(t => t.id !== (firstDeposit ? firstDeposit.id : null))
    .reduce((s, t) => s + t.qty, 0);

  const withdrawalsVal = withdrawalsInSummary.reduce((s, t) => s + t.qty, 0);

  const totalAccountDeposits = startingCapital + otherDepositsVal;

  const actualTrades = processedTrades.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");

  const totalTradesCount = actualTrades.length;
  const wins = actualTrades.filter(t => t.pnl > 0);
  const losses = actualTrades.filter(t => t.pnl < 0);
  const breakEven = actualTrades.filter(t => t.pnl === 0);
  const winRate = calculateWinRate(actualTrades);

  const totalWinsVolume = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLossVolume = losses.reduce((s, t) => s + t.pnl, 0);

  const avgWin = wins.length ? totalWinsVolume / wins.length : 0;
  const avgLoss = losses.length ? totalLossVolume / losses.length : 0;

  const bestTrade = actualTrades.length ? Math.max(...actualTrades.map(t => t.pnl)) : 0;
  const worstTrade = actualTrades.length ? Math.min(...actualTrades.map(t => t.pnl)) : 0;

  const totalFees = actualTrades.reduce((s, t) => s + (t.fees || 0), 0);
  const totalNetPnl = actualTrades.reduce((s, t) => s + t.netPnl, 0);


  const currentAccBalance = totalAccountDeposits - withdrawalsVal + totalNetPnl;
  const accountGrowth = totalAccountDeposits > 0 ? (totalNetPnl / totalAccountDeposits) * 100 : 0;
  
  const tradeExpectancy = calculateExpectancy(actualTrades);

  const aveRiskPerTrade = riskMetrics.tradesWithRisk ? (riskMetrics.totalRiskPctSum / riskMetrics.tradesWithRisk) : 0;
  const avgRewardPerTrade = riskMetrics.tradesWithRisk ? (riskMetrics.totalRewardPctSum / riskMetrics.tradesWithRisk) : 0;
  const avgRiskReward = riskMetrics.tradesWithRisk ? (riskMetrics.rrrSum / riskMetrics.tradesWithRisk) : 0;

  // New Summary Fields from summaryRows (A1:S5)
  const totalNumDeposits = depositsInSummary.length;
  const totalNumWithdrawals = withdrawalsInSummary.length;

  // Month-on-Month Analysis
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const monthlyStats = monthNames.map((name, monthIdx) => {
    const monthTrades = actualTrades.filter(t => {
      const date = new Date(t.closeTime);
      return date.getMonth() === monthIdx && date.getFullYear() === selectedYear;
    });

    const count = monthTrades.length;
    const monthWins = monthTrades.filter(t => t.pnl > 0);
    const monthLosses = monthTrades.filter(t => t.pnl < 0);
    const monthBreakEven = monthTrades.filter(t => t.pnl === 0);

    const mWinRate = count ? (monthWins.length / count) * 100 : 0;
    const mTotalPnl = monthTrades.reduce((s, t) => s + t.pnl, 0);
    const mTotalCosts = monthTrades.reduce((s, t) => s + (t.fees || 0), 0);

    const mAvgWin = monthWins.length ? monthWins.reduce((s, t) => s + t.pnl, 0) / monthWins.length : 0;
    const mAvgLoss = monthLosses.length ? monthLosses.reduce((s, t) => s + t.pnl, 0) / monthLosses.length : 0;

    const mLargestWin = monthWins.length ? Math.max(...monthWins.map(t => t.pnl)) : 0;
    const mLargestLoss = monthLosses.length ? Math.min(...monthLosses.map(t => t.pnl)) : 0;

    const mAvgPnlPerTrade = count ? mTotalPnl / count : 0;

    let mRiskSum = 0, mRewardSum = 0, mRrrSum = 0, mRiskCount = 0;
    monthTrades.forEach(t => {
      if (t.riskAmount > 0) {
        mRiskSum += t.riskPct;
        mRewardSum += t.rewardPct;
        mRrrSum += t.realizedRRR;
        mRiskCount++;
      }
    });

    return {
      name,
      count,
      wins: monthWins.length,
      losses: monthLosses.length,
      breakEven: monthBreakEven.length,
      winRate: mWinRate,
      avgWin: mAvgWin,
      avgLoss: mAvgLoss,
      largestWin: mLargestWin,
      largestLoss: mLargestLoss,
      totalCosts: mTotalCosts,
      totalPnl: mTotalPnl,
      avgPnlPerTrade: mAvgPnlPerTrade,
      aveRiskPerTrade: mRiskCount ? (mRiskSum / mRiskCount) : 0,
      avgRewardPerTrade: mRiskCount ? (mRewardSum / mRiskCount) : 0,
      avgRiskReward: mRiskCount ? (mRrrSum / mRiskCount) : 0
    };
  });

  const parseDailyDate = (dStr) => {
    const [d, m, y] = dStr.split("/");
    return new Date(`${y}-${m}-${d}`).getTime();
  };
  const dailySheetList = Object.entries(dailySheetData)
    .sort((a, b) => parseDailyDate(b[0]) - parseDailyDate(a[0]));

  let runningNetPnl = 0;
  const chartPoints = [{ xLabel: "Start", yVal: 0 }, ...actualTrades.map((t) => {
    runningNetPnl += t.netPnl;
    return { xLabel: fmtDateShort(t.closeTime), yVal: parseFloat(runningNetPnl.toFixed(2)) };
  })];

  const renderLineChart = () => {
    if (chartPoints.length < 2) return <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim }}>Not enough data.</div>;
    const width = 500, height = 110, padding = 15;
    const yVals = chartPoints.map(p => p.yVal);
    const maxVal = Math.max(...yVals, 1);
    const minVal = Math.min(...yVals, -1);
    const valRange = maxVal - minVal;

    const getX = (idx) => padding + (idx / (chartPoints.length - 1)) * (width - 2 * padding);
    const getY = (val) => height - padding - ((val - minVal) / valRange) * (height - 2 * padding);

    const pathD = chartPoints.reduce((acc, p, idx) => {
      return acc + `${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(p.yVal)} `;
    }, "");

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} stroke={T.border} strokeWidth="1" strokeDasharray="3 3" />
        <path d={pathD} fill="none" stroke={totalNetPnl >= 0 ? T.green : T.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {chartPoints.map((p, idx) => (
          <circle key={idx} cx={getX(idx)} cy={getY(p.yVal)} r="3" fill={p.yVal >= 0 ? T.green : T.red} />
        ))}
      </svg>
    );
  };

  const renderDonutChart = () => {
    const size = 110;
    const center = size / 2;
    const radius = 38;
    const strokeWidth = 10;
    const circumference = 2 * Math.PI * radius;

    const winPct = totalTradesCount ? wins.length / totalTradesCount : 0.5;
    const winStrokeOffset = circumference - winPct * circumference;

    return (
      <div style={{ display: "flex", alignItems: "center", justifyItems: "center", gap: 14 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke={T.redDim} strokeWidth={strokeWidth} />
          <circle cx={center} cy={center} r={radius} fill="none" stroke={T.green} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={winStrokeOffset} strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: 13, fontFamily: T.mono }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, background: T.green, borderRadius: "50%" }} />Wins: {winRate.toFixed(1)}%</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}><span style={{ width: 8, height: 8, background: T.red, borderRadius: "50%" }} />Losses: {(100 - winRate).toFixed(1)}%</div>
        </div>
      </div>
    );
  };

  const renderBarChart = () => {
    const height = 90;
    const absWins = Math.abs(totalWinsVolume);
    const absLoss = Math.abs(totalLossVolume);
    const maxVal = Math.max(absWins, absLoss, 1);
    
    const winBarHeight = (absWins / maxVal) * (height - 20);
    const lossBarHeight = (absLoss / maxVal) * (height - 20);

    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.green, fontWeight: 700, fontFamily: T.mono, marginBottom: 4 }}>{fmt$(totalWinsVolume)}</span>
          <div style={{ width: 32, height: Math.max(winBarHeight, 4), background: T.green, borderRadius: "3px 3px 0 0" }} />
          <span style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>Wins</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.red, fontWeight: 700, fontFamily: T.mono, marginBottom: 4 }}>{fmt$(totalLossVolume)}</span>
          <div style={{ width: 32, height: Math.max(lossBarHeight, 4), background: T.red, borderRadius: "3px 3px 0 0" }} />
          <span style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>Losses</span>
        </div>
      </div>
    );
  };



  const tableHeaderStyle = { padding: "8px 4px", fontSize: 10, color: T.dim, borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}40`, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center", fontWeight: 700 };
  const tableCellStyle = { padding: "7px 4px", fontSize: 12, fontFamily: T.mono, borderBottom: `1px solid ${T.border}30`, borderRight: `1px solid ${T.border}30`, textAlign: "center", color: T.text };

  return (
    <div style={{ display: "flex", gap: 16, height: "100%", overflowY: "auto", paddingBottom: 20 }}>
      {/* 1. Left Sidebar: Trade Summary & Risk Calculator */}
      <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ padding: 16, background: `linear-gradient(145deg, ${T.panel}, ${T.panel2})`, border: `1px solid ${T.border}80` }}>
          <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: T.purple, borderBottom: `1px solid ${T.border}`, paddingBottom: 6, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            📊 JOURNAL STATISTICS
          </div>
          
          <SideRow label="Total Number of Trades" val={totalTradesCount.toString()} />
          <SideRow label="Trading Start Date" val={startDateStr} />
          <SideRow label="Total Number of Winning Trades" val={wins.length.toString()} />
          <SideRow label="Total Number of Losing Trades" val={losses.length.toString()} />
          <SideRow label="Total Number of Break Even Trades" val={breakEven.length.toString()} />
          <SideRow label="Trade Win Rate" val={winRate} isPct />
          
          <div style={{ height: 8 }} />
          
          <SideRow label="Average Winning Trade" val={avgWin} isPnl />
          <SideRow label="Average Losing Trade" val={avgLoss} isPnl />
          
          <div style={{ height: 8 }} />
          
          <SideRow label="Best Trade" val={bestTrade} isPnl />
          <SideRow label="Worst Trade" val={worstTrade} isPnl />
          
          <div style={{ height: 8 }} />
          
          <SideRow label="Trade Expectancy" val={tradeExpectancy} isPnl />
          <SideRow label="Total Platform Fee" val={totalFees} isPnl />
          
          <div style={{ height: 8 }} />

          <EditableValue 
            label="Starting Account Balance" 
            val={startingCapital} 
            isEditing={isEditingInitial} 
            setIsEditing={setIsEditingInitial} 
            inputVal={initialInput} 
            setInputVal={setInitialInput} 
            onSave={handleSaveInitial} 
            hideEdit={firstDeposit !== undefined || initialCapital > 0}
          />
          <SideRow label="Other Deposits" val={otherDepositsVal} />
          <SideRow label="Total Account Deposits" val={totalAccountDeposits} />
          <SideRow label="Total Withdrawals" val={withdrawalsVal} />
          <SideRow label="Current Acc Balance" val={currentAccBalance} isPnl />
          
          <div style={{ height: 8 }} />
          
          <SideRow label="Total number of deposits" val={totalNumDeposits.toString()} />
          <SideRow label="Total number of withdrawals" val={totalNumWithdrawals.toString()} />
          
          <div style={{ height: 8 }} />
          
          <SideRow label="Over All P/L (Net)" val={totalNetPnl} isPnl />
          <SideRow label="Account Growth" val={accountGrowth} isPct />
          
          <div style={{ height: 8 }} />
          
          <SideRow label="Ave Risk Per Trade" val={aveRiskPerTrade} isPct />
          <SideRow label="Average Reward Per Trade" val={avgRewardPerTrade} isPct />
          <SideRow label="Average Risk:Reward" val={avgRiskReward ? `1 : ${avgRiskReward.toFixed(2)}` : "—"} />
        </Card>

        {/* Position Size Calculator Widget */}
        <div style={{ marginTop: 8 }}>
          <PositionSizeCalculator accountBalance={currentAccBalance} />
        </div>
      </div>

      {/* 2. Right Column: Month on Month Analysis, Visual Charts, and Daily Sheet */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        
        {/* Live Trades Section */}
        {liveTrades && liveTrades.length > 0 && (
          <Card style={{ padding: 18, border: `1px solid ${T.blue}40`, background: `linear-gradient(to right, ${T.panel}, ${T.panel2})` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: T.blue, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.blue, boxShadow: `0 0 10px ${T.blue}` }} />
                ACTIVE POSITIONS ({liveTrades.length})
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
              {liveTrades.map(trade => {
                 const isProfit = trade.pnl >= 0;
                 return (
                   <div key={trade.id} style={{ minWidth: 150, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                         <div style={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>{trade.symbol}</div>
                         <div style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: trade.side === "Long" ? `${T.green}20` : `${T.red}20`, color: trade.side === "Long" ? T.green : T.red }}>{trade.side}</div>
                      </div>
                      <div style={{ fontSize: 11, color: T.dim, marginBottom: 2 }}>Floating PnL</div>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: T.mono, color: isProfit ? T.green : T.red }}>
                         {isProfit ? "+" : ""}${trade.pnl?.toFixed(2) || "0.00"}
                      </div>
                   </div>
                 )
              })}
            </div>
          </Card>
        )}

        {/* Month on Month Analysis Card */}
        <Card style={{ padding: 18, overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: T.bright, letterSpacing: 0.5 }}>MONTH ON MONTH ANALYSIS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: T.dim }}>Year:</span>
              <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ background: T.border, border: `1px solid ${T.border2}`, color: T.text, borderRadius: 5, padding: "3px 8px", fontSize: 11, fontFamily: T.mono }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${T.border}` }}>
            <thead>
              <tr style={{ background: T.panel2 }}>
                <th style={{ ...tableHeaderStyle, textAlign: "left", paddingLeft: 8 }}>Metric</th>
                {monthNames.map(m => (
                  <th key={m} style={tableHeaderStyle}>{m.substring(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Total Trades</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={tableCellStyle}>{s.count}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Winning Trades</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={tableCellStyle}>{s.wins}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Losing Trades</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={tableCellStyle}>{s.losses}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Win Rate</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={tableCellStyle}>{s.count ? `${s.winRate.toFixed(0)}%` : "0%"}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Avg Win</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={{ ...tableCellStyle, color: s.avgWin > 0 ? T.green : T.text }}>{s.avgWin ? fmt$(s.avgWin) : "—"}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Avg Loss</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={{ ...tableCellStyle, color: s.avgLoss < 0 ? T.red : T.text }}>{s.avgLoss ? fmt$(s.avgLoss) : "—"}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Largest Win</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={{ ...tableCellStyle, color: s.largestWin > 0 ? T.green : T.text }}>{s.largestWin ? fmt$(s.largestWin) : "—"}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Largest Loss</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={{ ...tableCellStyle, color: s.largestLoss < 0 ? T.red : T.text }}>{s.largestLoss ? fmt$(s.largestLoss) : "—"}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Trade Costs</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={{ ...tableCellStyle, color: s.totalCosts < 0 ? T.red : T.text }}>{s.totalCosts ? fmt$(s.totalCosts) : "—"}</td>)}
              </tr>
              <tr style={{ background: T.panel2 + "30" }}>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Total P/L (Gross)</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={{ ...tableCellStyle, fontWeight: 700, color: s.totalPnl >= 0 ? T.green : T.red }}>{s.totalPnl ? fmt$(s.totalPnl) : "—"}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Avg P/L Per Trade</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={{ ...tableCellStyle, color: s.avgPnlPerTrade >= 0 ? T.green : T.red }}>{s.avgPnlPerTrade ? fmt$(s.avgPnlPerTrade) : "—"}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Ave Risk Per Trade</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={tableCellStyle}>{s.aveRiskPerTrade ? `${s.aveRiskPerTrade.toFixed(2)}%` : "—"}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8 }}>Avg Reward / Trade</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={{ ...tableCellStyle, color: s.avgRewardPerTrade >= 0 ? T.green : T.red }}>{s.avgRewardPerTrade ? `${s.avgRewardPerTrade.toFixed(2)}%` : "—"}</td>)}
              </tr>
              <tr>
                <td style={{ ...tableCellStyle, textAlign: "left", fontWeight: 700, paddingLeft: 8, borderRight: `1px solid ${T.border}` }}>Avg Risk:Reward</td>
                {monthlyStats.map((s, idx) => <td key={idx} style={{ ...tableCellStyle, borderRight: `1px solid ${T.border}30` }}>{s.avgRiskReward ? `1:${s.avgRiskReward.toFixed(2)}` : "—"}</td>)}
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Charts Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.dim }}>WIN RATE DONUT</div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 110 }}>
              {renderDonutChart()}
            </div>
          </Card>
          
          <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.dim }}>PROFIT & LOSS VOLUME</div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 110 }}>
              {renderBarChart()}
            </div>
          </Card>
        </div>

        {/* Bottom Row: Curve & Daily Sheet */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.dim }}>OVER ALL PROFIT/LOSS GRAPH</div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {renderLineChart()}
            </div>
          </Card>

          <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, maxHeight: 180 }}>
            <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.dim }}>DAILY SHEET</div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.panel2, borderBottom: `1px solid ${T.border}` }}>
                    <th style={{ padding: "4px 8px", fontSize: 9, color: T.dim, textAlign: "left", textTransform: "uppercase" }}>Day</th>
                    <th style={{ padding: "4px 8px", fontSize: 9, color: T.dim, textAlign: "right", textTransform: "uppercase" }}>Net P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySheetList.map(([day, pnl]) => (
                    <tr key={day} style={{ borderBottom: `1px solid ${T.border}20` }}>
                      <td style={{ padding: "5px 8px", fontSize: 11, fontFamily: T.mono, color: T.bright }}>{day}</td>
                      <td style={{ padding: "5px 8px", fontSize: 11, fontFamily: T.mono, textAlign: "right", color: pnl >= 0 ? T.green : T.red, fontWeight: 700 }}>
                        {fmt$(pnl)}
                      </td>
                    </tr>
                  ))}
                  {dailySheetList.length === 0 && (
                    <tr>
                      <td colSpan="2" style={{ padding: "12px 0", textAlign: "center", color: T.dim, fontSize: 11 }}>No data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
