import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { useDashboard } from "../../context/DashboardContext.jsx";

// ---- Date range filter ----
function withinRange(closeTime, range) {
  if (!closeTime) return false;
  if (range === "all") return true;
  const days = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 }[range];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(closeTime).getTime() >= cutoff;
}

// ---- Pure calc helpers ----
function computeStats(trades) {
  const closed = trades.filter(t => t.status === "closed" && typeof t.pnl === "number");
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const totalFees = trades.reduce((sum, t) => sum + (t.fees ?? 0) + (t.fundingFees ?? 0), 0);
  const wins = closed.filter(t => (t.pnl ?? 0) > 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const biggestWin = closed.reduce((max, t) => Math.max(max, t.pnl ?? 0), 0);
  const biggestLoss = closed.reduce((min, t) => Math.min(min, t.pnl ?? 0), 0);
  const openCount = trades.filter(t => t.status !== "closed").length;

  return { totalPnl, totalFees, winRate, biggestWin, biggestLoss, openCount, closedCount: closed.length };
}

function computeEquityCurve(trades) {
  const closed = trades
    .filter(t => t.status === "closed" && t.closeTime)
    .sort((a, b) => a.closeTime - b.closeTime);

  let running = 0;
  return closed.map(t => {
    running += t.pnl ?? 0;
    return { 
      date: new Date(t.closeTime).toISOString().slice(0, 10), 
      equity: Math.round(running * 100) / 100 
    };
  });
}

function computeMonthlySummary(trades) {
  const closed = trades.filter(t => t.status === "closed" && t.closeTime);
  const byMonth = new Map();

  for (const t of closed) {
    const month = new Date(t.closeTime).toISOString().slice(0, 7); // YYYY-MM
    const entry = byMonth.get(month) ?? { pnl: 0, wins: 0, losses: 0 };
    entry.pnl += t.pnl ?? 0;
    if ((t.pnl ?? 0) > 0) entry.wins++; else entry.losses++;
    byMonth.set(month, entry);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));
}

