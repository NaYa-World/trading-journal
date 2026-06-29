import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { App } from "@capacitor/app";
import CryptoJS from "crypto-js";
import { setStorageEncryption } from "../utils/storage.js";

const SecurityContext = createContext(null);

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) throw new Error("useSecurity must be used within a SecurityProvider");
  return context;
};

const SECURITY_PREFS_KEY = "cj_security_prefs_v1";
const APP_LOCK_KEY_SERVER = "com.trading.journal.masterkey";

export const SecurityProvider = ({ children }) => {
  const [isLocked, setIsLocked] = useState(true);
  const [masterKey, setMasterKey] = useState(null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);

  // Security preferences state
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [lockTimeout, setLockTimeout] = useState(5); // in minutes
  const [keyOption, setKeyOption] = useState("biometric"); // 'biometric' | 'password' | 'machine'
  const [salt, setSalt] = useState("");
  const [machineKey, setMachineKey] = useState("");

  const backgroundTimeRef = useRef(null);

  // Initialize biometric availability and load preferences
  useEffect(() => {
    const init = async () => {
      // 1. Check if biometric is hardware available
      if (Capacitor.isNativePlatform()) {
        try {
          const result = await NativeBiometric.isAvailable();
          setIsBiometricAvailable(result.isAvailable);
        } catch (e) {
          console.warn("Biometrics check failed:", e);
          setIsBiometricAvailable(false);
        }
      } else {
        setIsBiometricAvailable(false);
      }

      // 2. Load preferences from raw localStorage
      try {
        const prefs = JSON.parse(localStorage.getItem(SECURITY_PREFS_KEY));
        if (prefs) {
          setAppLockEnabled(prefs.appLockEnabled ?? false);
          setLockTimeout(prefs.lockTimeout ?? 5);
          setKeyOption(prefs.keyOption ?? (Capacitor.getPlatform() === "web" ? "password" : "biometric"));
          setSalt(prefs.salt || "");
          if (prefs.machineKey) setMachineKey(prefs.machineKey);

          if (!prefs.appLockEnabled) {
            setIsLocked(false);
            setMasterKey("cj_serverless_default_key");
          } else {
            // Need to authenticate
            setIsLocked(true);
          }
        } else {
          setIsLocked(false);
          setMasterKey("cj_serverless_default_key");
        }
      } catch (e) {
        console.error("Failed to load security preferences:", e);
        setIsLocked(false);
        setMasterKey("cj_serverless_default_key");
      }
    };

    init();
  }, []);

  // Update storage encryption wrappers whenever masterKey changes
  useEffect(() => {
    if (masterKey) {
      setStorageEncryption(
        (val) => CryptoJS.AES.encrypt(val, masterKey).toString(),
        (ciphertext) => {
          try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, masterKey);
            return bytes.toString(CryptoJS.enc.Utf8);
          } catch (e) {
            console.error("Decryption failed:", e);
            return null;
          }
        }
      );
    } else {
      setStorageEncryption((v) => v, (v) => null);
    }
  }, [masterKey]);

  // Save preferences helper
  const savePrefs = (updated) => {
    const current = {
      appLockEnabled,
      lockTimeout,
      keyOption,
      salt,
      machineKey,
      ...updated,
    };
    localStorage.setItem(SECURITY_PREFS_KEY, JSON.stringify(current));
  };

  // Generate a random 64-digit hex key
  const generateMachineKey = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  // Helper: derive key using PBKDF2
  const deriveKeyFromPassword = (password, currentSalt) => {
    let s = currentSalt;
    if (!s) {
      // Generate new salt
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      s = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
      setSalt(s);
      savePrefs({ salt: s });
    }
    return CryptoJS.PBKDF2(password, s, { keySize: 256 / 32, iterations: 50000 }).toString();
  };

  // Setup security/lock options
  const setupSecurity = async (option, passwordOrKey = "") => {
    try {
      let derived = "";
      let newMachineKey = "";

      if (option === "biometric") {
        if (!isBiometricAvailable && Capacitor.isNativePlatform()) {
          throw new Error("Biometric hardware not available");
        }
        // Generate random key to act as master key
        derived = generateMachineKey();
        if (Capacitor.isNativePlatform()) {
          // Save in secure store
          await NativeBiometric.setCredentials({
            username: "journal_user",
            password: derived,
            server: APP_LOCK_KEY_SERVER,
          });
        } else {
          // Web fallback: save in localStorage
          localStorage.setItem("cj_web_bio_fallback", derived);
        }
      } else if (option === "password") {
        if (!passwordOrKey) throw new Error("Password cannot be empty");
        derived = deriveKeyFromPassword(passwordOrKey, salt);
      } else if (option === "machine") {
        newMachineKey = passwordOrKey || generateMachineKey();
        derived = CryptoJS.SHA256(newMachineKey).toString();
        setMachineKey(newMachineKey);
      }

      setKeyOption(option);
      setMasterKey(derived);
      setAppLockEnabled(true);
      setIsLocked(false);

      savePrefs({
        appLockEnabled: true,
        keyOption: option,
        machineKey: newMachineKey,
      });

      return { success: true, machineKey: newMachineKey };
    } catch (e) {
      console.error("Failed to setup security:", e);
      return { success: false, error: e.message };
    }
  };

  // Disable lock
  const disableSecurity = () => {
    setAppLockEnabled(false);
    setMasterKey("cj_serverless_default_key");
    setIsLocked(false);
    savePrefs({ appLockEnabled: false });

    // Clean up biometric store if native
    if (Capacitor.isNativePlatform() && keyOption === "biometric") {
      NativeBiometric.deleteCredentials({ server: APP_LOCK_KEY_SERVER }).catch(() => {});
    }
  };

  // Authenticate (Unlock)
  const authenticate = useCallback(async (inputPasswordOrKey = "") => {
    try {
      if (keyOption === "biometric") {
        if (Capacitor.isNativePlatform()) {
          // Trigger native biometrics
          await NativeBiometric.verifyIdentity({
            reason: "Unlock your Trading Journal",
            title: "App Lock",
            subtitle: "Use biometrics to unlock",
            description: "Verify your identity",
            negativeButtonText: "Cancel",
          });
          // Retrieve secure key
          const credentials = await NativeBiometric.getCredentials({
            server: APP_LOCK_KEY_SERVER,
          });
          if (credentials && credentials.password) {
            setMasterKey(credentials.password);
            setIsLocked(false);
            return { success: true };
          } else {
            throw new Error("Secure credentials not found");
          }
        } else {
          // Web fallback
          const fallback = localStorage.getItem("cj_web_bio_fallback");
          if (fallback) {
            setMasterKey(fallback);
            setIsLocked(false);
            return { success: true };
          } else {
            // First time setup mock
            const key = generateMachineKey();
            localStorage.setItem("cj_web_bio_fallback", key);
            setMasterKey(key);
            setIsLocked(false);
            return { success: true };
          }
        }
      } else if (keyOption === "password") {
        const derived = deriveKeyFromPassword(inputPasswordOrKey, salt);
        // We verify the derived key by checking if we can decrypt something small
        // or we just set it. If it's incorrect, decryption of the trades will fail/yield empty.
        // To verify password correctness, we can save an encrypted test string "VALID_KEY" under a special key.
        const testCipher = localStorage.getItem("cj_auth_check_v1");
        if (testCipher) {
          try {
            const dec = CryptoJS.AES.decrypt(testCipher, derived).toString(CryptoJS.enc.Utf8);
            if (dec === "VERIFIED") {
              setMasterKey(derived);
              setIsLocked(false);
              return { success: true };
            } else {
              return { success: false, error: "Incorrect password" };
            }
          } catch (e) {
            return { success: false, error: "Incorrect password" };
          }
        } else {
          // First setup validation
          const enc = CryptoJS.AES.encrypt("VERIFIED", derived).toString();
          localStorage.setItem("cj_auth_check_v1", enc);
          setMasterKey(derived);
          setIsLocked(false);
          return { success: true };
        }
      } else if (keyOption === "machine") {
        if (!inputPasswordOrKey) return { success: false, error: "Recovery key is required" };
        const cleanKey = inputPasswordOrKey.trim().toLowerCase();
        if (cleanKey.length !== 64) return { success: false, error: "Key must be exactly 64 characters" };
        const derived = CryptoJS.SHA256(cleanKey).toString();

        const testCipher = localStorage.getItem("cj_auth_check_v1");
        if (testCipher) {
          try {
            const dec = CryptoJS.AES.decrypt(testCipher, derived).toString(CryptoJS.enc.Utf8);
            if (dec === "VERIFIED") {
              setMasterKey(derived);
              setIsLocked(false);
              return { success: true };
            } else {
              return { success: false, error: "Invalid recovery key" };
            }
          } catch (e) {
            return { success: false, error: "Invalid recovery key" };
          }
        } else {
          // First setup validation
          const enc = CryptoJS.AES.encrypt("VERIFIED", derived).toString();
          localStorage.setItem("cj_auth_check_v1", enc);
          setMasterKey(derived);
          setIsLocked(false);
          return { success: true };
        }
      }
      return { success: false, error: "Unknown lock configuration" };
    } catch (e) {
      console.error("Unlock failed:", e);
      return { success: false, error: e.message || "Unlock failed" };
    }
  }, [keyOption, salt]);

  const loginSession = useCallback((customKey = "nayatrading_default_key") => {
    setMasterKey(customKey);
    setIsLocked(false);
  }, []);

  // Lock App
  const lockApp = useCallback(() => {
    if (appLockEnabled) {
      setIsLocked(true);
      setMasterKey(null);
    }
  }, [appLockEnabled]);

  // Monitor app lifecycle for auto-lock timeout
  useEffect(() => {
    if (!appLockEnabled || lockTimeout <= 0) return;

    const handleAppState = (state) => {
      if (state.isActive) {
        // App resumed
        if (backgroundTimeRef.current) {
          const secondsPast = (Date.now() - backgroundTimeRef.current) / 1000;
          const minsPast = secondsPast / 60;
          if (minsPast >= lockTimeout) {
            lockApp();
          }
          backgroundTimeRef.current = null;
        }
      } else {
        // App paused/sent to background
        backgroundTimeRef.current = Date.now();
      }
    };

    let sub;
    if (Capacitor.isNativePlatform()) {
      App.addListener("appStateChange", handleAppState).then((s) => {
        sub = s;
      });
    }

    return () => {
      if (sub) sub.remove();
    };
  }, [appLockEnabled, lockTimeout, lockApp]);

  // Helper encryption methods
  const encryptData = useCallback((dataString) => {
    if (!masterKey) return dataString; // No-op if key not ready
    return CryptoJS.AES.encrypt(dataString, masterKey).toString();
  }, [masterKey]);

  const decryptData = useCallback((ciphertext) => {
    if (!masterKey) return null;
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, masterKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      console.error("Decryption failed:", e);
      return null;
    }
  }, [masterKey]);

  return (
    <SecurityContext.Provider
      value={{
        isLocked,
        masterKey,
        appLockEnabled,
        lockTimeout,
        isBiometricAvailable,
        keyOption,
        machineKey,
        setLockTimeout: (mins) => {
          setLockTimeout(mins);
          savePrefs({ lockTimeout: mins });
        },
        setupSecurity,
        disableSecurity,
        authenticate,
        loginSession,
        lockApp,
        encryptData,
        decryptData,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};
