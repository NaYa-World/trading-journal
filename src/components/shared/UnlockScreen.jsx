import React, { useState, useEffect } from "react";
import { useSecurity } from "../../context/SecurityContext.jsx";
import { T } from "../../utils/theme.js";

export default function UnlockScreen() {
  const { authenticate, keyOption, isBiometricAvailable } = useSecurity();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-authenticate on mount if biometric
  useEffect(() => {
    if (keyOption === "biometric") {
      handleBiometricUnlock();
    }
  }, [keyOption]);

  const handleBiometricUnlock = async () => {
    setError("");
    setLoading(true);
    const result = await authenticate();
    setLoading(false);
    if (!result.success) {
      setError(result.error || "Biometric authentication failed.");
    }
  };

  const handleManualUnlock = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      setError("Please enter your password or key.");
      return;
    }

    setError("");
    setLoading(true);
    // Give a short delay to feel premium
    setTimeout(async () => {
      const result = await authenticate(inputValue);
      setLoading(false);
      if (!result.success) {
        setError(result.error || "Authentication failed. Please try again.");
      }
    }, 400);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily: T.sans,
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: T.panel,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: "40px 32px",
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Glow lock icon */}
        <div style={{ position: "relative", marginBottom: 24, display: "inline-block" }}>
          <div
            className="pulse-glow"
            style={{
              position: "absolute",
              inset: -12,
              background: `radial-gradient(circle, ${T.blue}30 0%, transparent 70%)`,
              borderRadius: "50%",
              zIndex: 1,
            }}
          />
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: `${T.blue}15`,
              border: `1px solid ${T.blue}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              position: "relative",
              zIndex: 2,
            }}
          >
            🔒
          </div>
        </div>

        <h2 style={{ color: T.bright, fontSize: 22, fontWeight: 700, margin: "0 0 8px 0" }}>
          Journal Locked
        </h2>
        <p style={{ color: T.dim, fontSize: 14, margin: "0 0 32px 0", lineHeight: 1.5 }}>
          {keyOption === "biometric"
            ? "Authenticate using Face ID / Fingerprint to access your trading dashboard."
            : keyOption === "password"
            ? "Enter your secure password to decrypt your journal."
            : "Enter your 64-digit recovery key to decrypt your journal."}
        </p>

        {error && (
          <div
            style={{
              background: `${T.red}12`,
              border: `1px solid ${T.red}30`,
              color: T.red,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontFamily: T.mono,
              marginBottom: 20,
              lineHeight: 1.4,
              textAlign: "left",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {keyOption === "biometric" ? (
          <button
            onClick={handleBiometricUnlock}
            disabled={loading}
            style={{
              background: T.blue,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "14px 28px",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: T.mono,
              cursor: "pointer",
              width: "100%",
              boxShadow: `0 4px 14px ${T.blue}40`,
              transition: "transform 0.15s, opacity 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {loading ? "Verifying..." : "⚡ Unlock with Biometrics"}
          </button>
        ) : (
          <form onSubmit={handleManualUnlock}>
            {keyOption === "password" ? (
              <input
                type="password"
                placeholder="Enter password..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={loading}
                style={{
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  color: T.bright,
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 14,
                  width: "100%",
                  boxSizing: "border-box",
                  marginBottom: 16,
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = T.blue)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
            ) : (
              <textarea
                placeholder="Enter 64-digit key..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={loading}
                rows={3}
                style={{
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  color: T.bright,
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 12,
                  fontFamily: T.mono,
                  width: "100%",
                  boxSizing: "border-box",
                  marginBottom: 16,
                  outline: "none",
                  resize: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = T.blue)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: T.blue,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "14px 28px",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: T.mono,
                cursor: "pointer",
                width: "100%",
                boxShadow: `0 4px 14px ${T.blue}40`,
                transition: "transform 0.15s, opacity 0.15s",
              }}
            >
              {loading ? "Decrypting..." : "🔓 Unlock Journal"}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .pulse-glow {
          animation: pulse 2.5s infinite alternate ease-in-out;
        }
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.5; }
          100% { transform: scale(1.1); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
