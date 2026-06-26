import { useState, useEffect, useMemo } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { Tag } from "../shared/index.jsx";
import { fmt$ } from "../../utils/helpers.js";

export default function TradingCalendar() {
  const { trades, reviews, openReview, T } = useDashboard();
  const [cur, setCur] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [heatMode, setHeatMode] = useState("pnl"); // pnl | winrate | volume
  const [viewMode, setViewMode] = useState("month"); // month | year
  const year = cur.getFullYear(), month = cur.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const closed = useMemo(() =>
    trades.filter(t => t.status === "closed" && t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal"),
    [trades]
  );

  const dayData = {};
  closed.forEach(t => {
    const d = new Date(t.closeTime);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dayData[day]) dayData[day] = { pnl: 0, trades: 0, wins: 0, tags: {}, tradeList: [] };
      dayData[day].pnl += t.pnl;
      dayData[day].trades++;
      if (t.pnl > 0) dayData[day].wins++;
      dayData[day].tradeList.push(t);
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach(tag => { dayData[day].tags[tag] = (dayData[day].tags[tag] || 0) + 1; });
      }
    }
  });

  const maxAbsPnl = Math.max(...Object.values(dayData).map(d => Math.abs(d.pnl)), 1);
  const maxVol = Math.max(...Object.values(dayData).map(d => d.trades), 1);
  const monthPnl = Object.values(dayData).reduce((s, d) => s + d.pnl, 0);
  const monthTrades = Object.values(dayData).reduce((s, d) => s + d.trades, 0);
  const monthWins = Object.values(dayData).reduce((s, d) => s + d.wins, 0);
  const monthName = cur.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const yearData = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      pnl: 0,
      trades: 0,
      wins: 0,
      tradeList: []
    }));
    closed.forEach(t => {
      const d = new Date(t.closeTime);
      if (d.getFullYear() === year) {
        const m = d.getMonth();
        data[m].pnl += t.pnl;
        data[m].trades++;
        if (t.pnl > 0) data[m].wins++;
        data[m].tradeList.push(t);
      }
    });
    return data;
  }, [closed, year]);

  const yearPnl = yearData.reduce((s, m) => s + m.pnl, 0);
  const yearTrades = yearData.reduce((s, m) => s + m.trades, 0);
  const yearWins = yearData.reduce((s, m) => s + m.wins, 0);

  useEffect(() => {
    setSelectedDay(null);
  }, [cur, viewMode]);

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const getCellStyle = (day) => {
    const data = day ? dayData[day] : null;
    if (!data) return { bg: "transparent", border: "transparent" };
    if (heatMode === "pnl") {
      const intensity = Math.min(Math.abs(data.pnl) / maxAbsPnl, 1);
      const alpha = 0.1 + intensity * 0.6;
      return data.pnl >= 0
        ? { bg: `rgba(0,212,163,${alpha})`, border: `rgba(0,212,163,${alpha + 0.2})` }
        : { bg: `rgba(255,77,121,${alpha})`, border: `rgba(255,77,121,${alpha + 0.2})` };
    }
    if (heatMode === "winrate") {
      const wr = data.trades ? data.wins / data.trades : 0;
      return wr >= 0.6
        ? { bg: `rgba(0,212,163,${0.1 + wr * 0.5})`, border: `rgba(0,212,163,0.5)` }
        : { bg: `rgba(255,77,121,${0.1 + (1 - wr) * 0.5})`, border: `rgba(255,77,121,0.5)` };
    }
    const intensity = data.trades / maxVol;
    return { bg: `rgba(99,102,241,${0.1 + intensity * 0.6})`, border: `rgba(99,102,241,0.4)` };
  };

  const todayKey = `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;
  const reviewKey = `${year}-${month}`;
  const hasReview = reviews && reviews[reviewKey];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setCur(new Date(viewMode === "month" ? year : year - 1, viewMode === "month" ? month - 1 : month, 1))} style={{ background: T.panel, border: `1px solid ${T.border}`, color: T.text, borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 18 }}>‹</button>
          <span style={{ fontFamily: T.mono, fontSize: 17, fontWeight: 700, color: T.bright }}>{viewMode === "month" ? monthName : year}</span>
          <button onClick={() => setCur(new Date(viewMode === "month" ? year : year + 1, viewMode === "month" ? month + 1 : month, 1))} style={{ background: T.panel, border: `1px solid ${T.border}`, color: T.text, borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 18 }}>›</button>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontFamily: T.mono, fontSize: 14, color: (viewMode === "month" ? monthPnl : yearPnl) >= 0 ? T.green : T.red, fontWeight: 700 }}>
            {fmt$(viewMode === "month" ? monthPnl : yearPnl)}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 13, color: T.dim }}>
            {viewMode === "month" ? monthTrades : yearTrades} trades
          </span>
          {(viewMode === "month" ? monthTrades : yearTrades) > 0 && (
            <span style={{ fontFamily: T.mono, fontSize: 13, color: T.cyan }}>
              {Math.round(((viewMode === "month" ? monthWins : yearWins) / (viewMode === "month" ? monthTrades : yearTrades)) * 100)}% WR
            </span>
          )}
          {viewMode === "month" && (
            <button onClick={() => openReview(reviewKey)} style={{ background: hasReview ? T.greenDim : T.blueDim, border: `1px solid ${hasReview ? T.green : T.blue}40`, color: hasReview ? T.green : T.blue, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontFamily: T.mono }}>{hasReview ? "✓ Review" : "+ Review"}</button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[["pnl", "P&L"], ["winrate", "Win Rate"], ["volume", "Volume"]].map(([mode, label]) => (
            <button key={mode} onClick={() => setHeatMode(mode)} style={{ background: heatMode === mode ? T.blueDim : "none", border: `1px solid ${heatMode === mode ? T.blue + "50" : T.border}`, color: heatMode === mode ? T.blue : T.dim, borderRadius: 5, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontFamily: T.mono }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["month", "Month View"], ["year", "Year View"]].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? T.border : "none", border: `1px solid ${viewMode === mode ? T.border2 : T.border}`, color: viewMode === mode ? T.text : T.dim, borderRadius: 5, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontFamily: T.mono }}>{label}</button>
          ))}
        </div>
      </div>

      {viewMode === "month" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr) 80px", gap: 3, marginBottom: 3 }}>
            {DAY_LABELS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, color: T.dim, letterSpacing: 1.5, padding: "2px 0", fontFamily: T.mono }}>{d}</div>)}
            <div style={{ fontSize: 10, color: T.dim, letterSpacing: 1, padding: "2px 6px", fontFamily: T.mono, textAlign: "right" }}>WEEK</div>
          </div>

          {weeks.map((week, wi) => {
            const weekPnl = week.filter(Boolean).reduce((s, d) => s + (dayData[d]?.pnl || 0), 0);
            const weekTrades = week.filter(Boolean).reduce((s, d) => s + (dayData[d]?.trades || 0), 0);
            const weekWins = week.filter(Boolean).reduce((s, d) => s + (dayData[d]?.wins || 0), 0);
            return (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr) 80px", gap: 3, marginBottom: 3 }}>
                {week.map((day, di) => {
                  const data = day ? dayData[day] : null;
                  const cs = getCellStyle(day);
                  const isSelected = selectedDay === day;
                  const isToday = day && `${year}-${month}-${day}` === todayKey;
                  return (
                    <div key={di} onClick={() => day && setSelectedDay(isSelected ? null : day)}
                      style={{ background: cs.bg, border: `1px solid ${isSelected ? T.blue : cs.border}`, borderRadius: 6, padding: "6px 6px", minHeight: 76, cursor: day ? "pointer" : "default", boxShadow: isSelected ? `0 0 0 2px ${T.blue}60` : "none", transition: "all .15s" }}>
                      {day && (
                        <>
                          <div style={{ fontSize: 10, color: isToday ? T.blue : T.dim, fontWeight: isToday ? 700 : 400, marginBottom: 3, fontFamily: T.mono }}>{day}{isToday && " ◉"}</div>
                          {data ? (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 700, color: data.pnl >= 0 ? T.green : T.red, fontFamily: T.mono }}>{fmt$(data.pnl)}</div>
                              <div style={{ fontSize: 9, color: T.dim, fontFamily: T.mono }}>{data.trades}t · {Math.round((data.wins / data.trades) * 100)}%wr</div>
                              <div style={{ display: "flex", gap: 1, marginTop: 4, alignItems: "flex-end", height: 14 }}>
                                {data.tradeList.slice(0, 7).map((t, i) => (
                                  <div key={i} style={{ flex: 1, background: t.pnl >= 0 ? T.green : T.red, borderRadius: 1, height: `${Math.max(30, Math.min(100, Math.abs(t.pnl) / Math.max(...data.tradeList.map(x => Math.abs(x.pnl)), 1) * 100))}%`, opacity: 0.7 }} />
                                ))}
                              </div>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
                <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end" }}>
                  {weekTrades > 0 ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: weekPnl >= 0 ? T.green : T.red, fontFamily: T.mono }}>{fmt$(weekPnl)}</div>
                      <div style={{ fontSize: 9, color: T.dim, fontFamily: T.mono }}>{weekTrades}t</div>
                      <div style={{ fontSize: 9, color: T.cyan, fontFamily: T.mono }}>{Math.round((weekWins / weekTrades) * 100)}%</div>
                    </>
                  ) : <div style={{ fontSize: 10, color: T.dim }}>–</div>}
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>Less</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(a => (
              <div key={a} style={{ width: 14, height: 14, borderRadius: 3, background: heatMode === "volume" ? `rgba(99,102,241,${a})` : `rgba(0,212,163,${a})` }} />
            ))}
            <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>More</span>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 10 }}>
          {yearData.map((m) => {
            const hasTrades = m.trades > 0;
            const wr = hasTrades ? Math.round((m.wins / m.trades) * 100) : 0;
            const name = new Date(year, m.monthIndex, 1).toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
            
            let cellBg = T.panel;
            let cellBorder = T.border;
            if (hasTrades) {
              if (heatMode === "pnl") {
                const maxAbsMonthPnl = Math.max(...yearData.map(x => Math.abs(x.pnl)), 1);
                const intensity = Math.min(Math.abs(m.pnl) / maxAbsMonthPnl, 1);
                const alpha = 0.15 + intensity * 0.55;
                cellBg = m.pnl >= 0 ? `rgba(0,212,163,${alpha})` : `rgba(255,77,121,${alpha})`;
                cellBorder = m.pnl >= 0 ? `rgba(0,212,163,${alpha + 0.2})` : `rgba(255,77,121,${alpha + 0.2})`;
              } else if (heatMode === "winrate") {
                cellBg = wr >= 60
                  ? `rgba(0,212,163,${0.15 + (wr / 100) * 0.55})`
                  : `rgba(255,77,121,${0.15 + (1 - wr / 100) * 0.55})`;
                cellBorder = wr >= 60 ? `rgba(0,212,163,0.5)` : `rgba(255,77,121,0.5)`;
              } else {
                const maxVol = Math.max(...yearData.map(x => x.trades), 1);
                const intensity = m.trades / maxVol;
                cellBg = `rgba(99,102,241,${0.15 + intensity * 0.55})`;
                cellBorder = `rgba(99,102,241,0.45)`;
              }
            }

            return (
              <div
                key={m.monthIndex}
                onClick={() => {
                  setCur(new Date(year, m.monthIndex, 1));
                  setViewMode("month");
                }}
                style={{
                  background: cellBg,
                  border: `1px solid ${cellBorder}`,
                  borderRadius: 8,
                  padding: "16px 12px",
                  cursor: "pointer",
                  minHeight: 100,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                  boxShadow: "none"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.2)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: T.bright, letterSpacing: 0.5 }}>{name}</div>
                {hasTrades ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: m.pnl >= 0 ? T.green : T.red, fontFamily: T.mono }}>
                      {fmt$(m.pnl)}
                    </div>
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 2, fontFamily: T.mono }}>
                      {m.trades} trades · {wr}% WR
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: T.dim, marginTop: 8, fontStyle: "italic" }}>No trades</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "month" && selectedDay && dayData[selectedDay] && (
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.bright, marginBottom: 10 }}>
            {new Date(year, month, selectedDay).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })} — {dayData[selectedDay].trades} trades
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dayData[selectedDay].tradeList.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.panel2, borderRadius: 7, padding: "8px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 14, color: T.bright }}>{t.symbol}</span>
                  <span style={{ fontSize: 12, color: t.side === "Long" ? T.green : T.red, fontFamily: T.mono }}>{t.side}</span>
                  <Tag label={t.setup} />
                </div>
                <span style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: t.pnl >= 0 ? T.green : T.red }}>{fmt$(t.pnl)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
