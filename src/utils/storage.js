import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import CryptoJS from 'crypto-js';

// ─── Storage Encryption Wrapper ──────────────────────────────────────────────
let aesKey = null;
let storageCorrupted = false; // Prevents overwriting if decryption fails

export const setStorageKey = (key) => {
  aesKey = key;
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
      } catch (e) {
        // File might not exist yet
        return fb;
      }
    } else {
      raw = localStorage.getItem(key);
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
      } catch (err) {
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
      localStorage.setItem(key, json);
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
  const loaded = await _load(STORAGE_KEY, []);
  if (loaded.length === 0) return DEMO_TRADES;
  return loaded;
};
export const saveTrades = (t) => _save(STORAGE_KEY, t);
export const loadSpotOpen = async () => await _load(SPOT_OPEN_KEY, []);
export const saveSpotOpen = (t) => _save(SPOT_OPEN_KEY, t);
export const loadLiveTrades = async () => await _load(LIVE_KEY, []);
export const saveLiveTrades = (t) => _save(LIVE_KEY, t);

// ─── Settings storage ─────────────────────────────────────────────────────────
export const loadSavedSymbols = async () => await _load(SYMBOLS_KEY, []);
export const saveSavedSymbols = (s) => _save(SYMBOLS_KEY, s);

const DEMO_SETUPS = [
  {
    id: "setup_1",
    name: "XAUUSD Liquidity Sweep",
    type: "Reversal",
    typeColor: "#3b82f6", // T.blue
    rulesCount: 6,
    rules: ["Wait for sweep", "Fair Value Gap", "RSI divergence", "Check HTF", "Volume spike", "Confirm close"],
    image: "/demo_setup_1.svg",
    timestamp: "5d ago"
  },
  {
    id: "setup_2",
    name: "Opening Range Breakout",
    type: "Breakout",
    typeColor: "#a855f7", // T.purple
    rulesCount: 5,
    rules: ["15m chart", "Mark ORB", "Candle close outside", "Check volume", "Target 1:2"],
    image: "/demo_setup_2.svg",
    timestamp: "5d ago"
  }
];

export const loadTradeSetups = async () => {
  const loaded = await _load(TRADE_SETUPS_KEY, []);
  if (loaded.length === 0) return DEMO_SETUPS;
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
