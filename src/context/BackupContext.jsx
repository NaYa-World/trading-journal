/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSecurity } from "./SecurityContext.jsx";
import { Network } from "@capacitor/network";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  loginGoogle,
  handleGoogleRedirect,
  uploadDriveBackup,
  listDriveBackups,
  downloadDriveBackup,
  rotateDriveBackups,
  encryptBackup,
  decryptBackup,
  exportLocalFile
} from "../utils/backup.js";
import { _load, _save, clearDemoDataIfNeeded } from "../utils/storage.js";

const BackupContext = createContext(null);

const getBase64OfFile = async (fileUrl) => {
  try {
    const res = await Filesystem.readFile({ url: fileUrl });
    let data = res.data;
    if (data && !data.startsWith("data:")) {
      data = `data:image/jpeg;base64,${data}`;
    }
    return data;
  } catch (e) {
    console.error("Failed to read local file as base64:", fileUrl, e);
    return null;
  }
};

const saveBase64AsFile = async (base64Data, filename) => {
  try {
    let rawData = base64Data;
    if (base64Data.includes(";base64,")) {
      rawData = base64Data.split(";base64,")[1];
    }
    const savedFile = await Filesystem.writeFile({
      path: filename,
      data: rawData,
      directory: Directory.Data
    });
    return savedFile.uri;
  } catch (e) {
    console.error("Failed to write base64 to local file:", e);
    return null;
  }
};

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
      return sessionStorage.getItem("cj_google_access_token") || null;
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

  const processRestoredKey = async (key, val) => {
    if (!Capacitor.isNativePlatform() || !val) return val;
    try {
      if (key === "cj_profiles_v2" && Array.isArray(val)) {
        return await Promise.all(val.map(async (p) => {
          if (p.avatar && p.avatar.startsWith("data:image/")) {
            const filename = `avatar_${p.id || Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
            const fileUri = await saveBase64AsFile(p.avatar, filename);
            if (fileUri) return { ...p, avatar: fileUri };
          }
          return p;
        }));
      }
      if (key === "cj_trade_setups_v2" && Array.isArray(val)) {
        return await Promise.all(val.map(async (s) => {
          if (s.image && s.image.startsWith("data:image/")) {
            const filename = `setup_${s.id || Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
            const fileUri = await saveBase64AsFile(s.image, filename);
            if (fileUri) return { ...s, image: fileUri };
          }
          return s;
        }));
      }
    } catch (e) {
      console.error("Error processing restored key:", key, e);
    }
    return val;
  };

  // Build the complete local payload of the journal
  const buildBackupPayload = useCallback(async () => {
    // We load directly from storage to be extra safe and decouple components.
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
      "cj_alerts_v1",
      "cj_trade_setups_v2"
    ];

    const data = {};
    for (const k of keys) {
      try {
        data[k] = await _load(k, null);
      } catch (e) {
        console.warn(`Failed to export key ${k}:`, e);
      }
    }

    // Process native files to base64 for backup
    if (Capacitor.isNativePlatform()) {
      if (data["cj_profiles_v2"]) {
        const processed = await Promise.all(data["cj_profiles_v2"].map(async (p) => {
          if (p.avatar && p.avatar.startsWith("file://")) {
            const base64 = await getBase64OfFile(p.avatar);
            if (base64) return { ...p, avatar: base64 };
          }
          return p;
        }));
        data["cj_profiles_v2"] = processed;
      }
      if (data["cj_trade_setups_v2"]) {
        const processed = await Promise.all(data["cj_trade_setups_v2"].map(async (s) => {
          if (s.image && s.image.startsWith("file://")) {
            const base64 = await getBase64OfFile(s.image);
            if (base64) return { ...s, image: base64 };
          }
          return s;
        }));
        data["cj_trade_setups_v2"] = processed;
      }
    }

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

  // Check if cloud backup needs to be auto-restored (if local database is empty)
  const checkForAutoRestore = useCallback(async (token) => {
    try {
      const [localTrades, localSpot, localLive] = await Promise.all([
        _load("cj_trades_v2", []),
        _load("cj_spot_open_v2", []),
        _load("cj_live_v2", [])
      ]);

      const isLocalEmpty = (!localTrades || localTrades.length === 0 || localTrades.every(t => String(t.id).startsWith("demo_"))) &&
                           (!localSpot || localSpot.length === 0) &&
                           (!localLive || localLive.length === 0);

      if (!isLocalEmpty) {
        return;
      }

      const backups = await listDriveBackups(token);
      if (backups && backups.length > 0) {
        const latestBackup = backups[0];
        const ciphertext = await downloadDriveBackup(latestBackup.id, token);
        const decryptionKey = masterKey || "cj_serverless_default_key";
        const decryptedJSON = decryptBackup(ciphertext, decryptionKey);
        const backup = JSON.parse(decryptedJSON);

        if (backup && backup.schemaVersion === 2 && backup.data) {
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
            "cj_alerts_v1",
            "cj_trade_setups_v2"
          ];

          for (const k of keys) {
            const backedVal = backup.data[k];
            if (backedVal !== undefined) {
              let valToSave = backedVal;
              if (typeof backedVal === "string") {
                try { valToSave = JSON.parse(backedVal); } catch { /* ignore */ }
              }
              const finalVal = await processRestoredKey(k, valToSave);
              await _save(k, finalVal);
            }
          }
          window.location.reload();
        }
      }
    } catch (e) {
      console.error("Auto-restore check failed:", e);
    }
  }, [masterKey]);

  // Authenticate Google
  async function authenticateGoogle(clientIdVal = googleClientId) {
    if (!clientIdVal) throw new Error("Google Client ID is missing. Please set it in Security settings.");
    try {
      setSyncing(true);
      const authResult = await loginGoogle(clientIdVal);
      setGoogleAccessToken(authResult.accessToken);
      if (authResult.accessToken) {
        sessionStorage.setItem("cj_google_access_token", authResult.accessToken);
      }
      if (authResult.email) {
        setUserEmail(authResult.email);
        localStorage.setItem("cj_google_user_email", authResult.email);
      }
      
      await clearDemoDataIfNeeded();

      await checkForAutoRestore(authResult.accessToken);
      
      setSyncing(false);
      return authResult.accessToken;
    } catch (e) {
      setSyncing(false);
      throw e;
    }
  }

  // Check for Google OAuth Redirect Result (Web callback)
  const checkRedirectResult = useCallback(async (clientIdVal = googleClientId) => {
    if (Capacitor.getPlatform() !== "web") return null;
    try {
      setSyncing(true);
      const authResult = await handleGoogleRedirect(clientIdVal);
      if (authResult && authResult.accessToken) {
        setGoogleAccessToken(authResult.accessToken);
        sessionStorage.setItem("cj_google_access_token", authResult.accessToken);
        if (authResult.email) {
          setUserEmail(authResult.email);
          localStorage.setItem("cj_google_user_email", authResult.email);
        }
        
        await clearDemoDataIfNeeded();

        await checkForAutoRestore(authResult.accessToken);

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
  }, [googleClientId, checkForAutoRestore]);

  // Handle web redirect result automatically on mount
  useEffect(() => {
    if (Capacitor.getPlatform() === "web") {
      const hasRedirectParams = window.location.hash.includes("access_token") ||
                                window.location.search.includes("code") ||
                                window.location.search.includes("state");
      if (hasRedirectParams) {
        Promise.resolve().then(() => {
          checkRedirectResult();
        });
      }
    }
  }, [checkRedirectResult]);

  // Clear Google session on logout
  const clearGoogleSession = () => {
    setGoogleAccessToken(null);
    setUserEmail("");
    localStorage.removeItem("cj_google_user_email");
    sessionStorage.removeItem("cj_google_access_token");
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

      const payload = await buildBackupPayload();
      
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

      const moduleKeyMap = {
        trades: ["cj_trades_v2"],
        spot: ["cj_spot_open_v2"],
        live: ["cj_live_v2"],
        keys: ["cj_apikeys_v2"],
        settings: ["cj_symbols_v2", "cj_capital_v2", "cj_profiles_v2", "cj_active_v2", "cj_theme_v2", "cj_other_deposits_v1", "cj_withdrawals_map_v1", "cj_alerts_v1", "cj_trade_setups_v2"]
      };

      for (const [moduleName, storageKeys] of Object.entries(moduleKeyMap)) {
        if (selectedModules[moduleName]) {
          for (const k of storageKeys) {
            const backedVal = backup.data[k];
            if (backedVal !== undefined) {
              if (backedVal === null) {
                await _save(k, null);
              } else {
                let valToSave = backedVal;
                if (typeof backedVal === "string") {
                  try { valToSave = JSON.parse(backedVal); } catch { /* ignore parsing errors and fall back to original value */ }
                }
                const finalVal = await processRestoredKey(k, valToSave);
                await _save(k, finalVal);
              }
            }
          }
        }
      }

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
      const payload = await buildBackupPayload();
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
        settings: ["cj_symbols_v2", "cj_capital_v2", "cj_profiles_v2", "cj_active_v2", "cj_theme_v2", "cj_other_deposits_v1", "cj_withdrawals_map_v1", "cj_alerts_v1", "cj_trade_setups_v2"]
      };

      for (const [moduleName, storageKeys] of Object.entries(moduleKeyMap)) {
        if (selectedModules[moduleName]) {
          for (const k of storageKeys) {
            const backedVal = backup.data[k];
            if (backedVal !== undefined) {
              if (backedVal === null) {
                await _save(k, null);
              } else {
                let valToSave = backedVal;
                if (typeof backedVal === "string") {
                  try { valToSave = JSON.parse(backedVal); } catch { /* ignore parsing errors and fall back to original value */ }
                }
                const finalVal = await processRestoredKey(k, valToSave);
                await _save(k, finalVal);
              }
            }
          }
        }
      }

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
