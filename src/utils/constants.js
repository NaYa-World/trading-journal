// ─── Static Constants ─────────────────────────────────────────────────────────
export const SETUPS = ["BREAKOUT", "FOMO", "RSI CROSSED", "REVERSAL", "BU-OB", "LTF CONFIRM", "VWAP", "DCA"];
export const MISTAKES = ["None", "FOMO", "Revenge Trade", "Broke Rules", "Moved SL", "Overleveraged", "Averaged Down", "Too Early", "Too Late", "Overtraded"];
export const CLOSE_REASONS = ["Target Hit", "Manually Closed", "Stopped Out"];
export const SIDES = ["Long", "Short"];
export const EXCHANGES = ["Binance", "Bitget"];
export const CRYPTO_TRADE_TYPES = ["Spot", "Margin", "Futures"];
export const DEFAULT_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT",
];
export const DEFAULT_PROFILES = [
  { id: "default", name: "Main Account", color: "#6366f1", emoji: "💼" },
];

export const NAV_ITEMS = [
  { id: "Dashboard", icon: "⊞" },
  { id: "Dashboard-2", icon: "✨" },
  { id: "Open Spot Trades", icon: "🪙" },
  { id: "Live Trades(ongoing)", icon: "◎" },
  { id: "Finished Trades", icon: "◷" },
  { id: "Watchlist", icon: "⬡" },
  { id: "Alerts", icon: "◻" },
  { id: "Analytics", icon: "📊" },
  { id: "Setup", icon: "🛠" },
];
