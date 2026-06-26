// ─── Currency & Symbol Utilities ──────────────────────────────────────────────
export const STABLES = ["USDT", "USDC", "FDUSD", "TUSD", "BUSD", "DAI"];
export const QUOTES = [...STABLES, "BTC", "ETH", "BNB", "SOL", "XRP"];

export const getQuoteCurrency = (symbol) => {
  const sym = symbol.toUpperCase();
  for (const q of QUOTES) {
    if (sym.endsWith(q) && sym !== q) return q;
  }
  return "USDT";
};

// ─── API calls ────────────────────────────────────────────────────────────────
export const fetchUsdtRate = async (quoteCurrency, timestamp) => {
  if (STABLES.includes(quoteCurrency)) return 1;
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${quoteCurrency}USDT&interval=1m&startTime=${timestamp}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
      return parseFloat(data[0][1]); // Open price
    }
  } catch (e) {
    console.error("Error fetching historical rate:", e);
  }
  // Fallback to live price
  try {
    const liveRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${quoteCurrency}USDT`);
    const liveData = await liveRes.json();
    if (liveData && liveData.price) return parseFloat(liveData.price);
  } catch (e) {
    console.error("Error fetching live rate fallback:", e);
  }
  return 1;
};

// ─── Date Helpers ─────────────────────────────────────────────────────────────
export const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "2-digit" });

export const fmtDateShort = (ts) =>
  new Date(ts).toLocaleDateString("en-IN", { month: "numeric", day: "numeric" });

export const formatMaskedDate = (date) => {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export const parseMaskedDate = (str) => {
  const d = str.replace(/[^\d]/g, "");
  if (d.length !== 12) return Date.now();
  return new Date(`${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}T${d.slice(8, 10)}:${d.slice(10, 12)}`).getTime();
};

// ─── Formatting ───────────────────────────────────────────────────────────────
export const fmt$ = (n) => {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n > 0 ? `+${abs} USDT` : n < 0 ? `-${abs} USDT` : `${abs} USDT`;
};
export const fmtPnl = fmt$;

export const getOrdinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const sequenceTransactions = (trades) => {
  const sorted = [...trades].sort((a, b) => a.closeTime - b.closeTime);
  let depositCount = 0;
  let withdrawalCount = 0;
  return sorted.map(t => {
    const isDeposit = t.entryType === "Deposit" || t.symbol === "Deposit";
    const isWithdrawal = t.entryType === "Withdrawal" || t.symbol === "Withdrawal";
    if (isDeposit) {
      depositCount++;
      return { ...t, closeReason: `${getOrdinal(depositCount)} deposit` };
    }
    if (isWithdrawal) {
      withdrawalCount++;
      return { ...t, closeReason: `${getOrdinal(withdrawalCount)} withdrawal` };
    }
    return t;
  });
};


