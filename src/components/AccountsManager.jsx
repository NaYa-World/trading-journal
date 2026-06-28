import { useState, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { T, THEMES } from "../utils/theme.js";
import { useBackup } from "../context/BackupContext.jsx";
import { useDashboard } from "../context/DashboardContext.jsx";
import { fmt$ } from "../utils/helpers.js";

export default function AccountsManager({ profiles, activeProfileId, switchProfile, addProfile, updateProfile, trades = [], liveTrades = [], addTrade, showToast }) {
  const [editingProfile, setEditingProfile] = useState(null);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [isTradingAccountsOpen, setIsTradingAccountsOpen] = useState(true);
  const [profileForm, setProfileForm] = useState({ name: "", color: "#6366f1", emoji: "💼" });
  
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];
  const { userEmail, authenticateGoogle, clearGoogleSession, lastSynced, syncing, executeCloudBackup } = useBackup();
  const { setShowCSVModal, downloadCSV, exportPDF, activeThemeKey, setActiveThemeKey, deleteProfile } = useDashboard();
  const fileInputRef = useRef(null);

  const handleGoogleSignIn = async () => {
    try {
      await authenticateGoogle();
    } catch (e) {
      if (showToast) showToast(e.message || "Failed to sign in.", "error");
      else alert(e.message || "Failed to sign in.");
    }
  };

  const initialCapital = activeProfile.initialCapital || 0;
  const closed = trades.filter(t => t.status === "closed");
  const firstDeposit = closed.find(t => t.entryType === "Deposit" || t.symbol === "Deposit");
  const startingCapital = firstDeposit ? firstDeposit.qty : initialCapital;
  
  const deposits = closed.filter(t => (t.entryType === "Deposit" || t.symbol === "Deposit") && t.id !== (firstDeposit ? firstDeposit.id : null)).reduce((s, t) => s + t.qty, 0);
  const withdrawals = closed.filter(t => t.entryType === "Withdrawal" || t.symbol === "Withdrawal").reduce((s, t) => s + t.qty, 0);
  
  const profileClosedTrades = closed.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
  const profileRealizedPnl = profileClosedTrades.reduce((s, t) => s + t.pnl, 0);
  const profileTotalFees = profileClosedTrades.reduce((s, t) => s + (t.fees || 0), 0);
  
  const currentBalance = startingCapital + deposits - withdrawals + profileRealizedPnl + profileTotalFees;

  const handleTransaction = (type) => {
    const amtStr = prompt(`Enter ${type} amount in USD:`);
    if (!amtStr) return;
    const amt = parseFloat(amtStr);
    if (isNaN(amt) || amt <= 0) {
      if (showToast) showToast("Invalid amount.", "error");
      else alert("Invalid amount.");
      return;
    }
    
    addTrade({
      symbol: type,
      tradeType: "Spot",
      entryType: type,
      side: type === "Deposit" ? "Long" : "Short",
      entry: 1,
      qty: amt,
      closePrice: 1,
      pnl: 0,
      fees: 0,
      status: "closed",
      openTime: Date.now(),
      closeTime: Date.now(),
      profileId: activeProfileId
    });
    if (showToast) showToast(`Successfully processed ${type}.`, "success");
  };

  const handleRename = () => {
    if (!updateProfile) return;
    const newName = prompt("Enter new account name:", activeProfile.name);
    if (newName && newName.trim()) {
      updateProfile(activeProfile.id, { name: newName.trim() });
    }
  };

  const handleDeleteAccount = () => {
    if (profiles.length <= 1) {
      if (showToast) showToast("Cannot delete your only trading account.", "error");
      else alert("Cannot delete your only trading account.");
      return;
    }
    if (confirm(`Are you sure you want to delete ${activeProfile.name} and all of its trades?`)) {
      deleteProfile(activeProfile.id);
    }
  };

  const handleCreateProfile = () => {
    if (!profileForm.name.trim()) return;
    addProfile({
      name: profileForm.name.trim(),
      emoji: profileForm.emoji,
      color: profileForm.color,
      initialCapital: 0,
      avatar: null
    });
    setShowAddProfile(false);
    setProfileForm({ name: "", color: "#6366f1", emoji: "💼" });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !updateProfile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateProfile(activeProfile.id, { avatar: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  if (showThemeSettings) {
    return (
      <div style={{ padding: "env(safe-area-inset-top, 20px) 16px 20px 16px", paddingBottom: 100, minHeight: "100%", background: T.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <button onClick={() => setShowThemeSettings(false)} style={{ background: "transparent", color: T.dim, border: "none", fontSize: 24, cursor: "pointer", padding: 0 }}>←</button>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#FFF" }}>Theme & Support</div>
        </div>

        {/* Themes Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          {Object.entries(THEMES).map(([key, theme]) => {
            const isActive = activeThemeKey === key;
            return (
              <div 
                key={key}
                onClick={() => setActiveThemeKey(key)}
                style={{
                  background: theme.panel,
                  border: `2px solid ${isActive ? T.purple : theme.border}`,
                  borderRadius: 16,
                  padding: 16,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: isActive ? `0 0 15px ${T.purple}40` : "none"
                }}
              >
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {theme.swatches.map((color, i) => (
                    <div key={i} style={{ width: 24, height: 24, borderRadius: 6, background: color }} />
                  ))}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.bright, marginBottom: 4 }}>{theme.name}</div>
                <div style={{ fontSize: 12, color: theme.dim }}>{theme.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Backup Section inside Theme & Support */}
        <div style={{ 
          background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ background: `${T.purple}20`, color: T.purple, padding: 8, borderRadius: 8 }}>📥</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF" }}>Backup</div>
              <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>Export or restore your journal data.</div>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={downloadCSV} style={{ width: "100%", background: T.purple, color: "#FFF", border: "none", borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "center", gap: 8 }}>
              <span>📥</span> Export CSV
            </button>
            <button onClick={() => setShowCSVModal(true)} style={{ width: "100%", background: T.panel2, color: T.bright, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "center", gap: 8 }}>
              <span>📤</span> Import CSV
            </button>
            <button onClick={() => { const now = new Date(); exportPDF(now.getMonth(), now.getFullYear()); }} style={{ width: "100%", background: T.panel2, color: T.bright, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "center", gap: 8 }}>
              <span>📄</span> Export PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "env(safe-area-inset-top, 20px) 16px 20px 16px", paddingBottom: 100, minHeight: "100%", background: T.bg }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#FFF", marginBottom: 6 }}>Accounts</div>
      <div style={{ fontSize: 13, color: T.dim, marginBottom: 24, lineHeight: 1.4 }}>
        Manage your profile, sync, and visible trading account.
      </div>

      {/* Profile Card */}
      <div style={{ 
        background: T.panel, 
        border: `1px solid ${T.border}`, 
        borderRadius: 16, 
        padding: 20,
        marginBottom: 24
      }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
          {/* Avatar with Glow */}
          <div style={{ position: "relative" }}>
            <div style={{ 
              width: 64, height: 64, borderRadius: "50%", padding: 2, 
              background: `linear-gradient(135deg, ${T.purple}, ${T.blue})`,
              boxShadow: `0 0 20px ${T.purple}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, overflow: "hidden"
            }}>
              {activeProfile.avatar ? (
                <img src={activeProfile.avatar} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", border: `2px solid ${T.panel}`, objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: T.panel2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {activeProfile.emoji || "💼"}
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: "none" }} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{ 
              position: "absolute", bottom: -4, right: -4, 
              background: T.purple, color: "#FFF", border: `2px solid ${T.panel}`, 
              borderRadius: "50%", width: 24, height: 24, 
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, cursor: "pointer", zIndex: 2
            }}>📷</button>
          </div>
          <div>
            <div 
              onClick={handleRename}
              style={{ fontSize: 18, fontWeight: 700, color: "#FFF", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            >
              {activeProfile.name} <span style={{ color: T.purple, fontSize: 14 }}>✎</span>
            </div>
            <div style={{ fontSize: 12, color: userEmail ? T.bright : T.dim, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              ✉ {userEmail ? userEmail : "No email connected"} {userEmail && <span style={{ color: T.green }}>✓</span>}
            </div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>
              📊 Realized PNL: {fmt$(profileRealizedPnl)}
            </div>
          </div>
        </div>

        {/* Market Tabs */}
        <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Market</div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
          {["Crypto"].map((tab, i) => (
            <div key={tab} style={{
              background: i === 0 ? T.purple : "transparent",
              color: i === 0 ? "#FFF" : T.dim,
              padding: "6px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: i === 0 ? 700 : 500,
              boxShadow: i === 0 ? `0 0 15px ${T.purple}60` : "none"
            }}>
              {tab}
            </div>
          ))}
        </div>
      </div>

      {/* Trading Accounts Section */}
      <div 
        onClick={() => setIsTradingAccountsOpen(!isTradingAccountsOpen)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, cursor: "pointer" }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "#FFF" }}>Trading accounts</div>
        <span style={{ color: T.dim }}>{isTradingAccountsOpen ? "^" : "⌄"}</span>
      </div>

      {isTradingAccountsOpen && (
        <>


      <div style={{ 
        background: T.panel, 
        border: `1px solid ${T.border}`, 
        borderRadius: 16, 
        padding: 20,
        marginBottom: 16
      }}>
        {/* Dropdown Header */}
        <div 
          onClick={() => setShowAccountDropdown(!showAccountDropdown)}
          style={{ 
            background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, 
            padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
            cursor: "pointer"
          }}>
          <div style={{ background: `${T.purple}20`, color: T.purple, padding: 6, borderRadius: 6 }}>💼</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: T.dim }}>Active account</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#FFF" }}>{activeProfile.name}</div>
          </div>
          <span style={{ color: T.dim }}>{showAccountDropdown ? "⌃" : "⌄"}</span>
        </div>

        {showAccountDropdown && (
          <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 20, overflow: "hidden" }}>
            {profiles.map(p => (
              <div 
                key={p.id} 
                onClick={() => { switchProfile(p.id); setShowAccountDropdown(false); }}
                style={{ 
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                  background: p.id === activeProfile.id ? `${T.purple}20` : "transparent",
                  cursor: "pointer", borderBottom: `1px solid ${T.border}`
                }}
              >
                <div style={{ fontSize: 18 }}>{p.emoji || "💼"}</div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: p.id === activeProfile.id ? 700 : 500, color: p.id === activeProfile.id ? T.bright : T.dim }}>
                  {p.name}
                </div>
                {p.id === activeProfile.id && <div style={{ color: T.purple }}>✓</div>}
              </div>
            ))}
          </div>
        )}

        {/* Account Details */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF" }}>{activeProfile.name}</div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 4, maxWidth: "80%" }}>
              Visible in totals and account-based views
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, color: T.dim }}>
            <span onClick={handleRename} style={{ cursor: "pointer" }}>✎</span>
            <span style={{ color: T.yellow, cursor: "pointer" }}>🗄</span>
            <span onClick={handleDeleteAccount} style={{ color: T.red, cursor: "pointer" }}>🗑</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: T.dim, letterSpacing: 1, textTransform: "uppercase" }}>Starting</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF", marginTop: 4 }}>{fmt$(startingCapital)}</div>
          </div>
          <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: T.dim, letterSpacing: 1, textTransform: "uppercase" }}>Current</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF", marginTop: 4 }}>{fmt$(currentBalance)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button onClick={() => handleTransaction("Deposit")} style={{ background: `${T.green}10`, color: T.green, border: `1px solid ${T.green}30`, borderRadius: 10, padding: 12, fontWeight: 700, cursor: "pointer" }}>Deposit</button>
          <button onClick={() => handleTransaction("Withdrawal")} style={{ background: `${T.red}10`, color: T.red, border: `1px solid ${T.red}30`, borderRadius: 10, padding: 12, fontWeight: 700, cursor: "pointer" }}>Withdraw</button>
        </div>
      </div>

      <button onClick={() => setShowAddProfile(true)} style={{ 
        width: "100%", background: "transparent", border: `1px dashed ${T.border2}`, 
        color: T.dim, borderRadius: 12, padding: 16, fontWeight: 700, marginBottom: 30, cursor: "pointer"
      }}>
        + Add Account
      </button>

      {showAddProfile && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.8)", 
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, width: "100%", maxWidth: 400 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#FFF", marginBottom: 16 }}>Create New Account</div>
            
            <div style={{ fontSize: 12, color: T.dim, marginBottom: 8 }}>Account Name</div>
            <input 
              autoFocus
              type="text" 
              placeholder="e.g. Prop Firm Challenge" 
              value={profileForm.name}
              onChange={e => setProfileForm({...profileForm, name: e.target.value})}
              style={{ width: "100%", padding: "12px 14px", background: T.bg, border: `1px solid ${T.border}`, color: "#FFF", borderRadius: 10, marginBottom: 16, outline: "none", boxSizing: "border-box" }}
            />

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button onClick={() => setShowAddProfile(false)} style={{ flex: 1, background: "transparent", border: `1px solid ${T.border}`, color: T.bright, padding: 12, borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreateProfile} style={{ flex: 1, background: T.purple, border: "none", color: "#FFF", padding: 12, borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Create</button>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Cloud Sync */}
      <div style={{ 
        background: T.panel, 
        border: `1px solid ${T.border}`, 
        borderRadius: 16, 
        padding: 20,
        marginBottom: 20
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ background: `${T.purple}20`, color: T.purple, padding: 8, borderRadius: 8 }}>☁</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF" }}>Cloud sync</div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{userEmail ? "Connected via Google Drive" : "Offline only for now"}</div>
          </div>
          <div style={{ fontSize: 10, background: userEmail ? `${T.green}20` : T.panel2, padding: "4px 8px", borderRadius: 4, color: userEmail ? T.green : T.dim, fontWeight: 700 }}>
            {userEmail ? "ONLINE" : "OFFLINE"}
          </div>
        </div>
        {!userEmail ? (
          <>
            <div style={{ fontSize: 13, color: T.dim, marginBottom: 20, lineHeight: 1.4 }}>
              Offline only (not backed up). Sign in to back up your trades across devices.
            </div>
            <button onClick={handleGoogleSignIn} style={{ width: "100%", background: T.purple, color: "#FFF", border: "none", borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15 }}>
              👤 Sign In
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: T.dim, marginBottom: 20, lineHeight: 1.4 }}>
              Logged in as <strong style={{ color: T.bright }}>{userEmail}</strong>. Your trades are being backed up.
              <div style={{ marginTop: 8, fontSize: 11, color: T.purple }}>
                Last synced: {lastSynced ? new Date(lastSynced).toLocaleString() : "Never"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => executeCloudBackup && executeCloudBackup()} disabled={syncing} style={{ flex: 1, background: T.purple, color: "#FFF", border: "none", borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 14, opacity: syncing ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
              <button onClick={clearGoogleSession} style={{ flex: 1, background: "transparent", color: T.red, border: `1px solid ${T.red}50`, borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 14 }}>
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Theme & Support Link */}
      <div 
        onClick={() => setShowThemeSettings(true)}
        style={{ 
          background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, 
          padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 20
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: `${T.blue}20`, color: T.blue, padding: 10, borderRadius: 12, fontSize: 20 }}>🎨</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF" }}>Theme & Support</div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>Themes, exports, backups, and help.</div>
          </div>
        </div>
        <div style={{ color: T.dim, fontSize: 18, fontWeight: 700 }}>›</div>
      </div>

    </div>
  );
}
