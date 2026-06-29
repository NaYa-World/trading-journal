import { useState, useMemo } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { Card } from "../shared/index.jsx";
import { calculateFees, calculateTPLevels, FEE_RATES } from "../../utils/feeengine";

export default function FeeCalculator() {
  const { T, isMobile } = useDashboard();

  // ─── Input States ─────────────────────────────────────────────────────────
  const [exchange, setExchange] = useState("binance");
  const [tradeType, setTradeType] = useState("spot");
  const [direction, setDirection] = useState("long");
  const [leverage, setLeverage] = useState("10");
  const [entryPrice, setEntryPrice] = useState("150.00");
  const [exitPrice, setExitPrice] = useState("165.00");
  const [quantity, setQuantity] = useState("10");
  const [stopLoss, setStopLoss] = useState("142.00");
  const [entryOrderType, setEntryOrderType] = useState("maker");
  const [exitOrderType, setExitOrderType] = useState("taker");
  const [useBnbDiscount, setUseBnbDiscount] = useState(false);
  const [useCustomRates, setUseCustomRates] = useState(false);
  const [customMakerRate, setCustomMakerRate] = useState("0.02");
  const [customTakerRate, setCustomTakerRate] = useState("0.04");

  // ─── Calculation ──────────────────────────────────────────────────────────
  const parsedInputs = useMemo(() => {
    const entry = parseFloat(entryPrice) || 0;
    const exit = parseFloat(exitPrice) || 0;
    const qty = parseFloat(quantity) || 0;
    const sl = parseFloat(stopLoss) || 0;
    const lev = tradeType === "futures" ? (parseFloat(leverage) || 1) : 1;
    const cMaker = useCustomRates ? (parseFloat(customMakerRate) || 0) / 100 : undefined;
    const cTaker = useCustomRates ? (parseFloat(customTakerRate) || 0) / 100 : undefined;

    return {
      exchange,
      tradeType,
      direction,
      entryPrice: entry,
      exitPrice: exit,
      quantity: qty,
      stopLoss: sl,
      leverage: lev,
      entryOrderType,
      exitOrderType,
      useBnbDiscount: exchange === "binance" && useBnbDiscount,
      customMakerRate: cMaker,
      customTakerRate: cTaker,
    };
  }, [
    exchange,
    tradeType,
    direction,
    leverage,
    entryPrice,
    exitPrice,
    quantity,
    stopLoss,
    entryOrderType,
    exitOrderType,
    useBnbDiscount,
    useCustomRates,
    customMakerRate,
    customTakerRate,
  ]);

  const results = useMemo(() => {
    return calculateFees(parsedInputs);
  }, [parsedInputs]);

  const tpLevels = useMemo(() => {
    return calculateTPLevels({
      ...parsedInputs,
    });
  }, [parsedInputs]);

  // ─── Style Constants ──────────────────────────────────────────────────────
  const IS = {
    background: T.panel2,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    color: T.bright,
    padding: "9px 12px",
    fontSize: 14,
    width: "100%",
    fontFamily: T.mono,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const LS = {
    fontSize: 11,
    color: T.dim,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    display: "block",
    marginBottom: 5,
  };

  const segStyle = {
    display: "flex",
    gap: 4,
    background: T.panel2,
    borderRadius: 6,
    padding: 3,
    border: `1px solid ${T.border}`,
  };

  const btnStyle = (active, colorClass = T.blue) => ({
    flex: 1,
    background: active ? colorClass : "transparent",
    border: "none",
    color: active ? "#fff" : T.dim,
    fontSize: 12,
    fontWeight: 500,
    padding: "6px 8px",
    borderRadius: 4,
    cursor: "pointer",
    transition: "all 0.15s",
    fontFamily: T.sans,
    outline: "none",
  });

  const dividerStyle = {
    height: 1,
    background: T.border,
    margin: "18px 0",
  };

  const resultRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: `1px solid ${T.border}`,
    fontSize: 13,
  };

  const tableHeaderStyle = {
    textAlign: "left",
    fontSize: 11,
    color: T.dim,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    padding: "8px 10px",
    borderBottom: `1px solid ${T.border}`,
  };

  const tableCellStyle = {
    padding: "10px 10px",
    borderBottom: `1px solid ${T.border}`,
    fontFamily: T.mono,
  };

  // ─── Formatters ───────────────────────────────────────────────────────────
  const fmt$ = (n, d = 2) => {
    if (n === null || isNaN(n)) return "—";
    return (n < 0 ? "-" : "+") + "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  const fmt$Neutral = (n, d = 2) => {
    if (n === null || isNaN(n)) return "—";
    return "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  const isProfit = results.netPnl >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header section inside the view */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.bright, display: "flex", alignItems: "center", gap: 8 }}>
          ⚡ Fee Calculator
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            padding: "2px 8px",
            borderRadius: 20,
            background: T.blueDim,
            color: T.blue,
            border: `1px solid ${T.blue}50`,
          }}>Live</span>
        </div>
        <div style={{ fontSize: 13, color: T.dim }}>
          Auto-calculates entry + exit fees, break-even price, and net P&L for Binance and Bitget
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        
        {/* ─── LEFT COLUMN: INPUTS ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.bright, marginBottom: 14, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Trade Setup
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Row 1: Exchange & Trade Type */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Exchange</label>
                  <select
                    value={exchange}
                    onChange={(e) => {
                      setExchange(e.target.value);
                      if (e.target.value !== "binance") setUseBnbDiscount(false);
                    }}
                    style={IS}
                  >
                    <option value="binance">Binance</option>
                    <option value="bitget">Bitget</option>
                  </select>
                </div>
                <div>
                  <label style={LS}>Trade Type</label>
                  <div style={segStyle}>
                    <button
                      onClick={() => setTradeType("spot")}
                      style={btnStyle(tradeType === "spot")}
                    >Spot</button>
                    <button
                      onClick={() => setTradeType("futures")}
                      style={btnStyle(tradeType === "futures")}
                    >Futures</button>
                  </div>
                </div>
              </div>

              {/* Row 2: Direction & Leverage */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Direction</label>
                  <div style={segStyle}>
                    <button
                      onClick={() => setDirection("long")}
                      style={btnStyle(direction === "long")}
                    >Long</button>
                    <button
                      onClick={() => setDirection("short")}
                      style={btnStyle(direction === "short")}
                    >Short</button>
                  </div>
                </div>
                {tradeType === "futures" ? (
                  <div>
                    <label style={LS}>Leverage (×</label>
                    <input
                      type="number"
                      value={leverage}
                      min="1"
                      max="125"
                      onChange={(e) => setLeverage(e.target.value)}
                      style={IS}
                    />
                  </div>
                ) : (
                  <div style={{ opacity: 0.3, pointerEvents: "none" }}>
                    <label style={LS}>Leverage</label>
                    <input type="text" value="Spot (1x)" readOnly style={IS} />
                  </div>
                )}
              </div>

              {/* Row 3: Entry & Exit Price */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Entry Price (USDT)</label>
                  <input
                    type="number"
                    value={entryPrice}
                    step="0.01"
                    placeholder="0.00"
                    onChange={(e) => setEntryPrice(e.target.value)}
                    style={IS}
                  />
                </div>
                <div>
                  <label style={LS}>Exit Price (USDT)</label>
                  <input
                    type="number"
                    value={exitPrice}
                    step="0.01"
                    placeholder="0.00"
                    onChange={(e) => setExitPrice(e.target.value)}
                    style={IS}
                  />
                </div>
              </div>

              {/* Row 4: Quantity & Stop Loss */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    step="0.001"
                    placeholder="0.000"
                    onChange={(e) => setQuantity(e.target.value)}
                    style={IS}
                  />
                </div>
                <div>
                  <label style={LS}>Stop Loss (USDT)</label>
                  <input
                    type="number"
                    value={stopLoss}
                    step="0.01"
                    placeholder="0.00"
                    onChange={(e) => setStopLoss(e.target.value)}
                    style={IS}
                  />
                </div>
              </div>

              <div style={dividerStyle}></div>

              {/* Row 5: Maker/Taker Types */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>Entry Order Type</label>
                  <div style={segStyle}>
                    <button
                      onClick={() => setEntryOrderType("maker")}
                      style={btnStyle(entryOrderType === "maker")}
                    >Maker</button>
                    <button
                      onClick={() => setEntryOrderType("taker")}
                      style={btnStyle(entryOrderType === "taker")}
                    >Taker</button>
                  </div>
                </div>
                <div>
                  <label style={LS}>Exit Order Type</label>
                  <div style={segStyle}>
                    <button
                      onClick={() => setExitOrderType("maker")}
                      style={btnStyle(exitOrderType === "maker")}
                    >Maker</button>
                    <button
                      onClick={() => setExitOrderType("taker")}
                      style={btnStyle(exitOrderType === "taker")}
                    >Taker</button>
                  </div>
                </div>
              </div>

              {/* Row 6: Discounts & Standard vs. Custom */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {exchange === "binance" ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={{ fontSize: 13, color: T.bright, cursor: "pointer" }} htmlFor="bnb-toggle">
                      Pay fees in BNB (-25%)
                    </label>
                    <input
                      type="checkbox"
                      id="bnb-toggle"
                      checked={useBnbDiscount}
                      onChange={(e) => setUseBnbDiscount(e.target.checked)}
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: T.blue,
                        cursor: "pointer",
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ opacity: 0.3, pointerEvents: "none", display: "flex", alignItems: "center" }}>
                    <label style={{ fontSize: 13, color: T.dim }}>No BNB Discount</label>
                  </div>
                )}
                <div>
                  <label style={LS}>Fee Override</label>
                  <div style={segStyle}>
                    <button
                      onClick={() => setUseCustomRates(false)}
                      style={btnStyle(!useCustomRates)}
                    >Standard</button>
                    <button
                      onClick={() => setUseCustomRates(true)}
                      style={btnStyle(useCustomRates)}
                    >Custom</button>
                  </div>
                </div>
              </div>

              {/* Row 7: Custom rates override (only shown when custom) */}
              {useCustomRates && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                  <div>
                    <label style={LS}>Custom Maker (%)</label>
                    <input
                      type="number"
                      value={customMakerRate}
                      step="0.001"
                      min="0"
                      onChange={(e) => setCustomMakerRate(e.target.value)}
                      style={IS}
                    />
                  </div>
                  <div>
                    <label style={LS}>Custom Taker (%)</label>
                    <input
                      type="number"
                      value={customTakerRate}
                      step="0.001"
                      min="0"
                      onChange={(e) => setCustomTakerRate(e.target.value)}
                      style={IS}
                    />
                  </div>
                </div>
              )}

            </div>
          </Card>
        </div>

        {/* ─── RIGHT COLUMN: RESULTS & REFERENCES ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Big PNL display hero */}
          <div style={{
            background: isProfit ? T.greenDim : T.redDim,
            border: `1px solid ${isProfit ? T.green : T.red}`,
            borderRadius: 10,
            padding: 22,
            textAlign: "center",
            boxShadow: `0 8px 24px -10px ${isProfit ? T.green : T.red}40`,
            transition: "all 0.3s",
          }}>
            <div style={{
              fontSize: 34,
              fontWeight: 700,
              fontFamily: T.mono,
              letterSpacing: -1,
              color: isProfit ? T.green : T.red,
            }}>
              {fmt$(results.netPnl)}
            </div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 6, fontWeight: 500, fontFamily: T.sans }}>
              Net P&L · {isProfit ? "+" : "-"}{Math.abs(results.roi).toFixed(2)}% ROI · Gross {fmt$(results.grossPnl)}
            </div>
          </div>

          {/* Fee breakdown details */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.bright, marginBottom: 14, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Fee Breakdown
            </div>

            {/* Active rate chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                Entry <span style={{ color: T.orange, fontWeight: 600 }}>{(results.entryFeeRate * 100).toFixed(4)}%</span>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                Exit <span style={{ color: T.orange, fontWeight: 600 }}>{(results.exitFeeRate * 100).toFixed(4)}%</span>
              </div>
              {exchange === "binance" && useBnbDiscount && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontFamily: T.mono, color: T.dim }}>
                  BNB <span style={{ color: T.green, fontWeight: 600 }}>-25%</span>
                </div>
              )}
            </div>

            {/* Values lists */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={resultRowStyle}>
                <span style={{ color: T.dim }}>Entry Notional</span>
                <span style={{ fontFamily: T.mono, color: T.bright, fontWeight: 600 }}>{fmt$Neutral(results.entryNotional)}</span>
              </div>
              <div style={resultRowStyle}>
                <span style={{ color: T.dim }}>Entry Fee</span>
                <span style={{ fontFamily: T.mono, color: T.red, fontWeight: 600 }}>-{fmt$Neutral(results.entryFee)}</span>
              </div>
              <div style={resultRowStyle}>
                <span style={{ color: T.dim }}>Exit Notional</span>
                <span style={{ fontFamily: T.mono, color: T.bright, fontWeight: 600 }}>{fmt$Neutral(results.exitNotional)}</span>
              </div>
              <div style={resultRowStyle}>
                <span style={{ color: T.dim }}>Exit Fee</span>
                <span style={{ fontFamily: T.mono, color: T.red, fontWeight: 600 }}>-{fmt$Neutral(results.exitFee)}</span>
              </div>
              <div style={resultRowStyle}>
                <span style={{ color: T.dim }}>Total Fee</span>
                <span style={{ fontFamily: T.mono, color: T.red, fontWeight: 600 }}>-{fmt$Neutral(results.totalFee)}</span>
              </div>
              
              <div style={{ ...dividerStyle, margin: "8px 0" }}></div>

              <div style={resultRowStyle}>
                <span style={{ color: T.dim }}>Gross P&L</span>
                <span style={{ fontFamily: T.mono, color: results.grossPnl >= 0 ? T.green : T.red, fontWeight: 600 }}>{fmt$(results.grossPnl)}</span>
              </div>
              <div style={resultRowStyle}>
                <span style={{ color: T.dim }}>Net P&L</span>
                <span style={{ fontFamily: T.mono, color: isProfit ? T.green : T.red, fontWeight: 600 }}>{fmt$(results.netPnl)}</span>
              </div>
              <div style={resultRowStyle}>
                <span style={{ color: T.dim }}>ROI (on Margin)</span>
                <span style={{ fontFamily: T.mono, color: results.roi >= 0 ? T.green : T.red, fontWeight: 600 }}>
                  {results.roi >= 0 ? "+" : ""}{results.roi.toFixed(2)}%
                </span>
              </div>
              <div style={resultRowStyle}>
                <span style={{ color: T.dim }}>Margin Used</span>
                <span style={{ fontFamily: T.mono, color: T.bright, fontWeight: 600 }}>{fmt$Neutral(results.margin)}</span>
              </div>

              <div style={{ ...dividerStyle, margin: "12px 0" }}></div>

              {/* Break-even pill */}
              <div style={{
                background: T.orangeDim,
                border: `1px solid ${T.orange}40`,
                color: T.orange,
                borderRadius: 6,
                padding: "8px 14px",
                fontFamily: T.mono,
                fontSize: 13,
                fontWeight: 600,
                textAlign: "center",
              }}>
                Break-even Exit: ${results.breakEvenPrice.toFixed(4)}
              </div>
            </div>
          </Card>

          {/* TP levels card */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.bright, marginBottom: 14, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Take-Profit Targets (Net of Fees)
            </div>
            
            {tpLevels.length === 0 ? (
              <div style={{ padding: "16px 10px", color: T.dim, textAlign: "center", fontSize: 13 }}>
                Set entry price + stop loss to calculate targets
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Level</th>
                      <th style={tableHeaderStyle}>Target Price</th>
                      <th style={tableHeaderStyle}>Net P&L</th>
                      <th style={tableHeaderStyle}>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tpLevels.map((tp, idx) => {
                      // TP tags styling
                      const tagStyles = [
                        { background: `${T.blue}20`, color: T.blue },
                        { background: `${T.green}20`, color: T.green },
                        { background: `${T.orange}20`, color: T.orange },
                        { background: `${T.purple || "#a855f7"}20`, color: T.purple || "#a855f7" }
                      ];
                      const tagStyle = tagStyles[idx] || tagStyles[0];

                      return (
                        <tr key={idx}>
                          <td style={tableCellStyle}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: tagStyle.background,
                              color: tagStyle.color,
                              display: "inline-block",
                              fontFamily: T.sans,
                              letterSpacing: 0.5,
                            }}>
                              {tp.label} · {tp.rMultiple}R
                            </span>
                          </td>
                          <td style={{ ...tableCellStyle, color: T.bright }}>
                            ${tp.targetPrice.toFixed(4)}
                          </td>
                          <td style={{ ...tableCellStyle, color: tp.netPnl >= 0 ? T.green : T.red, fontWeight: 600 }}>
                            {fmt$(tp.netPnl)}
                          </td>
                          <td style={{ ...tableCellStyle, color: tp.roi >= 0 ? T.green : T.red, fontWeight: 600 }}>
                            {tp.roi >= 0 ? "+" : ""}{tp.roi.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Reference standard rates cheat-sheet */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.bright, marginBottom: 14, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Standard Reference Rates
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Exchange</th>
                    <th style={tableHeaderStyle}>Type</th>
                    <th style={tableHeaderStyle}>Maker</th>
                    <th style={tableHeaderStyle}>Taker</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...tableCellStyle, color: T.blue, fontWeight: 600 }}>Binance</td>
                    <td style={{ ...tableCellStyle, color: T.dim }}>Spot</td>
                    <td style={{ ...tableCellStyle, color: T.green }}>{(FEE_RATES.binance.spot.maker * 100).toFixed(2)}%</td>
                    <td style={{ ...tableCellStyle, color: T.orange }}>{(FEE_RATES.binance.spot.taker * 100).toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td style={{ ...tableCellStyle, color: T.blue, fontWeight: 600 }}>Binance</td>
                    <td style={{ ...tableCellStyle, color: T.dim }}>Futures</td>
                    <td style={{ ...tableCellStyle, color: T.green }}>{(FEE_RATES.binance.futures.maker * 100).toFixed(2)}%</td>
                    <td style={{ ...tableCellStyle, color: T.orange }}>{(FEE_RATES.binance.futures.taker * 100).toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td style={{ ...tableCellStyle, color: T.green, fontWeight: 600 }}>Bitget</td>
                    <td style={{ ...tableCellStyle, color: T.dim }}>Spot</td>
                    <td style={{ ...tableCellStyle, color: T.green }}>{(FEE_RATES.bitget.spot.maker * 100).toFixed(2)}%</td>
                    <td style={{ ...tableCellStyle, color: T.orange }}>{(FEE_RATES.bitget.spot.taker * 100).toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td style={{ ...tableCellStyle, color: T.green, fontWeight: 600 }}>Bitget</td>
                    <td style={{ ...tableCellStyle, color: T.dim }}>Futures</td>
                    <td style={{ ...tableCellStyle, color: T.green }}>{(FEE_RATES.bitget.futures.maker * 100).toFixed(2)}%</td>
                    <td style={{ ...tableCellStyle, color: T.orange }}>{(FEE_RATES.bitget.futures.taker * 100).toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ ...tableCellStyle, color: T.dim }}>BNB Discount</td>
                    <td colSpan={2} style={{ ...tableCellStyle, color: T.orange, fontWeight: 600 }}>-25% on Binance</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

        </div>

      </div>
    </div>
  );
}
