import { useState } from "react";
/* eslint-disable react-refresh/only-export-components */
import { T } from "../../utils/theme.js";

// ─── Tag chip ─────────────────────────────────────────────────────────────────
export const TAG_COLORS = {
  BREAKOUT: ["#00d4a318", "#00d4a3"], FOMO: ["#f9731618", "#f97316"],
  "RSI CROSSED": ["#6366f118", "#6366f1"], REVERSAL: ["#eab30818", "#eab308"],
  "BU-OB": ["#ec489918", "#ec4899"], "LTF CONFIRM": ["#a855f718", "#a855f7"],
  VWAP: ["#22d3ee18", "#22d3ee"],
};

export function Tag({ label }) {
  const [bg, fg] = TAG_COLORS[label] || ["#64748b18", "#64748b"];
  return (
    <span style={{ background: bg, color: fg, border: `1px solid ${fg}45`, borderRadius: 3, padding: "1px 5px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap", fontFamily: T.mono }}>
      {label}
    </span>
  );
}

// ─── Coin Icon ────────────────────────────────────────────────────────────────
const COIN_COLORS = { BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c2a633", XRP: "#346aa9", BNB: "#f3ba2f", ADA: "#0033ad" };

export function CoinIcon({ symbol, size = 32 }) {
  const sym = symbol.replace("USDT", "");
  const color = COIN_COLORS[sym] || "#6366f1";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color + "25", border: `1.5px solid ${color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, color, fontFamily: T.mono, flexShrink: 0 }}>
      {sym.slice(0, 3)}
    </div>
  );
}

// ─── Info dot ─────────────────────────────────────────────────────────────────
export function InfoDot({ title }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block", marginLeft: 4 }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid ${hover ? T.bright : T.dim}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: hover ? T.bright : T.dim, cursor: "help", flexShrink: 0, transition: "all 0.15s" }}>i</span>
      {hover && title && (
        <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 8, padding: "6px 10px", background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: T.sans, whiteSpace: "nowrap", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", pointerEvents: "none" }}>
          {title}
        </div>
      )}
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: T.panel,
        border: `1px solid ${hover ? T.border2 : T.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        boxShadow: hover ? `0 8px 20px -6px ${T.blue}20` : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
        ...style
      }}
    >
      {children}
    </div>
  );
}

export const ML = {
  fontSize: 14,
  get color() { return T.dim; },
  marginBottom: 8,
  display: "flex",
  alignItems: "center",
  gap: 5
};

export const MV = {
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: 26,
  fontWeight: 700,
  get color() { return T.bright; },
  lineHeight: 1
};

