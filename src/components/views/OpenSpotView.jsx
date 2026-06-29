import { useState } from "react";
import { T } from "../../utils/theme.js";
import { getQuoteCurrency, fmt$ } from "../../utils/helpers.js";
import { CoinIcon, Skeleton } from "../shared/index.jsx";
import SellSpotModal from "../modals/SellSpotModal.jsx";
import { usePrices } from "../../context/PricesContext.jsx";

export default function OpenSpotTradesView({ spotOpen, onSell, onDelete, onEdit, savedSymbols }) {
  const [sellingTrade, setSellingTrade] = useState(null);
  const { prices } = usePrices();

  const totalValue = spotOpen.reduce((sum, t) => {
    const p = prices[t.symbol]?.price;
    const valQuote = p ? p * t.qty : t.entry * t.qty;
    return sum + (valQuote * (t.usdtRate || 1));
  }, 0);
  const totalCost = spotOpen.reduce((s, t) => s + (t.entry * t.qty * (t.usdtRate || 1)), 0);
  const totalPnl = totalValue - totalCost;

  if (!spotOpen.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 12 }}>
      <div style={{ fontSize: 32 }}>🪙</div>
      <div style={{ fontFamily: T.mono, fontSize: 14, color: T.bright }}>No open spot positions</div>
      <div style={{ fontSize: 12, color: T.dim }}>Click "+ Add Trade" → Spot → "Just Bought" to log a buy</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Positions", val: spotOpen.length, color: T.cyan },
          { label: "Invested Amount", val: `${totalCost.toFixed(2)} USDT`, color: T.bright },
          { label: "Current Value", val: `${totalValue.toFixed(2)} USDT`, color: T.blue },
          { label: "Unrealized PnL", val: fmt$(totalPnl), color: totalPnl >= 0 ? T.green : T.red },
        ].map((s, i) => (
          <div key={i} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {spotOpen.map(trade => {
          const p = prices[trade.symbol];
          const livePrice = p?.price;
          const qc = trade.quoteCurrency || getQuoteCurrency(trade.symbol);
          const liveUsdtRate = qc === "USDT" ? 1 : (prices[`${qc}USDT`]?.price || trade.usdtRate || 1);
          
          const unreal = livePrice ? (livePrice - trade.entry) * trade.qty : null;
          const unrealUsdt = unreal !== null ? unreal * liveUsdtRate : null;
          const unrPct = unreal !== null ? (unreal / (trade.entry * trade.qty)) * 100 : null;
          const holdMs = Date.now() - trade.openTime;
          const holdDays = Math.floor(holdMs / 86400000);
          const holdH = Math.floor((holdMs % 86400000) / 3600000);
          const invested = trade.entry * trade.qty;
          const investedUsdt = invested * (trade.usdtRate || 1);

          return (
            <div key={trade.id} style={{ background: T.panel, border: `1px solid ${unreal !== null ? (unrealUsdt >= 0 ? T.green + "30" : T.red + "30") : T.border}`, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CoinIcon symbol={trade.symbol} size={36} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: T.bright }}>{trade.symbol}</span>
                      <span style={{ background: T.greenDim, color: T.green, border: `1px solid ${T.green}40`, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>SPOT BUY</span>
                      <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{trade.exchange}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 3, fontFamily: T.mono }}>
                      Bought @ {trade.entry.toFixed(4)} · {trade.qty} units · {holdDays > 0 ? `${holdDays}d ` : ""}{holdH}h ago
                      <br />
                      Invested: {invested < 10 ? Number(invested.toFixed(6)) : invested.toFixed(2)} {trade.quoteCurrency || "USDT"} {trade.quoteCurrency && trade.quoteCurrency !== "USDT" ? `(~$${investedUsdt.toFixed(2)})` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {livePrice
                    ? <><div style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color: T.cyan }}>{livePrice.toFixed(4)}</div>
                      <div style={{ fontSize: 11, color: p.change24h >= 0 ? T.green : T.red, fontFamily: T.mono }}>{p.change24h >= 0 ? "+" : ""}{p.change24h?.toFixed(2)}% 24h</div></>
                    : <Skeleton width={60} height={16} />}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 8, marginBottom: 12 }}>
                {[
                  { 
                    label: "COST BASIS", 
                    val: trade.quoteCurrency && trade.quoteCurrency !== "USDT" 
                      ? `${(trade.entry * trade.qty).toFixed(4)} ${trade.quoteCurrency} (~$${investedUsdt.toFixed(2)})` 
                      : `${(trade.entry * trade.qty).toFixed(2)} USDT`, 
                    color: T.text 
                  },
                  { 
                    label: "CURRENT VALUE", 
                    val: livePrice 
                      ? (qc !== "USDT"
                        ? `${(livePrice * trade.qty).toFixed(4)} ${qc} (~$${(livePrice * trade.qty * liveUsdtRate).toFixed(2)})`
                        : `${(livePrice * trade.qty).toFixed(2)} USDT`)
                      : "–", 
                    color: T.blue 
                  },
                  { label: "UNREALIZED PnL", val: unreal !== null ? (qc !== "USDT" ? `${unreal >= 0 ? "+" : ""}${unreal.toFixed(4)} ${qc} (~${fmt$(unrealUsdt)})` : fmt$(unreal)) : "–", color: unreal !== null ? (unrealUsdt >= 0 ? T.green : T.red) : T.dim },
                  { label: "RETURN %", val: unrPct !== null ? `${unrPct >= 0 ? "+" : ""}${unrPct.toFixed(2)}%` : "–", color: unrPct !== null ? (unrPct >= 0 ? T.green : T.red) : T.dim },
                ].map((item, i) => (
                  <div key={i} style={{ background: T.panel2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: item.color }}>{item.val}</div>
                  </div>
                ))}
              </div>

              {trade.notes && <div style={{ fontSize: 11, color: T.dim, fontStyle: "italic", marginBottom: 10 }}>{trade.notes}</div>}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => onEdit(trade)} style={{ background: "none", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 11, fontFamily: T.mono }}>Edit</button>
                <button onClick={() => onDelete(trade.id)} style={{ background: "none", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 11, fontFamily: T.mono }}>Delete</button>
                <button onClick={() => setSellingTrade(trade)} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>Record Sell →</button>
              </div>
            </div>
          );
        })}
      </div>

      {sellingTrade && (
        <SellSpotModal
          trade={sellingTrade}
          currentPrice={prices[sellingTrade.symbol]?.price}
          prices={prices}
          onClose={() => setSellingTrade(null)}
          onConfirm={(data) => { onSell(sellingTrade, data); setSellingTrade(null); }}
        />
      )}
    </div>
  );
}
