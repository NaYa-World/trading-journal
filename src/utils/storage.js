// ─── Storage Encryption Wrapper ──────────────────────────────────────────────
let encryptFn = (v) => v;
let decryptFn = (v) => v;

export const setStorageEncryption = (encrypt, decrypt) => {
  encryptFn = encrypt;
  decryptFn = decrypt;
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
export const _load = (key, fb) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fb;
    const decrypted = decryptFn(raw);
    if (!decrypted) return fb;
    return JSON.parse(decrypted) ?? fb;
  } catch (e) {
    console.error("Storage load failed for key:", key, e);
    return fb;
  }
};

export const _save = (key, v) => {
  try {
    const json = JSON.stringify(v);
    const encrypted = encryptFn(json);
    localStorage.setItem(key, encrypted);
  } catch (e) {
    console.error("Storage save failed for key:", key, e);
  }
};

// ─── Trade storage ────────────────────────────────────────────────────────────
export const loadTrades = () => _load(STORAGE_KEY, []);
export const saveTrades = (t) => _save(STORAGE_KEY, t);
export const loadSpotOpen = () => _load(SPOT_OPEN_KEY, []);
export const saveSpotOpen = (t) => _save(SPOT_OPEN_KEY, t);
export const loadLiveTrades = () => _load(LIVE_KEY, []);
export const saveLiveTrades = (t) => _save(LIVE_KEY, t);

// ─── Settings storage ─────────────────────────────────────────────────────────
export const loadSavedSymbols = () => _load(SYMBOLS_KEY, []);
export const saveSavedSymbols = (s) => _save(SYMBOLS_KEY, s);
export const loadTradeSetups = () => _load(TRADE_SETUPS_KEY, []);
export const saveTradeSetups = (s) => _save(TRADE_SETUPS_KEY, s);
export const ALERTS_KEY = "cj_alerts_v1";
export const loadAlerts = () => _load(ALERTS_KEY, []);
export const saveAlerts = (a) => _save(ALERTS_KEY, a);
export const loadCapital = () => _load(CAPITAL_KEY, 0);
export const saveCapital = (n) => _save(CAPITAL_KEY, n);

// ─── Profile storage ──────────────────────────────────────────────────────────
export const loadProfiles = () => _load(PROFILES_KEY, [{ id: "default", name: "Main Account", color: "#6366f1", emoji: "💼" }]);
export const saveProfiles = (p) => _save(PROFILES_KEY, p);

// Active profile is simple string metadata, doesn't need heavy encryption but we can encrypt it anyway for completeness
export const loadActiveProfile = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (!raw) return "default";
    return decryptFn(raw) || "default";
  } catch {
    return "default";
  }
};
export const saveActiveProfile = (id) => {
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, encryptFn(id));
  } catch (e) {
    console.warn("Failed to save active profile:", e);
  }
};

// ─── Theme storage (Theme is not sensitive, so we don't encrypt it) ────────────
export const loadTheme = () => localStorage.getItem(THEME_KEY) || "oceanBlue";
export const saveThemePref = (t) => localStorage.setItem(THEME_KEY, t);

// ─── Review & API key storage ─────────────────────────────────────────────────
export const loadReviews = () => _load(REVIEWS_KEY, {});
export const saveReviews = (r) => _save(REVIEWS_KEY, r);
export const loadApiKeys = () => _load(API_KEYS_KEY, { apiKey: "", apiSecret: "" });
export const saveApiKeys = (k) => _save(API_KEYS_KEY, k);

// ─── deposits and withdrawals storage ─────────────────────────────────────────
export const loadOtherDeposits = () => _load("cj_other_deposits_v1", {});
export const saveOtherDeposits = (d) => _save("cj_other_deposits_v1", d);
export const loadWithdrawalsMap = () => _load("cj_withdrawals_map_v1", {});
export const saveWithdrawalsMap = (w) => _save("cj_withdrawals_map_v1", w);
