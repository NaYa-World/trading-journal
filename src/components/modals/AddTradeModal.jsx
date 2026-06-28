import { useState, useEffect, useMemo } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { CoinIcon, MaskedDateInput } from "../shared/index.jsx";
import RiskCalculator from "../views/RiskCalculator.jsx";
import {
  getQuoteCurrency, getOrdinal, parseMaskedDate, fetchUsdtRate
} from "../../utils/helpers.js";
import { T } from "../../utils/theme.js";
import { createTrade } from "../../utils/tradeFactory.js";
import { calculatePnL } from "../../utils/calculations.js";
import {
  CRYPTO_TRADE_TYPES, DEFAULT_SYMBOLS, EXCHANGES, SETUPS, CLOSE_REASONS
} from "../../utils/constants.js";

export default function AddTradeModal() {
  const {
    addTrade, addSpotOpen, setShowAddModal, savedSymbols, saveSymbol,
    activeProfileId, initialCapital, allTrades
  } = useDashboard();

  const onAdd = addTrade;
  const onAddSpotOpen = addSpotOpen;
  const onClose = () => setShowAddModal(false);
  const onSaveSymbol = saveSymbol;
  const profileId = activeProfileId;

  const [entryType, setEntryType] = useState("Trade"); // "Trade" | "Deposit" | "Withdrawal"
  const [tradeType, setTradeType] = useState("Spot");
  const [spotMode, setSpotMode] = useState("open"); // "open" | "closed" — spot only
  const [form, setForm] = useState({
    symbol: "", action: "Buy", side: "Long",
    exchange: "Binance", marginType: "USDT-M",
    entry: "", exit: "", qty: "", fees: "", fundingFees: "",
    stopLoss: "",
    setup: "BREAKOUT", closeReason: "Target Hit",
    openTime: "",
    closeTime: "",
    notes: "",
  });
  const [symbolInput, setSymbolInput] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [depositWarning, setDepositWarning] = useState(""); // inline warning instead of alert()
  const [dateCappedMsg, setDateCappedMsg] = useState("");

  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setDepositWarning(""); };

  const isSpot = tradeType === "Spot";
  const isSpotOpen = isSpot && spotMode === "open";
  const isDirectional = tradeType === "Margin" || tradeType === "Futures";
  const qc = getQuoteCurrency(form.symbol) || "USDT";

  const saved = savedSymbols || DEFAULT_SYMBOLS;
  const filtered = symbolInput
    ? saved.filter(s => s.toLowerCase().includes(symbolInput.toLowerCase()))
    : saved;

  const selectSymbol = (s) => { set("symbol", s); setSymbolInput(s); setShowDrop(false); };

  useEffect(() => {
    const calculateEstimatedFees = () => {
      const e = parseFloat(form.entry), q = parseFloat(form.qty);
      if (isNaN(e) || isNaN(q)) return;
      const rate = form.tradeType === "Spot" ? 0.001 : 0.0004;
      const f = (e * q * rate) * (form.tradeType === "Spot" ? 1 : 2);
      setForm(prev => ({ ...prev, fees: f.toFixed(4) }));
    };
    calculateEstimatedFees();
  }, [form.entry, form.exit, form.qty, isSpotOpen, tradeType]);

  // ── Live RR & PnL Preview ─────────────────────────────────────────────────
  const rrPreview = useMemo(() => {
    const e = parseFloat(form.entry);
    const x = parseFloat(form.exit);
    const sl = parseFloat(form.stopLoss);
    const q = parseFloat(form.qty);
    const isLong = isSpot ? form.action === "Buy" : form.side === "Long";
    if (!isNaN(e) && !isNaN(x) && e > 0 && x > 0) {
      const priceDiff = isLong ? (x - e) : (e - x);
      const pct = (priceDiff / e) * 100;
      const estPnl = !isNaN(q) && q > 0 ? priceDiff * q : null;
      const rr = !isNaN(sl) && sl > 0
        ? Math.abs(priceDiff) / Math.abs(e - sl)
        : null;
      return { pct, estPnl, rr, isWin: priceDiff > 0 };
    }
    return null;
  }, [form.entry, form.exit, form.stopLoss, form.qty, form.action, form.side]);

  const handle = async () => {
    if (entryType === "Trade") {
      const profileTrades = allTrades.filter(t => (t.profileId || "default") === (profileId || "default"));
      const deposits = profileTrades.filter(t => t.entryType === "Deposit" || t.symbol === "Deposit");
      if (deposits.length === 0) {
        setDepositWarning("no_deposit");
        return;
      }

      const withdrawals = profileTrades.filter(t => t.entryType === "Withdrawal" || t.symbol === "Withdrawal");
      const closedTrades = profileTrades.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
      
      const totalDepositsQty = deposits.reduce((s, d) => s + d.qty, 0);
      const totalWithdrawalsQty = withdrawals.reduce((s, w) => s + w.qty, 0);
      const netTradesPnl = closedTrades.reduce((s, tr) => s + tr.pnl + (tr.fees || 0), 0);
      const currentBalance = totalDepositsQty - totalWithdrawalsQty + netTradesPnl;

      if (currentBalance <= 0) {
        setDepositWarning("zero_balance");
        return;
      }
    }

    if (entryType === "Deposit" || entryType === "Withdrawal") {
      const amt = parseFloat(form.qty);
      if (isNaN(amt) || amt <= 0) return;

      setLoading(true);
      try {
        let tTime = parseMaskedDate(form.openTime);
        if (tTime > Date.now()) {
          tTime = Date.now();
        }

        // Count existing deposits/withdrawals of this profile to determine the next ordinal remark
        const existingTrans = allTrades.filter(t => (t.profileId || "default") === (profileId || "default"));
        const count = existingTrans.filter(t => t.entryType === entryType || t.symbol === entryType).length;
        const ordinal = getOrdinal(count + 1);
        const remark = `${ordinal} ${entryType.toLowerCase()}`;

        onAdd(createTrade({
          id: Date.now(),
          entryType,
          symbol: entryType,
          tradeType: entryType,
          qty: amt,
          pnl: entryType === "Deposit" ? amt : -amt,
          fees: 0,
          openTime: tTime,
          closeTime: tTime,
          status: "closed",
          notes: form.notes,
          closeReason: remark,
          profileId: profileId || "default",
        }));
        onClose();
      } finally {
        setLoading(false);
      }
      return;
    }

    const e = parseFloat(form.entry), q = parseFloat(form.qty);
    if (!form.symbol.trim() || isNaN(e) || e <= 0 || isNaN(q) || q <= 0) return;
    if (!isSpotOpen) {
      const x = parseFloat(form.exit);
      if (isNaN(x) || x <= 0) return;
    }

    setLoading(true);
    try {
      const sym = form.symbol.trim().toUpperCase();
      if (!saved.includes(sym)) onSaveSymbol(sym);

      let openT = parseMaskedDate(form.openTime);
      let closeT = parseMaskedDate(form.closeTime);

      let capped = false;
      if (openT > Date.now()) { openT = Date.now(); capped = true; }
      if (!isSpotOpen && closeT > Date.now()) { closeT = Date.now(); capped = true; }
      if (!isSpotOpen && closeT < openT) { closeT = openT; capped = true; }

      if (capped) {
        setDateCappedMsg("One or more dates were in the future or out of order — automatically corrected.");
      }

      const quoteCurrency = getQuoteCurrency(sym);
      const [usdtRate, closeUsdtRate] = await Promise.all([
        fetchUsdtRate(quoteCurrency, openT, form.exchange),
        !isSpotOpen ? fetchUsdtRate(quoteCurrency, closeT, form.exchange) : Promise.resolve(1)
      ]);

      if (isSpotOpen) {
        onAddSpotOpen(createTrade({
          id: Date.now(), symbol: sym, tradeType: "Spot",
          exchange: form.exchange, action: "Buy",
          entry: e, qty: q,
          fees: -(Math.abs(parseFloat(form.fees) || 0)),
          setup: form.setup,
          openTime: openT,
          notes: form.notes, status: "spot_open",
          profileId: profileId || "default",
          quoteCurrency,
          usdtRate,
        }));
      } else {
        const x = parseFloat(form.exit);
        const side = isSpot ? (form.action === "Buy" ? "Long" : "Short") : form.side;
        const action = isSpot ? form.action : form.side;

        const { nativePnl, pnl } = calculatePnL({
          entry: e,
          exit: x,
          qty: q,
          side,
          leverage: 1, // AddTradeModal defaults to 1 for realized trades
          tradeType,
          marginType: form.marginType,
          quoteRateOpen: usdtRate,
          quoteRateClose: closeUsdtRate,
          action
        });

        onAdd(createTrade({
          id: Date.now(), symbol: sym,
          tradeType, exchange: form.exchange,
          side,
          action,
          displayType: isSpot ? `Spot ${form.action}` : `${tradeType} ${form.side}`,
          entry: e, exit: x, qty: q,
          fees: -(Math.abs(parseFloat(form.fees) || 0)),
          fundingFees: Math.abs(parseFloat(form.fundingFees) || 0),
          nativePnl,
          pnl,
          marginType: form.marginType,
          setup: form.setup, closeReason: form.closeReason,
          openTime: openT,
          closeTime: closeT,
          notes: form.notes,
          status: "closed", tags: [form.setup],
          profileId: profileId || "default",
          quoteCurrency,
          usdtRate,
          closeUsdtRate
        }));
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const IS = { background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 12, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box" };
  const LS = { fontSize: 9, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5, marginTop: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 14, padding: 26, width: entryType === "Trade" ? "min(900px,95vw)" : "min(480px,95vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 30px 80px #00000070", transition: "width 0.3s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: T.mono, fontSize: 14, color: T.bright, letterSpacing: 1.5 }}>
            {entryType === "Trade" ? "ADD TRADE" : entryType === "Deposit" ? "LOG DEPOSIT" : "LOG WITHDRAWAL"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>Press <kbd style={{ background: T.border, borderRadius: 4, padding: "1px 6px", fontSize: 10, border: `1px solid ${T.border2}` }}>Esc</kbd> to close</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 20 }}>✕</button>
          </div>
        </div>

        {/* ── Inline Deposit Warning ── */}
        {depositWarning === "no_deposit" && (
          <div style={{ background: T.orangeDim, border: `1px solid ${T.orange}50`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: T.orange, fontFamily: T.mono }}>
            <span>⚠ No deposit found for this profile.</span>
            <button onClick={() => { setEntryType("Deposit"); setDepositWarning(""); }}
              style={{ background: T.orange + "25", border: `1px solid ${T.orange}50`, color: T.orange, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700, whiteSpace: "nowrap" }}>
              → Switch to Deposit
            </button>
          </div>
        )}
        {depositWarning === "zero_balance" && (
          <div style={{ background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: T.red, fontFamily: T.mono }}>
            ⚠ Account balance is zero or negative — please log a deposit first.
          </div>
        )}
        {dateCappedMsg && (
          <div style={{ background: T.blueDim, border: `1px solid ${T.blue}40`, borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: T.blue, fontFamily: T.mono, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>ℹ {dateCappedMsg}</span>
            <button onClick={() => setDateCappedMsg("")} style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexDirection: width < 768 ? "column" : "row" }}>
          {/* Left Column (Form Inputs) */}
          <div style={{ flex: 1.2, width: "100%" }}>
            <div style={{ marginBottom: 12 }}>
              <label style={LS}>Entry Type</label>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {["Trade", "Deposit", "Withdrawal"].map(type => (
                  <button key={type} onClick={() => {
                    setEntryType(type);
                    if (type === "Deposit" || type === "Withdrawal") {
                      set("symbol", type);
                    } else {
                      set("symbol", "");
                    }
                  }}
                    style={{ flex: 1, background: entryType === type ? T.blueDim : T.panel2, border: `1px solid ${entryType === type ? T.blue + "60" : T.border}`, color: entryType === type ? T.blue : T.dim, borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {entryType === "Trade" ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={LS}>Trade Type</label>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {CRYPTO_TRADE_TYPES.map(tt => (
                      <button key={tt} onClick={() => setTradeType(tt)}
                        style={{ flex: 1, background: tradeType === tt ? T.blueDim : T.panel2, border: `1px solid ${tradeType === tt ? T.blue + "60" : T.border}`, color: tradeType === tt ? T.blue : T.dim, borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>
                        {tt}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 6, fontFamily: T.mono, color: isSpot ? T.dim : T.orange }}>
                    {isSpot && "Spot: you own the asset. Buy low, sell high. Can hold for weeks."}
                    {tradeType === "Margin" && "⚠ Margin: borrowed funds. Long = price rises, Short = price falls."}
                    {tradeType === "Futures" && "⚠ Futures: contracts, no asset ownership. Long = rises, Short = falls."}
                  </div>
                </div>

                {isSpot && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={LS}>Trade Status</label>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      {[["open", "🟢 Just Bought (still holding)"], ["closed", "✅ Fully Closed (buy + sell done)"]].map(([val, label]) => (
                        <button key={val} onClick={() => setSpotMode(val)}
                          style={{ flex: 1, background: spotMode === val ? (val === "open" ? T.greenDim : T.blueDim) : T.panel2, border: `1px solid ${spotMode === val ? (val === "open" ? T.green : T.blue) + "50" : T.border}`, color: spotMode === val ? (val === "open" ? T.green : T.blue) : T.dim, borderRadius: 6, padding: "8px 6px", cursor: "pointer", fontSize: 10, fontFamily: T.mono, fontWeight: 700, textAlign: "center" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 4 }}>
                  <label style={LS}>Exchange</label>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {EXCHANGES.map(ex => (
                      <button key={ex} onClick={() => set("exchange", ex)}
                        style={{ flex: 1, background: form.exchange === ex ? T.blueDim : T.panel2, border: `1px solid ${form.exchange === ex ? T.blue + "60" : T.border}`, color: form.exchange === ex ? T.blue : T.dim, borderRadius: 6, padding: "7px 0", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Row 1: Symbol + Direction ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10, marginTop: 4 }}>
                  <div style={{ position: "relative" }}>
                    <label style={LS}>Symbol</label>
                    <input style={IS} value={symbolInput}
                      onChange={e => { setSymbolInput(e.target.value.toUpperCase()); set("symbol", e.target.value.toUpperCase()); setShowDrop(true); }}
                      onFocus={() => setShowDrop(true)}
                      onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                      placeholder="e.g. BTCUSDT" autoComplete="off" />
                    {showDrop && filtered.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.panel2, border: `1px solid ${T.border2}`, borderRadius: 6, zIndex: 10, maxHeight: 160, overflowY: "auto", marginTop: 2, boxShadow: "0 8px 32px #00000050" }}>
                        {filtered.map(s => (
                          <div key={s} onMouseDown={() => selectSymbol(s)}
                            style={{ padding: "7px 10px", fontSize: 11, fontFamily: T.mono, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                            onMouseEnter={e => e.currentTarget.style.background = T.border}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <CoinIcon symbol={s} size={16} />
                            <span style={{ flex: 1 }}>{s}</span>
                            <span style={{ color: T.dim, fontSize: 10 }}>{getQuoteCurrency(s)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={LS}>{isSpot ? "Action" : "Direction"}</label>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      {(isSpot ? ["Buy", "Sell"] : ["Long", "Short"]).map(s => {
                        const isPositive = s === "Buy" || s === "Long";
                        const active = isSpot ? form.action === s : form.side === s;
                        const disabled = isSpotOpen && s === "Sell";
                        return (
                          <button key={s} onClick={() => !disabled && (isSpot ? set("action", s) : set("side", s))}
                            style={{ flex: 1, opacity: disabled ? 0.3 : 1, cursor: disabled ? "not-allowed" : "pointer", background: active ? (isPositive ? T.greenDim : T.redDim) : T.panel2, border: `1px solid ${active ? (isPositive ? T.green : T.red) + "60" : T.border}`, color: active ? (isPositive ? T.green : T.red) : T.dim, borderRadius: 6, padding: "8px 0", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>{s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {tradeType === "Futures" && (
                    <div style={{ marginTop: 12 }}>
                      <label style={LS}>Margin Type</label>
                      <div style={{ display: "flex", background: T.panel2, borderRadius: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
                        <div onClick={() => set("marginType", "USDT-M")} style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: 13, cursor: "pointer", fontFamily: T.mono, fontWeight: 700, background: form.marginType === "USDT-M" ? T.blueDim : "transparent", color: form.marginType === "USDT-M" ? T.blue : T.dim }}>USDT-M</div>
                        <div onClick={() => set("marginType", "COIN-M")} style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: 13, cursor: "pointer", fontFamily: T.mono, fontWeight: 700, background: form.marginType === "COIN-M" ? T.orangeDim : "transparent", color: form.marginType === "COIN-M" ? T.orange : T.dim }}>COIN-M</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Row 2: Setup + Close Reason ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><label style={LS}>Setup</label><select style={IS} value={form.setup} onChange={e => set("setup", e.target.value)}>{SETUPS.map(s => <option key={s}>{s}</option>)}</select></div>
                  {!isSpotOpen && <div><label style={LS}>Close Reason</label><select style={IS} value={form.closeReason} onChange={e => set("closeReason", e.target.value)}>{CLOSE_REASONS.map(r => <option key={r}>{r}</option>)}</select></div>}
                </div>

                {/* ── Row 3: Times ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><label style={LS}>{isSpotOpen ? "Buy Time" : "Open Time"}</label><MaskedDateInput style={IS} value={form.openTime} onChange={v => set("openTime", v)} /></div>
                  {!isSpotOpen && <div><label style={LS}>Close Time</label><MaskedDateInput style={IS} value={form.closeTime} onChange={v => set("closeTime", v)} /></div>}
                </div>

                {/* ── Row 4: Entry / Exit / Qty / Stop Loss ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><label style={LS}>Buy Price ({qc})</label><input style={IS} type="number" value={form.entry} onChange={e => set("entry", e.target.value)} placeholder="0.00" /></div>
                  {!isSpotOpen && <div><label style={LS}>Sell Price ({qc})</label><input style={IS} type="number" value={form.exit} onChange={e => set("exit", e.target.value)} placeholder="0.00" /></div>}
                  <div><label style={LS}>Quantity (units)</label><input style={IS} type="number" value={form.qty} onChange={e => set("qty", e.target.value)} placeholder="0.00" /></div>
                  {!isSpotOpen && <div><label style={LS}>Stop Loss ({qc}) <span style={{ color: T.dim }}>(optional)</span></label><input style={IS} type="number" value={form.stopLoss} onChange={e => set("stopLoss", e.target.value)} placeholder="for RR calc" /></div>}
                </div>

                {/* ── RR + PnL Live Preview ── */}
                {rrPreview && (
                  <div style={{ background: rrPreview.isWin ? T.greenDim : T.redDim, border: `1px solid ${rrPreview.isWin ? T.green : T.red}40`, borderRadius: 8, padding: "10px 14px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontFamily: T.mono, fontSize: 13, color: rrPreview.isWin ? T.green : T.red, fontWeight: 700 }}>
                      {rrPreview.isWin ? "▲" : "▼"} {Math.abs(rrPreview.pct).toFixed(2)}%
                    </div>
                    {rrPreview.estPnl !== null && (
                      <div style={{ fontFamily: T.mono, fontSize: 13, color: rrPreview.isWin ? T.green : T.red }}>
                        Est. PnL: {rrPreview.isWin ? "+" : ""}{rrPreview.estPnl.toFixed(2)} {qc}
                      </div>
                    )}
                    {rrPreview.rr !== null && (
                      <div style={{ fontFamily: T.mono, fontSize: 13, color: T.cyan, fontWeight: 700 }}>
                        RR: {rrPreview.rr.toFixed(2)}R
                      </div>
                    )}
                    {rrPreview.rr === null && (
                      <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>Add Stop Loss for RR calculation</div>
                    )}
                  </div>
                )}

                {/* ── Row 5: Fees ── */}
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={LS}>Trading Fees ({qc}) <span style={{ color: T.dim }}>(auto)</span></label>
                    <input style={IS} type="number" value={form.fees} onChange={e => set("fees", e.target.value)} placeholder="0.00" />
                  </div>
                  {tradeType === "Futures" && (
                    <div style={{ flex: 1 }}>
                      <label style={LS}>Funding Fees ({qc})</label>
                      <input style={IS} type="number" value={form.fundingFees} onChange={e => set("fundingFees", e.target.value)} placeholder="0.00" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                <div>
                  <label style={LS}>Amount (USDT)</label>
                  <input style={IS} type="number" value={form.qty} onChange={e => set("qty", e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label style={LS}>Date & Time</label>
                  <MaskedDateInput style={IS} value={form.openTime} onChange={v => set("openTime", v)} />
                </div>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <label style={LS}>Notes (optional)</label>
              <textarea style={{ ...IS, resize: "vertical", minHeight: 56, marginBottom: 0 }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Enter details..." />
            </div>

            {isSpotOpen && entryType === "Trade" && (
              <div style={{ marginTop: 10, background: T.greenDim, border: `1px solid ${T.green}30`, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: T.green, fontFamily: T.mono }}>
                ✓ This will appear in "Open Spot Trades". When you sell, click "Record Sell" to close it and move it to Finished Trades.
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: T.text, fontFamily: T.mono }}>
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width: 16, height: 16, accentColor: T.green }} />
                I confirm these details are correct
              </label>
            </div>
          </div>

          {/* Right Column (Risk Calculator) */}
          {isDirectional && entryType === "Trade" && (
            <div style={{ flex: 1, width: "100%", background: T.panel2, borderRadius: 12, border: `1px solid ${T.border}` }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>🧮</span>
                <span style={{ fontSize: 12, color: T.dim, fontFamily: T.mono, letterSpacing: 1, fontWeight: 700 }}>RISK CALCULATOR</span>
              </div>
              <div style={{ padding: 16 }}>
                <RiskCalculator />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 11, fontFamily: T.mono }} disabled={loading}>Cancel</button>
          <button onClick={handle} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }} disabled={loading || !confirmed}>
            {loading ? "Looking up rate..." : (entryType === "Trade" ? (isSpotOpen ? "Record Buy ↗" : "Add Trade ↗") : (entryType === "Deposit" ? "Log Deposit ↗" : "Log Withdrawal ↗"))}
          </button>
        </div>
      </div>
    </div>
  );
}
