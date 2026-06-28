import { useState, useRef, useEffect } from "react";
import { T } from "../utils/theme.js";
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useBackup } from "../context/BackupContext.jsx";
import { loadCustomSetupTypes, saveCustomSetupTypes } from "../utils/storage.js";

const SETUP_TYPES = [
  { id: "Unassigned", label: "🏷 Unassigned", color: T.dim },
  { id: "Breakout", label: "🏷 Breakout", color: T.purple },
  { id: "Reversal", label: "🏷 Reversal", color: T.blue },
  { id: "Continuation", label: "🏷 Continuation", color: T.green },
  { id: "Fakeout", label: "🏷 Fakeout", color: T.orange }
];

export default function TradeSetupsManager({ trades = [], tradeSetups = [], setTradeSetups, showToast }) {
  const [showAddSetup, setShowAddSetup] = useState(false);
  const [newSetup, setNewSetup] = useState({ name: "", type: "Unassigned", image: "", rules: [{ id: crypto.randomUUID(), text: "" }] });
  const { userEmail, authenticateGoogle } = useBackup();
  const fileInputRef = useRef(null);

  const [customTypes, setCustomTypes] = useState([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState("");

  useEffect(() => {
    loadCustomSetupTypes().then(types => {
      setCustomTypes(types || []);
    }).catch(() => {
      setCustomTypes([]);
    });
  }, []);

  const allSetupTypes = [...SETUP_TYPES, ...customTypes];

  // Compute live analytics for each setup
  const computedSetups = tradeSetups.map(setup => {
    const setupTrades = trades.filter(t => t.status === "closed" && (t.setupId === setup.id || (!t.setupId && t.setup === setup.name)));
    const wins = setupTrades.filter(t => t.pnl > 0);
    const winRate = setupTrades.length ? Math.round((wins.length / setupTrades.length) * 100) : 0;
    const pnl = setupTrades.reduce((sum, t) => sum + t.pnl, 0);
    return { ...setup, winRate, totalTrades: setupTrades.length, pnl, wins: wins.length };
  });

  const getImageUrl = (uri) => {
    if (!uri) return "";
    if (uri.startsWith('http') || uri.startsWith('data:')) return uri;
    if (Capacitor.isNativePlatform()) return Capacitor.convertFileSrc(uri);
    return uri;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Data = ev.target.result;
      if (Capacitor.isNativePlatform()) {
        try {
          if (newSetup.image) {
            await Filesystem.deleteFile({ url: newSetup.image }).catch(() => {});
          }
          const fileName = `${Date.now()}_setup.jpg`;
          const savedFile = await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Data });
          setNewSetup(prev => ({ ...prev, image: savedFile.uri }));
        } catch {
          if (showToast) showToast("Failed to save image natively.", "error");
        }
      } else {
        setNewSetup(prev => ({ ...prev, image: base64Data }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSetup = () => {
    if (!newSetup.name.trim()) {
      if (showToast) showToast("Name is required", "error");
      return;
    }
    const cleanRules = newSetup.rules.map(r => r.text).filter(r => r.trim() !== "");
    const selectedType = allSetupTypes.find(t => t.id === newSetup.type) || allSetupTypes[0];
    
    if (newSetup.id) {
      setTradeSetups(tradeSetups.map(s => s.id === newSetup.id ? {
        ...s,
        name: newSetup.name,
        type: newSetup.type,
        typeColor: selectedType.color,
        rulesCount: cleanRules.length,
        rules: cleanRules,
        image: newSetup.image
      } : s));
    } else {
      setTradeSetups([...tradeSetups, {
        id: crypto.randomUUID(),
        name: newSetup.name,
        type: newSetup.type,
        typeColor: selectedType.color,
        rulesCount: cleanRules.length,
        rules: cleanRules,
        image: newSetup.image,
        timestamp: new Date().toLocaleDateString()
      }]);
    }
    setShowAddSetup(false);
    setNewSetup({ name: "", type: "Unassigned", image: "", rules: [{ id: crypto.randomUUID(), text: "" }] });
  };

  const handleEditClick = (setup) => {
    setNewSetup({
      id: setup.id,
      name: setup.name,
      type: setup.type,
      image: setup.image || "",
      rules: setup.rules && setup.rules.length > 0 
        ? setup.rules.map((r, i) => ({ id: i.toString(), text: r }))
        : [{ id: crypto.randomUUID(), text: "" }]
    });
    setShowAddSetup(true);
  };

  const handleAddCustomType = () => {
    if (!newTypeInput.trim()) return;
    const newType = {
      id: newTypeInput.trim(),
      label: `🏷 ${newTypeInput.trim()}`,
      color: T.purple // Can randomize or default to a brand color
    };
    const updated = [...customTypes, newType];
    setCustomTypes(updated);
    saveCustomSetupTypes(updated);
    setNewSetup({ ...newSetup, type: newType.id });
    setNewTypeInput("");
    setShowAddType(false);
  };

  const handleDelete = (id) => {
    if(confirm("Delete this setup?")) {
      setTradeSetups(tradeSetups.filter(s => s.id !== id));
    }
  };

  // Aggregated Analytics
  const totalSetups = computedSetups.length;
  const totalTradesAll = computedSetups.reduce((sum, s) => sum + s.totalTrades, 0);
  const totalWinsAll = computedSetups.reduce((sum, s) => sum + (s.wins || 0), 0);
  const avgWinRate = totalTradesAll > 0 ? Math.round((totalWinsAll / totalTradesAll) * 100) : 0;
  const bestSetup = [...computedSetups].sort((a,b) => b.winRate - a.winRate)[0]?.name || "N/A";

  const getSetupColor = (typeId) => allSetupTypes.find(t => t.id === typeId)?.color || T.dim;
  
  return (
    <div style={{ padding: "env(safe-area-inset-top, 20px) 16px 120px 16px", minHeight: "100%", background: T.bg, fontFamily: T.sans }}>
      
      {/* Banner */}
      {!userEmail && (
        <div style={{ background: `${T.purple}15`, border: `1px solid ${T.purple}40`, borderRadius: 12, padding: "16px", marginBottom: 24, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 20 }}>🔒</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 13, lineHeight: 1.4, fontWeight: 500, marginBottom: 12 }}>
              <span style={{ fontWeight: 700 }}>Sign in to backup your trades across devices.</span> Keep working offline anytime.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={authenticateGoogle} style={{ background: T.panel2, border: `1px solid ${T.border}`, color: "#FFF", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Sign In</button>
              <button onClick={authenticateGoogle} style={{ background: T.purple, color: "#FFF", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Sign Up</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#FFF", marginBottom: 4, letterSpacing: "-0.5px" }}>Trade Setups</div>
          <div style={{ fontSize: 14, color: T.dim }}>Plan. Track. Improve.</div>
        </div>
        <button onClick={() => setShowAddSetup(true)} style={{ 
          background: T.purple, border: "none", color: "#FFF", 
          borderRadius: 10, padding: "10px 16px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
          fontSize: 14, cursor: "pointer"
        }}>
          <span style={{ fontSize: 18, fontWeight: 400 }}>+</span> New Setup
        </button>
      </div>

      {/* Setups Grid */}
      {computedSetups.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingBottom: 16, marginBottom: 24 }}>
          {computedSetups.map(setup => (
            <div key={setup.id} style={{ 
              background: T.panel, border: `1px solid ${T.border}`, 
              borderRadius: 14, padding: 12,
              display: "flex", flexDirection: "column"
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFF", marginBottom: 10, lineHeight: 1.3 }}>{setup.name}</div>
              
              <div 
                onClick={() => !setup.image && handleEditClick(setup)}
                style={{ 
                  width: "100%", height: 90, borderRadius: 8, overflow: "hidden", marginBottom: 12, 
                  border: setup.image ? `1px solid ${T.border}` : `1px dashed ${T.border}`,
                  cursor: setup.image ? "default" : "pointer"
                }}
              >
                {setup.image ? (
                  <img src={getImageUrl(setup.image)} alt="Setup Chart" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: T.panel2, color: T.dim, fontSize: 11 }}>
                    <div style={{ fontSize: 20, marginBottom: 4, color: T.purple }}>🖼️</div>
                    <div style={{ fontWeight: 700, color: "#FFF", marginBottom: 2 }}>Add chart</div>
                    <div style={{ fontSize: 9 }}>Upload your chart image</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <div style={{ background: getSetupColor(setup.type), color: "#FFF", padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  🏷 {setup.type}
                </div>
                <div style={{ background: T.panel2, border: `1px solid ${T.border}`, color: T.dim, padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10 }}>☰</span> {setup.rulesCount || 0} rules
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <div style={{ color: T.dim }}>Win rate</div>
                  <div style={{ fontWeight: 700, color: setup.winRate >= 50 ? T.green : T.red }}>{setup.totalTrades > 0 ? `${setup.winRate}%` : "—"}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <div style={{ color: T.dim }}>Trades</div>
                  <div style={{ fontWeight: 700, color: "#FFF" }}>{setup.totalTrades || "0"}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <div style={{ color: T.dim }}>PnL</div>
                  <div style={{ fontWeight: 700, color: setup.pnl > 0 ? T.green : (setup.pnl < 0 ? T.red : T.dim) }}>
                    {setup.pnl > 0 ? "+" : ""}{setup.pnl !== 0 ? "$" + setup.pnl.toLocaleString() : "—"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", color: T.dim, fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12 }}>🕒</span> {setup.totalTrades > 0 ? (setup.timestamp || "5d ago") : "No trades yet"}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span onClick={() => handleEditClick(setup)} style={{ cursor: "pointer", fontSize: 12 }}>✏️</span>
                  <span onClick={() => handleDelete(setup.id)} style={{ color: T.red, cursor: "pointer", fontSize: 12 }}>🗑</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: T.dim, padding: 40, textAlign: "center", background: T.panel, borderRadius: 16, border: `1px solid ${T.border}`, marginBottom: 24 }}>
          No setups created yet. Click "+ New Setup" to start tracking!
        </div>
      )}

      {/* Analytics Overview */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.purple, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>OVERVIEW</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#FFF" }}>Trade Setup Analytics</div>
          </div>
          <div style={{ background: T.panel2, border: `1px solid ${T.border}`, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, color: T.purple, fontSize: 18 }}>
            📈
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.purple}15`, display: "flex", alignItems: "center", justifyContent: "center", color: T.purple, marginBottom: 12, fontSize: 18 }}>📚</div>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>Total Setups</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF" }}>{totalSetups}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.purple}15`, display: "flex", alignItems: "center", justifyContent: "center", color: T.purple, marginBottom: 12, fontSize: 18 }}>🎯</div>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>Avg Win</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: avgWinRate > 50 ? T.green : T.red }}>{avgWinRate}%</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", borderRight: `1px solid ${T.border}`, padding: "0 8px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.purple}15`, display: "flex", alignItems: "center", justifyContent: "center", color: T.purple, marginBottom: 12, fontSize: 18 }}>🏆</div>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>Best Setup</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#FFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{bestSetup}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.purple}15`, display: "flex", alignItems: "center", justifyContent: "center", color: T.purple, marginBottom: 12, fontSize: 18 }}>📊</div>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>Total Trades</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF" }}>{totalTradesAll}</div>
          </div>
        </div>
      </div>

      {/* Bottom CTA Card */}
      <div onClick={() => setShowAddSetup(true)} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${T.purple}15`, display: "flex", alignItems: "center", justifyContent: "center", color: T.purple, fontSize: 24, fontWeight: 300 }}>+</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.purple, marginBottom: 4 }}>+ Create New Setup</div>
          <div style={{ fontSize: 13, color: T.dim }}>Start tracking a new trade setup</div>
        </div>
        <div style={{ color: T.purple, fontSize: 20 }}>›</div>
      </div>


      {/* Modal Overlay */}
      {showAddSetup && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "24px 20px 20px", borderBottom: `1px solid ${T.border}`, background: T.panel }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${T.purple}15`, color: T.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                ◎
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#FFF", marginBottom: 2 }}>{newSetup.id ? "Edit Trade Setup" : "New Trade Setup"}</div>
                <div style={{ fontSize: 13, color: T.dim }}>Name it, tag the style, attach your chart,<br/>and list what must be true.</div>
              </div>
            </div>
            <button onClick={() => setShowAddSetup(false)} style={{ background: "none", border: "none", color: T.dim, fontSize: 24, cursor: "pointer", padding: 0 }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {/* Basics */}
            <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: 1.5, marginBottom: 12 }}>BASICS</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Setup Name <span style={{color: T.red}}>*</span></div>
            <input 
              type="text" placeholder="e.g. GBPJPY liquidity sweep" value={newSetup.name} 
              onChange={e => setNewSetup({...newSetup, name: e.target.value})}
              style={{ width: "100%", padding: "16px 14px", background: T.bg, border: `1px solid ${T.border}`, color: "#FFF", borderRadius: 12, marginBottom: 24, fontSize: 16, boxSizing: "border-box", outline: "none" }}
            />

            <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Setup Type</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
              {allSetupTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setNewSetup({...newSetup, type: type.id})}
                  style={{
                    background: newSetup.type === type.id ? type.color : T.panel2,
                    border: `1px solid ${newSetup.type === type.id ? type.color : T.border}`,
                    color: newSetup.type === type.id ? "#FFF" : T.dim,
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {type.label}
                </button>
              ))}
              
              {!showAddType ? (
                <button
                  onClick={() => setShowAddType(true)}
                  style={{
                    background: T.panel2,
                    border: `1px dashed ${T.border}`,
                    color: T.dim,
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  + Add Type
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Type name..."
                    value={newTypeInput}
                    onChange={(e) => setNewTypeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomType()}
                    style={{ background: T.bg, border: `1px solid ${T.purple}`, color: "#FFF", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", width: 120 }}
                  />
                  <button onClick={handleAddCustomType} style={{ background: T.purple, color: "#FFF", border: "none", borderRadius: 8, padding: "0 12px", cursor: "pointer", fontWeight: 700 }}>✓</button>
                  <button onClick={() => setShowAddType(false)} style={{ background: T.panel2, color: T.dim, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0 12px", cursor: "pointer" }}>✕</button>
                </div>
              )}
            </div>

            {/* Reference Chart */}
            <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: 1.5, marginBottom: 4, textTransform: "uppercase" }}>Reference Chart</div>
            <div style={{ fontSize: 13, color: T.dim, marginBottom: 12 }}>Your ideal example for this setup</div>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{ 
                border: `2px dashed ${T.purple}40`, background: `${T.purple}05`, borderRadius: 16, padding: "32px 20px", 
                textAlign: "center", cursor: "pointer", marginBottom: 32, position: "relative", overflow: "hidden"
              }}
            >
              {newSetup.image ? (
                <>
                  <img src={getImageUrl(newSetup.image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 }}>
                    <div style={{ color: "#FFF", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}><span style={{fontSize:18}}>↺</span> Change Image</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${T.purple}15`, color: T.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 16px" }}>
                    🖼️
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF", marginBottom: 8 }}>Add chart screenshot</div>
                  <div style={{ fontSize: 13, color: T.dim }}>Annotate levels, zones, and key levels</div>
                </>
              )}
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
            </div>

            {/* Entry Rules */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: 1.5, textTransform: "uppercase" }}>Entry Rules</div>
              <div style={{ background: T.panel2, border: `1px solid ${T.border}`, padding: "4px 10px", borderRadius: 12, color: T.dim, fontSize: 11, fontWeight: 700 }}>
                ☰ {newSetup.rules.filter(r => r.text.trim()).length}
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.dim, marginBottom: 16 }}>What must be true before you take the trade</div>

            {newSetup.rules.map((rule, idx) => (
              <div key={rule.id} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: T.panel2, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim, fontWeight: 700, fontSize: 13, border: `1px solid ${T.border}` }}>
                  {idx + 1}
                </div>
                <input 
                  type="text" 
                  placeholder={idx === 0 ? "e.g. Sweep of Asian high" : "Add another condition..."}
                  value={rule.text}
                  onChange={e => {
                    const newRules = [...newSetup.rules];
                    newRules[idx].text = e.target.value;
                    setNewSetup({ ...newSetup, rules: newRules });
                  }}
                  style={{ flex: 1, padding: "12px 14px", background: T.bg, border: `1px solid ${T.border}`, color: "#FFF", borderRadius: 10, fontSize: 14, outline: "none" }}
                />
                {newSetup.rules.length > 1 && (
                  <button 
                    onClick={() => {
                      const newRules = newSetup.rules.filter((_, i) => i !== idx);
                      setNewSetup({ ...newSetup, rules: newRules });
                    }} 
                    style={{ background: "none", border: "none", color: T.red, fontSize: 20, cursor: "pointer", padding: "0 8px" }}
                  >×</button>
                )}
              </div>
            ))}

            <button 
              onClick={() => setNewSetup({ ...newSetup, rules: [...newSetup.rules, { id: Date.now().toString(), text: "" }] })}
              style={{ background: "transparent", border: `1px dashed ${T.dim}`, color: T.dim, borderRadius: 10, padding: 12, width: "100%", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 }}
            >
              + Add rule
            </button>
            <div style={{ height: 100 }} /> {/* spacer for sticky bottom */}
          </div>

          {/* Sticky Footer */}
          <div style={{ borderTop: `1px solid ${T.border}`, background: T.panel, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <button 
              onClick={handleSaveSetup}
              disabled={!newSetup.name.trim()}
              style={{ 
                width: "100%", padding: 16, background: newSetup.name.trim() ? T.purple : T.panel2, 
                color: newSetup.name.trim() ? "#FFF" : T.dim, border: "none", borderRadius: 12, 
                fontWeight: 700, fontSize: 16, cursor: newSetup.name.trim() ? "pointer" : "not-allowed"
              }}
            >
              ✓ Create setup
            </button>
            <button 
              onClick={() => setShowAddSetup(false)}
              style={{ width: "100%", padding: 16, background: T.panel2, color: "#FFF", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
