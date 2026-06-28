import { useState } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { DEFAULT_SYMBOLS, SIDES, EXCHANGES } from "../../utils/constants.js";
import { getQuoteCurrency, fetchUsdtRate, parseMaskedDate } from "../../utils/helpers.js";
import { CoinIcon, MaskedDateInput } from "../shared/index.jsx";
import { createTrade } from "../../utils/tradeFactory.js";

export default function AddLiveTradeModal({ onAdd, onClose, savedSymbols, initialSymbol }) {
  const { showToast, T } = useDashboard();
  const [form, setForm] = useState({
    exchange: "Binance", tradeType: "Futures", marginType: "USDT-M", symbol: initialSymbol || "", side: "Long",
    entry: "", qty: "", leverage: "1", stopLoss: "", takeProfit: "",
    openTime: "", notes: "",
  });
  const [symbolInput, setSymbolInput] = useState(initialSymbol || "");
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const cryptoSymbols = Array.isArray(savedSymbols) ? savedSymbols : DEFAULT_SYMBOLS;
  const filtered = symbolInput
    ? cryptoSymbols.filter(s => s.toLowerCase().includes(symbolInput.toLowerCase()))
    : cryptoSymbols;
  const qc = getQuoteCurrency(form.symbol) || "USDT";

  const handle = async () => {
    const e = parseFloat(form.entry), q = parseFloat(form.qty);
    if (!form.symbol.trim() || isNaN(e) || isNaN(q)) return;

    setLoading(true);
    try {
      const sym = form.symbol.trim().toUpperCase();
      let openT = parseMaskedDate(form.openTime);
      if (openT > Date.now()) {
        openT = Date.now();
        showToast("Entry time was in the future. It has been automatically set to the current time.", "warning");
      }

      const quoteCurrency = getQuoteCurrency(sym);
      const usdtRate = await fetchUsdtRate(quoteCurrency, openT);

      onAdd(createTrade({
        ...form,
        symbol: sym,
        entry: e, qty: q,
        leverage: parseFloat(form.leverage) || 1,
        marginType: form.marginType,
        stopLoss: form.stopLoss,
        takeProfit: form.takeProfit,
        openTime: openT,
        status: "live",
        quoteCurrency,
        usdtRate,
      }));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const IS = { background: "#080d14", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 14, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box" };
  const LS = { fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5, marginTop: 12 };

  const showLeverage = form.tradeType === "Futures" || form.tradeType === "Margin";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.cyan}30`, borderRadius: 14, padding: 26, width: "min(560px,95vw)", maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}`, animation: "pulse 1.5s infinite" }} />
            <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright, letterSpacing: 1.5 }}>OPEN LIVE TRADE</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>

        {/* Exchange + Type row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
          <div>
            <label style={LS}>Exchange</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {EXCHANGES.map(ex => (
                <button key={ex} onClick={() => set("exchange", ex)} style={{ flex: 1, background: form.exchange === ex ? T.blueDim : T.panel2, border: `1px solid ${form.exchange === ex ? T.blue + "60" : T.border}`, color: form.exchange === ex ? T.blue : T.dim, borderRadius: 6, padding: "7px 0", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>{ex}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={LS}>Trade Type</label>
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {["Margin", "Futures"].map(tt => (
                <button key={tt} onClick={() => set("tradeType", tt)} style={{ flex: 1, minWidth: 60, background: form.tradeType === tt ? T.blueDim : T.panel2, border: `1px solid ${form.tradeType === tt ? T.blue + "60" : T.border}`, color: form.tradeType === tt ? T.blue : T.dim, borderRadius: 6, padding: "7px 4px", cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>{tt}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Symbol autocomplete */}
          <div style={{ position: "relative" }}>
            <label style={LS}>Symbol</label>
            <input style={IS} value={symbolInput}
              onChange={e => { setSymbolInput(e.target.value.toUpperCase()); set("symbol", e.target.value.toUpperCase()); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="e.g. BTCUSDT" autoComplete="off" />
            {showDrop && filtered.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.panel2, border: `1px solid ${T.border2}`, borderRadius: 6, zIndex: 10, maxHeight: 130, overflowY: "auto", WebkitOverflowScrolling: "touch", marginTop: 2, boxShadow: "0 8px 32px #00000050" }}>
                {filtered.map(s => (
                  <div key={s} onMouseDown={() => { set("symbol", s); setSymbolInput(s); setShowDrop(false); }}
                    style={{ padding: "7px 10px", fontSize: 11, fontFamily: T.mono, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = T.border}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <CoinIcon symbol={s} size={16} />
                    <span style={{ flex: 1 }}>{s}</span>
                    <span style={{ color: T.dim, fontSize: 11 }}>{getQuoteCurrency(s)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={LS}>Side</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {SIDES.map(s => (
                <button key={s} onClick={() => set("side", s)} style={{ flex: 1, background: form.side === s ? (s === "Long" ? T.greenDim : T.redDim) : T.panel2, border: `1px solid ${form.side === s ? (s === "Long" ? T.green : T.red) + "60" : T.border}`, color: form.side === s ? (s === "Long" ? T.green : T.red) : T.dim, borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>{s}</button>
              ))}
            </div>
          </div>
          
          {showLeverage && (
            <div style={{ gridColumn: "1/-1" }}>
              <label style={LS}>Margin Type</label>
              <div style={{ display: "flex", background: T.panel2, borderRadius: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
                <div onClick={() => set("marginType", "USDT-M")} style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: 13, cursor: "pointer", fontFamily: T.mono, fontWeight: 700, background: form.marginType === "USDT-M" ? T.blueDim : "transparent", color: form.marginType === "USDT-M" ? T.blue : T.dim }}>USDT-M</div>
                <div onClick={() => set("marginType", "COIN-M")} style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: 13, cursor: "pointer", fontFamily: T.mono, fontWeight: 700, background: form.marginType === "COIN-M" ? T.orangeDim : "transparent", color: form.marginType === "COIN-M" ? T.orange : T.dim }}>COIN-M</div>
              </div>
            </div>
          )}

          <div><label style={LS}>Entry Price ({qc})</label><input style={IS} type="number" inputMode="decimal" value={form.entry} onChange={e => set("entry", e.target.value)} placeholder="0.00" /></div>
          <div><label style={LS}>Quantity</label><input style={IS} type="number" inputMode="decimal" value={form.qty} onChange={e => set("qty", e.target.value)} placeholder="0.00" /></div>

          {showLeverage && (
            <div><label style={LS}>Leverage</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input style={{ ...IS, width: 80, flexShrink: 0 }} type="number" inputMode="decimal" value={form.leverage} onChange={e => set("leverage", e.target.value)} min="1" max="125" />
                <span style={{ fontFamily: T.mono, fontSize: 16, color: T.orange, fontWeight: 700 }}>{form.leverage}×</span>
              </div>
            </div>
          )}

          <div><label style={LS}>Stop Loss ({qc})</label><input style={IS} type="number" inputMode="decimal" value={form.stopLoss} onChange={e => set("stopLoss", e.target.value)} placeholder="Optional" /></div>
          <div><label style={LS}>Take Profit ({qc})</label><input style={IS} type="number" inputMode="decimal" value={form.takeProfit} onChange={e => set("takeProfit", e.target.value)} placeholder="Optional" /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={LS}>Open Time</label><MaskedDateInput style={IS} value={form.openTime} onChange={v => set("openTime", v)} /></div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={LS}>Notes</label>
          <textarea style={{ ...IS, resize: "vertical", minHeight: 52 }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Setup reason, entry thesis..." />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontFamily: T.mono }} disabled={loading}>Cancel</button>
          <button onClick={handle} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }} disabled={loading}>
            {loading ? "Looking up rate..." : "Open Trade ↗"}
          </button>
        </div>
      </div>
    </div>
  );
}
