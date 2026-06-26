import { T } from "../../utils/theme.js";
import { NAV_ITEMS } from "../../utils/constants.js";

// Mapping of view IDs to short mobile labels and updated emojis
const LABEL_MAP = {
  "Dashboard": "Home",
  "Open Spot Trades": "Spot",
  "Live Trades(ongoing)": "Live",
  "Finished Trades": "Log",
  "Watchlist": "Watch",
  "Alerts": "Alerts"
};

const ICON_MAP = {
  "Dashboard": "⊞",
  "Open Spot Trades": "🪙",
  "Live Trades(ongoing)": "◎",
  "Finished Trades": "◷",
  "Watchlist": "⬡",
  "Alerts": "🔔"
};

export default function BottomNav({ view, setView, spotOpenCount, alertsCount }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      background: T.panel,
      borderTop: `1px solid ${T.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      zIndex: 1000,
      boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.4)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)"
    }}>
      {NAV_ITEMS.map(n => {
        const isActive = view === n.id;
        const label = LABEL_MAP[n.id] || n.id;
        const icon = ICON_MAP[n.id] || n.icon;
        
        let badge = null;
        if (n.id === "Open Spot Trades" && spotOpenCount > 0) {
          badge = spotOpenCount;
        } else if (n.id === "Alerts" && alertsCount > 0) {
          badge = alertsCount;
        }

        return (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              background: "none",
              border: "none",
              color: isActive ? T.blue : T.dim,
              cursor: "pointer",
              padding: "10px 12px",
              minHeight: 48,
              flex: 1,
              position: "relative",
              outline: "none",
              transition: "color 0.2s"
            }}
          >
            {/* Icon */}
            <span style={{ fontSize: 18, position: "relative" }}>
              {icon}
              {badge !== null && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -10,
                  background: n.id === "Alerts" ? T.blue : T.orange,
                  color: "#000",
                  borderRadius: 8,
                  padding: "1px 5px",
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: T.mono,
                  lineHeight: 1
                }}>
                  {badge}
                </span>
              )}
            </span>

            {/* Label */}
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: 0.3
            }}>
              {label}
            </span>

            {/* Micro-indicator dot under active item */}
            {isActive && (
              <span style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: T.blue,
                marginTop: 1,
                boxShadow: `0 0 4px ${T.blue}`
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
