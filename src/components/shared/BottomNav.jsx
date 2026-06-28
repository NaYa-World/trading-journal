import { T } from "../../utils/theme.js";
import { useDashboard } from "../../context/DashboardContext.jsx";

// We'll define the mobile nav items directly here instead of using the generic NAV_ITEMS
const MOBILE_TABS = [
  { id: "Dashboard", label: "Home", icon: "⌘" },
  { id: "Journal", label: "Journal", icon: "📖" },
  { id: "Trade", label: "Trade", isCenter: true },
  { id: "Setup", label: "Setup", icon: "✔" },
  { id: "Analytics", label: "Analytics", icon: "📈" },
  { id: "Profile", label: "Profile", icon: "👤" }
];

export default function BottomNav({ view, setView }) {
  const { activeProfile } = useDashboard();

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: 70,
      background: "#0A0914", // Deep violet matching mockup
      borderTop: `1px solid #1B172E`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 10px",
      zIndex: 1000,
      paddingBottom: "env(safe-area-inset-bottom, 0px)"
    }}>
      {MOBILE_TABS.map((tab) => {
        const isActive = view === tab.id;

        if (tab.isCenter) {
          return (
            <button
              key={tab.id}
              onClick={() => setView("Trade")} // Adjust based on how Add Trade is handled later
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                flex: 1,
                position: "relative",
                outline: "none",
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "transparent",
                border: "1px solid #3B3356",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontSize: 20,
                fontWeight: 300,
                marginBottom: 2
              }}>+</div>
              <span style={{ fontSize: 10, color: "#8C89A3", fontWeight: 500, fontFamily: T.sans }}>{tab.label}</span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              background: "none",
              border: "none",
              color: isActive ? "#FFFFFF" : "#8C89A3",
              cursor: "pointer",
              padding: "8px 0",
              flex: 1,
              outline: "none",
              transition: "color 0.2s"
            }}
          >
            {tab.id === "Profile" ? (
              <div style={{
                width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: `2px solid ${isActive ? "#FFFFFF" : "transparent"}`, background: T.panel2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14
              }}>
                {activeProfile?.avatar ? (
                  <img src={activeProfile.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span>{activeProfile?.emoji || "👤"}</span>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 22, opacity: isActive ? 1 : 0.7 }}>{tab.icon}</span>
            )}
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              fontFamily: T.sans,
            }}>
              {tab.label}
            </span>
            {isActive && tab.id !== "Profile" && (
              <div style={{ position: "absolute", bottom: -2, width: 20, height: 3, background: "#FFFFFF", borderRadius: "4px 4px 0 0" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
