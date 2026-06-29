import { useState, useEffect, useMemo } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { fmtPnl } from "../../utils/helpers.js";
import { CLOSE_REASONS, MISTAKES } from "../../utils/constants.js";
import { calculatePnL } from "../../utils/calculations.js";

export default function CloseLiveTradeModal({ trade, currentPrice, onClose: onModalClose, onConfirm }) {
  const { T } = useDashboard();
  const [exitPrice, setExitPrice] = useState(currentPrice ? currentPrice.toFixed(4) : "");
  const [closeReason, setCloseReason] = useState("Target Hit");
  const [mistake, setMistake] = useState("None");
  const [chartUrl, setChartUrl] = useState("");
  const [fees, setFees] = useState("");
  const [fundingFees, setFundingFees] = useState("");
  const [closeQty, setCloseQty] = useState(trade?.qty ? trade.qty.toString() : "");

  // Auto-calculate exit fee
  useEffect(() => {
    const x = parseFloat(exitPrice);
    if (!isNaN(x) && x > 0 && trade?.qty > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFees((x * trade.qty * 0.0006).toFixed(4));
    }
  }, [exitPrice, trade]);

  const exit = parseFloat(exitPrice);
  const qtyToClose = parseFloat(closeQty) || trade?.qty || 0;
  
  const pnl = useMemo(() => {
    if (isNaN(exit) || !trade) return null;
    const isSpot = trade.tradeType === "Spot";
    const side = isSpot ? "Long" : trade.side;
    const action = isSpot ? "Buy" : trade.side;
    const { nativePnl } = calculatePnL({
      entry: trade.entry,
      exit,
      qty: qtyToClose,
      side,
      leverage: trade.leverage || 1,
      tradeType: trade.tradeType,
      marginType: trade.marginType,
      action
    });
    return nativePnl;
  }, [exit, qtyToClose, trade]);

  const IS = { background: "#080d14", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 14, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box" };
  const LS = { fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5, marginTop: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onModalClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.red}30`, borderRadius: 14, padding: "clamp(16px, 5vw, 26px)", width: "min(420px,95vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 30px 80px #00000070" }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={LS}>Exit Price (USDT)</label>
            <input style={IS} type="number" inputMode="decimal" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label style={LS}>Close Qty</label>
            <div style={{ position: "relative" }}>
              <input style={IS} type="number" inputMode="decimal" value={closeQty} onChange={e => setCloseQty(e.target.value)} placeholder={trade?.qty} />
              <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: T.dim }}>
                / {trade?.qty}
              </div>
            </div>
          </div>
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
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={LS}>Trading Fees (USDT)</label>
            <input style={IS} type="number" inputMode="decimal" value={fees} onChange={e => setFees(e.target.value)} placeholder="0.00" />
          </div>
          {trade?.tradeType === "Futures" && (
            <div style={{ flex: 1 }}>
              <label style={LS}>Funding Fees (USDT)</label>
              <input style={IS} type="number" inputMode="decimal" value={fundingFees} onChange={e => setFundingFees(e.target.value)} placeholder="0.00" />
            </div>
          )}
        </div>

        {pnl !== null && (
          <div style={{ background: pnl >= 0 ? T.greenDim : T.redDim, border: `1px solid ${pnl >= 0 ? T.green : T.red}40`, borderRadius: 8, padding: "12px 16px", marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: T.dim, fontFamily: T.mono }}>ESTIMATED PnL</span>
            <span style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color: pnl >= 0 ? T.green : T.red }}>{fmtPnl(pnl)}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onModalClose} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontFamily: T.mono }}>Cancel</button>
          <button onClick={() => onConfirm({ exit: parseFloat(exitPrice), closeReason, fees: -(Math.abs(parseFloat(fees) || 0)), fundingFees: Math.abs(parseFloat(fundingFees) || 0), closeQty: parseFloat(closeQty) || trade?.qty })}
            style={{ background: T.redDim, border: `1px solid ${T.red}50`, color: T.red, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>{parseFloat(closeQty) < trade?.qty ? "Partial Close" : "Close Trade"}</button>
        </div>
      </div>
    </div>
  );
}
