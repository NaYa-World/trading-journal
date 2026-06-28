/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSecurity } from "./SecurityContext.jsx";
import { Network } from "@capacitor/network";
import { Capacitor } from "@capacitor/core";
import {
  loginGoogle,
  handleGoogleRedirect,
  uploadDriveBackup,
  listDriveBackups,
  downloadDriveBackup,
  rotateDriveBackups,
  exportLocalFile,
  encryptBackup,
  decryptBackup
} from "../utils/backup.js";

const BackupContext = createContext(null);

export const useBackup = () => {
  const context = useContext(BackupContext);
  if (!context) throw new Error("useBackup must be used within a BackupProvider");
  return context;
};

const BACKUP_PREFS_KEY = "cj_backup_prefs_v1";

export const BackupProvider = ({ children }) => {
  const { masterKey } = useSecurity();
  const [googleClientId, setGoogleClientId] = useState("217538466431-j5sqrafrg96th6t5lth9t2bbrb5ofh78.apps.googleusercontent.com");
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupInterval, setBackupInterval] = useState("daily"); // 'daily' | 'weekly' | 'monthly' | 'manual'
  const [wifiOnly, setWifiOnly] = useState(true);
  const [lastSynced, setLastSynced] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState(() => {
    try {
      return localStorage.getItem("cj_google_access_token") || null;
    } catch {
      return null;
    }
  });
  const [userEmail, setUserEmail] = useState(() => {
    try {
      return localStorage.getItem("cj_google_user_email") || "";
    } catch {
      return "";
    }
  });

  // Load backup preferences from raw storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BACKUP_PREFS_KEY);
      if (raw) {
        const prefs = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGoogleClientId(prefs.googleClientId || "217538466431-j5sqrafrg96th6t5lth9t2bbrb5ofh78.apps.googleusercontent.com");
        setAutoBackupEnabled(prefs.autoBackupEnabled ?? false);
        setBackupInterval(prefs.backupInterval || "daily");
        setWifiOnly(prefs.wifiOnly ?? true);
        setLastSynced(prefs.lastSynced || "");
      }
    } catch (e) {
      console.error("Failed to load backup preferences:", e);
    }
  }, []);

  const saveBackupPrefs = (updated) => {
    const current = {
      googleClientId,
      autoBackupEnabled,
      backupInterval,
      wifiOnly,
      lastSynced,
      ...updated,
    };
    localStorage.setItem(BACKUP_PREFS_KEY, JSON.stringify(current));
  };

  // Build the complete local payload of the journal
  const buildBackupPayload = useCallback(() => {
    // If we have dashboardContextValue passed down, we extract states.
    // Otherwise, we load directly from storage to be extra safe and decouple components.
    // Reading directly from raw localStorage keys is serverless-clean and works even if contexts are mounting/demounting.
    const keys = [
      "cj_trades_v2",
      "cj_spot_open_v2",
      "cj_live_v2",
      "cj_symbols_v2",
      "cj_capital_v2",
      "cj_profiles_v2",
      "cj_active_v2",
      "cj_theme_v2",
      "cj_reviews_v2",
      "cj_apikeys_v2",
      "cj_other_deposits_v1",
      "cj_withdrawals_map_v1",
      "cj_alerts_v1"
    ];

    const data = {};
    keys.forEach(k => {
      try {
        data[k] = localStorage.getItem(k); // Store raw encrypted states as they are!
      } catch (e) {
        console.warn(`Failed to export raw key ${k}:`, e);
      }
    });

    return JSON.stringify({
      timestamp: Date.now(),
      schemaVersion: 2,
      data
    });
  }, []);

  // Perform a sync check (e.g. check wifi constraints and trigger backup if due)
  const runAutoBackupCheck = useCallback(async (force = false) => {
    if (!autoBackupEnabled && !force) return;
    if (!masterKey) return; // Need encryption key active

    try {
      // 1. Check network constraints
      const status = await Network.getStatus();
      if (wifiOnly && status.connectionType !== "wifi") {

        return;
      }

      // 2. Check timing constraint
      if (!force && lastSynced) {
        const lastSyncDate = new Date(lastSynced);
        const now = new Date();
        const diffMs = now - lastSyncDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (backupInterval === "daily" && diffDays < 1) return;
        if (backupInterval === "weekly" && diffDays < 7) return;
        if (backupInterval === "monthly" && diffDays < 30) return;
      }

      // 3. Run the backup upload
      await executeCloudBackup();
    } catch (e) {
      console.error("Auto backup check failed:", e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBackupEnabled, masterKey, wifiOnly, lastSynced, backupInterval]);

  // Authenticate Google
  async function authenticateGoogle(clientIdVal = googleClientId) {
    if (!clientIdVal) throw new Error("Google Client ID is missing. Please set it in Security settings.");
    try {
      setSyncing(true);
      const authResult = await loginGoogle(clientIdVal);
      setGoogleAccessToken(authResult.accessToken);
      if (authResult.accessToken) {
        localStorage.setItem("cj_google_access_token", authResult.accessToken);
      }
      if (authResult.email) {
        setUserEmail(authResult.email);
        localStorage.setItem("cj_google_user_email", authResult.email);
      }
      setSyncing(false);
      return authResult.accessToken;
    } catch (e) {
      setSyncing(false);
      throw e;
    }
  }

  // Check for Google OAuth Redirect Result (Web callback)
  const checkRedirectResult = async (clientIdVal = googleClientId) => {
    if (Capacitor.getPlatform() !== "web") return null;
    try {
      setSyncing(true);
      const authResult = await handleGoogleRedirect(clientIdVal);
      if (authResult && authResult.accessToken) {
        setGoogleAccessToken(authResult.accessToken);
        localStorage.setItem("cj_google_access_token", authResult.accessToken);
        if (authResult.email) {
          setUserEmail(authResult.email);
          localStorage.setItem("cj_google_user_email", authResult.email);
        }
        setSyncing(false);
        return authResult;
      }
      setSyncing(false);
      return null;
    } catch (e) {
      setSyncing(false);
      console.error("Redirect check failed:", e);
      return null;
    }
  };

  // Clear Google session on logout
  const clearGoogleSession = () => {
    setGoogleAccessToken(null);
    setUserEmail("");
    localStorage.removeItem("cj_google_user_email");
    localStorage.removeItem("cj_google_access_token");
  };

  // Perform Cloud Backup
  async function executeCloudBackup(customKey = null) {
    const encryptionKey = customKey || masterKey;
    if (!encryptionKey) throw new Error("Journal is locked. Unlock the app first.");
    
    setSyncing(true);
    try {
      let token = googleAccessToken;
      if (!token) {
        token = await authenticateGoogle();
      }

      const payload = buildBackupPayload();
      
      // Encrypt backup payload with master key
      const encryptedData = encryptBackup(payload, encryptionKey);

      // We name it using the current day of the week to keep a rolling set of 7 files (or keep 5 via rotation)
      const dayName = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
      const filename = `dashboard_backup_${dayName}.crypt`;

      await uploadDriveBackup(filename, encryptedData, token);
      
      // Delete old backups beyond rolling 5
      await rotateDriveBackups(token);

      const nowIso = new Date().toISOString();
      setLastSynced(nowIso);
      saveBackupPrefs({ lastSynced: nowIso });
      
      setSyncing(false);
      return { success: true, file: filename };
    } catch (e) {
      setSyncing(false);
      console.error("Backup failed:", e);
      throw e;
    }
  }

  // Fetch backups list from Google Drive
  const fetchBackupsList = async () => {
    try {
      let token = googleAccessToken;
      if (!token) {
        token = await authenticateGoogle();
      }
      return await listDriveBackups(token);
    } catch (e) {
      console.error("Failed to list backups:", e);
      throw e;
    }
  };

  // Restore and merge a backup
  const executeCloudRestore = async (fileId, selectedModules, customKey = null) => {
    const decryptionKey = customKey || masterKey;
    if (!decryptionKey) throw new Error("Decryption key not available. Unlock first or enter password.");

    setSyncing(true);
    try {
      let token = googleAccessToken;
      if (!token) {
        token = await authenticateGoogle();
      }

      // 1. Download
      const ciphertext = await downloadDriveBackup(fileId, token);

      // 2. Decrypt
      const decryptedJSON = decryptBackup(ciphertext, decryptionKey);
      const backup = JSON.parse(decryptedJSON);

      if (backup.schemaVersion !== 2 || !backup.data) {
        throw new Error("Invalid schema version in backup file.");
      }

      // 3. Selective merge
      // Mapping of checkbox modules to local storage keys
      const moduleKeyMap = {
        trades: ["cj_trades_v2"],
        spot: ["cj_spot_open_v2"],
        live: ["cj_live_v2"],
        keys: ["cj_apikeys_v2"],
        settings: ["cj_symbols_v2", "cj_capital_v2", "cj_profiles_v2", "cj_active_v2", "cj_theme_v2", "cj_other_deposits_v1", "cj_withdrawals_map_v1", "cj_alerts_v1"]
      };

      Object.entries(moduleKeyMap).forEach(([moduleName, storageKeys]) => {
        if (selectedModules[moduleName]) {
          storageKeys.forEach(k => {
            const backedVal = backup.data[k];
            if (backedVal !== undefined) {
              if (backedVal === null) {
                localStorage.removeItem(k);
              } else {
                localStorage.setItem(k, backedVal);
              }
            }
          });
        }
      });

      setSyncing(false);
      return { success: true };
    } catch (e) {
      setSyncing(false);
      console.error("Restore failed:", e);
      throw e;
    }
  };

  // Local File Export
  const executeLocalExport = async () => {
    if (!masterKey) throw new Error("Journal is locked.");
    try {
      const payload = buildBackupPayload();
      const encryptedData = encryptBackup(payload, masterKey);
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `trading_journal_backup_${dateStr}.crypt`;

      if (Capacitor.isNativePlatform()) {
        const result = await exportLocalFile(filename, encryptedData);
        return { success: true, path: result.uri };
      } else {
        // Web download fallback
        const blob = new Blob([encryptedData], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true, path: "Downloads folder" };
      }
    } catch (e) {
      console.error("Local export failed:", e);
      throw e;
    }
  };

  // Local File Import and Decrypt
  const executeLocalImport = async (fileContent, selectedModules, customKey = null) => {
    const decryptionKey = customKey || masterKey;
    if (!decryptionKey) throw new Error("Decryption key not available.");

    try {
      const decryptedJSON = decryptBackup(fileContent, decryptionKey);
      const backup = JSON.parse(decryptedJSON);

      if (backup.schemaVersion !== 2 || !backup.data) {
        throw new Error("Invalid schema version in backup file.");
      }

      const moduleKeyMap = {
        trades: ["cj_trades_v2"],
        spot: ["cj_spot_open_v2"],
        live: ["cj_live_v2"],
        keys: ["cj_apikeys_v2"],
        settings: ["cj_symbols_v2", "cj_capital_v2", "cj_profiles_v2", "cj_active_v2", "cj_theme_v2", "cj_other_deposits_v1", "cj_withdrawals_map_v1", "cj_alerts_v1"]
      };

      Object.entries(moduleKeyMap).forEach(([moduleName, storageKeys]) => {
        if (selectedModules[moduleName]) {
          storageKeys.forEach(k => {
            const backedVal = backup.data[k];
            if (backedVal !== undefined) {
              if (backedVal === null) {
                localStorage.removeItem(k);
              } else {
                localStorage.setItem(k, backedVal);
              }
            }
          });
        }
      });

      return { success: true };
    } catch (e) {
      console.error("Local import failed:", e);
      throw e;
    }
  };

  return (
    <BackupContext.Provider
      value={{
        googleClientId,
        setGoogleClientId: (id) => {
          setGoogleClientId(id);
          saveBackupPrefs({ googleClientId: id });
        },
        autoBackupEnabled,
        setAutoBackupEnabled: (b) => {
          setAutoBackupEnabled(b);
          saveBackupPrefs({ autoBackupEnabled: b });
        },
        backupInterval,
        setBackupInterval: (i) => {
          setBackupInterval(i);
          saveBackupPrefs({ backupInterval: i });
        },
        wifiOnly,
        setWifiOnly: (b) => {
          setWifiOnly(b);
          saveBackupPrefs({ wifiOnly: b });
        },
        lastSynced,
        syncing,
        googleAccessToken,
        userEmail,
        authenticateGoogle,
        checkRedirectResult,
        clearGoogleSession,
        executeCloudBackup,
        fetchBackupsList,
        executeCloudRestore,
        executeLocalExport,
        executeLocalImport,
        runAutoBackupCheck
      }}
    >
      {children}
    </BackupContext.Provider>
  );
};
