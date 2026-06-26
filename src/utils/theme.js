// ─── Theme ────────────────────────────────────────────────────────────────────
export const DARK = {
  bg: "#0b0f1a", panel: "#131927", panel2: "#1a2236",
  border: "#1e2d45", border2: "#253548",
  green: "#00d4a3", greenDim: "#00d4a318",
  red: "#ff4d79", redDim: "#ff4d7918",
  blue: "#6366f1", blueDim: "#6366f118",
  orange: "#f97316", orangeDim: "#f9731618",
  yellow: "#eab308", cyan: "#22d3ee", purple: "#a855f7",
  text: "#cbd5e1", dim: "#8b9bb4", bright: "#f1f5f9",
  mono: "'JetBrains Mono', 'Fira Code', monospace", sans: "'DM Sans', sans-serif",
};

export const LIGHT = {
  bg: "#f0f4f8", panel: "#ffffff", panel2: "#f8fafc",
  border: "#e2e8f0", border2: "#cbd5e1",
  green: "#059669", greenDim: "#05966914",
  red: "#e11d48", redDim: "#e11d4814",
  blue: "#4f46e5", blueDim: "#4f46e514",
  orange: "#ea580c", orangeDim: "#ea580c14",
  yellow: "#ca8a04", cyan: "#0891b2", purple: "#7c3aed",
  text: "#334155", dim: "#64748b", bright: "#0f172a",
  mono: "'JetBrains Mono', 'Fira Code', monospace", sans: "'DM Sans', sans-serif",
};

// Mutable singleton used by all components
export let T = { ...DARK };

export function applyTheme(isDark) {
  const src = isDark ? DARK : LIGHT;
  Object.assign(T, src);
}
