// ─── Themes ───────────────────────────────────────────────────────────────────

export const THEMES = {
  oceanBlue: {
    name: "Ocean Blue", desc: "Calm & professional",
    bg: "#0A0914", panel: "#121021", panel2: "#1B172E",
    border: "#2A2440", border2: "#3B3356",
    green: "#00E096", greenDim: "#00E09618",
    red: "#FF3B69", redDim: "#FF3B6918",
    blue: "#3b82f6", blueDim: "#3b82f618",
    orange: "#f97316", orangeDim: "#f9731618",
    yellow: "#eab308", cyan: "#0891b2", purple: "#8b5cf6",
    text: "#E2E8F0", dim: "#8C89A3", bright: "#FFFFFF",
    mono: "'JetBrains Mono', 'Fira Code', monospace", sans: "'DM Sans', sans-serif",
    swatches: ["#3b82f6", "#f97316", "#eab308"]
  },
  goldenHour: {
    name: "Golden Hour", desc: "Warm, rich & cinematic",
    bg: "#18120F", panel: "#211915", panel2: "#2E241E",
    border: "#40322A", border2: "#56443A",
    green: "#10b981", greenDim: "#10b98118",
    red: "#ef4444", redDim: "#ef444418",
    blue: "#8b5cf6", blueDim: "#8b5cf618",
    orange: "#f97316", orangeDim: "#f9731618",
    yellow: "#eab308", cyan: "#06b6d4", purple: "#8b5cf6",
    text: "#fde047", dim: "#a1a1aa", bright: "#fef08a",
    mono: "'JetBrains Mono', 'Fira Code', monospace", sans: "'DM Sans', sans-serif",
    swatches: ["#eab308", "#f97316", "#8b5cf6"]
  },
  minimalist: {
    name: "Minimalist", desc: "Clean & simple",
    bg: "#111827", panel: "#1f2937", panel2: "#374151",
    border: "#4b5563", border2: "#6b7280",
    green: "#22c55e", greenDim: "#22c55e18",
    red: "#ef4444", redDim: "#ef444418",
    blue: "#3b82f6", blueDim: "#3b82f618",
    orange: "#f97316", orangeDim: "#f9731618",
    yellow: "#eab308", cyan: "#06b6d4", purple: "#a855f7",
    text: "#f3f4f6", dim: "#9ca3af", bright: "#ffffff",
    mono: "'JetBrains Mono', 'Fira Code', monospace", sans: "'DM Sans', sans-serif",
    swatches: ["#64748b", "#ef4444", "#22c55e"]
  },
  ultraDark: {
    name: "Ultra Dark", desc: "Maximum darkness, Inspired by 'Yavuz'",
    bg: "#000000", panel: "#0a0a0a", panel2: "#171717",
    border: "#262626", border2: "#404040",
    green: "#16a34a", greenDim: "#16a34a18",
    red: "#dc2626", redDim: "#dc262618",
    blue: "#2563eb", blueDim: "#2563eb18",
    orange: "#ea580c", orangeDim: "#ea580c18",
    yellow: "#ca8a04", cyan: "#0891b2", purple: "#9333ea",
    text: "#a3a3a3", dim: "#525252", bright: "#f5f5f5",
    mono: "'JetBrains Mono', 'Fira Code', monospace", sans: "'DM Sans', sans-serif",
    swatches: ["#334155", "#94a3b8", "#e2e8f0"]
  },
  ledgerPaper: {
    name: "Ledger Paper", desc: "Paper journal 2.0",
    bg: "#fdf6e3", panel: "#eee8d5", panel2: "#e5e0c8",
    border: "#ccc6b1", border2: "#b3ad99",
    green: "#15803d", greenDim: "#15803d18",
    red: "#b91c1c", redDim: "#b91c1c18",
    blue: "#1d4ed8", blueDim: "#1d4ed818",
    orange: "#c2410c", orangeDim: "#c2410c18",
    yellow: "#a16207", cyan: "#0369a1", purple: "#6d28d9",
    text: "#334155", dim: "#64748b", bright: "#0f172a",
    mono: "'JetBrains Mono', 'Fira Code', monospace", sans: "'DM Sans', sans-serif",
    swatches: ["#15803d", "#c2410c", "#475569"]
  }
};

// Mutable singleton used by all components
export let T = { ...THEMES.oceanBlue };

export function updateTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.oceanBlue;
  Object.assign(T, theme);
}
