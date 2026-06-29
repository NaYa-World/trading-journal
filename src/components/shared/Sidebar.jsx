import { T } from "../../utils/theme.js";
import { NAV_ITEMS } from "../../utils/constants.js";

export default function Sidebar({ view, setView, onClear, tradeCount, spotOpenCount, profiles, activeProfileId, onOpenProfiles }) {
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  return (
    <div style={{ width: 220, background: T.panel, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", minHeight: "100vh", flexShrink: 0 }}>
      {/* Profile switcher */}
      <div style={{ padding: "14px 12px", borderBottom: `1px solid ${T.border}` }}>
        <button onClick={onOpenProfiles} style={{ display: "flex", alignItems: "center", gap: 8, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 11px", width: "100%", cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: activeProfile.color + "20", border: `1px solid ${activeProfile.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{activeProfile.emoji}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.bright, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeProfile.name}</div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{tradeCount} trades</div>
          </div>
          <span style={{ color: T.dim, fontSize: 12 }}>▾</span>
        </button>
      </div>

      {/* Nav */}
      <div style={{ padding: "10px 8px", flex: 1 }}>
        {NAV_ITEMS.map(n => {
          const badge = n.id === "Open Spot Trades" && spotOpenCount > 0 ? spotOpenCount : null;
          return (
            <button key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 11px", borderRadius: 8, marginBottom: 2, background: view === n.id ? T.blueDim : "none", border: view === n.id ? `1px solid ${T.blue}35` : "1px solid transparent", color: view === n.id ? T.bright : T.dim, cursor: "pointer", fontSize: 15, fontWeight: view === n.id ? 600 : 400, transition: "all .15s", textAlign: "left" }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.id}</span>
              {badge && <span style={{ background: T.orange, color: "#000", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700, fontFamily: T.mono }}>{badge}</span>}
            </button>
          );
        })}
      </div>

      {/* Bottom */}
      <div style={{ padding: "12px 8px", borderTop: `1px solid ${T.border}` }}>
        <button onClick={onClear} style={{ width: "100%", background: "none", border: `1px solid ${T.border}`, color: T.dim, borderRadius: 6, padding: "7px 0", cursor: "pointer", fontSize: 12, fontFamily: T.mono, letterSpacing: 0.5 }}>⚠ Clear All Data</button>
      </div>
    </div>
  );
}
