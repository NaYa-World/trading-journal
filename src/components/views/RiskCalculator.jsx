import { useState } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { Card } from "../shared/index.jsx";

export default function RiskCalculator() {
  const { initialCapital, T } = useDashboard();
  const [capital, setCapital] = useState(initialCapital || "");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [leverage, setLeverage] = useState("1");

  const cap = parseFloat(capital), rp = parseFloat(riskPct) / 100;
  const en = parseFloat(entry), sl = parseFloat(stopLoss), lev = parseFloat(leverage) || 1;
  const riskAmt = cap && rp ? cap * rp : null;
  const stopDist = en && sl ? Math.abs(en - sl) : null;
  const stopDistPct = en && sl ? (Math.abs(en - sl) / en) * 100 : null;
  const positionSize = riskAmt && stopDist && en ? riskAmt / stopDist : null;
  const positionValue = positionSize ? positionSize * en : null;
  const capitalRequired = positionValue ? positionValue / lev : null;

  const IS = { background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, padding: "9px 12px", fontSize: 14, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box" };
  const LS = { fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.bright, marginBottom: 14 }}>Inputs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={LS}>Account Capital (USDT)</label><input style={IS} type="number" value={capital} onChange={e => setCapital(e.target.value)} placeholder="e.g. 10000" /></div>
            <div>
              <label style={LS}>Risk Per Trade: {riskPct}%</label>
              <input type="range" min="0.1" max="5" step="0.1" value={riskPct} onChange={e => setRiskPct(e.target.value)} style={{ width: "100%", accentColor: T.blue, marginTop: 6 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.dim, fontFamily: T.mono }}><span>0.1%</span><span>5%</span></div>
            </div>
            <div><label style={LS}>Entry Price (USDT)</label><input style={IS} type="number" value={entry} onChange={e => setEntry(e.target.value)} placeholder="0.00" /></div>
            <div><label style={LS}>Stop Loss Price (USDT)</label><input style={IS} type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="0.00" /></div>
            <div>
              <label style={LS}>Leverage: {leverage}×</label>
              <input type="range" min="1" max="50" step="1" value={leverage} onChange={e => setLeverage(e.target.value)} style={{ width: "100%", accentColor: T.orange, marginTop: 6 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.dim, fontFamily: T.mono }}><span>1×</span><span>50×</span></div>
            </div>
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Card>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.bright, marginBottom: 12 }}>Position Size</div>
            <div style={{ fontFamily: T.mono, fontSize: 34, fontWeight: 700, color: positionSize ? T.cyan : T.dim }}>{positionSize ? positionSize.toFixed(4) : "—"}</div>
            <div style={{ fontSize: 14, color: T.dim, marginTop: 6, fontWeight: 600 }}>units to buy/sell</div>
          </Card>
          {[
            { label: "Risk Amount", val: riskAmt ? `USDT ${riskAmt.toFixed(2)}` : "—", color: T.red },
            { label: "Position Value", val: positionValue ? `USDT ${positionValue.toFixed(2)}` : "—", color: T.blue },
            { label: "Capital Required", val: capitalRequired ? `USDT ${capitalRequired.toFixed(2)}` : "—", color: T.orange },
            { label: "Stop Distance", val: stopDistPct ? `${stopDistPct.toFixed(2)}%` : "—", color: T.yellow },
          ].map((item, i) => (
            <div key={i} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 15, color: T.text, fontWeight: 600 }}>{item.label}</span>
              <span style={{ fontFamily: T.mono, fontSize: 17, fontWeight: 700, color: item.val === "—" ? T.dim : item.color }}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>
      {capitalRequired && cap && capitalRequired > cap && (
        <div style={{ background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8, padding: "10px 14px", fontSize: 14, color: T.red, fontFamily: T.mono }}>⚠ Capital required exceeds account balance. Reduce size or increase leverage.</div>
      )}
      {parseFloat(riskPct) > 2 && (
        <div style={{ background: "#f9731618", border: `1px solid ${T.orange}40`, borderRadius: 8, padding: "10px 14px", fontSize: 14, color: T.orange }}>⚠ Risking more than 2% per trade is aggressive. Most professional traders risk 0.5–1%.</div>
      )}
    </div>
  );
}
