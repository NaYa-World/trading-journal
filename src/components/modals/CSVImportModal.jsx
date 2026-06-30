import { useState, useRef, useMemo, useCallback } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { createTrade } from "../../utils/tradeFactory.js";
import { getQuoteCurrency } from "../../utils/helpers.js";
import { T } from "../../utils/theme.js";

// ── Robust CSV parsing ──────────────────────────────────────────────────
// Handles quoted fields containing commas/newlines (Binance & Bitget both
// quote fields with embedded commas, e.g. "1,234.50"). A naive split(",")
// silently corrupts those rows — this is why we don't use one.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && next === "\n") i++;
        row.push(field); field = "";
        if (row.some(f => f.trim() !== "")) rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], rows: [] };
  return { headers: rows[0].map(h => h.trim()), rows: rows.slice(1) };
}

// ── Required fields our trade model needs, regardless of exchange ──────
const REQUIRED_FIELDS = [
  { key: "symbol", label: "Symbol", hint: "e.g. BTCUSDT" },
  { key: "side", label: "Side / Direction", hint: "Buy/Sell or Long/Short" },
  { key: "entry", label: "Entry / Buy Price", hint: "" },
  { key: "qty", label: "Quantity", hint: "" },
  { key: "openTime", label: "Open / Trade Time", hint: "" },
];
const OPTIONAL_FIELDS = [
  { key: "exit", label: "Exit / Sell Price", hint: "leave unmapped for open positions" },
  { key: "closeTime", label: "Close Time", hint: "" },
  { key: "fees", label: "Fee", hint: "" },
];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

// Best-effort auto-guess so the user usually just confirms, doesn't fill
// 8 dropdowns from scratch. Pure convenience — never trusted blindly.
function guessMapping(headers) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const guesses = {};
  const patterns = {
    symbol: ["symbol", "pair", "market", "instrument"],
    side: ["side", "type", "direction", "buysell"],
    entry: ["price", "executedprice", "avgprice", "entryprice"],
    exit: ["exitprice", "closeprice", "sellprice"],
    qty: ["quantity", "amount", "executedqty", "filledqty", "qty", "size"],
    openTime: ["date", "time", "datetime", "createtime", "opentime", "tradetime"],
    closeTime: ["closetime", "closedate"],
    fees: ["fee", "fees", "commission"],
  };
  for (const field of ALL_FIELDS) {
    const candidates = patterns[field.key] || [];
    const match = headers.find(h => candidates.includes(norm(h)));
    if (match) guesses[field.key] = match;
  }
  return guesses;
}

// localStorage key — keyed by the exact header signature so a saved
// mapping is only reused when the file shape actually matches. If the
// exchange changes their CSV columns, the old mapping won't silently
// misapply to the new shape.
function mappingStorageKey(headers) {
  return `csvMapping_${headers.join("|")}`;
}

function cryptoId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseDate(raw) {
  if (!raw) return NaN;
  const t = Date.parse(raw);
  if (!isNaN(t)) return t;
  // Fallback: epoch milliseconds, as some exchange exports use raw timestamps
  const n = Number(raw);
  if (!isNaN(n) && n > 1e10) return n;
  if (!isNaN(n) && n > 1e9) return n * 1000;
  return NaN;
}

function isLongSide(raw) {
  const s = (raw || "").toString().trim().toLowerCase();
  return ["buy", "long", "b"].includes(s);
}

