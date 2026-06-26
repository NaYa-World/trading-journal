import { useState } from "react";
import { useDashboard } from "../../context/DashboardContext.jsx";

export default function TopNav() {
  const {
    view,
    subTab,
    setSubTab,
    dateRange,
    setDateRange,
    isMobile,
    isDark,
    setIsDark,
    setShowCSVModal,
    setShowAddModal,
    downloadCSV,
    exportPDF,
    activeProfile,
    setShowProfiles,
    T
  } = useDashboard();

  const [showTools, setShowTools] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const tabMap = {
    Dashboard: ["Overview", "Trade Summary", "Time Metrics", "Analytics", "Calendar", "Risk Calc"],
  };
  const viewTabs = tabMap[view] || [];

  const now = new Date();

  return (
    <div style={{
      background: T.panel,
      borderBottom: `1px solid ${T.border}`,
      padding: isMobile ? "10px 12px" : "10px 18px",
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
      justifyContent: "space-between",
      minHeight: isMobile ? "auto" : 50,
      flexShrink: 0,
      gap: 10,
      width: "100%",
      boxSizing: "border-box",
      position: "relative"
    }}>
      {/* CSS style to hide scrollbars for cleaner tabs scroll */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Tabs Container */}
      <div 
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: 0,
          height: isMobile ? 40 : "100%",
          alignItems: "stretch",
          overflowX: "auto",
          overflowY: "hidden",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {viewTabs.map(t => (
          <button 
            key={t} 
            onClick={() => setSubTab(t)} 
            style={{
              background: "none", 
              border: "none",
              borderBottom: subTab === t ? `2px solid ${T.blue}` : "2px solid transparent",
              color: subTab === t ? T.bright : T.dim,
              padding: "0 12px", 
              cursor: "pointer", 
              fontSize: 14,
              fontWeight: subTab === t ? 600 : 400, 
              transition: "all .15s",
              height: "100%",
              display: "inline-flex",
              alignItems: "center"
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Controls Container */}
      <div style={{ 
        display: "flex", 
        gap: 8, 
        alignItems: "center", 
        justifyContent: isMobile ? "flex-start" : "flex-end", 
        flexShrink: 0,
        flexWrap: "wrap"
      }}>
        {/* Mobile Profile Switcher */}
        {isMobile && (
          <button
            onClick={() => setShowProfiles(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: T.panel2,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: 16 }}>{activeProfile?.emoji || "💼"}</span>
            <span style={{ fontSize: 11, fontWeight: "bold", color: T.bright }}>{activeProfile?.name || "Main"}</span>
          </button>
        )}

        {/* Date Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📅</span>
          <select 
            value={dateRange} 
            onChange={e => setDateRange(e.target.value)} 
            style={{ 
              background: T.border, 
              border: `1px solid ${T.border2}`, 
              color: T.text, 
              borderRadius: 6, 
              padding: "6px 10px", 
              fontSize: 12, 
              fontFamily: T.mono, 
              cursor: "pointer", 
              outline: "none" 
            }}
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="ytd">Year to Date</option>
            <option value="1y">Last 1 Year</option>
          </select>
        </div>

        {/* Add Trade Button */}
        <button 
          onClick={() => setShowAddModal(true)} 
          style={{ 
            background: T.blue, 
            border: "none", 
            color: "#fff", 
            borderRadius: 7, 
            padding: "7px 16px", 
            cursor: "pointer", 
            fontSize: 12, 
            fontWeight: 700, 
            fontFamily: T.mono, 
            letterSpacing: 0.5 
          }}
        >
          + Add Trade
        </button>

        {/* Tools Dropdown */}
        <div style={{ position: "relative" }}>
          <button 
            onClick={() => setShowTools(t => !t)} 
            style={{ 
              background: T.panel2, 
              border: `1px solid ${showTools ? T.blue : T.border}`, 
              color: showTools ? T.blue : T.dim, 
              borderRadius: 6, 
              padding: "7px 12px", 
              cursor: "pointer", 
              fontSize: 12, 
              fontFamily: T.mono 
            }}
          >
            Tools ▾
          </button>
          {showTools && (
            <div style={{ 
              position: "absolute", 
              top: "100%", 
              right: 0, 
              background: T.panel, 
              border: `1px solid ${T.border2}`, 
              borderRadius: 8, 
              padding: 4, 
              marginTop: 4, 
              zIndex: 1050, 
              boxShadow: "0 10px 40px #00000050", 
              minWidth: 150 
            }}>
              <button 
                onClick={() => { setShowCSVModal(true); setShowTools(false); }} 
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: T.text, cursor: "pointer", fontSize: 12, fontFamily: T.mono, borderRadius: 4 }} 
                onMouseEnter={e => e.target.style.background = T.panel2} 
                onMouseLeave={e => e.target.style.background = "none"}
              >
                ⬆ Import CSV
              </button>
              <button 
                onClick={() => { downloadCSV(); setShowTools(false); }} 
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: T.text, cursor: "pointer", fontSize: 12, fontFamily: T.mono, borderRadius: 4 }} 
                onMouseEnter={e => e.target.style.background = T.panel2} 
                onMouseLeave={e => e.target.style.background = "none"}
              >
                ⬇ Export CSV
              </button>
              <button 
                onClick={() => { exportPDF(now.getMonth(), now.getFullYear()); setShowTools(false); }} 
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: T.text, cursor: "pointer", fontSize: 12, fontFamily: T.mono, borderRadius: 4 }} 
                onMouseEnter={e => e.target.style.background = T.panel2} 
                onMouseLeave={e => e.target.style.background = "none"}
              >
                ⬇ Export PDF (Mo)
              </button>
              {isMobile && (
                <button 
                  onClick={() => { setIsDark(d => !d); setShowTools(false); }} 
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", color: T.text, cursor: "pointer", fontSize: 12, fontFamily: T.mono, borderRadius: 4, borderTop: `1px solid ${T.border}` }} 
                  onMouseEnter={e => e.target.style.background = T.panel2} 
                  onMouseLeave={e => e.target.style.background = "none"}
                >
                  {isDark ? "☀ Light Mode" : "🌙 Dark Mode"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Desktop Theme Toggle & Shortcuts */}
        {!isMobile && (
          <>
            <button 
              onClick={() => setIsDark(d => !d)} 
              style={{ 
                background: T.panel2, 
                border: `1px solid ${T.border}`, 
                color: T.dim, 
                borderRadius: 6, 
                padding: "6px 10px", 
                cursor: "pointer", 
                fontSize: 14 
              }}
            >
              {isDark ? "☀" : "🌙"}
            </button>
            <div 
              onMouseEnter={() => setShowShortcuts(true)}
              onMouseLeave={() => setShowShortcuts(false)}
              style={{ position: "relative" }}
            >
              <button 
                style={{ 
                  background: T.panel2, 
                  border: `1px solid ${T.border}`, 
                  color: T.dim, 
                  borderRadius: 6, 
                  padding: "6px 10px", 
                  cursor: "help", 
                  fontSize: 14 
                }}
              >
                ⌨
              </button>
              {showShortcuts && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  background: T.panel,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginTop: 6,
                  zIndex: 1050,
                  boxShadow: "0 10px 40px #00000060",
                  width: 180,
                  fontFamily: T.mono,
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: T.text
                }}>
                  <div style={{ fontWeight: 700, color: T.bright, marginBottom: 6, borderBottom: `1px solid ${T.border}`, paddingBottom: 4 }}>SHORTCUTS</div>
                  <div><span style={{ color: T.blue }}>N</span> : New Trade</div>
                  <div><span style={{ color: T.cyan }}>1-6</span> : Tabs</div>
                  <div><span style={{ color: T.green }}>Z</span> : Undo Delete</div>
                  <div><span style={{ color: T.dim }}>Esc</span> : Close Modal</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
