import { useState, useEffect } from "react";
import { T } from "../../utils/theme.js";
import { getQuoteCurrency, fmtPnl } from "../../utils/helpers.js";
import { calculatePnL } from "../../utils/calculations.js";
import { CoinIcon, Skeleton } from "../shared/index.jsx";
import AddLiveTradeModal from "../modals/AddLiveTradeModal.jsx";
import CloseLiveTradeModal from "../modals/CloseLiveTradeModal.jsx";

const TYPE_COLORS = { Spot: T.green, Futures: T.orange, Margin: T.purple, Options: T.cyan };

export default function LiveTradesView({ liveTrades, onAdd, onClose, savedSymbols, prices, status, prefilledSymbol, clearPrefilledSymbol }) {
  const [showAdd, setShowAdd] = useState(false);
  const [closingTrade, setClosingTrade] = useState(null);

  useEffect(() => {
    if (prefilledSymbol) {
      setShowAdd(true);
    }
  }, [prefilledSymbol]);

  const totalUnrealizedPnl = liveTrades.reduce((sum, t) => {
    const p = prices[t.symbol];
    if (!p) return sum;
    const qc = t.quoteCurrency || getQuoteCurrency(t.symbol);
    const liveUsdtRate = qc === "USDT" ? 1 : (prices[`${qc}USDT`]?.price || t.usdtRate || 1);
    
    const { pnl: unrealPnl } = calculatePnL({
      entry: t.entry,
      exit: p.price,
      qty: t.qty,
      side: t.side,
      leverage: t.leverage || 1,
      tradeType: t.tradeType,
      marginType: t.marginType,
      quoteRateOpen: t.usdtRate || 1,
      quoteRateClose: liveUsdtRate,
      action: t.side
    });
    return sum + unrealPnl;
  }, 0);

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: status === "ok" ? T.green : status === "fetching" ? T.yellow : T.dim, boxShadow: status === "ok" ? `0 0 6px ${T.green}` : "none" }} />
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.dim, letterSpacing: 1 }}>
              {status === "ok" ? "LIVE · 3s" : status === "fetching" ? "UPDATING..." : "CONNECTING..."}
            </span>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 13, color: liveTrades.length ? T.cyan : T.dim }}>{liveTrades.length} Open Position{liveTrades.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {liveTrades.length > 0 && (
            <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: totalUnrealizedPnl >= 0 ? T.green : T.red }}>
              Unrealized: {fmtPnl(totalUnrealizedPnl)}
            </div>
          )}
          <button onClick={() => setShowAdd(true)} style={{ background: T.green, border: "none", color: "#000", borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: T.mono }}>+ Open Trade</button>
        </div>
      </div>

      {/* Empty state */}
      {liveTrades.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 14 }}>
          <div style={{ fontSize: 38 }}>◎</div>
          <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright }}>No open positions</div>
          <div style={{ fontSize: 14, color: T.dim }}>Open a trade to track it live with real-time PnL</div>
          <button onClick={() => setShowAdd(true)} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: T.mono, marginTop: 4 }}>+ Open First Trade</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {liveTrades.map(trade => {
            const p = prices[trade.symbol];
            const currentPrice = p?.price;
            const qc = trade.quoteCurrency || getQuoteCurrency(trade.symbol);
            const liveUsdtRate = qc === "USDT" ? 1 : (prices[`${qc}USDT`]?.price || trade.usdtRate || 1);
            
            const lev = trade.leverage || 1;
            
            let nativeUnrealizedPnl = null;
            let unrealizedPnl = null;
            if (currentPrice) {
              const { nativePnl, pnl } = calculatePnL({
                entry: trade.entry,
                exit: currentPrice,
                qty: trade.qty,
                side: trade.side,
                leverage: trade.leverage || 1,
                tradeType: trade.tradeType,
                marginType: trade.marginType,
                quoteRateOpen: trade.usdtRate || 1,
                quoteRateClose: liveUsdtRate,
                action: trade.side
              });
              nativeUnrealizedPnl = nativePnl;
              unrealizedPnl = pnl;
            }
            
            const pnlPct = nativeUnrealizedPnl !== null ? (nativeUnrealizedPnl / (trade.entry * trade.qty * lev)) * 100 : null;
            const distToSL = trade.stopLoss && currentPrice ? ((currentPrice - trade.stopLoss) / currentPrice * 100 * (trade.side === "Long" ? 1 : -1)) : null;
            const distToTP = trade.takeProfit && currentPrice ? ((trade.takeProfit - currentPrice) / currentPrice * 100 * (trade.side === "Long" ? 1 : -1)) : null;
            const typeColor = TYPE_COLORS[trade.tradeType] || T.dim;
            const holdMs = Date.now() - trade.openTime;
            const holdH = Math.floor(holdMs / 3600000);
            const holdM = Math.floor((holdMs % 3600000) / 60000);

            return (
              <div key={trade.id} style={{ background: T.panel, border: `1px solid ${unrealizedPnl !== null ? (unrealizedPnl >= 0 ? T.green + "30" : T.red + "30") : T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CoinIcon symbol={trade.symbol} size={36} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: T.bright }}>{trade.symbol}</span>
                        <span style={{ background: trade.side === "Long" ? T.greenDim : T.redDim, color: trade.side === "Long" ? T.green : T.red, border: `1px solid ${trade.side === "Long" ? T.green : T.red}40`, borderRadius: 4, padding: "2px 7px", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>{trade.side}</span>
                        <span style={{ background: typeColor + "18", color: typeColor, border: `1px solid ${typeColor}40`, borderRadius: 4, padding: "2px 7px", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>{trade.tradeType}</span>
                        {trade.leverage > 1 && <span style={{ background: T.orangeDim, color: T.orange, border: `1px solid ${T.orange}40`, borderRadius: 4, padding: "2px 7px", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>{trade.leverage}×</span>}
                        <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{trade.exchange}</span>
                      </div>
                      <div style={{ fontSize: 12, color: T.dim, marginTop: 3, fontFamily: T.mono }}>
                        Opened {holdH}h {holdM}m ago · Entry: {trade.entry.toFixed(4)} · Qty: {trade.qty}
                      </div>
                    </div>
                  </div>

                  {/* Live price + PnL */}
                  <div style={{ textAlign: "right" }}>
                    {currentPrice ? (
                      <>
                        <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: T.cyan }}>{currentPrice.toFixed(4)}</div>
                        <div style={{ fontSize: 12, color: p.change24h >= 0 ? T.green : T.red, fontFamily: T.mono }}>{p.change24h >= 0 ? "+" : ""}{p.change24h?.toFixed(2)}% 24h</div>
                      </>
                    ) : (
                      <Skeleton width={120} height={20} />
                    )}
                  </div>
                </div>

                {/* PnL + levels row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 8, marginBottom: 12 }}>
                  <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>UNREALIZED PnL</div>
                    <div style={{ fontFamily: T.mono, fontSize: 17, fontWeight: 700, color: unrealizedPnl !== null ? (unrealizedPnl >= 0 ? T.green : T.red) : T.dim }}>
                      {unrealizedPnl !== null ? fmtPnl(unrealizedPnl) : "–"}
                    </div>
                    {trade.quoteCurrency && trade.quoteCurrency !== "USDT" && nativeUnrealizedPnl !== null && (
                      <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{nativeUnrealizedPnl > 0 ? "+" : ""}{nativeUnrealizedPnl.toFixed(4)} {trade.quoteCurrency}</div>
                    )}
                    {pnlPct !== null && <div style={{ fontSize: 12, color: pnlPct >= 0 ? T.green : T.red, fontFamily: T.mono, marginTop: 2 }}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div>}
                  </div>
                  <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>STOP LOSS</div>
                    <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: trade.stopLoss ? T.red : T.dim }}>{trade.stopLoss ? trade.stopLoss.toFixed(4) : "—"}</div>
                    {distToSL !== null && <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono }}>{distToSL.toFixed(2)}% away</div>}
                  </div>
                  <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>TAKE PROFIT</div>
                    <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: trade.takeProfit ? T.green : T.dim }}>{trade.takeProfit ? trade.takeProfit.toFixed(4) : "—"}</div>
                    {distToTP !== null && <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono }}>{distToTP.toFixed(2)}% away</div>}
                  </div>
                  <div style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>24H RANGE</div>
                    {p ? (
                      <>
                        <div style={{ fontSize: 12, color: T.green, fontFamily: T.mono }}>H: {p.high24h?.toFixed(2)}</div>
                        <div style={{ fontSize: 12, color: T.red, fontFamily: T.mono }}>L: {p.low24h?.toFixed(2)}</div>
                      </>
                    ) : <div style={{ fontSize: 14, color: T.dim }}>–</div>}
                  </div>
                </div>

                {/* Notes + close button */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {trade.notes ? <div style={{ fontSize: 13, color: T.dim, fontStyle: "italic", maxWidth: "70%" }}>{trade.notes}</div> : <div />}
                  <button onClick={() => setClosingTrade(trade)}
                    style={{ background: T.redDim, border: `1px solid ${T.red}40`, color: T.red, borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>
                    Close Trade
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddLiveTradeModal
          onAdd={(t) => {
            onAdd(t);
            setShowAdd(false);
            if (clearPrefilledSymbol) clearPrefilledSymbol();
          }}
          onClose={() => {
            setShowAdd(false);
            if (clearPrefilledSymbol) clearPrefilledSymbol();
          }}
          savedSymbols={savedSymbols}
          initialSymbol={prefilledSymbol}
        />
      )}
      {closingTrade && (
        <CloseLiveTradeModal
          trade={closingTrade}
          currentPrice={prices[closingTrade.symbol]?.price}
          onClose={() => setClosingTrade(null)}
          onConfirm={(closeData) => { onClose(closingTrade, closeData); setClosingTrade(null); }}
        />
      )}
    </div>
  );
}
