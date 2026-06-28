import { useState, useEffect } from "react";
import { T } from "../../utils/theme.js";
import { DEFAULT_SYMBOLS } from "../../utils/constants.js";
import { CoinIcon } from "../shared/index.jsx";

export default function AlertsView({ alerts, onAddAlert, onDeleteAlert, savedSymbols, prices, prefilledSymbol, clearPrefilledSymbol }) {
  const [symbolInput, setSymbolInput] = useState(prefilledSymbol || "");
  const [condition, setCondition] = useState("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [showDrop, setShowDrop] = useState(false);

  useEffect(() => {
    if (prefilledSymbol) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSymbolInput(prefilledSymbol);
      if (clearPrefilledSymbol) clearPrefilledSymbol();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledSymbol]);

  const saved = savedSymbols || DEFAULT_SYMBOLS;
  const filtered = symbolInput
    ? saved.filter(s => s.toLowerCase().includes(symbolInput.toLowerCase()))
    : saved;

  const handleCreate = () => {
    const sym = symbolInput.trim().toUpperCase();
    const price = parseFloat(targetPrice);
    if (!sym || isNaN(price) || price <= 0) return;

    onAddAlert({
      symbol: sym,
      condition,
      targetPrice: price
    });

    setSymbolInput("");
    setTargetPrice("");
    setShowDrop(false);
  };

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered).sort((a, b) => b.triggeredAt - a.triggeredAt);

  return (
    <div>
      <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.bright, letterSpacing: 1, marginBottom: 18 }}>
        PRICE ALERTS
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Create Alert Panel */}
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.bright, marginBottom: 14, fontFamily: T.mono }}>+ CREATE PRICE ALERT</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Symbol Selection */}
            <div style={{ position: "relative" }}>
              <label style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Symbol</label>
              <input
                type="text"
                placeholder="BTCUSDT, ETHUSDT..."
                value={symbolInput}
                onChange={e => { setSymbolInput(e.target.value); setShowDrop(true); }}
                onFocus={() => setShowDrop(true)}
                onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 7, color: T.bright, padding: "8px 12px", width: "100%", boxSizing: "border-box", outline: "none", fontSize: 13, fontFamily: T.mono }}
              />
              {showDrop && filtered.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 7, maxHeight: 180, overflowY: "auto", WebkitOverflowScrolling: "touch", zIndex: 10, boxShadow: "0 10px 30px #00000080" }}>
                  {filtered.map(s => (
                    <div
                      key={s}
                      onClick={() => { setSymbolInput(s); setShowDrop(false); }}
                      style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, borderBottom: `1px solid ${T.border}30` }}
                      onMouseEnter={e => e.currentTarget.style.background = T.border + "30"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <CoinIcon symbol={s} size={20} />
                      <span style={{ color: T.bright }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Condition Selection */}
            <div>
              <label style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Trigger Condition</label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value)}
                style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 7, color: T.bright, padding: "8px 12px", width: "100%", fontSize: 13, outline: "none", cursor: "pointer" }}
              >
                <option value="above">Price crosses above (▲)</option>
                <option value="below">Price crosses below (▼)</option>
              </select>
            </div>

            {/* Target Price */}
            <div>
              <label style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Target Price (USD)</label>
              <input
                type="number" inputMode="decimal"
                step="any"
                placeholder="100000"
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 7, color: T.bright, padding: "8px 12px", width: "100%", boxSizing: "border-box", outline: "none", fontSize: 13, fontFamily: T.mono }}
              />
            </div>

            <button
              onClick={handleCreate}
              style={{ background: T.blueDim, border: `1px solid ${T.blue}50`, color: T.blue, borderRadius: 7, padding: "10px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: T.mono, marginTop: 6, transition: "background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.blue + "20"}
              onMouseLeave={e => e.currentTarget.style.background = T.blueDim}
            >
              🔔 Create Alert
            </button>
          </div>
        </div>

        {/* Alerts List Panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          {/* Active Alerts */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.bright, marginBottom: 12, fontFamily: T.mono }}>
              ACTIVE ALERTS ({activeAlerts.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeAlerts.map(alert => {
                const livePrice = prices[alert.symbol]?.price;
                return (
                  <div key={alert.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CoinIcon symbol={alert.symbol} size={24} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: T.bright }}>{alert.symbol}</div>
                        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 1 }}>
                          Crosses {alert.condition === "above" ? "above ▲" : "below ▼"} {alert.targetPrice.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {livePrice !== undefined && (
                        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                          Live: <span style={{ color: T.bright }}>{livePrice.toLocaleString()}</span>
                        </div>
                      )}
                      <button
                        onClick={() => onDeleteAlert(alert.id)}
                        style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 14, padding: 12 }}
                        title="Delete Alert"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
              {activeAlerts.length === 0 && (
                <div style={{ textAlign: "center", color: T.dim, fontSize: 12, padding: "20px 0", fontStyle: "italic" }}>
                  No active alerts. Create one on the left.
                </div>
              )}
            </div>
          </div>

          {/* Triggered Alerts */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.bright, marginBottom: 12, fontFamily: T.mono }}>
              TRIGGERED ALERTS ({triggeredAlerts.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              {triggeredAlerts.map(alert => (
                <div key={alert.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.panel2, border: `1px solid ${T.border}30`, borderRadius: 8, padding: "8px 12px", opacity: 0.7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CoinIcon symbol={alert.symbol} size={24} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: T.bright }}>{alert.symbol}</div>
                      <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 1 }}>
                        Crossed {alert.condition === "above" ? "above ▲" : "below ▼"} {alert.targetPrice.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {alert.triggeredAt && (
                      <div style={{ fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                        {new Date(alert.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <button
                      onClick={() => onDeleteAlert(alert.id)}
                      style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 14, padding: 12 }}
                      title="Delete Alert"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {triggeredAlerts.length === 0 && (
                <div style={{ textAlign: "center", color: T.dim, fontSize: 12, padding: "20px 0", fontStyle: "italic" }}>
                  No triggered alerts.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
