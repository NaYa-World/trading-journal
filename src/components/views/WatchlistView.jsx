import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { T } from "../../utils/theme.js";
import { getQuoteCurrency } from "../../utils/helpers.js";
import { DEFAULT_SYMBOLS } from "../../utils/constants.js";
import { CoinIcon, Skeleton } from "../shared/index.jsx";

export default function WatchlistView({ savedSymbols, setSavedSymbols, prices, status, onAddAlert, onOpenLiveTrade }) {
  const [newSymbol, setNewSymbol] = useState("");
  const symbols = (savedSymbols || DEFAULT_SYMBOLS).slice(0, 30);
  const isNative = Capacitor.isNativePlatform();

  const handleAddSymbol = (e) => {
    e.preventDefault();
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;
    
    // Auto append USDT if user types just BTC
    const formattedSym = sym.includes("USDT") || sym.includes("USD") ? sym : `${sym}USDT`;

    if (!savedSymbols.includes(formattedSym)) {
      if (setSavedSymbols) setSavedSymbols([formattedSym, ...savedSymbols]);
    }
    setNewSymbol("");
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.bright, letterSpacing: 1 }}>WATCHLIST</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: isNative ? T.dim : (status === "ok" ? T.green : T.dim), boxShadow: !isNative && status === "ok" ? `0 0 6px ${T.green}` : "none" }} />
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>{isNative ? "OFFLINE" : (status === "ok" ? "LIVE" : "CONNECTING...")}</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono }}>{isNative ? "Prices unavailable offline" : "Auto-updates every 3s"} · {symbols.length} symbols</div>
      </div>

      <form onSubmit={handleAddSymbol} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input 
          type="text" 
          placeholder="Add symbol (e.g. SOLUSDT)" 
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          style={{ flex: 1, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.bright, fontFamily: T.mono, fontSize: 14, outline: "none" }}
        />
        <button 
          type="submit" 
          disabled={!newSymbol.trim()}
          style={{ background: newSymbol.trim() ? T.blue : T.panel2, border: `1px solid ${newSymbol.trim() ? T.blue : T.border}`, color: newSymbol.trim() ? "#fff" : T.dim, borderRadius: 8, padding: "0 20px", fontWeight: 700, cursor: newSymbol.trim() ? "pointer" : "not-allowed", transition: "all 0.2s" }}
        >
          + Add
        </button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {symbols.map(sym => {
          const p = prices[sym];
          const change = p?.change24h;
          const isUp = change >= 0;
          return (
            <div key={sym} style={{ background: T.panel, border: `1px solid ${p ? (isUp ? T.green + "25" : T.red + "25") : T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, transition: "border-color 0.3s" }}>
              <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CoinIcon symbol={sym} size={32} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.bright }}>{sym}</div>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{getQuoteCurrency(sym)}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {p ? (
                    <>
                      <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.bright }}>
                        {p.price >= 1 ? p.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.price.toFixed(6)}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: T.mono, color: isUp ? T.green : T.red, marginTop: 2 }}>
                        {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                      </div>
                    </>
                  ) : (
                    <Skeleton width={80} height={16} />
                  )}
                </div>
              </div>

              {/* Actions Section */}
              <div style={{ display: "flex", gap: 6, marginTop: 4, width: "100%", justifyContent: "flex-end", borderTop: `1px solid ${T.border}30`, paddingTop: 8 }}>
                <button
                  onClick={() => onAddAlert && onAddAlert(sym)}
                  style={{ background: "transparent", border: `1px solid ${T.blue}40`, color: T.blue, borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: T.mono }}
                  onMouseEnter={e => e.currentTarget.style.background = T.blueDim}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  🔔 Alert
                </button>
                <button
                  onClick={() => onOpenLiveTrade && onOpenLiveTrade(sym)}
                  style={{ background: T.greenDim, border: `1px solid ${T.green}40`, color: T.green, borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: T.mono }}
                  onMouseEnter={e => e.currentTarget.style.background = T.greenDim + "40"}
                  onMouseLeave={e => e.currentTarget.style.background = T.greenDim}
                >
                  📈 Trade Live
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {symbols.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
          <div style={{ fontSize: 36 }}>◎</div>
          <div style={{ fontFamily: T.mono, fontSize: 15, color: T.bright }}>No symbols saved yet</div>
          <div style={{ fontSize: 13, color: T.dim }}>Add trades with crypto symbols — they'll appear here automatically.</div>
        </div>
      )}
    </div>
  );
}
