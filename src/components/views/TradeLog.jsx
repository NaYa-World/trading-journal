import { useState, useEffect, useMemo } from "react";
import { T } from "../../utils/theme.js";
import { fmtDate } from "../../utils/helpers.js";
import { Tag, CoinIcon, EmptyState, MaskedDateInput } from "../shared/index.jsx";
import { SETUPS, CLOSE_REASONS, DEFAULT_SYMBOLS } from "../../utils/constants.js";
import { fmt$ } from "../../utils/helpers.js";
import { calculatePnL } from "../../utils/calculations.js";
import { useDashboard } from "../../context/DashboardContext.jsx";

function MobileTradeCard({ trade: t, onEdit, onViewChart }) {
  const isTransaction = t.entryType === "Deposit" || t.entryType === "Withdrawal" || t.symbol === "Deposit" || t.symbol === "Withdrawal";
  return (
    <div 
      onClick={() => onEdit && onEdit(t)}
      style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isTransaction ? (
            <span style={{ fontSize: 20 }}>{t.entryType === "Deposit" ? "💰" : "💸"}</span>
          ) : (
            <CoinIcon symbol={t.symbol} size={24} />
          )}
          <span style={{ fontSize: 16, fontWeight: 700, color: T.bright }}>
            {isTransaction ? t.entryType || t.symbol : t.symbol}
          </span>
          {!isTransaction && (
            <span style={{ background: t.side === "Long" ? T.greenDim : T.redDim, color: t.side === "Long" ? T.green : T.red, border: `1px solid ${t.side === "Long" ? T.green : T.red}40`, borderRadius: 4, padding: "2px 6px", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>
              {t.side}
            </span>
          )}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: t.pnl >= 0 ? T.green : T.red }}>
          {isTransaction ? (t.entryType === "Deposit" || t.symbol === "Deposit" ? `+${fmt$(t.qty)}` : `-${fmt$(t.qty)}`) : fmt$(t.pnl)}
        </div>
      </div>
      
      {!isTransaction && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>ENTRY</div>
            <div style={{ fontSize: 13, fontFamily: T.mono, color: T.text }}>{t.entry < 10 ? Number(t.entry?.toFixed(6)) : t.entry?.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>EXIT</div>
            <div style={{ fontSize: 13, fontFamily: T.mono, color: T.text }}>{t.exit < 10 ? Number(t.exit?.toFixed(6)) : t.exit?.toFixed(2)}</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: T.dim }}>
        <span>{fmtDate(t.closeTime)}</span>
        {!isTransaction && <Tag label={t.setup} />}
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function TradeLog({ trades, title, onEdit, onViewChart, onSave, onQuickAdd, savedSymbols }) {
  const { isMobile } = useDashboard();
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [editingCell, setEditingCell] = useState(null);
  const [tempVal, setTempVal] = useState("");

  const [quickForm, setQuickForm] = useState({
    symbol: "",
    side: "Long",
    entry: "",
    exit: "",
    qty: "",
    setup: SETUPS[0] || "BREAKOUT",
    closeReason: CLOSE_REASONS[0] || "Target Hit"
  });
  const [showQuickDrop, setShowQuickDrop] = useState(false);

  const handleQuickFormChange = (field, val) => {
    setQuickForm(prev => ({ ...prev, [field]: val }));
  };

  const quickPnl = useMemo(() => {
    const e = parseFloat(quickForm.entry);
    const x = parseFloat(quickForm.exit);
    const q = parseFloat(quickForm.qty);
    if (isNaN(e) || isNaN(x) || isNaN(q) || e <= 0 || x <= 0 || q <= 0) return null;
    const isLong = quickForm.side === "Long";
    return (isLong ? (x - e) : (e - x)) * q;
  }, [quickForm.entry, quickForm.exit, quickForm.qty, quickForm.side]);

  const quickFees = useMemo(() => {
    const e = parseFloat(quickForm.entry);
    const x = parseFloat(quickForm.exit);
    const q = parseFloat(quickForm.qty);
    if (isNaN(e) || isNaN(x) || isNaN(q) || e <= 0 || x <= 0 || q <= 0) return null;
    return -((e * q * 0.0006) + (x * q * 0.0006));
  }, [quickForm.entry, quickForm.exit, quickForm.qty]);

  const submitQuickTrade = () => {
    const sym = quickForm.symbol.trim().toUpperCase();
    const e = parseFloat(quickForm.entry);
    const x = parseFloat(quickForm.exit);
    const q = parseFloat(quickForm.qty);

    if (!sym || isNaN(e) || e <= 0 || isNaN(x) || x <= 0 || isNaN(q) || q <= 0) {
      return;
    }

    if (onQuickAdd) {
      onQuickAdd({
        symbol: sym,
        side: quickForm.side,
        entry: e,
        exit: x,
        qty: q,
        setup: quickForm.setup,
        closeReason: quickForm.closeReason
      });
    }

    setQuickForm({
      symbol: quickForm.symbol,
      side: "Long",
      entry: "",
      exit: "",
      qty: "",
      setup: SETUPS[0] || "BREAKOUT",
      closeReason: CLOSE_REASONS[0] || "Target Hit"
    });
  };

  const saved = savedSymbols || DEFAULT_SYMBOLS;
  const filteredQuickSymbols = quickForm.symbol
    ? saved.filter(s => s.toLowerCase().includes(quickForm.symbol.toLowerCase()))
    : saved;

  const saveField = (trade, field, valString) => {
    const newVal = parseFloat(valString);
    if (isNaN(newVal) || newVal <= 0) {
      setEditingCell(null);
      return;
    }

    const updatedTrade = { ...trade };
    
    if (parseFloat(trade[field]) === newVal) {
      setEditingCell(null);
      return;
    }

    updatedTrade[field] = newVal;

    const isSpot = trade.tradeType === "Spot" || (!trade.tradeType && (trade.entryType === "Trade" || !trade.entryType));
    const isLong = trade.side === "Long" || trade.action === "Buy";
    const side = isLong ? "Long" : "Short";
    const action = isSpot ? (isLong ? "Buy" : "Sell") : side;

    const { nativePnl, pnl } = calculatePnL({
      entry: updatedTrade.entry,
      exit: updatedTrade.exit,
      qty: updatedTrade.qty,
      side,
      leverage: trade.leverage || 1,
      tradeType: trade.tradeType || "Spot",
      quoteRateOpen: trade.usdtRate || 1,
      quoteRateClose: trade.closeUsdtRate || 1,
      action
    });

    updatedTrade.nativePnl = nativePnl;
    updatedTrade.pnl = pnl;

    let f = updatedTrade.entry * updatedTrade.qty * 0.0006;
    if (updatedTrade.exit != null && updatedTrade.exit > 0) {
      f += updatedTrade.exit * updatedTrade.qty * 0.0006;
    }
    updatedTrade.fees = -Math.abs(f);

    if (onSave) {
      onSave(updatedTrade);
    }
    setEditingCell(null);
  };

  const renderEditableCell = (t, field, rawValue, displayValue) => {
    const isTransaction = t.entryType === "Deposit" || t.entryType === "Withdrawal" || t.symbol === "Deposit" || t.symbol === "Withdrawal";
    if (isTransaction) {
      return (
        <td style={{ padding: "8px 12px", fontFamily: T.mono, fontSize: 13, color: T.text }}>
          —
        </td>
      );
    }

    const isEditing = editingCell?.id === t.id && editingCell?.field === field;

    return (
      <td
        onClick={(e) => {
          e.stopPropagation();
          setEditingCell({ id: t.id, field });
          setTempVal(rawValue.toString());
        }}
        style={{
          padding: "8px 12px",
          fontFamily: T.mono,
          fontSize: 13,
          color: T.text,
          cursor: "pointer",
          position: "relative",
          borderBottom: isEditing ? `none` : `1px dashed transparent`,
          transition: "background 0.15s, border-bottom-color 0.15s",
        }}
        onMouseEnter={e => {
          if (!isEditing) {
            e.currentTarget.style.background = T.border + "30";
            e.currentTarget.style.borderBottomColor = T.blue + "60";
            const indicator = e.currentTarget.querySelector(".edit-indicator");
            if (indicator) indicator.style.opacity = "0.8";
          }
        }}
        onMouseLeave={e => {
          if (!isEditing) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderBottomColor = "transparent";
            const indicator = e.currentTarget.querySelector(".edit-indicator");
            if (indicator) indicator.style.opacity = "0";
          }
        }}
        title="Click to edit inline"
      >
        {isEditing ? (
          <input
            type="number"
            step="any"
            autoFocus
            value={tempVal}
            onChange={e => setTempVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") saveField(t, field, tempVal);
              if (e.key === "Escape") setEditingCell(null);
            }}
            onBlur={() => saveField(t, field, tempVal)}
            onClick={e => e.stopPropagation()}
            style={{
              background: T.panel2,
              border: `1px solid ${T.blue}`,
              borderRadius: 4,
              color: T.bright,
              padding: "2px 6px",
              fontSize: 13,
              fontFamily: T.mono,
              width: "100%",
              boxSizing: "border-box",
              outline: "none"
            }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <span>{displayValue}</span>
            <span style={{ fontSize: 11, opacity: 0, transition: "opacity 0.15s" }} className="edit-indicator">✏️</span>
          </div>
        )}
      </td>
    );
  };

  const sortedTrades = [...trades].sort((a, b) => b.closeTime - a.closeTime);
  const filtered = filter === "Winning" ? sortedTrades.filter(t => t.pnl > 0)
    : filter === "Losing" ? sortedTrades.filter(t => t.pnl < 0)
    : sortedTrades;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: T.mono, fontSize: 13, color: T.bright, letterSpacing: 1 }}>{title} ({trades.length})</div>
        <div style={{ display: "flex", gap: 4 }}>
          {["All", "Winning", "Losing"].map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
              background: filter === f ? T.blueDim : "none",
              border: filter === f ? `1px solid ${T.blue}40` : `1px solid transparent`,
              color: filter === f ? T.blue : T.dim, borderRadius: 5, padding: "4px 10px",
              cursor: "pointer", fontSize: 13, fontFamily: T.mono,
            }}>{f}</button>
          ))}
        </div>
      </div>
      {isMobile ? (
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {paginated.map((t) => (
             <MobileTradeCard key={t.id} trade={t} onEdit={onEdit} onViewChart={onViewChart} />
          ))}
          {paginated.length === 0 && <div style={{ textAlign: "center", color: T.dim, padding: 20, fontStyle: "italic" }}>No closed trades found. Use the quick-entry row to log one.</div>}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Symbol", "Side", "Entry", "Exit", "Qty", "P&L", "Fees", "Setup", "Reason", "Duration", "Closed", ""].map((h, i) => (
                <th key={h + i} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: T.dim, fontWeight: 700, letterSpacing: 1.2, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((t, i) => (
              <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}20`, background: i % 2 === 0 ? "transparent" : T.panel2 + "60" }}
                onMouseEnter={e => e.currentTarget.style.background = T.border + "30"}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : T.panel2 + "60"}>
                <td style={{ padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {t.entryType === "Deposit" || t.symbol === "Deposit" ? (
                      <>
                        <span style={{ fontSize: 18 }}>💰</span>
                        <span style={{ color: T.bright, fontWeight: 600 }}>Deposit</span>
                      </>
                    ) : t.entryType === "Withdrawal" || t.symbol === "Withdrawal" ? (
                      <>
                        <span style={{ fontSize: 18 }}>💸</span>
                        <span style={{ color: T.bright, fontWeight: 600 }}>Withdrawal</span>
                      </>
                    ) : (
                      <>
                        <CoinIcon symbol={t.symbol} size={26} />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ color: T.bright, fontWeight: 600 }}>{t.symbol}</span>
                          <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                            <span style={{ fontSize: 10, fontFamily: T.mono, color: t.tradeType === "Spot" ? T.cyan : T.orange, background: (t.tradeType === "Spot" ? T.cyan : T.orange) + "15", padding: "2px 5px", borderRadius: 4 }}>
                              {t.tradeType || "Spot"}
                            </span>
                            {t.leverage > 1 && <span style={{ fontSize: 10, fontFamily: T.mono, color: T.orange, background: T.orange + "15", padding: "2px 5px", borderRadius: 4 }}>{t.leverage}×</span>}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {t.entryType === "Deposit" || t.entryType === "Withdrawal" || t.symbol === "Deposit" || t.symbol === "Withdrawal" ? (
                    <span style={{ color: T.dim }}>—</span>
                  ) : (
                    <span style={{ background: t.side === "Long" ? T.greenDim : T.redDim, color: t.side === "Long" ? T.green : T.red, border: `1px solid ${t.side === "Long" ? T.green : T.red}40`, borderRadius: 4, padding: "2px 7px", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>
                      {t.side}
                    </span>
                  )}
                </td>
                {renderEditableCell(t, "entry", t.entry != null ? t.entry : "", t.entry != null ? (t.entry < 10 ? Number(t.entry.toFixed(6)) : t.entry.toFixed(2)) : "—")}
                {renderEditableCell(t, "exit", t.exit != null ? t.exit : "", t.exit != null ? (t.exit < 10 ? Number(t.exit.toFixed(6)) : t.exit.toFixed(2)) : "—")}
                {renderEditableCell(t, "qty", t.qty, t.qty)}
                <td style={{ padding: "8px 12px", fontFamily: T.mono, fontSize: 14, color: t.pnl >= 0 ? T.green : T.red, fontWeight: 700 }}>
                  {t.entryType === "Deposit" || t.symbol === "Deposit" ? (
                    `+${fmt$(t.qty)}`
                  ) : t.entryType === "Withdrawal" || t.symbol === "Withdrawal" ? (
                    `-${fmt$(t.qty)}`
                  ) : t.nativePnl !== undefined && t.quoteCurrency !== "USDT" && t.quoteCurrency ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span>{fmt$(t.pnl)}</span>
                      <span style={{ fontSize: 11, color: T.dim }}>{t.nativePnl >= 0 ? "+" : ""}{t.nativePnl} {t.quoteCurrency}</span>
                    </div>
                  ) : (
                    fmt$(t.pnl)
                  )}
                </td>
                <td style={{ padding: "8px 12px", fontFamily: T.mono, fontSize: 13, color: T.red }}>
                  {t.entryType === "Deposit" || t.entryType === "Withdrawal" || t.symbol === "Deposit" || t.symbol === "Withdrawal" ? "—" : fmt$(t.fees)}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {t.entryType === "Deposit" || t.entryType === "Withdrawal" || t.symbol === "Deposit" || t.symbol === "Withdrawal" ? "—" : <Tag label={t.setup} />}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: T.dim, whiteSpace: "nowrap" }}>{t.closeReason}</td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: T.dim, fontFamily: T.mono }}>
                  {t.entryType === "Deposit" || t.entryType === "Withdrawal" || t.symbol === "Deposit" || t.symbol === "Withdrawal" ? "—" : `${Math.floor((t.closeTime - t.openTime) / 3600000)}h ${Math.floor(((t.closeTime - t.openTime) % 3600000) / 60000)}m`}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: T.dim, whiteSpace: "nowrap" }}>{fmtDate(t.closeTime)}</td>
                {onEdit && (
                  <td style={{ padding: "8px 12px", textAlign: "right", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      {!(t.entryType === "Deposit" || t.entryType === "Withdrawal" || t.symbol === "Deposit" || t.symbol === "Withdrawal") && (
                        <>
                          {t.chartUrl && (
                            <a href={t.chartUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }} onClick={e => e.stopPropagation()}>
                              <button style={{ background: "transparent", border: "none", color: T.blue, cursor: "pointer", fontSize: 14, padding: "4px 6px", borderRadius: 6 }} title="View Chart" onMouseEnter={e => e.currentTarget.style.background = T.blueDim} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>🔗</button>
                            </a>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); onViewChart && onViewChart(t); }} style={{ background: "transparent", border: "none", color: T.blue, cursor: "pointer", fontSize: 14, padding: "4px 6px", borderRadius: 6 }} title="View Interactive Chart" onMouseEnter={e => e.currentTarget.style.background = T.blueDim} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>📈</button>
                        </>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onEdit(t); }} style={{ background: "transparent", border: "none", color: T.blue, cursor: "pointer", fontSize: 14, padding: "4px 6px", borderRadius: 6 }} title="Edit Transaction" onMouseEnter={e => e.currentTarget.style.background = T.blueDim} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>✏️</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={12} style={{ padding: "30px 12px", textAlign: "center", color: T.dim, fontStyle: "italic" }}>
                  No closed trades found. Use the quick-entry row below to log one.
                </td>
              </tr>
            )}

            {/* Quick Entry Row */}
            {onQuickAdd && (
              <tr style={{ background: T.panel2, borderTop: `2px solid ${T.border}` }}>
                {/* Symbol */}
                <td style={{ padding: "8px 12px" }}>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Symbol"
                      value={quickForm.symbol}
                      onChange={e => handleQuickFormChange("symbol", e.target.value)}
                      onFocus={() => setShowQuickDrop(true)}
                      onBlur={() => setTimeout(() => setShowQuickDrop(false), 200)}
                      style={{
                        background: T.panel,
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        color: T.bright,
                        padding: "6px 10px",
                        fontSize: 13,
                        fontFamily: T.mono,
                        width: 90,
                        boxSizing: "border-box",
                        outline: "none"
                      }}
                    />
                    {showQuickDrop && filteredQuickSymbols.length > 0 && (
                      <div style={{
                        position: "absolute", bottom: "100%", left: 0,
                        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6,
                        maxHeight: 180, overflowY: "auto", zIndex: 10, boxShadow: "0 -4px 20px #00000080",
                        width: 140
                      }}>
                        {filteredQuickSymbols.map(sym => (
                          <div
                            key={sym}
                            onClick={() => {
                              handleQuickFormChange("symbol", sym);
                              setShowQuickDrop(false);
                            }}
                            style={{
                              padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                              fontSize: 12, borderBottom: `1px solid ${T.border}30`
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = T.border + "30"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <CoinIcon symbol={sym} size={18} />
                            <span style={{ color: T.bright }}>{sym}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>

                {/* Side */}
                <td style={{ padding: "8px 12px" }}>
                  <select
                    value={quickForm.side}
                    onChange={e => handleQuickFormChange("side", e.target.value)}
                    style={{
                      background: T.panel,
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      color: T.bright,
                      padding: "6px 10px",
                      fontSize: 13,
                      outline: "none"
                    }}
                  >
                    <option value="Long">Long</option>
                    <option value="Short">Short</option>
                  </select>
                </td>

                {/* Entry */}
                <td style={{ padding: "8px 12px" }}>
                  <input
                    type="number"
                    step="any"
                    placeholder="Entry"
                    value={quickForm.entry}
                    onChange={e => handleQuickFormChange("entry", e.target.value)}
                    style={{
                      background: T.panel,
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      color: T.bright,
                      padding: "6px 10px",
                      fontSize: 13,
                      fontFamily: T.mono,
                      width: 80,
                      boxSizing: "border-box",
                      outline: "none"
                    }}
                  />
                </td>

                {/* Exit */}
                <td style={{ padding: "8px 12px" }}>
                  <input
                    type="number"
                    step="any"
                    placeholder="Exit"
                    value={quickForm.exit}
                    onChange={e => handleQuickFormChange("exit", e.target.value)}
                    style={{
                      background: T.panel,
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      color: T.bright,
                      padding: "6px 10px",
                      fontSize: 13,
                      fontFamily: T.mono,
                      width: 80,
                      boxSizing: "border-box",
                      outline: "none"
                    }}
                  />
                </td>

                {/* Qty */}
                <td style={{ padding: "8px 12px" }}>
                  <input
                    type="number"
                    step="any"
                    placeholder="Qty"
                    value={quickForm.qty}
                    onChange={e => handleQuickFormChange("qty", e.target.value)}
                    style={{
                      background: T.panel,
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      color: T.bright,
                      padding: "6px 10px",
                      fontSize: 13,
                      fontFamily: T.mono,
                      width: 80,
                      boxSizing: "border-box",
                      outline: "none"
                    }}
                  />
                </td>

                {/* P&L */}
                <td style={{ padding: "8px 12px", fontFamily: T.mono, fontSize: 13, color: quickPnl >= 0 ? T.green : T.red }}>
                  {quickPnl !== null ? fmt$(quickPnl) : "—"}
                </td>

                {/* Fees */}
                <td style={{ padding: "8px 12px", fontFamily: T.mono, fontSize: 13, color: T.red }}>
                  {quickFees !== null ? fmt$(quickFees) : "—"}
                </td>

                {/* Setup */}
                <td style={{ padding: "8px 12px" }}>
                  <select
                    value={quickForm.setup}
                    onChange={e => handleQuickFormChange("setup", e.target.value)}
                    style={{
                      background: T.panel,
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      color: T.bright,
                      padding: "6px 10px",
                      fontSize: 13,
                      outline: "none"
                    }}
                  >
                    {SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>

                {/* Reason */}
                <td style={{ padding: "8px 12px" }}>
                  <select
                    value={quickForm.closeReason}
                    onChange={e => handleQuickFormChange("closeReason", e.target.value)}
                    style={{
                      background: T.panel,
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      color: T.bright,
                      padding: "6px 10px",
                      fontSize: 13,
                      outline: "none"
                    }}
                  >
                    {CLOSE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>

                {/* Duration */}
                <td style={{ padding: "8px 12px", fontSize: 12, color: T.dim }}>—</td>

                {/* Closed */}
                <td style={{ padding: "8px 12px", fontSize: 12, color: T.dim }}>Now</td>

                {/* Log Button */}
                <td style={{ padding: "8px 12px", textAlign: "right" }}>
                  <button
                    onClick={submitQuickTrade}
                    style={{
                      background: T.blueDim,
                      border: `1px solid ${T.blue}50`,
                      color: T.blue,
                      borderRadius: 6,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: "bold",
                      fontFamily: T.mono
                    }}
                  >
                    + Log
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      <div style={{ padding: "12px 18px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono }}>{filtered.length} trades</div>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: "none", border: `1px solid ${T.border}`, color: T.dim, borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 13 }}>‹</button>
            <span style={{ fontFamily: T.mono, fontSize: 13, color: T.dim, padding: "3px 8px" }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: "none", border: `1px solid ${T.border}`, color: T.dim, borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 13 }}>›</button>
          </div>
        )}
      </div>
    </div>
  );
}
