import { useState } from "react";
import { T } from "../../utils/theme.js";

export default function ProfileManagerModal({ profiles, activeId, onSwitch, onAdd, onDelete, onClose }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💼");
  const [color, setColor] = useState("#6366f1");
  const EMOJIS = ["💼", "📈", "🪙", "🔥", "⚡", "🎯", "🧪", "🤖", "🌙", "💎"];
  const COLORS = ["#6366f1", "#00d4a3", "#f97316", "#22d3ee", "#a855f7", "#ec4899", "#eab308", "#ef4444"];

  const handleCreate = () => {
    if (!name.trim()) return;
    onAdd({ id: `profile_${Date.now()}`, name: name.trim(), emoji, color });
    setCreating(false); setName(""); setEmoji("💼"); setColor("#6366f1");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000092", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 26, width: "min(420px,95vw)", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: T.mono, fontSize: 15, color: T.bright, letterSpacing: 1 }}>PROFILES</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>

        {profiles.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: activeId === p.id ? T.blueDim : T.panel2, border: `1px solid ${activeId === p.id ? p.color + "60" : T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: p.color + "20", border: `1px solid ${p.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{p.emoji}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.bright }}>{p.name}</div>
                {activeId === p.id && <div style={{ fontSize: 11, color: p.color, fontFamily: T.mono, letterSpacing: 1 }}>ACTIVE</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {activeId !== p.id && <button onClick={() => { onSwitch(p.id); onClose(); }} style={{ background: T.blueDim, border: `1px solid ${T.blue}40`, color: T.blue, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: T.mono }}>Switch</button>}
              {profiles.length > 1 && p.id !== "default" && <button onClick={() => onDelete(p.id)} style={{ background: "none", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>}
            </div>
          </div>
        ))}

        {creating ? (
          <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginTop: 12 }}>
            <div style={{ fontSize: 13, color: T.bright, fontWeight: 700, marginBottom: 12 }}>New Profile</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Profile name (e.g. Binance Spot)"
              style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 14, width: "100%", fontFamily: T.mono, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
            <div style={{ fontSize: 11, color: T.dim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>Emoji</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {EMOJIS.map(em => <button key={em} onClick={() => setEmoji(em)} style={{ background: emoji === em ? T.blueDim : T.panel, border: `1px solid ${emoji === em ? T.blue + "60" : T.border}`, borderRadius: 6, width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>{em}</button>)}
            </div>
            <div style={{ fontSize: 11, color: T.dim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>Colour</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {COLORS.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? `3px solid ${T.bright}` : "3px solid transparent", cursor: "pointer" }} />)}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setCreating(false)} style={{ background: "none", border: `1px solid ${T.dim}`, color: T.dim, borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontFamily: T.mono }}>Cancel</button>
              <button onClick={handleCreate} style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 6, padding: "7px 18px", cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 700 }}>Create</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} style={{ width: "100%", background: "none", border: `1px dashed ${T.border}`, color: T.dim, borderRadius: 10, padding: "12px 0", cursor: "pointer", fontSize: 14, marginTop: 8 }}>+ New Profile</button>
        )}
      </div>
    </div>
  );
}
