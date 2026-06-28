import { useState } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { fmtDate } from "../../utils/helpers.js";

export default function CSVImportModal() {
  const { importTrades, setShowCSVModal, activeProfileId, T } = useDashboard();
  const [step, setStep] = useState("upload");
  const [rows, setRows] = useState([]);
  const [exchange, setExchange] = useState("Binance");
  const [importTradeType, setImportTradeType] = useState("Spot");
  const [error, setError] = useState("");
  const [previewTrades, setPreviewTrades] = useState([]);

  const onImport = importTrades;
  const onClose = () => setShowCSVModal(false);
  const profileId = activeProfileId;

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      // Handle quoted fields with commas inside
      const vals = [];
      let cur = "", inQ = false;
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      vals.push(cur.trim());
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || "").replace(/^"|"$/g, "")]));
    }).filter(r => Object.values(r).some(v => v));
  };

  const mapRow = (row) => {
    const entryTypeRaw = (row["Entry Type"] || row["entry_type"] || row["Type"] || row["type"] || "").trim().toLowerCase();
    const isDeposit = entryTypeRaw.includes("deposit") || (row["Symbol"] && row["Symbol"].toLowerCase().includes("deposit")) || (row["Coin"] && row["Coin"].toLowerCase().includes("deposit")) || (row["entryType"] && row["entryType"].toLowerCase().includes("deposit"));
    const isWithdrawal = entryTypeRaw.includes("withdrawal") || entryTypeRaw.includes("withdraw") || (row["Symbol"] && row["Symbol"].toLowerCase().includes("withdrawal")) || (row["Coin"] && row["Coin"].toLowerCase().includes("withdrawal")) || (row["entryType"] && row["entryType"].toLowerCase().includes("withdrawal"));

    if (isDeposit || isWithdrawal) {
      const amt = parseFloat(row["Quantity"] || row["Qty"] || row["Amount"] || row["Executed"] || row["Account Balance"] || row["pnl"] || row["PnL"] || "0");
      const dateStr = row["Date"] || row["Time"] || row["Close Time"] || row["CloseTime"] || row["OpenTime"] || row["date"] || row["timestamp"] || "";
      const openTime = dateStr ? new Date(dateStr).getTime() : Date.now();
      const notes = row["Notes"] || row["Reason to open and close"] || row["Reason"] || row["notes"] || "";
      const entryType = isDeposit ? "Deposit" : "Withdrawal";
      const originalId = parseFloat(row["ID"] || row["id"]);
      const finalId = isNaN(originalId) ? (Date.now() + Math.random()) : originalId;

      return {
        id: finalId,
        entryType,
        symbol: entryType,
        tradeType: entryType,
        qty: amt,
        pnl: isDeposit ? amt : -amt,
        fees: 0,
        openTime,
        closeTime: openTime,
        status: "closed",
        notes,
        closeReason: notes || "",
        profileId: profileId || "default",
      };
    }

    // Auto-detect columns across Binance, Bybit, Bitget, Excel/Google Sheets custom exports
    const symbol = (row["Pair"] || row["Symbol"] || row["symbol"] || row["Asset"] || row["Coin"] || "").replace(/[^A-Z]/g, "").toUpperCase();
    const sideRaw = (row["Side"] || row["side"] || row["Type"] || row["Direction"] || "buy").toLowerCase();
    const actionRaw = (row["Action"] || row["action"] || "").trim();
    const side = sideRaw.includes("buy") || sideRaw.includes("long") ? "Long" : (sideRaw.includes("sell") || sideRaw.includes("short") ? "Short" : (actionRaw.toLowerCase().includes("buy") || actionRaw.toLowerCase().includes("long") ? "Long" : "Short"));

    const rowType = (row["Trade Type"] || row["tradeType"] || row["trade_type"] || row["Type"] || "").trim();
    let detectedType = importTradeType;
    if (rowType.toLowerCase().includes("spot")) detectedType = "Spot";
    else if (rowType.toLowerCase().includes("future") || rowType.toLowerCase().includes("swap")) detectedType = "Futures";
    else if (rowType.toLowerCase().includes("margin")) detectedType = "Margin";

    const action = actionRaw || (detectedType === "Spot" ? (side === "Long" ? "Buy" : "Sell") : side);

    const entry = parseFloat(row["Price"] || row["Avg Price"] || row["Buy Price"] || row["Entry"] || row["entry_price"] || "0");
    const exitStr = row["Exit Price"] || row["Sell Price"] || row["exit_price"] || row["Close Price"] || row["Exit"] || "";
    const exit = parseFloat(exitStr);

    const statusRaw = (row["Status"] || row["status"] || "").trim().toLowerCase();
    const isOpen = statusRaw ? (statusRaw === "open" || statusRaw === "spot_open" || statusRaw === "live") : (isNaN(exit) || exit === 0 || exitStr.trim() === "");
    const finalExit = isOpen ? null : exit;

    const qty = parseFloat(row["Executed"] || row["Qty"] || row["Quantity"] || row["Amount"] || row["qty"] || row["Size"] || "0");
    let fees = -Math.abs(parseFloat(row["Fee"] || row["Fees"] || row["Commission"] || row["fee"] || "0"));

    if (fees === 0 && entry > 0 && qty > 0) {
      let f = entry * qty * 0.0006;
      if (!isOpen && finalExit > 0) f += finalExit * qty * 0.0006;
      fees = -f;
    }

    const pnlRaw = parseFloat(row["PnL"] || row["Profit"] || row["Realized P&L"] || row["pnl"] || "0");
    const dateStr = row["Date"] || row["Time"] || row["Close Time"] || row["CloseTime"] || row["OpenTime"] || row["date"] || row["timestamp"] || "";
    const openTime = dateStr ? new Date(dateStr).getTime() : Date.now();
    
    // Support CloseTime column
    const closeTimeStr = row["CloseTime"] || row["Close Time"] || row["closeTime"] || row["close_time"] || "";
    const closeTime = isOpen ? null : (closeTimeStr ? new Date(closeTimeStr).getTime() : openTime);

    if (!symbol || isNaN(entry) || isNaN(qty) || qty === 0) return null;

    const pnl = pnlRaw !== 0 ? pnlRaw : (!isOpen && finalExit !== entry ? (finalExit - entry) * qty * (side === "Long" ? 1 : -1) : 0);

    const leverage = parseFloat(row["Leverage"] || row["leverage"] || row["Lev"] || "1") || 1;
    const stopLoss = parseFloat(row["Stop Loss"] || row["stopLoss"] || row["SL"] || row["STOPLOSS PRICE"] || row["StopLoss"] || "0") || null;
    const takeProfit = parseFloat(row["Take Profit"] || row["takeProfit"] || row["TP"] || row["TAKE PROFIT PRICE"] || row["TakeProfit"] || "0") || null;
    const notes = row["Notes"] || row["Reason to open and close"] || row["Reason"] || row["notes"] || `Imported from ${exchange}`;
    const tags = row["Tags"] ? row["Tags"].split(";") : ["Imported"];
    const originalId = parseFloat(row["ID"] || row["id"]);
    const finalId = isNaN(originalId) ? (Date.now() + Math.random()) : originalId;

    return {
      id: finalId, symbol, side, action,
      tradeType: detectedType, market: "Crypto",
      displayType: detectedType === "Spot" ? `Spot ${action}` : `${detectedType} ${side}`,
      entry,
      exit: isOpen ? null : finalExit,
      qty, fees,
      usdtRate: 1,
      leverage,
      stopLoss,
      takeProfit,
      pnl: isOpen ? null : parseFloat(pnl.toFixed(2)),
      openTime,
      closeTime,
      status: isOpen ? (detectedType === "Spot" ? "spot_open" : "live") : "closed",
      setup: row["Setup"] || "BREAKOUT",
      closeReason: isOpen ? "" : (row["CloseReason"] || "Imported"),
      tags,
      notes,
      profileId: profileId || "default",
    };
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        setRows(parsed);
        const mapped = parsed.map(mapRow).filter(Boolean);
        if (!mapped.length) { setError("No valid rows found. Make sure columns include Symbol, Price, Quantity (and optionally Side, Date, Fee)."); return; }
        setPreviewTrades(mapped);
        setError("");
        setStep("preview");
      } catch { setError("Failed to parse file. Ensure it's saved as CSV (comma-separated)."); }
    };
    reader.readAsText(file);
  };

  const confirm = () => { onImport(previewTrades); setStep("done"); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, width: "min(620px,95vw)", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright, letterSpacing: 1 }}>IMPORT CSV</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>

        {step === "upload" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Exchange Format</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Binance", "Bybit", "Bitget"].map(ex => (
                  <button key={ex} onClick={() => setExchange(ex)} style={{ flex: 1, background: exchange === ex ? T.blueDim : T.panel2, border: `1px solid ${exchange === ex ? T.blue + "60" : T.border}`, color: exchange === ex ? T.blue : T.dim, borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>{ex}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Default Trade Type</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Spot", "Futures"].map(type => (
                  <button key={type} onClick={() => setImportTradeType(type)} style={{ flex: 1, background: importTradeType === type ? T.blueDim : T.panel2, border: `1px solid ${importTradeType === type ? T.blue + "60" : T.border}`, color: importTradeType === type ? T.blue : T.dim, borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>{type}</button>
                ))}
              </div>
            </div>
            <div style={{ background: T.panel2, border: `2px dashed ${T.border2}`, borderRadius: 10, padding: "32px 20px", textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>📂</div>
              <div style={{ fontSize: 15, color: T.text, marginBottom: 6 }}>Drop your {exchange} trade history CSV here</div>
              <div style={{ fontSize: 13, color: T.dim, marginBottom: 16 }}>
                {exchange === "Binance" ? "Export from: Orders → Trade History → Export" : exchange === "Bybit" ? "Export from: Assets → Trade History → Export" : "Export from: Orders → Futures/Spot Trade History"}
              </div>
              <label style={{ background: T.blueDim, border: `1px solid ${T.blue}50`, color: T.blue, borderRadius: 7, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>
                Choose File <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
              </label>
            </div>
            {error && <div style={{ color: T.red, fontSize: 14, fontFamily: T.mono, background: T.redDim, border: `1px solid ${T.red}30`, borderRadius: 6, padding: "8px 12px" }}>{error}</div>}
            <div style={{ fontSize: 13, color: T.dim, marginTop: 12, lineHeight: 1.7 }}>
              ⚠ PnL will be 0 for imported trades since CSV exports don't include realized PnL per-trade. You can edit each trade manually after import.
            </div>
          </>
        )}

        {step === "preview" && (
          <>
            <div style={{ background: T.greenDim, border: `1px solid ${T.green}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 14, color: T.green, fontFamily: T.mono }}>
              ✓ {previewTrades.length} trades parsed from {rows.length} rows. Note: Leverage defaults to 1x for Futures/Margin trades if not specified in CSV.
            </div>
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Symbol", "Side", "Entry", "Qty", "Fees", "Date"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: T.dim, fontWeight: 700, letterSpacing: 1 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {previewTrades.slice(0, 10).map((t, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border}20` }}>
                      <td style={{ padding: "6px 10px", fontFamily: T.mono, color: T.bright }}>{t.symbol}</td>
                      <td style={{ padding: "6px 10px" }}><span style={{ color: t.side === "Long" ? T.green : (t.side === "Short" ? T.red : T.text), fontFamily: T.mono, fontSize: 12 }}>{t.side || "—"}</span></td>
                      <td style={{ padding: "6px 10px", fontFamily: T.mono, color: T.text }}>{t.entry !== undefined ? t.entry.toFixed(4) : "—"}</td>
                      <td style={{ padding: "6px 10px", fontFamily: T.mono, color: T.text }}>{t.qty}</td>
                      <td style={{ padding: "6px 10px", fontFamily: T.mono, color: T.red }}>{(t.fees || 0).toFixed(4)}</td>
                      <td style={{ padding: "6px 10px", color: T.dim }}>{fmtDate(t.openTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewTrades.length > 10 && <div style={{ fontSize: 13, color: T.dim, padding: "8px 10px", fontFamily: T.mono }}>... and {previewTrades.length - 10} more</div>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setStep("upload")} style={{ background: "transparent", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontFamily: T.mono }}>Back</button>
              <button onClick={confirm} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>Import {previewTrades.length} Trades</button>
            </div>
          </>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, color: T.green, marginBottom: 8 }}>Import complete</div>
            <div style={{ fontSize: 14, color: T.dim, marginBottom: 20 }}>{previewTrades.length} trades imported successfully</div>
            <button onClick={onClose} style={{ background: T.blue, border: "none", color: "#fff", borderRadius: 7, padding: "9px 22px", cursor: "pointer", fontSize: 14, fontFamily: T.mono, fontWeight: 700 }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
