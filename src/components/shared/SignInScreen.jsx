import React, { useState, useEffect } from "react";
import { useBackup } from "../../context/BackupContext.jsx";
import { T } from "../../utils/theme.js";

export default function SignInScreen() {
  const { authenticateGoogle, checkRedirectResult } = useBackup();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle Web OAuth Redirects on mount
  useEffect(() => {
    const handleRedirect = async () => {
      setLoading(true);
      await checkRedirectResult();
      setLoading(false);
    };
    handleRedirect();
  }, [checkRedirectResult]);

  const handleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await authenticateGoogle();
      // On success, the main.jsx will automatically unmount this screen 
      // because userEmail will be set in context.
    } catch (e) {
      setError(e.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
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
            👤
          </div>
        </div>

        <h2 style={{ color: T.bright, fontSize: 22, fontWeight: 700, margin: "0 0 8px 0" }}>
          Sign In Required
        </h2>
        <p style={{ color: T.dim, fontSize: 14, margin: "0 0 32px 0", lineHeight: 1.5 }}>
          You must sign in with your Google account to access your trading dashboard and synchronize data.
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

        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            background: "#ffffff",
            color: "#000000",
            border: "none",
            borderRadius: 10,
            padding: "14px 28px",
            fontSize: 15,
            fontWeight: 700,
            fontFamily: T.sans,
            cursor: "pointer",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.2s"
          }}
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="G" style={{ width: 20, height: 20 }} />
          {loading ? "Signing in..." : "Continue with Google"}
        </button>
        
        <style>{`
          @keyframes pulseGlow {
            0% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.1); }
            100% { opacity: 0.5; transform: scale(1); }
          }
          .pulse-glow {
            animation: pulseGlow 2.5s infinite ease-in-out;
          }
        `}</style>
      </div>
    </div>
  );
}
