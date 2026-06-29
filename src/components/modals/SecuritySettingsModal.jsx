import { useState } from "react";
import { useSecurity } from "../../context/SecurityContext.jsx";
import { useBackup } from "../../context/BackupContext.jsx";
import { T } from "../../utils/theme.js";
import { Capacitor } from "@capacitor/core";

export default function SecuritySettingsModal({ onClose }) {
  const {
    logoutSession,
    appLockEnabled,
    lockTimeout,
    isBiometricAvailable,
    keyOption,
    machineKey,
    setLockTimeout,
    setupSecurity,
    disableSecurity,
  } = useSecurity();

  const {
    autoBackupEnabled,
    setAutoBackupEnabled,
    backupInterval,
    setBackupInterval,
    wifiOnly,
    setWifiOnly,
    lastSynced,
    syncing,
    userEmail,
    googleClientId,
    setGoogleClientId,
    clearGoogleSession,
    executeCloudBackup,
    fetchBackupsList,
    executeCloudRestore,
    executeLocalExport,
    executeLocalImport,
  } = useBackup();

  // Local component states
  const [activeTab, setActiveTab] = useState("local"); // 'local' | 'cloud' | 'restore'
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [cloudBackups, setCloudBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [customPasswordForRestore, setCustomPasswordForRestore] = useState("");
  const [localFileContent, setLocalFileContent] = useState("");

  // Selective Restore checkbox states
  const [selectedModules, setSelectedModules] = useState({
    trades: true,
    spot: true,
    live: true,
    keys: false,
    settings: false,
  });

  const isWeb = Capacitor.getPlatform() === "web";

  const showMsg = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "info" }), 5000);
  };

  const handleSignOut = () => {
    clearGoogleSession();
    if (isWeb) {
      window.location.reload();
    } else {
      logoutSession();
    }
  };

  const handleToggleAppLock = async (e) => {
    if (isWeb) return;
    const enabled = e.target.checked;
    if (!enabled) {
      disableSecurity();
      showMsg("App lock disabled", "info");
      return;
    }

    if (isBiometricAvailable) {
      const res = await setupSecurity("biometric");
      if (res.success) {
        showMsg("Biometric lock enabled!", "success");
      } else {
        showMsg(res.error || "Failed to setup biometrics.", "warning");
      }
    } else {
      setActiveTab("local");
      showMsg("Biometrics not available. Please enter a password below.", "info");
    }
  };

  const handlePasswordSetup = async (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      showMsg("Password cannot be empty.", "warning");
      return;
    }
    if (passwordInput !== passwordConfirm) {
      showMsg("Passwords do not match.", "warning");
      return;
    }

    const res = await setupSecurity("password", passwordInput);
    if (res.success) {
      showMsg("Password lock enabled!", "success");
      setPasswordInput("");
      setPasswordConfirm("");
    } else {
      showMsg(res.error || "Failed to set password.", "warning");
    }
  };

  const handleMachineKeySetup = async () => {
    const res = await setupSecurity("machine");
    if (res.success) {
      showMsg("Recovery key lock enabled!", "success");
    } else {
      showMsg(res.error || "Failed to enable recovery key.", "warning");
    }
  };

  const handleTriggerManualBackup = async () => {
    try {
      showMsg("Starting Google Drive backup...", "info");
      const res = await executeCloudBackup();
      if (res.success) {
        showMsg(`Successfully backed up to ${res.file}!`, "success");
      }
    } catch (e) {
      showMsg(e.message || "Manual backup failed.", "warning");
    }
  };

  const handleFetchCloudBackups = async () => {
    setLoadingBackups(true);
    try {
      const backups = await fetchBackupsList();
      setCloudBackups(backups);
      if (backups.length === 0) {
        showMsg("No backups found in Google Drive.", "info");
      }
    } catch (e) {
      showMsg(e.message || "Failed to retrieve backups list.", "warning");
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCloudRestore = async (fileId) => {
    if (!isWeb && (keyOption === "password" || keyOption === "machine")) {
      if (!customPasswordForRestore) {
        showMsg("Decryption password/key is required to restore.", "warning");
        return;
      }
    }

    try {
      showMsg("Restoring and merging data...", "info");
      await executeCloudRestore(fileId, selectedModules, isWeb ? null : customPasswordForRestore);
      showMsg("Journal restore complete! Reloading...", "success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showMsg(e.message || "Restore failed.", "warning");
    }
  };

  const handleLocalExport = async () => {
    try {
      const res = await executeLocalExport();
      if (res.success) {
        showMsg(`Local backup saved: ${res.path}`, "success");
      }
    } catch (e) {
      showMsg(e.message || "Local export failed.", "warning");
    }
  };

  const handleLocalImport = async (e) => {
    e.preventDefault();
    if (!isWeb && (keyOption === "password" || keyOption === "machine")) {
      if (!customPasswordForRestore) {
        showMsg("Decryption password/key is required to restore.", "warning");
        return;
      }
    }
    if (!localFileContent.trim()) {
      showMsg("Paste the backup content first.", "warning");
      return;
    }

    try {
      showMsg("Decrypting & importing...", "info");
      await executeLocalImport(localFileContent, selectedModules, isWeb ? null : customPasswordForRestore);
      showMsg("Local import complete! Reloading...", "success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showMsg(e.message || "Import failed.", "warning");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000092",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1001,
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: T.panel,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 24,
          width: "min(520px,95vw)",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 30px 80px #00000070",
          color: T.text,
          fontFamily: T.sans,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: T.mono, fontSize: 15, color: T.bright, letterSpacing: 1 }}>🛡️ SECURITY & BACKUPS</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>

        {/* Status Message */}
        {message.text && (
          <div
            style={{
              background: message.type === "success" ? `${T.green}18` : message.type === "warning" ? `${T.red}18` : `${T.blue}18`,
              border: `1px solid ${message.type === "success" ? T.green : message.type === "warning" ? T.red : T.blue}50`,
              color: message.type === "success" ? T.green : message.type === "warning" ? T.red : T.bright,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              marginBottom: 16,
              lineHeight: 1.4,
            }}
          >
            {message.text}
          </div>
        )}

        {/* Tab Headers */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
          <button
            onClick={() => setActiveTab("local")}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              borderBottom: activeTab === "local" ? `2px solid ${T.blue}` : "2px solid transparent",
              color: activeTab === "local" ? T.bright : T.dim,
              padding: "10px 0",
              cursor: "pointer",
              fontWeight: activeTab === "local" ? 700 : 500,
              fontSize: 13,
              fontFamily: T.mono,
            }}
          >
            {isWeb ? "🔑 App Session" : "🔒 App Lock"}
          </button>
          <button
            onClick={() => setActiveTab("cloud")}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              borderBottom: activeTab === "cloud" ? `2px solid ${T.blue}` : "2px solid transparent",
              color: activeTab === "cloud" ? T.bright : T.dim,
              padding: "10px 0",
              cursor: "pointer",
              fontWeight: activeTab === "cloud" ? 700 : 500,
              fontSize: 13,
              fontFamily: T.mono,
            }}
          >
            ☁️ Cloud Sync
          </button>
          <button
            onClick={() => setActiveTab("restore")}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              borderBottom: activeTab === "restore" ? `2px solid ${T.blue}` : "2px solid transparent",
              color: activeTab === "restore" ? T.bright : T.dim,
              padding: "10px 0",
              cursor: "pointer",
              fontWeight: activeTab === "restore" ? 700 : 500,
              fontSize: 13,
              fontFamily: T.mono,
            }}
          >
            🔄 Restore
          </button>
        </div>

        {/* Tab Content 1: Google Session and App Lock */}
        {activeTab === "local" && (
          <>
            <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛡️</div>
              <div style={{ fontWeight: 700, color: T.bright, fontSize: 16, marginBottom: 4 }}>Google Session Active</div>
              <p style={{ fontSize: 13, color: T.dim, margin: "0 0 20px 0", lineHeight: 1.5 }}>
                Your app is secured via Google OAuth. To access the journal or sync data, this active Google session is required.
              </p>
              
              <div style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 8, padding: "12px 14px", marginBottom: 20, textAlign: "left" }}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", fontFamily: T.mono, marginBottom: 4 }}>Signed In As:</div>
                <div style={{ fontSize: 14, color: T.bright, fontWeight: 600, wordBreak: "break-all" }}>{userEmail || "Connected Google Account"}</div>
              </div>

              <button
                onClick={handleSignOut}
                style={{
                  background: T.redDim,
                  border: `1px solid ${T.red}40`,
                  color: T.red,
                  borderRadius: 8,
                  padding: "10px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: T.mono,
                  fontWeight: 700,
                  width: "100%",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = `${T.red}28`}
                onMouseLeave={(e) => e.currentTarget.style.background = T.redDim}
              >
                🚪 Sign Out
              </button>
            </div>

            <div>
              {/* Toggle App Lock */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, color: T.bright, fontSize: 14 }}>Enable App Lock</div>
                  <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Require authentication on startup</div>
                </div>
                <input
                  type="checkbox"
                  checked={appLockEnabled}
                  onChange={handleToggleAppLock}
                  style={{ width: 20, height: 20, cursor: "pointer", accentColor: T.blue }}
                />
              </div>

              {appLockEnabled && (
                <>
                  {/* Lock Timeout Selection */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: T.bright, fontSize: 14 }}>Auto-Lock Timeout</div>
                      <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Lock app after being backgrounded</div>
                    </div>
                    <select
                      value={lockTimeout}
                      onChange={(e) => setLockTimeout(Number(e.target.value))}
                      style={{ background: T.border, color: T.bright, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 8px", outline: "none", fontFamily: T.mono, fontSize: 12 }}
                    >
                      <option value={1}>1 Minute</option>
                      <option value={5}>5 Minutes</option>
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={-1}>Never Auto-Lock</option>
                    </select>
                  </div>

                  {/* Key Option Display */}
                  <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: T.bright, fontSize: 14, marginBottom: 6 }}>Active Lock Mode</div>
                    <div style={{ textTransform: "uppercase", fontSize: 12, fontFamily: T.mono, color: T.blue, fontWeight: "bold" }}>
                      {keyOption === "biometric" ? "🧬 Fingerprint / Face ID" : keyOption === "password" ? "🔑 Custom Password" : "🤖 64-Digit Recovery Key"}
                    </div>
                    {keyOption === "machine" && machineKey && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>Write this down! It is required to restore your backups:</div>
                        <div style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 12px", fontFamily: T.mono, fontSize: 10, wordBreak: "break-all", userSelect: "all", color: T.bright }}>
                          {machineKey}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Set Password / Key Form */}
              {!appLockEnabled && (
                <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 700, color: T.bright, fontSize: 14, marginBottom: 12 }}>Change Lock Mode</div>
                  
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button
                      onClick={handleMachineKeySetup}
                      style={{ flex: 1, background: T.border, color: T.bright, border: `1px solid ${T.border2}`, borderRadius: 8, padding: "10px 0", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                    >
                      Use 64-Digit Key
                    </button>
                  </div>

                  <form onSubmit={handlePasswordSetup}>
                    <div style={{ fontSize: 11, color: T.dim, marginBottom: 4, textTransform: "uppercase" }}>Or Set Password:</div>
                    <input
                      type="password"
                      placeholder="New Password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, color: T.bright, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                    />
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, color: T.bright, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
                    />
                    <button
                      type="submit"
                      style={{ background: T.blueDim, border: `1px solid ${T.blue}40`, color: T.blue, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700, width: "100%" }}
                    >
                      Setup Password Lock
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tab Content 2: Cloud Sync Settings */}
        {activeTab === "cloud" && (
          <div>

            {/* Custom Google Client ID */}
            <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: T.bright, fontSize: 13, marginBottom: 6 }}>Google OAuth Client ID</div>
              <div style={{ fontSize: 11, color: T.dim, marginBottom: 10 }}>
                If you encounter "Error 401: invalid_client", you can override the Google Client ID with one registered in your Google Console.
              </div>
              <input
                type="text"
                placeholder="Enter custom Google Client ID..."
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                style={{
                  width: "100%",
                  background: T.panel,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: "#FFF",
                  fontFamily: T.mono,
                  fontSize: 12,
                  outline: "none"
                }}
              />
            </div>

            {/* Sync Settings Options */}
            <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              {/* Auto Sync Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: T.bright, fontSize: 13 }}>Auto Cloud Backups</div>
                  <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>Back up when app state resumes/suspends</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: T.blue }}
                />
              </div>

              {/* Wi-Fi constraint Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: T.bright, fontSize: 13 }}>Over Wi-Fi Only</div>
                  <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>Restrict automatic uploads to Wi-Fi</div>
                </div>
                <input
                  type="checkbox"
                  checked={wifiOnly}
                  onChange={(e) => setWifiOnly(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: T.blue }}
                />
              </div>

              {/* Sync Interval */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: T.bright, fontSize: 13 }}>Backup Frequency</div>
                </div>
                <select
                  value={backupInterval}
                  onChange={(e) => setBackupInterval(e.target.value)}
                  style={{ background: T.border, color: T.bright, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "5px 8px", outline: "none", fontFamily: T.mono, fontSize: 12 }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Sync Metadata & Actions */}
            <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 12 }}>
                <span style={{ color: T.dim }}>Last Backup Upload:</span>
                <span style={{ fontFamily: T.mono, color: T.bright }}>{lastSynced ? new Date(lastSynced).toLocaleString() : "Never"}</span>
              </div>
              <button
                onClick={handleTriggerManualBackup}
                disabled={syncing}
                style={{ background: T.blue, border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {syncing ? "Syncing..." : "🔄 Backup Now"}
              </button>
            </div>

            {/* Offline Export */}
            <button
              onClick={handleLocalExport}
              style={{ background: "none", border: `1px dashed ${T.border2}`, color: T.dim, borderRadius: 8, padding: "10px 0", cursor: "pointer", fontSize: 13, width: "100%" }}
            >
              📥 Export Encrypted File Locally (`.crypt`)
            </button>
          </div>
        )}

        {/* Tab Content 3: Restore / Import */}
        {activeTab === "restore" && (
          <div>
            {/* Password Decryption Requirement (APK Only) */}
            {!isWeb && (keyOption === "password" || keyOption === "machine") && (
              <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: T.bright, fontSize: 13, marginBottom: 6 }}>Enter Password/Key to Decrypt Backup</div>
                <input
                  type="password"
                  placeholder={keyOption === "password" ? "Enter password..." : "Enter 64-character key..."}
                  value={customPasswordForRestore}
                  onChange={(e) => setCustomPasswordForRestore(e.target.value)}
                  style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, color: T.bright, padding: "8px 12px", fontSize: 12, width: "100%", fontFamily: T.mono, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            )}

            {/* Selective merge checklist */}
            <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: T.bright, fontSize: 13, marginBottom: 10 }}>Selective Restore Checklist</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.keys(selectedModules).map((mod) => (
                  <label key={mod} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={selectedModules[mod]}
                      onChange={(e) => setSelectedModules((prev) => ({ ...prev, [mod]: e.target.checked }))}
                      style={{ accentColor: T.blue }}
                    />
                    <span style={{ textTransform: "capitalize" }}>
                      {mod === "spot" ? "Spot Open" : mod === "live" ? "Live Open" : mod === "keys" ? "Exchange Keys" : mod === "settings" ? "App Settings" : mod}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Cloud Restore */}
            <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: T.bright, fontSize: 13 }}>Google Drive Backups</div>
                <button
                  onClick={handleFetchCloudBackups}
                  disabled={loadingBackups}
                  style={{ background: T.border, border: `1px solid ${T.border2}`, color: T.bright, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
                >
                  {loadingBackups ? "Loading..." : "Get List"}
                </button>
              </div>

              {cloudBackups.length > 0 ? (
                <div style={{ maxHeight: 150, overflowY: "auto" }}>
                  {cloudBackups.map((b) => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontFamily: T.mono, color: T.bright }}>
                        <div>{b.name}</div>
                        <div style={{ color: T.dim, fontSize: 9, marginTop: 2 }}>{new Date(b.createdTime).toLocaleString()}</div>
                      </div>
                      <button
                        onClick={() => handleCloudRestore(b.id)}
                        disabled={syncing}
                        style={{ background: T.greenDim, border: `1px solid ${T.green}40`, color: T.green, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: T.dim, fontSize: 11, textAlign: "center", padding: "10px 0" }}>Click "Get List" to load remote backups</div>
              )}
            </div>

            {/* Local Restore */}
            <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, color: T.bright, fontSize: 13, marginBottom: 8 }}>Import Local `.crypt` content</div>
              <form onSubmit={handleLocalImport}>
                <textarea
                  placeholder="Paste contents of .crypt file here..."
                  value={localFileContent}
                  onChange={(e) => setLocalFileContent(e.target.value)}
                  rows={3}
                  style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, color: T.bright, padding: "8px 10px", fontSize: 11, fontFamily: T.mono, width: "100%", boxSizing: "border-box", marginBottom: 8, resize: "none", outline: "none" }}
                />
                <button
                  type="submit"
                  style={{ background: T.blueDim, border: `1px solid ${T.blue}40`, color: T.blue, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700, width: "100%" }}
                >
                  Verify & Import Locally
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
