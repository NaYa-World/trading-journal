import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { DashboardProvider } from "./context/DashboardContext.jsx";
import { SecurityProvider, useSecurity } from "./context/SecurityContext.jsx";
import UnlockScreen from "./components/shared/UnlockScreen.jsx";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/700.css";

function RootApp() {
  const { isLocked } = useSecurity();
  const [isBackground, setIsBackground] = useState(false);

  useEffect(() => {
    let sub;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appStateChange", (state) => {
        setIsBackground(!state.isActive);
      }).then((s) => {
        sub = s;
      });
    }
    return () => {
      if (sub) sub.remove();
    };
  }, []);

  if (isLocked) {
    return <UnlockScreen />;
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
  <React.StrictMode>
    <SecurityProvider>
      <RootApp />
    </SecurityProvider>
  </React.StrictMode>
);