export default function CSVImportModal({ onClose }) {
  const { allTrades, addTrade, addSpotOpen, savedSymbols, saveSymbol, activeProfileId } = useDashboard();
  const profileId = activeProfileId;

  const [stage, setStage] = useState("upload"); // upload | mapping | preview | importing | done
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState({});
  const [exchange, setExchange] = useState("Binance");
  const [parseError, setParseError] = useState("");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState(null); // { imported, duplicates, errors: [] }
  const fileInputRef = useRef(null);

  // ── Step 1: file selection ──────────────────────────────────────────
  const handleFile = useCallback((file) => {
    setParseError("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please select a .csv file.");
      return;
    }
    // 15MB sanity cap — guards against accidentally selecting the wrong
    // file (e.g. a full account export ZIP renamed) crashing the WebView.
    if (file.size > 15 * 1024 * 1024) {
      setParseError("File is too large (max 15MB). Export a shorter date range and try again.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setParseError("Could not read the file. It may be corrupted — try re-exporting it.");
    reader.onload = (e) => {
      try {
        const result = parseCsv(String(e.target.result));
        if (!result.headers.length || !result.rows.length) {
          setParseError("This file has no readable rows. Check it isn't empty or in an unexpected encoding.");
          return;
        }
        setParsed(result);
        setFileName(file.name);
        const key = mappingStorageKey(result.headers);
        const saved = localStorage.getItem(key);
        setMapping(saved ? JSON.parse(saved) : guessMapping(result.headers));
        setStage("mapping");
      } catch (err) {
        console.error("CSV parse failed:", err);
        setParseError("Couldn't parse this file. Make sure it's the unmodified export from your exchange.");
      }
    };
    reader.readAsText(file);
  }, []);

  // ── Step 2: mapping validation ──────────────────────────────────────
  const missingRequired = REQUIRED_FIELDS.filter(f => !mapping[f.key]);
  const mappingValid = missingRequired.length === 0;

  const confirmMapping = () => {
    if (!mappingValid) return;
    localStorage.setItem(mappingStorageKey(parsed.headers), JSON.stringify(mapping));
    setStage("preview");
  };

  // ── Step 3: build preview rows + validate each, never guess on bad data ──
  const existingSignatures = useMemo(() => {
    const set = new Set();
    for (const t of allTrades) {
      set.add(`${t.symbol}|${t.openTime}|${t.entry}|${t.qty}`);
    }
    return set;
  }, [allTrades]);

  const previewRows = useMemo(() => {
    if (!parsed) return [];
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const idx = {};
    for (const f of ALL_FIELDS) idx[f.key] = parsed.headers.indexOf(mapping[f.key]);

    return parsed.rows.map((row, i) => {
      const get = (key) => idx[key] >= 0 ? row[idx[key]] : "";
      const symbol = (get("symbol") || "").trim().toUpperCase();
      const entry = parseFloat(get("entry"));
      const qty = parseFloat(get("qty"));
      const exitRaw = get("exit");
      const exit = exitRaw ? parseFloat(exitRaw) : null;
      const openTime = parseDate(get("openTime"));
      const closeTimeRaw = get("closeTime");
      const closeTime = closeTimeRaw ? parseDate(closeTimeRaw) : null;
      const fees = Math.abs(parseFloat(get("fees")) || 0);
      const long = isLongSide(get("side"));

      const errors = [];
      if (!symbol) errors.push("missing symbol");
      if (isNaN(entry) || entry <= 0) errors.push("invalid entry price");
      if (isNaN(qty) || qty <= 0) errors.push("invalid quantity");
      if (isNaN(openTime)) errors.push("unparseable open time");
      if (openTime > now) errors.push("open time is in the future");
      if (exitRaw && (isNaN(exit) || exit <= 0)) errors.push("invalid exit price");
      if (closeTimeRaw && isNaN(closeTime)) errors.push("unparseable close time");

      const isOpen = !exitRaw; // no exit price present → treat as still-open spot position
      const signature = `${symbol}|${openTime}|${entry}|${qty}`;
      const isDuplicate = existingSignatures.has(signature);

      return {
        rowNum: i + 2, // +2: 1-indexed + header row offset, matches what user sees in their spreadsheet app
        symbol, entry, qty, exit, openTime, closeTime, fees, long, isOpen,
        signature, isDuplicate, errors, raw: row,
      };
    });
  }, [parsed, mapping, existingSignatures]);

  const validRows = previewRows.filter(r => r.errors.length === 0 && !r.isDuplicate);
  const errorRows = previewRows.filter(r => r.errors.length > 0);
  const duplicateRows = previewRows.filter(r => r.errors.length === 0 && r.isDuplicate);

  // ── Step 4: chunked, non-blocking import ──────────────────────────────
  const runImport = async () => {
    setStage("importing");
    setProgress(0);
    let imported = 0;

    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const quoteCurrency = getQuoteCurrency(r.symbol);
      if (!savedSymbols.includes(r.symbol)) saveSymbol(r.symbol);

      const base = {
        id: cryptoId(),
        symbol: r.symbol,
        tradeType: "Spot",
        exchange,
        entry: r.entry,
        qty: r.qty,
        fees: -r.fees,
        openTime: r.openTime,
        notes: "Imported from CSV",
        profileId: profileId || "default",
        quoteCurrency,
        usdtRate: 1, // best-effort; exact historical FX rate not available from CSV alone
      };

      if (r.isOpen) {
        addSpotOpen(createTrade({ ...base, action: "Buy", status: "spot_open" }));
      } else {
        const pnl = r.long ? (r.exit - r.entry) * r.qty : (r.entry - r.exit) * r.qty;
        addTrade(createTrade({
          ...base,
          action: r.long ? "Buy" : "Sell",
          side: r.long ? "Long" : "Short",
          displayType: `Spot ${r.long ? "Buy" : "Sell"}`,
          exit: r.exit,
          closeTime: r.closeTime || r.openTime,
          nativePnl: pnl,
          pnl,
          status: "closed",
          closeReason: "CSV Import",
        }));
      }
      imported++;

      // Yield to the render thread every 50 rows so the progress bar
      // actually paints and a 5,000-row file doesn't freeze the WebView.
      if (i % 50 === 0) {
        setProgress(Math.round((i / validRows.length) * 100));
        await new Promise(res => setTimeout(res, 0));
      }
    }

    setProgress(100);
    setSummary({ imported, duplicates: duplicateRows.length, errors: errorRows.length });
    setStage("done");

  };



  const LS = { fontSize: 9, color: T.dim, letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 5, marginTop: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1002, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && stage !== "importing" && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Import trades from CSV"
        style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 14, padding: 24, width: "min(720px,95vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 30px 80px #00000070" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: T.mono, fontSize: 14, color: T.bright, letterSpacing: 1.5 }}>IMPORT TRADES (CSV)</div>
          <button onClick={onClose} disabled={stage === "importing"} aria-label="Close"
            style={{ background: "none", border: "none", color: T.dim, cursor: stage === "importing" ? "not-allowed" : "pointer", fontSize: 20, opacity: stage === "importing" ? 0.4 : 1 }}>✕</button>
        </div>

        {/* ── Stage: upload ── */}
        {stage === "upload" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={LS}>Source Exchange</label>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {["Binance", "Bitget", "Other"].map(ex => (
                  <button key={ex} onClick={() => setExchange(ex)}
                    style={{ flex: 1, background: exchange === ex ? T.blueDim : T.panel2, border: `1px solid ${exchange === ex ? T.blue + "60" : T.border}`, color: exchange === ex ? T.blue : T.dim, borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
              style={{ border: `1px dashed ${T.border2}`, borderRadius: 10, padding: "40px 20px", textAlign: "center", cursor: "pointer", color: T.dim, fontFamily: T.mono, fontSize: 12 }}>
              📄 Click or drop your exchange's exported .csv file here
              <div style={{ fontSize: 10, marginTop: 8, color: T.dim }}>
                We'll ask you to confirm which columns mean what next — works with any export format.
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
              onChange={e => handleFile(e.target.files?.[0])} />

            {parseError && (
              <div style={{ background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8, padding: "10px 14px", marginTop: 14, fontSize: 12, color: T.red, fontFamily: T.mono }}>
                ⚠ {parseError}
              </div>
            )}
          </>
        )}

        {/* ── Stage: mapping ── */}
        {stage === "mapping" && parsed && (
          <>
            <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono, marginBottom: 14 }}>
              {fileName} — {parsed.rows.length} rows detected. Tell us which column is which.
            </div>
            {ALL_FIELDS.map(f => (
              <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 150, fontSize: 11, fontFamily: T.mono, color: T.text }}>
                  {f.label}{REQUIRED_FIELDS.some(r => r.key === f.key) && <span style={{ color: T.red }}> *</span>}
                </div>
                <select
                  value={mapping[f.key] || ""}
                  onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value || undefined }))}
                  style={{ flex: 1, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "6px 10px", fontSize: 12, fontFamily: T.mono }}>
                  <option value="">— not in file —</option>
                  {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}

            {!mappingValid && (
              <div style={{ fontSize: 11, color: T.orange, fontFamily: T.mono, marginTop: 10 }}>
                ⚠ Map all required fields (marked *) to continue.
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setStage("upload")} style={{ background: "none", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontFamily: T.mono }}>Back</button>
              <button onClick={confirmMapping} disabled={!mappingValid}
                style={{ background: T.blueDim, border: `1px solid ${T.blue}50`, color: T.blue, borderRadius: 6, padding: "8px 20px", cursor: mappingValid ? "pointer" : "not-allowed", opacity: mappingValid ? 1 : 0.5, fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>
                Continue → Preview
              </button>
            </div>
          </>
        )}

        {/* ── Stage: preview (nothing written yet) ── */}
        {stage === "preview" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <StatChip label="Will import" value={validRows.length} color={T.green} />
              <StatChip label="Duplicates (skipped)" value={duplicateRows.length} color={T.orange} />
              <StatChip label="Errors (skipped)" value={errorRows.length} color={T.red} />
            </div>

            {errorRows.length > 0 && (
              <div style={{ background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, maxHeight: 140, overflowY: "auto" }}>
                <div style={{ fontSize: 11, color: T.red, fontFamily: T.mono, fontWeight: 700, marginBottom: 6 }}>Rows that will be skipped:</div>
                {errorRows.slice(0, 20).map(r => (
                  <div key={r.rowNum} style={{ fontSize: 10, color: T.red, fontFamily: T.mono, opacity: 0.85 }}>
                    Row {r.rowNum}: {r.errors.join(", ")}
                  </div>
                ))}
                {errorRows.length > 20 && <div style={{ fontSize: 10, color: T.red, fontFamily: T.mono, marginTop: 4 }}>...and {errorRows.length - 20} more.</div>}
              </div>
            )}

            <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginBottom: 8 }}>Preview (first 8 of {validRows.length} rows to import):</div>
            <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: T.mono }}>
                <thead>
                  <tr style={{ background: T.panel2, textAlign: "left" }}>
                    {["Symbol", "Side", "Entry", "Exit", "Qty", "Status"].map(h => (
                      <th key={h} style={{ padding: "6px 10px", color: T.dim, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validRows.slice(0, 8).map(r => (
                    <tr key={r.signature} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "6px 10px", color: T.text }}>{r.symbol}</td>
                      <td style={{ padding: "6px 10px", color: r.long ? T.green : T.red }}>{r.long ? "Long" : "Short"}</td>
                      <td style={{ padding: "6px 10px", color: T.text }}>{r.entry}</td>
                      <td style={{ padding: "6px 10px", color: T.text }}>{r.exit ?? "—"}</td>
                      <td style={{ padding: "6px 10px", color: T.text }}>{r.qty}</td>
                      <td style={{ padding: "6px 10px", color: T.dim }}>{r.isOpen ? "Open" : "Closed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setStage("mapping")} style={{ background: "none", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontFamily: T.mono }}>Back</button>
              <button onClick={runImport} disabled={validRows.length === 0}
                style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 6, padding: "8px 20px", cursor: validRows.length ? "pointer" : "not-allowed", opacity: validRows.length ? 1 : 0.5, fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>
                Import {validRows.length} Trade{validRows.length === 1 ? "" : "s"} ↗
              </button>
            </div>
          </>
        )}

        {/* ── Stage: importing ── */}
        {stage === "importing" && (
          <div style={{ padding: "30px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: T.dim, fontFamily: T.mono, marginBottom: 14 }}>Importing trades — keep this tab open...</div>
            <div style={{ width: "100%", height: 8, background: T.panel2, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: T.green, transition: "width 0.2s ease" }} />
            </div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 8 }}>{progress}%</div>
          </div>
        )}

        {/* ── Stage: done ── */}
        {stage === "done" && summary && (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14, color: T.bright, fontFamily: T.mono, fontWeight: 700, marginBottom: 6 }}>
              Imported {summary.imported} trade{summary.imported === 1 ? "" : "s"}
            </div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>
              {summary.duplicates > 0 && `${summary.duplicates} duplicate${summary.duplicates === 1 ? "" : "s"} skipped. `}
              {summary.errors > 0 && `${summary.errors} row${summary.errors === 1 ? "" : "s"} couldn't be read.`}
            </div>
            <button onClick={onClose}
              style={{ marginTop: 18, background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 6, padding: "9px 24px", cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{ background: color + "15", border: `1px solid ${color}40`, borderRadius: 8, padding: "8px 14px", flex: "1 1 100px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "inherit" }}>{value}</div>
      <div style={{ fontSize: 9, color, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    </div>
  );
}
