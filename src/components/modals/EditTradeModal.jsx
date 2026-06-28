import { useState, useEffect } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { MaskedDateInput } from "../shared/index.jsx";
import {
  formatMaskedDate, parseMaskedDate, getQuoteCurrency, fetchUsdtRate
} from "../../utils/helpers.js";
import { calculatePnL } from "../../utils/calculations.js";
import { SETUPS, CLOSE_REASONS } from "../../utils/constants.js";

export default function EditTradeModal() {
  const { editingTrade, setEditingTrade, handleEditTrade, deleteFinishedTrade, T } = useDashboard();
  const trade = editingTrade;
  const onClose = () => setEditingTrade(null);
  const onSave = handleEditTrade;
  const onDelete = deleteFinishedTrade;

  if (!trade) return null;

  const isTransaction = trade.entryType === "Deposit" || trade.entryType === "Withdrawal" || trade.symbol === "Deposit" || trade.symbol === "Withdrawal";
  const isOpen = (trade.tradeType === "Spot" && !trade.exit) || trade.status === "open";

  const [form, setForm] = useState({
    entry: (trade.entry || 0).toString(),
    exit: (trade.exit || 0).toString(),
    qty: (trade.qty || 0).toString(),
    fees: Math.abs(trade.fees || 0).toString(),
    fundingFees: Math.abs(trade.fundingFees || 0).toString(),
    marginType: trade.marginType || "USDT-M",
    setup: trade.setup || "BREAKOUT",
    closeReason: trade.closeReason || "",
    openTime: formatMaskedDate(new Date(trade.openTime)),
    closeTime: formatMaskedDate(new Date(trade.closeTime || trade.openTime)),
    notes: trade.notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dateCappedMsg, setDateCappedMsg] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (isTransaction) return;
    const e = parseFloat(form.entry), q = parseFloat(form.qty), x = parseFloat(form.exit);
    if (!isNaN(e) && !isNaN(q) && e > 0 && q > 0) {
      let f = e * q * 0.0006;
      if (!isNaN(x) && x > 0) f += x * q * 0.0006;
      setForm(prev => ({ ...prev, fees: f.toFixed(4) }));
    }
  }, [form.entry, form.exit, form.qty, isTransaction]);

  const qc = getQuoteCurrency(trade.symbol || "USDT") || "USDT";

  const handle = async () => {
    if (isTransaction) {
      const amt = parseFloat(form.qty);
      if (isNaN(amt) || amt <= 0) return;

      setLoading(true);
      try {
        let tTime = parseMaskedDate(form.openTime);
        if (tTime > Date.now()) {
          tTime = Date.now();
        }

        onSave({
          ...trade,
          qty: amt,
          pnl: trade.entryType === "Deposit" || trade.symbol === "Deposit" ? amt : -amt,
          openTime: tTime,
          closeTime: tTime,
          notes: form.notes
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    const e = parseFloat(form.entry), x = parseFloat(form.exit), q = parseFloat(form.qty);
    if (isNaN(e) || e <= 0 || isNaN(q) || q <= 0) return;
    if (!isOpen && (isNaN(x) || x <= 0)) return;

    setLoading(true);
    try {
      let openT = parseMaskedDate(form.openTime);
      let closeT = parseMaskedDate(form.closeTime);

      let capped = false;
      if (openT > Date.now()) { openT = Date.now(); capped = true; }
      if (closeT > Date.now()) { closeT = Date.now(); capped = true; }
      if (!isOpen && closeT < openT) { closeT = openT; capped = true; }

      if (capped) {
        setDateCappedMsg("Dates were out of range — auto-corrected.");
      }

      const usdtPromises = [fetchUsdtRate(qc, openT, form.exchange)];
      if (!isOpen) usdtPromises.push(fetchUsdtRate(qc, closeT, form.exchange));
      
      const [usdtRate, closeUsdtRate] = await Promise.all(usdtPromises);

      const isSpot = trade.tradeType === "Spot";
      const isLong = trade.side === "Long" || trade.action === "Buy";
      const side = isLong ? "Long" : "Short";
      const action = isSpot ? (isLong ? "Buy" : "Sell") : side;

      let nativePnl = 0, pnl = 0;
      if (!isOpen) {
        const res = calculatePnL({
          entry: e,
          exit: x,
          qty: q,
          side,
          leverage: trade.leverage || 1,
          tradeType: trade.tradeType,
          marginType: form.marginType,
          quoteRateOpen: usdtRate,
          quoteRateClose: closeUsdtRate,
          action
        });
        nativePnl = res.nativePnl;
        pnl = res.pnl;
      }

      onSave({
        ...trade,
        entry: e, qty: q,
        fees: -(Math.abs(parseFloat(form.fees) || 0)),
        fundingFees: Math.abs(parseFloat(form.fundingFees) || 0),
        marginType: form.marginType,
        usdtRate,
        setup: form.setup,
        openTime: openT,
        notes: form.notes,
        ...(isOpen ? {} : { 
          exit: x, 
          nativePnl: parseFloat(nativePnl.toFixed(6)), 
          pnl: parseFloat(pnl.toFixed(2)), 
          closeUsdtRate, 
          closeReason: form.closeReason, 
          closeTime: closeT 
        })
      });
    } finally {
      setLoading(false);
    }
  };

  const IS = { background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 12, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box", transition: "border 0.2s" };
  const LS = { fontSize: 9, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5, marginTop: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 14, padding: 26, width: "min(440px,95vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 30px 80px #00000070" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright }}>
            {isTransaction ? `✏️ Edit ${trade.entryType || trade.symbol}` : `✏️ Edit Trade — ${trade.symbol}`}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>

        {dateCappedMsg && (
          <div style={{ background: T.blueDim, border: `1px solid ${T.blue}40`, borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: T.blue, fontFamily: T.mono, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>ℹ {dateCappedMsg}</span>
            <button onClick={() => setDateCappedMsg("")} style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        )}

        {isTransaction ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            <div><label style={LS}>Amount (USDT)</label><input style={IS} type="number" value={form.qty} onChange={e => set("qty", e.target.value)} /></div>
            <div><label style={LS}>Date & Time</label><MaskedDateInput style={IS} value={form.openTime} onChange={v => set("openTime", v)} /></div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={LS}>Entry Price ({qc})</label><input style={IS} type="number" value={form.entry} onChange={e => set("entry", e.target.value)} /></div>
            {!isOpen && <div><label style={LS}>Exit Price ({qc})</label><input style={IS} type="number" value={form.exit} onChange={e => set("exit", e.target.value)} /></div>}
            <div><label style={LS}>Quantity</label><input style={IS} type="number" value={form.qty} onChange={e => set("qty", e.target.value)} /></div>
            <div><label style={LS}>Trading Fees ({qc})</label><input style={IS} type="number" value={form.fees} onChange={e => set("fees", e.target.value)} /></div>
            {trade.tradeType === "Futures" && (
              <>
                <div><label style={LS}>Funding Fees ({qc})</label><input style={IS} type="number" value={form.fundingFees} onChange={e => set("fundingFees", e.target.value)} /></div>
                <div>
                  <label style={LS}>Margin Type</label>
                  <select style={IS} value={form.marginType} onChange={e => set("marginType", e.target.value)}>
                    <option value="USDT-M">USDT-M</option>
                    <option value="COIN-M">COIN-M</option>
                  </select>
                </div>
              </>
            )}
            <div><label style={LS}>Setup</label><select style={IS} value={form.setup} onChange={e => set("setup", e.target.value)}>{SETUPS.map(s => <option key={s}>{s}</option>)}</select></div>
            {!isOpen && <div><label style={LS}>Close Reason</label><select style={IS} value={form.closeReason} onChange={e => set("closeReason", e.target.value)}>{CLOSE_REASONS.map(r => <option key={r}>{r}</option>)}</select></div>}
            <div><label style={LS}>Open Time</label><MaskedDateInput style={IS} value={form.openTime} onChange={v => set("openTime", v)} /></div>
            {!isOpen && <div><label style={LS}>Close Time</label><MaskedDateInput style={IS} value={form.closeTime} onChange={v => set("closeTime", v)} /></div>}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <label style={LS}>Notes</label>
          <textarea style={{ ...IS, resize: "vertical", minHeight: 56, marginBottom: 0 }} value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          {confirmDelete ? (
            <button onClick={() => { onDelete(trade.id); onClose(); }}
              style={{ background: T.red, border: `1px solid ${T.red}`, color: "#000", borderRadius: 7, padding: "9px 16px", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>
              Confirm Delete?
            </button>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              style={{ background: T.redDim, border: `1px solid ${T.red}50`, color: T.red, borderRadius: 7, padding: "9px 16px", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>
              Delete {isTransaction ? "Transaction 🗑️" : "Trade 🗑️"} (Z to undo)
            </button>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 11, fontFamily: T.mono }} disabled={loading}>Cancel</button>
            <button onClick={handle} style={{ background: T.blueDim, border: `1px solid ${T.blue}50`, color: T.blue, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
