/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { DashboardProvider } from "./context/DashboardContext.jsx";
import { SecurityProvider, useSecurity } from "./context/SecurityContext.jsx";
import { BackupProvider, useBackup } from "./context/BackupContext.jsx";
import UnlockScreen from "./components/shared/UnlockScreen.jsx";
import SignInScreen from "./components/shared/SignInScreen.jsx";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";

import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/700.css";

function RootApp() {
  const { isLocked } = useSecurity();
  const { runAutoBackupCheck, userEmail } = useBackup();
  const [isBackground, setIsBackground] = useState(false);

  // Monitor app lifecycle for switcher blur and auto-backup sync triggers
  useEffect(() => {
    let sub;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appStateChange", (state) => {
        setIsBackground(!state.isActive);
        if (state.isActive) {
          // App resumed to foreground: check if backup is due
          runAutoBackupCheck(false);
        } else {
          // App paused to background: check if backup is due
          runAutoBackupCheck(false);
        }
      }).then((s) => {
        sub = s;
      });
      // Initial launch check
      runAutoBackupCheck(false);

      // Edge-to-Edge UI Configuration
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    }
    return () => {
      if (sub) sub.remove();
    };
  }, [runAutoBackupCheck]);

  if (isLocked) {
    return <UnlockScreen />;
  }

  if (!userEmail) {
    return <SignInScreen />;
  }

  return (
    <DashboardProvider>
      <div style={{ filter: isBackground ? "blur(20px)" : "none", transition: "filter 0.15s ease", minHeight: "100vh" }}>
        <App />
      </div>
      {isBackground && (
        <div style={{ position: "fixed", inset: 0, background: "#0b0f1a", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#f1f5f9", fontFamily: "sans-serif" }}>
            <span style={{ fontSize: 48 }}>🔒</span>
            <h2 style={{ marginTop: 12, fontSize: 20 }}>Journal Secured</h2>
          </div>
        </div>
      )}
    </DashboardProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SecurityProvider>
      <BackupProvider>
        <RootApp />
      </BackupProvider>
    </SecurityProvider>
  </StrictMode>
);
