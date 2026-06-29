import { useState } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { getQuoteCurrency, fmt$, parseMaskedDate } from "../../utils/helpers.js";
import { CLOSE_REASONS } from "../../utils/constants.js";
import { MaskedDateInput } from "../shared/index.jsx";

export default function SellSpotModal({ trade, currentPrice, prices, onClose, onConfirm }) {
  const { showToast, T } = useDashboard();
  const [sellPrice, setSellPrice] = useState(currentPrice ? currentPrice.toFixed(4) : trade.entry.toFixed(4));
  const [sellTime, setSellTime] = useState("");
  const [fees, setFees] = useState("");
  const [reason, setReason] = useState("Target Hit");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const exit = parseFloat(sellPrice);
  const qc = getQuoteCurrency(trade.symbol) || "USDT";
  const liveUsdtRate = qc === "USDT" ? 1 : (prices && prices[`${qc}USDT`] ? prices[`${qc}USDT`].price : (trade.usdtRate || 1));
  const investedUsdt = trade.entry * trade.qty * (trade.usdtRate || 1);
  const currentUsdt = exit * trade.qty * liveUsdtRate;
  const pnl = !isNaN(exit) ? (currentUsdt - investedUsdt) : null;
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