function computeSymbolTable(trades) {
  const closed = trades.filter(t => t.status === "closed");
  const bySymbol = new Map();

  for (const t of closed) {
    const entry = bySymbol.get(t.symbol) ?? { entries: [], pnl: 0, wins: 0, count: 0 };
    entry.entries.push(t.entry);
    entry.pnl += t.pnl ?? 0;
    if ((t.pnl ?? 0) > 0) entry.wins++;
    entry.count++;
    bySymbol.set(t.symbol, entry);
  }

  return Array.from(bySymbol.entries())
    .map(([symbol, v]) => ({
      symbol,
      avgEntry: v.entries.reduce((a, b) => a + b, 0) / v.entries.length,
      totalPnl: v.pnl,
      winRate: (v.wins / v.count) * 100,
      count: v.count,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

function computeBreakdown(trades, key) {
  const closed = trades.filter(t => t.status === "closed");
  const map = new Map();

  for (const t of closed) {
    const k = key(t);
    const entry = map.get(k) ?? { pnl: 0, count: 0, wins: 0 };
    entry.pnl += t.pnl ?? 0;
    entry.count++;
    if ((t.pnl ?? 0) > 0) entry.wins++;
    map.set(k, entry);
  }

  return Array.from(map.entries()).map(([k, v]) => ({
    label: k,
    pnl: v.pnl,
    count: v.count,
    winRate: v.count ? (v.wins / v.count) * 100 : 0,
  }));
}

// ---- UI subcomponents ----

function StatCard({ label, value, tone }) {
  const color = tone === "pos" ? "var(--accent-green, #22c55e)"
    : tone === "neg" ? "var(--accent-red, #ef4444)"
    : "var(--text-primary, #e5e7eb)";
  return (
    <div style={{
      background: "var(--surface-1, #16181d)",
      border: "1px solid var(--border, #2a2d35)",
      borderRadius: 10,
      padding: "14px 16px",
      minWidth: 140,
      flex: "1 1 140px",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-muted, #9aa0aa)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

function fmtMoney(n) {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const RANGE_OPTIONS = [
  { value: "7d", label: "This week" },
  { value: "30d", label: "This month" },
  { value: "90d", label: "Last 3 months" },
  { value: "1y", label: "This year" },
  { value: "all", label: "All time" },
];

// ---- Main Dashboard ----

export default function DashboardV3() {
  const { allTrades } = useDashboard();
  const [range, setRange] = useState("30d");

  // Filter once; all derived data flows from this.
  const trades = useMemo(() => {
    return allTrades.filter(t =>
      t.status !== "closed" ? true : withinRange(t.closeTime, range)
    );
  }, [allTrades, range]);

  const stats = useMemo(() => computeStats(trades), [trades]);
  const equityCurve = useMemo(() => computeEquityCurve(trades), [trades]);
  const monthly = useMemo(() => computeMonthlySummary(trades), [trades]);
  const symbolTable = useMemo(() => computeSymbolTable(trades), [trades]);
  const directionBreakdown = useMemo(
    () => computeBreakdown(trades, t => t.side?.toLowerCase() || "long"), [trades]
  );
  const exchangeBreakdown = useMemo(
    () => computeBreakdown(trades, t => t.exchange?.toLowerCase() || "binance"), [trades]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 16, background: "#080c12", color: "#e5e7eb", borderRadius: 12 }}>
      {/* Header + date range filter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#fff" }}>v3 Dashboard (Recharts)</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              style={{
                fontSize: 12,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid var(--border, #2a2d35)",
                background: range === opt.value ? "var(--bg-accent, #1e3a5f)" : "transparent",
                color: range === opt.value ? "var(--text-accent, #60a5fa)" : "var(--text-secondary, #9aa0aa)",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="Total PnL" value={fmtMoney(stats.totalPnl)} tone={stats.totalPnl >= 0 ? "pos" : "neg"} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
        <StatCard label="Open Positions" value={String(stats.openCount)} />
        <StatCard label="Biggest Win" value={fmtMoney(stats.biggestWin)} tone="pos" />
        <StatCard label="Biggest Loss" value={fmtMoney(stats.biggestLoss)} tone="neg" />
        <StatCard label="Total Fees Paid" value={fmtMoney(stats.totalFees)} />
      </div>

      {/* Equity curve */}
      <div style={{ background: "var(--surface-1, #16181d)", border: "1px solid var(--border, #2a2d35)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary, #9aa0aa)", marginBottom: 10 }}>Equity Curve</div>
        {equityCurve.length === 0 ? (
          <EmptyState text="No closed trades in this range yet." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #2a2d35)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => fmtMoney(v)}
                contentStyle={{ background: "var(--surface-2, #1c1f26)", border: "1px solid var(--border, #2a2d35)", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="equity" stroke="var(--text-accent, #60a5fa)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly summary */}
      <div style={{ background: "var(--surface-1, #16181d)", border: "1px solid var(--border, #2a2d35)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary, #9aa0aa)", marginBottom: 10 }}>Monthly Summary</div>
        {monthly.length === 0 ? (
          <EmptyState text="No monthly data yet." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #2a2d35)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => fmtMoney(v)}
                contentStyle={{ background: "var(--surface-2, #1c1f26)", border: "1px solid var(--border, #2a2d35)", fontSize: 12 }}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {monthly.map((m, i) => (
                  <Cell key={i} fill={m.pnl >= 0 ? "var(--accent-green, #22c55e)" : "var(--accent-red, #ef4444)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdowns: direction + exchange side by side */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <BreakdownCard title="By Direction" rows={directionBreakdown} />
        <BreakdownCard title="By Exchange" rows={exchangeBreakdown} />
      </div>

      {/* Symbol table */}
      <div style={{ background: "var(--surface-1, #16181d)", border: "1px solid var(--border, #2a2d35)", borderRadius: 10, padding: 16, overflowX: "auto" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary, #9aa0aa)", marginBottom: 10 }}>By Symbol</div>
        {symbolTable.length === 0 ? (
          <EmptyState text="No closed trades to summarize." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted, #9aa0aa)", fontSize: 11 }}>
                <th style={{ padding: "6px 8px" }}>Symbol</th>
                <th style={{ padding: "6px 8px" }}>Avg Entry</th>
                <th style={{ padding: "6px 8px" }}>Total PnL</th>
                <th style={{ padding: "6px 8px" }}>Win Rate</th>
                <th style={{ padding: "6px 8px" }}>Trades</th>
              </tr>
            </thead>
            <tbody>
              {symbolTable.map(row => (
                <tr key={row.symbol} style={{ borderTop: "1px solid var(--border, #2a2d35)" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 500 }}>{row.symbol}</td>
                  <td style={{ padding: "6px 8px" }}>₹{row.avgEntry.toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: "6px 8px", color: row.totalPnl >= 0 ? "var(--accent-green, #22c55e)" : "var(--accent-red, #ef4444)" }}>
                    {fmtMoney(row.totalPnl)}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{row.winRate.toFixed(1)}%</td>
                  <td style={{ padding: "6px 8px" }}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BreakdownCard({ title, rows }) {
  return (
    <div style={{ background: "var(--surface-1, #16181d)", border: "1px solid var(--border, #2a2d35)", borderRadius: 10, padding: 16, flex: "1 1 260px" }}>
      <div style={{ fontSize: 13, color: "var(--text-secondary, #9aa0aa)", marginBottom: 10 }}>{title}</div>
      {rows.length === 0 ? (
        <EmptyState text="No data yet." />
      ) : (
        rows.map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--border, #2a2d35)", fontSize: 13 }}>
            <span style={{ textTransform: "capitalize" }}>{r.label}</span>
            <span style={{ color: "var(--text-muted, #9aa0aa)" }}>{r.count} trades · {r.winRate.toFixed(0)}% WR</span>
            <span style={{ color: r.pnl >= 0 ? "var(--accent-green, #22c55e)" : "var(--accent-red, #ef4444)" }}>{fmtMoney(r.pnl)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ fontSize: 12, color: "var(--text-muted, #9aa0aa)", padding: "20px 0", textAlign: "center" }}>{text}</div>;
}
