import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import CryptoJS from 'crypto-js';
import localforage from 'localforage';

// ─── Storage Encryption Wrapper ──────────────────────────────────────────────
let aesKey = null;
let storageCorrupted = false; // Prevents overwriting if decryption fails

export const setStorageKey = (key) => {
  aesKey = key;
};

export const resetStorageCorrupted = () => {
  storageCorrupted = false;
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────
export const STORAGE_KEY = "cj_trades_v2";
export const SPOT_OPEN_KEY = "cj_spot_open_v2";
export const LIVE_KEY = "cj_live_v2";
export const SYMBOLS_KEY = "cj_symbols_v2";
export const CAPITAL_KEY = "cj_capital_v2";
export const PROFILES_KEY = "cj_profiles_v2";
export const ACTIVE_PROFILE_KEY = "cj_active_v2";
export const THEME_KEY = "cj_theme_v2";
export const REVIEWS_KEY = "cj_reviews_v2";
export const API_KEYS_KEY = "cj_apikeys_v2";
export const TRADE_SETUPS_KEY = "cj_trade_setups_v2";

// ─── Core storage primitives ──────────────────────────────────────────────────
export const _load = async (key, fb) => {
  try {
    let raw = null;
    
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.readFile({
          path: `${key}.crypt`,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        raw = result.data;
      } catch {
        // File might not exist yet
        return fb;
      }
    } else {
      raw = localStorage.getItem(key);
      if (raw) {
        // Legacy data found in localStorage. Migrate to localforage!
        await localforage.setItem(key, raw);
        localStorage.removeItem(key);
      } else {
        // Load normally from localforage
        raw = await localforage.getItem(key);
      }
      if (!raw) return fb;
    }

    if (Capacitor.isNativePlatform() && aesKey) {
      try {
        const bytes = CryptoJS.AES.decrypt(raw, aesKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (!decrypted) {
          storageCorrupted = true;
          return fb;
        }
        return JSON.parse(decrypted) ?? fb;
      } catch {
        console.error("Failed to decrypt native storage file for key:", key);
        storageCorrupted = true;
        return fb;
      }
    } else {
      return JSON.parse(raw) ?? fb;
    }
  } catch (e) {
    console.error("Storage load failed for key:", key, e);
    return fb;
  }
};

export const _save = async (key, v) => {
  if (storageCorrupted) {
    console.error(`Storage is in Safe Mode. Blocked saving to prevent overwriting ${key}.`);
    return;
  }
  
  try {
    const json = JSON.stringify(v);
    
    if (Capacitor.isNativePlatform() && aesKey) {
      const encrypted = CryptoJS.AES.encrypt(json, aesKey).toString();
      await Filesystem.writeFile({
        path: `${key}.crypt`,
        data: encrypted,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
    } else {
      await localforage.setItem(key, json);
    }
  } catch (e) {
    console.error("Storage save failed for key:", key, e);
  }
};

// ─── Trade storage ────────────────────────────────────────────────────────────
const DEMO_TRADES = [
  { id: "demo_dep_1", symbol: "Deposit", tradeType: "Spot", entryType: "Deposit", side: "Long", qty: 25000, entry: 1, closePrice: 1, pnl: 0, fees: 0, status: "closed", openTime: Date.now() - 30 * 24 * 3600000, closeTime: Date.now() - 30 * 24 * 3600000, profileId: "default" },
  { id: "demo_1", symbol: "BTCUSDT", tradeType: "Futures", entryType: "Breakout", side: "Long", leverage: 10, qty: 0.1, entry: 60000, closePrice: 62000, pnl: 200, fees: 5, status: "closed", openTime: Date.now() - 25 * 24 * 3600000, closeTime: Date.now() - 24 * 24 * 3600000, profileId: "default" },
  { id: "demo_2", symbol: "ETHUSDT", tradeType: "Futures", entryType: "Reversal", side: "Short", leverage: 20, qty: 1.5, entry: 3500, closePrice: 3400, pnl: 150, fees: 8, status: "closed", openTime: Date.now() - 20 * 24 * 3600000, closeTime: Date.now() - 19 * 24 * 3600000, profileId: "default" },
  { id: "demo_3", symbol: "SOLUSDT", tradeType: "Spot", entryType: "Trend", side: "Long", leverage: 1, qty: 50, entry: 120, closePrice: 110, pnl: -500, fees: 2, status: "closed", openTime: Date.now() - 15 * 24 * 3600000, closeTime: Date.now() - 10 * 24 * 3600000, profileId: "default" },
  { id: "demo_4", symbol: "DOGEUSDT", tradeType: "Futures", entryType: "Breakout", side: "Long", leverage: 5, qty: 10000, entry: 0.15, closePrice: 0.18, pnl: 300, fees: 10, status: "closed", openTime: Date.now() - 5 * 24 * 3600000, closeTime: Date.now() - 4 * 24 * 3600000, profileId: "default" },
  { id: "demo_5", symbol: "AVAXUSDT", tradeType: "Futures", entryType: "Reversal", side: "Short", leverage: 15, qty: 100, entry: 40, closePrice: 42, pnl: -200, fees: 6, status: "closed", openTime: Date.now() - 2 * 24 * 3600000, closeTime: Date.now() - 1 * 24 * 3600000, profileId: "default" },
];

export const loadTrades = async () => {
  const loaded = await _load(STORAGE_KEY, null);
  if (loaded === null) {
    const activeProfile = await loadActiveProfile();
    const pid = activeProfile || "default";
    return DEMO_TRADES.map(t => ({ ...t, profileId: pid }));
  }
  return loaded;
};
export const saveTrades = (t) => _save(STORAGE_KEY, t);
export const loadSpotOpen = async () => await _load(SPOT_OPEN_KEY, []);
export const saveSpotOpen = (t) => _save(SPOT_OPEN_KEY, t);
export const loadLiveTrades = async () => await _load(LIVE_KEY, []);
export const saveLiveTrades = (t) => _save(LIVE_KEY, t);

export const clearDemoDataIfNeeded = async () => {
  // Clear demo trades
  const loaded = await _load(STORAGE_KEY, null);
  if (loaded !== null) {
    const filtered = loaded.filter(t => !String(t.id).startsWith("demo_"));
    await _save(STORAGE_KEY, filtered);
  }

  // Clear demo setups so the user starts fresh
  const loadedSetups = await _load(TRADE_SETUPS_KEY, null);
  if (loadedSetups !== null) {
    const filteredSetups = loadedSetups.filter(s => !String(s.id).startsWith("setup_"));
    await _save(TRADE_SETUPS_KEY, filteredSetups);
  } else {
    // If they were using default demo setups, initialize as empty
    await _save(TRADE_SETUPS_KEY, []);
  }
};

// ─── Settings storage ─────────────────────────────────────────────────────────
export const loadSavedSymbols = async () => await _load(SYMBOLS_KEY, []);
export const saveSavedSymbols = (s) => _save(SYMBOLS_KEY, s);

const DEMO_SETUPS = [
  {
    id: "setup_1",
    name: "Bullish Hammer Reversal",
    type: "Reversal",
    typeColor: "#22c55e", // T.green
    rulesCount: 5,
    rules: [
      "Prior downtrend in place",
      "Hammer candle shows long lower wick (2x body)",
      "Next candle closes bullish to confirm",
      "RSI indicator is oversold (< 30)",
      "Reversal occurs on high volume"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iNTAiIHkxPSIzMCIgeDI9IjUwIiB5Mj0iOTAiIHN0cm9rZT0iIzIyYzU1ZSIgc3Ryb2tlLXdpZHRoPSI0Ii8+PHJlY3QgeD0iNDAiIHk9IjMwIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIGZpbGw9IiMyMmM1NWUiIHJ4PSIyIi8+PC9zdmc+",
    timestamp: "1d ago"
  },
  {
    id: "setup_2",
    name: "Bearish Shooting Star",
    type: "Reversal",
    typeColor: "#ef4444", // T.red
    rulesCount: 5,
    rules: [
      "Prior uptrend in place",
      "Shooting Star candle has long upper wick (2x body)",
      "RSI indicator is overbought (> 70)",
      "Entry trigger below Shooting Star low",
      "Stop Loss set above upper wick high"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4gPGxpbmUgeDE9IjUwIiB5MT0iMTAiIHgyPSI1MCIgeTI9IjcwIiBzdHJva2U9IiNlZjQ0NDQiIHN0cm9rZS13aWR0aD0iNCIvPjxyZWN0IHg9IjQwIiB5PSI1MCIgd2lkdGg9IjIwIiBlaWdodD0iMjAiIGZpbGw9IiNlZjQ0NDQiIHJ4PSIyIi8+PC9zdmc+",
    timestamp: "1d ago"
  },
  {
    id: "setup_3",
    name: "Bullish Engulfing Breakout",
    type: "Breakout",
    typeColor: "#22c55e",
    rulesCount: 4,
    rules: [
      "Prior downtrend approaching support zone",
      "Bullish body completely engulfs previous bearish body",
      "Volume spikes significantly on engulfing candle",
      "Confirm breakout above the engulfing high"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyNSIgeT0iNDAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIzMCIgZmlsbD0iI2VmNDQ0NCIgcng9IjIiLz48bGluZSB4MT0iMzIiIHkxPSIzMCIgeDI9IjMyIiB5Mj0iODAiIHN0cm9rZT0iI2VmNDQ0NCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHJlY3QgeD0iNTUiIHk9IjI1IiB3aWR0aD0iMjAiIGhlaWdodD0iNjAiIGZpbGw9IiMyMmM1NWUiIHJ4PSIyIi8+PGxpbmUgeDE9IjY1IiB5MT0iMTUiIHgyPSI2NSIgeTI9IjkwIiBzdHJva2U9IiMyMmM1NWUiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==",
    timestamp: "1d ago"
  },
  {
    id: "setup_4",
    name: "Bearish Engulfing Reversal",
    type: "Reversal",
    typeColor: "#ef4444",
    rulesCount: 4,
    rules: [
      "Prior uptrend approaching key resistance zone",
      "Bearish body completely engulfs previous bullish body",
      "Volume spikes significantly on engulfing candle",
      "Confirm breakdown below the engulfing low"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyNSIgeT0iMzUiIHdpZHRoPSIxNSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48bGluZSB4MT0iMzIiIHkxPSIyMCIgeDI9IjMyIiB5Mj0iOTAiIHN0cm9rZT0iIzIyYzU1ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHJlY3QgeD0iNTUiIHk9IjI1IiB3aWR0aD0iMjAiIGhlaWdodD0iNjAiIGZpbGw9IiNlZjQ0NDQiIHJ4PSIyIi8+PGxpbmUgeDE9IjY1IiB5MT0iMTUiIHgyPSI2NSIgeTI9IjkwIiBzdHJva2U9IiNlZjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==",
    timestamp: "1d ago"
  },
  {
    id: "setup_5",
    name: "Morning Star Bullish Reversal",
    type: "Reversal",
    typeColor: "#22c55e",
    rulesCount: 5,
    rules: [
      "Candle 1: Large bearish candle continuation",
      "Candle 2: Small body star (gaps down or lower)",
      "Candle 3: Large bullish candle closes > 50% of Candle 1",
      "Occurs on strong support level",
      "Confirm with volume spike on Candle 3"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxNSIgeT0iMjAiIHdpZHRoPSIxNSIgaGVpZ2h0PSI1MCIgZmlsbD0iI2VmNDQ0NCIgcng9IjIiLz48cmVjdCB4PSI0MiIgeT0iNjUiIHdpZHRoPSIxNSIgaGVpZ2h0PSIxNSIgZmlsbD0iIzNiODJmNiIgcng9IjIiLz48cmVjdCB4PSI3MCIgeT0iMzAiIHdpZHRoPSIxNSIgaGVpZ2h0PSI0NSIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48L3N2Zz4=",
    timestamp: "1d ago"
  },
  {
    id: "setup_6",
    name: "Evening Star Bearish Reversal",
    type: "Reversal",
    typeColor: "#ef4444",
    rulesCount: 5,
    rules: [
      "Candle 1: Large bullish candle continuation",
      "Candle 2: Small body star (gaps up or higher)",
      "Candle 3: Large bearish candle closes > 50% of Candle 1",
      "Occurs on strong resistance level",
      "Confirm with volume spike on Candle 3"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxNSIgeT0iMzAiIHdpZHRoPSIxNSIgaGVpZ2h0PSI0NSIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48cmVjdCB4PSI0MiIgeT0iMjAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIxNSIgZmlsbD0iIzNiODJmNiIgcng9IjIiLz48cmVjdCB4PSI3MCIgeT0iMzUiIHdpZHRoPSIxNSIgaGVpZ2h0PSI0NSIgZmlsbD0iI2VmNDQ0NCIgcng9IjIiLz48L3N2Zz4=",
    timestamp: "1d ago"
  },
  {
    id: "setup_7",
    name: "Doji Decision Breakout",
    type: "Breakout",
    typeColor: "#3b82f6",
    rulesCount: 4,
    rules: [
      "Price trading in consolidated narrow range",
      "Doji candle formed (open and close are nearly identical)",
      "Enter on break of Doji high (long) or low (short)",
      "Volume expansion confirms the breakout direction"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iNTAiIHkxPSIxMCIgeDI9IjUwIiB5Mj0iOTAiIHN0cm9rZT0iIzhiOTQ5ZSIgc3Ryb2tlLXdpZHRoPSI0Ii8+PGxpbmUgeDE9IjMwIiB5MT0iNTAiIHgyPSI3MCIgeTI9IjUwIiBzdHJva2U9IiM4Yjk0OWUiIHN0cm9rZT0iZDkiLz48L3N2Zz4=",
    timestamp: "1d ago"
  },
  {
    id: "setup_8",
    name: "Bullish Harami Continuation",
    type: "Continuation",
    typeColor: "#3b82f6",
    rulesCount: 4,
    rules: [
      "Downtrend slowing near major support zone",
      "Candle 1: Large bearish candle",
      "Candle 2: Small bullish candle contained inside Candle 1 body",
      "Trigger long trade when price breaks above Candle 1 high"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyMCIgaGVpZ2h0PSI2MCIgZmlsbD0iI2VmNDQ0NCIgcng9IjIiLz48cmVjdCB4PSI1NSIgeT0iNDAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIyMCIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48L3N2Zz4=",
    timestamp: "1d ago"
  },
  {
    id: "setup_9",
    name: "Bearish Harami Continuation",
    type: "Continuation",
    typeColor: "#3b82f6",
    rulesCount: 4,
    rules: [
      "Uptrend slowing near major resistance zone",
      "Candle 1: Large bullish candle",
      "Candle 2: Small bearish candle contained inside Candle 1 body",
      "Trigger short trade when price breaks below Candle 1 low"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyMCIgaGVpZ2h0PSI2MCIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48cmVjdCB4PSI1NSIgeT0iNDAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIyMCIgZmlsbD0iI2VmNDQ0NCIgIHJ4PSIyIi8+PC9zdmc+",
    timestamp: "1d ago"
  },
  {
    id: "setup_10",
    name: "Three White Soldiers",
    type: "Continuation",
    typeColor: "#22c55e",
    rulesCount: 4,
    rules: [
      "Prior downtrend bottoming out",
      "Three consecutive long-bodied green candles",
      "Each candle opens within previous body and closes near high",
      "Volume increases on each successive candle"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxNSIgeT0iNjAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIyNSIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48cmVjdCB4PSI0MiIgeT0iNDAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIzMCIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48cmVjdCB4PSI3MCIgeT0iMjAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIzNSIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48L3N2Zz4=",
    timestamp: "1d ago"
  }
];

export const loadTradeSetups = async () => {
  const loaded = await _load(TRADE_SETUPS_KEY, null);
  if (loaded === null) return DEMO_SETUPS;
  return loaded;
};
export const saveTradeSetups = (s) => _save(TRADE_SETUPS_KEY, s);

const CUSTOM_TYPES_KEY = "cj_custom_setup_types";
export const loadCustomSetupTypes = async () => await _load(CUSTOM_TYPES_KEY, []);
export const saveCustomSetupTypes = (t) => _save(CUSTOM_TYPES_KEY, t);

export const ALERTS_KEY = "cj_alerts_v1";
export const loadAlerts = async () => await _load(ALERTS_KEY, []);
export const saveAlerts = (a) => _save(ALERTS_KEY, a);
export const loadCapital = async () => await _load(CAPITAL_KEY, 0);
export const saveCapital = (n) => _save(CAPITAL_KEY, n);

// ─── Profile storage ──────────────────────────────────────────────────────────
export const loadProfiles = async () => await _load(PROFILES_KEY, [{ id: "default", name: "Main Account", color: "#6366f1", emoji: "💼" }]);
export const saveProfiles = (p) => _save(PROFILES_KEY, p);

export const loadActiveProfile = async () => {
  const loaded = await _load(ACTIVE_PROFILE_KEY, "default");
  return loaded || "default";
};
export const saveActiveProfile = (id) => _save(ACTIVE_PROFILE_KEY, id);

// ─── Theme storage (Theme is not sensitive, so we don't encrypt it) ────────────
export const loadTheme = () => localStorage.getItem(THEME_KEY) || "oceanBlue";
export const saveThemePref = (t) => localStorage.setItem(THEME_KEY, t);

// ─── Review & API key storage ─────────────────────────────────────────────────
export const loadReviews = async () => await _load(REVIEWS_KEY, {});
export const saveReviews = (r) => _save(REVIEWS_KEY, r);
export const loadApiKeys = async () => await _load(API_KEYS_KEY, {});
export const saveApiKeys = (k) => _save(API_KEYS_KEY, k);

export const loadOtherDeposits = async () => await _load("cj_other_deposits_v1", {});
export const saveOtherDeposits = (d) => _save("cj_other_deposits_v1", d);
export const loadWithdrawalsMap = async () => await _load("cj_withdrawals_map_v1", {});
export const saveWithdrawalsMap = (w) => _save("cj_withdrawals_map_v1", w);