// ─── Placeholder ──────────────────────────────────────────────────────────────
export function Placeholder({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: T.dim, fontSize: 16, fontFamily: T.mono, letterSpacing: 1 }}>
      [ {label} — coming soon ]
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ onAdd, filtered = false }) {
  if (filtered) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={T.dim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <div style={{ fontFamily: T.mono, fontSize: 18, color: T.bright, letterSpacing: 1 }}>No matches found</div>
        <div style={{ fontSize: 15, color: T.dim, textAlign: "center", maxWidth: 320 }}>No trades match the current filters. Adjust your filters to see results.</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M8 7h6" />
        <path d="M8 11h8" />
        <polyline points="10 16 12 14 16 18" />
      </svg>
      <div style={{ fontFamily: T.mono, fontSize: 18, color: T.bright, letterSpacing: 1 }}>No trades yet</div>
      <div style={{ fontSize: 15, color: T.dim, textAlign: "center", maxWidth: 320 }}>Your journal is empty. Add your first trade to start tracking your performance.</div>
      <button onClick={onAdd} style={{ background: T.blue, border: "none", color: "#fff", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: T.mono, marginTop: 8 }}>+ Add First Trade</button>
    </div>
  );
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────
export function Skeleton({ width = "100%", height = 20, style = {} }) {
  return (
    <div style={{
      width, height, background: T.border, borderRadius: 4,
      animation: "pulse 1.5s infinite ease-in-out", ...style
    }} />
  );
}

// ─── SemiGauge ────────────────────────────────────────────────────────────────
export function SemiGauge({ pct, wins, total, size = 90 }) {
  const r = size * 0.4, cx = size / 2, cy = size / 0.58;
  const toXY = (angle) => {
    const rad = (angle - 180) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [sx, sy] = toXY(0);
  const [ex, ey] = toXY(Math.min(pct, 0.999) * 180);
  const large = pct * 180 > 180 ? 1 : 0;
  const sw = size * 0.075;
  return (
    <div style={{ position: "relative", width: size, height: size * 0.65, flexShrink: 0 }}>
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={T.border2} strokeWidth={sw} strokeLinecap="round" />
        {pct > 0 && (
          <path d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`} fill="none" stroke={T.green} strokeWidth={sw} strokeLinecap="round" />
        )}
      </svg>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{wins} / {total}</div>
      </div>
    </div>
  );
}

// ─── DonutGauge ───────────────────────────────────────────────────────────────
export function DonutGauge({ value, size = 72 }) {
  const r = size * 0.38, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const winPct = Math.min(value / 3, 1) * 0.7;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border2} strokeWidth={size * 0.09} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.green}
        strokeWidth={size * 0.09} strokeDasharray={`${circ * winPct} ${circ * (1 - winPct)}`}
        strokeDashoffset={circ * 0.25} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.red}
        strokeWidth={size * 0.09} strokeDasharray={`${circ * 0.25} ${circ * 0.75}`}
        strokeDashoffset={-(circ * (winPct - 0.25))} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
    </svg>
  );
}

// ─── MaskedDateInput ──────────────────────────────────────────────────────────
export function MaskedDateInput({ value, onChange, style }) {
  const handleChange = (e) => {
    let v = e.target.value.replace(/[^\d]/g, "");

    if (v.length === 1 && parseInt(v[0]) > 3) v = "0" + v;
    if (v.length === 3 && parseInt(v[2]) > 1) v = v.slice(0, 2) + "0" + v[2];
    if (v.length === 7 && parseInt(v[6]) > 2) v = v.slice(0, 6) + "0" + v[6];
    if (v.length === 9 && parseInt(v[8]) > 5) v = v.slice(0, 8) + "0" + v[8];

    if (v.length > 10) v = v.slice(0, 10);

    if (v.length >= 2) {
      let dd = parseInt(v.slice(0, 2));
      if (dd > 31) v = "31" + v.slice(2);
      if (dd === 0 && v.length >= 2) v = "01" + v.slice(2);
    }
    if (v.length >= 4) {
      let mm = parseInt(v.slice(2, 4));
      if (mm > 12) v = v.slice(0, 2) + "12" + v.slice(4);
      if (mm === 0 && v.length >= 4) v = v.slice(0, 2) + "01" + v.slice(4);
    }
    if (v.length >= 6) {
      let yy = parseInt(v.slice(4, 6));
      const currentYear = parseInt(new Date().getFullYear().toString().slice(-2));
      if (yy > currentYear && v.slice(4, 6).length === 2) {
        v = v.slice(0, 4) + currentYear.toString().padStart(2, '0') + v.slice(6);
      }
    }
    if (v.length >= 8) {
      let hh = parseInt(v.slice(6, 8));
      if (hh > 23) v = v.slice(0, 6) + "23" + v.slice(8);
    }
    if (v.length >= 10) {
      let mins = parseInt(v.slice(8, 10));
      if (mins > 59) v = v.slice(0, 8) + "59";
    }

    let out = "";
    if (v.length > 0) out += v.slice(0, 2);
    if (v.length >= 2) out += "/" + v.slice(2, 4);
    if (v.length >= 4) out += "/" + v.slice(4, 6);
    if (v.length >= 6) out += " " + v.slice(6, 8);
    if (v.length >= 8) out += ":" + v.slice(8, 10);
    onChange(out);
  };
  return <input style={style} value={value} onChange={handleChange} placeholder="DD/MM/YY HH:MM" maxLength={14} />;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ data, width = 90, height = 40, color = "#3b82f6", type = "line" }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;

  if (type === "bar") {
    const max = Math.max(...data.map(Math.abs), 1);
    const count = data.length;
    const barWidth = Math.max(2, (width - (count - 1) * 2) / count);

    return (
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        {data.map((val, i) => {
          const barHeight = (Math.abs(val) / max) * (height / 2);
          const x = i * (barWidth + 2);
          const y = val >= 0 ? (height / 2) - barHeight : (height / 2);
          const barColor = val >= 0 ? T.green : T.red;
          return (
            <rect key={i} x={x} y={y} width={barWidth} height={Math.max(1, barHeight)} fill={barColor} rx={1} />
          );
        })}
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={T.border} strokeWidth={1} />
      </svg>
    );
  }

  // Line chart sparkline
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" L ");

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <path d={`M ${points}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── WinLossRatioBar ──────────────────────────────────────────────────────────
export function WinLossRatioBar({ win, loss, height = 8, width = 70 }) {
  const total = win + loss || 1;
  const winPct = (win / total) * 100;
  const lossPct = (loss / total) * 100;
  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 4, fontFamily: T.mono, fontSize: 10, color: T.dim, textAlign: "center", alignSelf: "center" }}>
      <div style={{ display: "flex", height, borderRadius: height / 2, overflow: "hidden", background: T.border2 }}>
        <div style={{ width: `${winPct}%`, background: T.green }} />
        <div style={{ width: `${lossPct}%`, background: T.red }} />
      </div>
      <div style={{ fontSize: 9 }}>W:L ({(loss ? win / loss : 0).toFixed(1)}:1)</div>
    </div>
  );
}

