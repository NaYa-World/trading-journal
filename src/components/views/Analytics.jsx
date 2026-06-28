import { useState, useMemo } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { Card, Tag, CoinIcon, ML } from "../shared/index.jsx";
import { fmt$ } from "../../utils/helpers.js";

export default function Analytics() {
  const { trades, T } = useDashboard();
  const [activeTab, setActiveTab] = useState("Setup");

  if (!trades.some(t => t.status === "closed")) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: T.dim, fontSize: 15, fontFamily: T.mono }}>No closed trades to analyse yet.</div>
  );

  // ── Pro Metrics ──
  const { closed, wins, losses, profitFactor, expectancy, maxDd, mistakeData, setupData, symData, sorted, curStreak, curType, maxWin, maxLoss, streaks, last20, reasonData } = useMemo(() => {
    const closed = trades.filter(t => t.status === "closed");
    const getNet = t => t.pnl + (t.fees || 0) - (t.fundingFees || 0);
    const wins = closed.filter(t => getNet(t) > 0);
    const losses = closed.filter(t => getNet(t) < 0);
    const grossProfit = wins.reduce((s, t) => s + getNet(t), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + getNet(t), 0));
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? "∞" : "0.00") : (grossProfit / grossLoss).toFixed(2);
    const winRateNum = closed.length ? (wins.length / closed.length) : 0;
    const avgWinNum = wins.length ? grossProfit / wins.length : 0;
    const avgLossNum = losses.length ? grossLoss / losses.length : 0;
    const expectancy = (winRateNum * avgWinNum) - ((1 - winRateNum) * avgLossNum);

    let peak = 0, currentBalance = 0, maxDd = 0;
    const sortedByTime = [...closed].sort((a, b) => a.closeTime - b.closeTime);
    sortedByTime.forEach(t => {
      currentBalance += getNet(t);
      if (currentBalance > peak) peak = currentBalance;
      const drawdown = peak - currentBalance;
      if (drawdown > maxDd) maxDd = drawdown;
    });

    // ── Mistake breakdown ──
    const mistakeMap = {};
    closed.forEach(t => {
      if (!t.mistake || t.mistake === "None") return;
      if (!mistakeMap[t.mistake]) mistakeMap[t.mistake] = { count: 0, pnl: 0 };
      mistakeMap[t.mistake].count++;
      mistakeMap[t.mistake].pnl += getNet(t);
    });
    const mistakeData = Object.entries(mistakeMap).map(([mistake, d]) => ({
      mistake, ...d, pnl: parseFloat(d.pnl.toFixed(2))
    })).sort((a, b) => a.pnl - b.pnl);

    // ── Setup performance ──
    const setupMap = {};
    closed.forEach(t => {
      if (!setupMap[t.setup]) setupMap[t.setup] = { wins: 0, losses: 0, pnl: 0, trades: 0 };
      setupMap[t.setup].trades++;
      setupMap[t.setup].pnl += getNet(t);
      if (getNet(t) > 0) setupMap[t.setup].wins++; else setupMap[t.setup].losses++;
    });
    const setupData = Object.entries(setupMap).map(([setup, d]) => ({
      setup, ...d, winRate: Math.round((d.wins / d.trades) * 100),
      avgPnl: parseFloat((d.pnl / d.trades).toFixed(2)),
      pnl: parseFloat(d.pnl.toFixed(2)),
    })).sort((a, b) => b.pnl - a.pnl);

    // ── Symbol performance ──
    const symMap = {};
    closed.forEach(t => {
      if (!symMap[t.symbol]) symMap[t.symbol] = { wins: 0, losses: 0, pnl: 0, trades: 0 };
      symMap[t.symbol].trades++;
      symMap[t.symbol].pnl += getNet(t);
      if (getNet(t) > 0) symMap[t.symbol].wins++; else symMap[t.symbol].losses++;
    });
    const symData = Object.entries(symMap).map(([symbol, d]) => ({
      symbol, ...d, winRate: Math.round((d.wins / d.trades) * 100),
      avgPnl: parseFloat((d.pnl / d.trades).toFixed(2)),
      pnl: parseFloat(d.pnl.toFixed(2)),
    })).sort((a, b) => b.pnl - a.pnl);

    // ── Streak analysis ──
    const sorted = [...closed].sort((a, b) => a.closeTime - b.closeTime);
    let curStreak = 0, curType = null, maxWin = 0, maxLoss = 0;
    const streaks = [];
    sorted.forEach(t => {
      const type = getNet(t) > 0 ? "W" : "L";
      if (type === curType) { curStreak++; }
      else { if (curType) streaks.push({ type: curType, len: curStreak }); curStreak = 1; curType = type; }
      if (type === "W") maxWin = Math.max(maxWin, curStreak);
      else maxLoss = Math.max(maxLoss, curStreak);
    });
    if (curType) streaks.push({ type: curType, len: curStreak });
    const last20 = sorted.slice(-20).map(t => getNet(t) > 0 ? "W" : "L");

    // ── Close reason breakdown ──
    const reasonMap = {};
    closed.forEach(t => {
      if (!reasonMap[t.closeReason]) reasonMap[t.closeReason] = { count: 0, pnl: 0, wins: 0 };
      reasonMap[t.closeReason].count++;
      reasonMap[t.closeReason].pnl += getNet(t);
      if (getNet(t) > 0) reasonMap[t.closeReason].wins++;
    });
    const reasonData = Object.entries(reasonMap).map(([r, d]) => ({
      reason: r, ...d, pnl: parseFloat(d.pnl.toFixed(2)),
      winRate: Math.round((d.wins / d.count) * 100),
    })).sort((a, b) => b.count - a.count);

    return { closed, wins, losses, profitFactor, expectancy, maxDd, mistakeData, setupData, symData, sorted, curStreak, curType, maxWin, maxLoss, streaks, last20, reasonData };
  }, [trades]);

  const maxSetupPnl = Math.max(...setupData.map(s => Math.abs(s.pnl)), 1);
  const maxSymPnl = Math.max(...symData.map(s => Math.abs(s.pnl)), 1);
  const TABS = ["Setup", "Symbol", "Psychology", "Streaks", "Close Reason"];

  return (
    <div>
      {/* Pro Metrics Banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        <Card><div style={ML}>Profit Factor</div><div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: profitFactor > 1.5 ? T.green : profitFactor > 1 ? T.cyan : T.red }}>{profitFactor}</div><div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Gross Win / Gross Loss</div></Card>
        <Card><div style={ML}>Expectancy</div><div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: expectancy > 0 ? T.green : T.red }}>{fmt$(expectancy)}</div><div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Expected Return per Trade</div></Card>
        <Card><div style={ML}>Max Drawdown</div><div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: T.red }}>{fmt$(-maxDd)}</div><div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Worst peak-to-trough drop</div></Card>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: "none", border: "none", borderBottom: activeTab === tab ? `2px solid ${T.blue}` : "2px solid transparent", color: activeTab === tab ? (tab === "Psychology" ? T.red : T.bright) : T.dim, padding: "8px 16px", cursor: "pointer", fontSize: 15, fontWeight: activeTab === tab ? 600 : 400, marginBottom: -1 }}>{tab}</button>
        ))}
      </div>

      {/* Setup Performance */}
      {activeTab === "Setup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 6 }}>
            {[
              { label: "Best Setup", val: setupData[0]?.setup, sub: `${fmt$(setupData[0]?.pnl)} total` },
              { label: "Highest Win Rate", val: setupData.sort((a, b) => b.winRate - a.winRate)[0]?.setup, sub: `${setupData.sort((a, b) => b.winRate - a.winRate)[0]?.winRate}% WR` },
              { label: "Most Used", val: setupData.sort((a, b) => b.trades - a.trades)[0]?.setup, sub: `${setupData.sort((a, b) => b.trades - a.trades)[0]?.trades} trades` },
            ].map((s, i) => (
              <Card key={i}><div style={ML}>{s.label}</div><div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.bright }}>{s.val || "–"}</div><div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{s.sub}</div></Card>
            ))}
          </div>
          {[...setupData].sort((a, b) => b.pnl - a.pnl).map(s => (
            <Card key={s.setup}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 80px 70px 60px", alignItems: "center", gap: 12 }}>
                <Tag label={s.setup} />
                <div style={{ position: "relative", height: 10, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(Math.abs(s.pnl) / maxSetupPnl) * 100}%`, background: s.pnl >= 0 ? T.green : T.red, borderRadius: 4 }} />
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: s.pnl >= 0 ? T.green : T.red, textAlign: "right" }}>{fmt$(s.pnl)}</div>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: T.dim, textAlign: "right" }}>avg {fmt$(s.avgPnl)}</div>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: s.winRate >= 50 ? T.green : T.red, textAlign: "right" }}>{s.winRate}% WR</div>
                <div style={{ fontSize: 12, color: T.dim, textAlign: "right" }}>{s.trades}t</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Psychology Performance */}
      {activeTab === "Psychology" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mistakeData.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.dim, fontSize: 14 }}>No mistakes recorded yet. Flawless execution!</div>
          ) : (
            mistakeData.map(m => (
              <Card key={m.mistake}>
                <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 100px 80px", alignItems: "center", gap: 12 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 13, color: T.red, fontWeight: 700 }}>{m.mistake}</div>
                  <div style={{ position: "relative", height: 10, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(Math.abs(m.pnl) / Math.abs(mistakeData[0].pnl)) * 100}%`, background: T.red, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: 14, color: T.red, textAlign: "right", fontWeight: 700 }}>{fmt$(m.pnl)}</div>
                  <div style={{ fontSize: 12, color: T.dim, textAlign: "right" }}>{m.count} trades</div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Symbol Performance */}
      {activeTab === "Symbol" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {symData.map(s => (
            <Card key={s.symbol}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px 90px 70px 60px", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><CoinIcon symbol={s.symbol} size={22} /><span style={{ fontFamily: T.mono, fontSize: 13, color: T.bright }}>{s.symbol.replace("USDT", "")}</span></div>
                <div style={{ position: "relative", height: 10, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(Math.abs(s.pnl) / maxSymPnl) * 100}%`, background: s.pnl >= 0 ? T.green : T.red, borderRadius: 4 }} />
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: s.pnl >= 0 ? T.green : T.red, textAlign: "right" }}>{fmt$(s.pnl)}</div>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: T.dim, textAlign: "right" }}>avg {fmt$(s.avgPnl)}</div>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: s.winRate >= 50 ? T.green : T.red, textAlign: "right" }}>{s.winRate}% WR</div>
                <div style={{ fontSize: 12, color: T.dim, textAlign: "right" }}>{s.trades}t</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Streak Analysis */}
      {activeTab === "Streaks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              { label: "Best Win Streak", val: maxWin, color: T.green },
              { label: "Worst Loss Streak", val: maxLoss, color: T.red },
              { label: "Current Streak", val: `${curStreak} ${curType === "W" ? "W" : "L"}`, color: curType === "W" ? T.green : T.red },
              { label: "Total Trades", val: closed.length, color: T.cyan },
            ].map((s, i) => (
              <Card key={i}><div style={ML}>{s.label}</div><div style={{ fontFamily: T.mono, fontSize: 26, fontWeight: 700, color: s.color }}>{s.val}</div></Card>
            ))}
          </div>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.bright, marginBottom: 12 }}>Last 20 Trades</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {last20.map((r, i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: 6, background: r === "W" ? T.greenDim : T.redDim, border: `1px solid ${r === "W" ? T.green : T.red}40`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: r === "W" ? T.green : T.red }}>{r}</div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.bright, marginBottom: 12 }}>Streak History</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-end" }}>
              {streaks.slice(-30).map((s, i) => (
                <div key={i} title={`${s.type === "W" ? "Win" : "Loss"} streak of ${s.len}`} style={{ width: 16, background: s.type === "W" ? T.green : T.red, borderRadius: "2px 2px 0 0", height: `${Math.min(s.len * 12, 80)}px`, opacity: 0.8 }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: T.green }} /><span style={{ fontSize: 12, color: T.dim }}>Win streak</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: T.red }} /><span style={{ fontSize: 12, color: T.dim }}>Loss streak</span></div>
            </div>
          </Card>
        </div>
      )}

      {/* Close Reason */}
      {activeTab === "Close Reason" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reasonData.map(r => (
            <Card key={r.reason}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 15, color: T.bright, fontWeight: 600, minWidth: 150 }}>{r.reason}</div>
                  <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono }}>{r.count} trades</div>
                </div>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>TOTAL PnL</div><div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: r.pnl >= 0 ? T.green : T.red }}>{fmt$(r.pnl)}</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>WIN RATE</div><div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: r.winRate >= 50 ? T.green : T.red }}>{r.winRate}%</div></div>
                </div>
              </div>
              <div style={{ marginTop: 8, background: T.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${r.winRate}%`, background: r.winRate >= 50 ? T.green : T.red, borderRadius: 4 }} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
