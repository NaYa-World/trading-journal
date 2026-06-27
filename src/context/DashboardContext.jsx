import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import CryptoJS from "crypto-js";
import { StatusBar, Style } from '@capacitor/status-bar';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { T, THEMES, updateTheme } from "../utils/theme.js";
import { Capacitor } from '@capacitor/core';
import {
  loadTrades, saveTrades, loadSpotOpen, saveSpotOpen,
  loadLiveTrades, saveLiveTrades, loadSavedSymbols, saveSavedSymbols,
  loadTradeSetups, saveTradeSetups, loadAlerts, saveAlerts,
  loadCapital, saveCapital, loadProfiles, saveProfiles,
  loadActiveProfile, saveActiveProfile, loadTheme, saveThemePref,
  loadReviews, saveReviews, loadApiKeys, saveApiKeys,
} from "../utils/storage.js";
import {
  STABLES, QUOTES, getQuoteCurrency, fetchUsdtRate,
  fmt$, fmtPnl, fmtDate, fmtDateShort, formatMaskedDate, parseMaskedDate,
  getOrdinal, sequenceTransactions,
} from "../utils/helpers.js";
import {
  SETUPS, MISTAKES, CLOSE_REASONS, SIDES, EXCHANGES,
  CRYPTO_TRADE_TYPES, DEFAULT_SYMBOLS, DEFAULT_PROFILES, NAV_ITEMS,
} from "../utils/constants.js";
import { createTrade } from "../utils/tradeFactory.js";
import { calculatePnL } from "../utils/calculations.js";
import { PricesProvider } from "./PricesContext.jsx";

const DashboardContext = createContext();


export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

export function DashboardProvider({ children }) {
  // Theme state
  const [activeThemeKey, setActiveThemeKey] = useState(() => {
    let t = loadTheme();
    // Migrating old 'dark'/'light' values to new names
    if (t === "dark") t = "oceanBlue";
    if (t === "light") t = "ledgerPaper";
    return t;
  });

  // Navigation state
  const [view, setView] = useState("Dashboard");
  const [subTab, setSubTab] = useState("Overview");

  // Profile manager states
  const [profiles, setProfiles] = useState(loadProfiles);
  const [activeProfileId, setActiveProfileId] = useState(loadActiveProfile);
  const [showProfiles, setShowProfiles] = useState(false);

  // Capital is now derived from the active profile
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || {};
  const initialCapital = activeProfile.initialCapital || 0;
  
  const setInitialCapital = (newCap) => {
    setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, initialCapital: newCap } : p));
  };

  // API sync key states
  const [apiKeys, setApiKeys] = useState(loadApiKeys);

  // Trades state
  const [allTrades, setAllTrades] = useState(loadTrades);
  const [allSpotOpen, setAllSpotOpen] = useState(loadSpotOpen);
  const [allLiveTrades, setAllLiveTrades] = useState(loadLiveTrades);
  
  // Watchlist & symbol settings
  const [savedSymbols, setSavedSymbols] = useState(loadSavedSymbols);
  
  // Trade Setups
  const [tradeSetups, setTradeSetups] = useState(loadTradeSetups);

  // Keyboard undo states
  const [undoTrade, setUndoTrade] = useState(null);
  const undoTimerRef = useRef(null);

  // Reviews state
  const [reviews, setReviews] = useState(loadReviews);
  const [reviewKey, setReviewKey] = useState(null);

  // Modals state
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewChartTrade, setViewChartTrade] = useState(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // Filters state
  const [dateRange, setDateRange] = useState("all");
  const [filterSetup, setFilterSetup] = useState("All");
  const [filterCoin, setFilterCoin] = useState("All");
  const [filterResult, setFilterResult] = useState("All");
  const [filterTrade, setFilterTrade] = useState("All");
  const [filterCapitalActivity, setFilterCapitalActivity] = useState("All");

  // Prefilled states for linking
  const [prefilledLiveSymbol, setPrefilledLiveSymbol] = useState(null);
  const [prefilledAlertSymbol, setPrefilledAlertSymbol] = useState(null);

  // Mobile responsiveness
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isMobile = width <= 768;

  // Price Alerts state
  const [alerts, setAlerts] = useState(loadAlerts);
  const [notifications, setNotifications] = useState([]);
  
  const [appToast, setAppToast] = useState(null);
  const showToast = useCallback((msg, type = "info") => {
    setAppToast({ msg, type, id: Date.now() });
    setTimeout(() => setAppToast(null), 4000);
  }, []);

  // ── Theme Sync Effect ──
  useEffect(() => {
    saveThemePref(activeThemeKey);
    updateTheme(activeThemeKey);
    document.body.style.background = T.bg;
    document.body.style.color = T.text;
    
    // Attempt to set a matching status bar style based on the theme
    const isActuallyDark = THEMES[activeThemeKey]?.bg?.toUpperCase() !== "#FDF6E3" && THEMES[activeThemeKey]?.bg?.toUpperCase() !== "#F0F4F8";
    StatusBar.setStyle({ style: isActuallyDark ? Style.Dark : Style.Light }).catch(() => {});
  }, [activeThemeKey]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // If user hasn't explicitly set a theme, follow system
      if (!localStorage.getItem('cj_theme_v1')) {
        setActiveThemeKey(e.matches ? "oceanBlue" : "ledgerPaper");
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

useEffect(() => {
    saveProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    saveApiKeys(apiKeys);
  }, [apiKeys]);

  useEffect(() => {
    saveSavedSymbols(savedSymbols);
  }, [savedSymbols]);

  useEffect(() => {
    saveTradeSetups(tradeSetups);
  }, [tradeSetups]);

  useEffect(() => {
    if (view === "Dashboard") {
      setSubTab("Overview");
    } else if (view === "Profile") {
      setSubTab("Accounts");
    } else {
      setSubTab("All");
    }
  }, [view]);

  // ── Profile and Trade Aggregation ──
  const profileTrades = useMemo(() => {
    const filtered = allTrades.filter(t => (t.profileId || "default") === activeProfileId);
    return sequenceTransactions(filtered);
  }, [allTrades, activeProfileId]);

  const trades = useMemo(() => {
    const now = Date.now();
    let cutoff = 0;
    if (dateRange === "7d") cutoff = now - 7 * 86400000;
    else if (dateRange === "30d") cutoff = now - 30 * 86400000;
    else if (dateRange === "90d") cutoff = now - 90 * 86400000;
    else if (dateRange === "ytd") cutoff = new Date(new Date().getFullYear(), 0, 1).getTime();
    else if (dateRange === "1y") cutoff = now - 365 * 86400000;

    return profileTrades.filter(t => {
      if (cutoff > 0 && t.closeTime < cutoff && t.openTime < cutoff) return false;
      const isDeposit = t.entryType === "Deposit" || t.symbol === "Deposit";
      const isWithdrawal = t.entryType === "Withdrawal" || t.symbol === "Withdrawal";
      const isCapitalActivity = isDeposit || isWithdrawal;

      if (!isCapitalActivity) {
        if (filterSetup !== "All" && t.setup !== filterSetup) return false;
        if (filterCoin !== "All" && t.symbol !== filterCoin) return false;
        if (filterResult === "Win" && t.pnl <= 0) return false;
        if (filterResult === "Loss" && t.pnl >= 0) return false;
        if (filterTrade === "spot" && (t.tradeType || "Spot") !== "Spot") return false;
        if (filterTrade === "futures" && t.tradeType !== "Futures") return false;
        if (filterTrade === "deposit" || filterTrade === "withdrawal") return false; // Hide regular trades when filtering by deposits/withdrawals
      } else {
        if (filterTrade === "spot" || filterTrade === "futures") return false; // Hide deposits/withdrawals when filtering by trade types
        if (filterTrade === "deposit" && !isDeposit) return false;
        if (filterTrade === "withdrawal" && !isWithdrawal) return false;
      }

      return true;
    });
  }, [profileTrades, dateRange, filterSetup, filterCoin, filterResult, filterTrade, filterCapitalActivity]);

  const spotOpen = useMemo(() => allSpotOpen.filter(t => (t.profileId || "default") === activeProfileId), [allSpotOpen, activeProfileId]);
  const liveTrades = useMemo(() => allLiveTrades.filter(t => (t.profileId || "default") === activeProfileId), [allLiveTrades, activeProfileId]);
  const closed = useMemo(() => trades.filter(t => t.status === "closed"), [trades]);
  const isJournalEmpty = profileTrades.length === 0 && spotOpen.length === 0 && liveTrades.length === 0;
  const isFilteredEmpty = trades.length === 0 && spotOpen.length === 0 && liveTrades.length === 0;

  // ── Combined Live Price Hook & Alerts Check ──
  const activeAlertSymbols = useMemo(() => {
    return alerts.filter(a => !a.triggered).map(a => a.symbol);
  }, [alerts]);

  const allWatchedSymbols = useMemo(() => {
    const symMap = new Map();
    liveTrades.forEach(t => {
      symMap.set(t.symbol, t.exchange || "Binance");
      const qc = getQuoteCurrency(t.symbol);
      if (qc && qc !== "USDT" && !symMap.has(`${qc}USDT`)) symMap.set(`${qc}USDT`, "Binance");
    });
    spotOpen.forEach(t => {
      symMap.set(t.symbol, t.exchange || "Binance");
      const qc = getQuoteCurrency(t.symbol);
      if (qc && qc !== "USDT" && !symMap.has(`${qc}USDT`)) symMap.set(`${qc}USDT`, "Binance");
    });
    
    const wl = Array.isArray(savedSymbols) ? savedSymbols : DEFAULT_SYMBOLS;
    wl.slice(0, 30).forEach(s => {
      if (!symMap.has(s)) symMap.set(s, "Binance");
    });
    
    activeAlertSymbols.forEach(s => {
      if (!symMap.has(s)) symMap.set(s, "Binance");
    });
    
    return Array.from(symMap.entries()).map(([symbol, exchange]) => ({ symbol, exchange }));
  }, [liveTrades, spotOpen, savedSymbols, activeAlertSymbols]);

  const alertsRef = useRef(alerts);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  // Alert processing is handled by AlertsEngine component which has access to PricesContext

  // ── Actions ──
  const addAlert = useCallback((newAlert) => {
    setAlerts(prev => {
      const next = [...prev, {
        id: Date.now() + Math.random().toString(),
        symbol: newAlert.symbol,
        condition: newAlert.condition,
        targetPrice: newAlert.targetPrice,
        triggered: false
      }];
      saveAlerts(next);
      return next;
    });
  }, []);

  const deleteAlert = useCallback((id) => {
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id);
      saveAlerts(next);
      return next;
    });
  }, []);

  const deleteFinishedTrade = useCallback((id) => {
    setAllTrades(prev => {
      const tradeToDelete = prev.find(t => t.id === id);
      if (tradeToDelete) {
        setUndoTrade(tradeToDelete);
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => {
          setUndoTrade(null);
        }, 5000);
      }
      const next = prev.filter(t => t.id !== id);
      saveTrades(next);
      return next;
    });
    setEditingTrade(null);
  }, []);

  const restoreDeletedTrade = useCallback(() => {
    setUndoTrade(prevUndo => {
      if (prevUndo) {
        setAllTrades(prev => {
          if (prev.some(t => t.id === prevUndo.id)) return prev;
          const next = [...prev, prevUndo].sort((a, b) => a.closeTime - b.closeTime);
          saveTrades(next);
          return next;
        });
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      }
      return null;
    });
  }, []);

  const handleEditTrade = useCallback((updatedTrade) => {
    setAllTrades(prev => {
      if (!prev.some(t => t.id === updatedTrade.id)) return prev;
      const next = prev.map(t => t.id === updatedTrade.id ? updatedTrade : t);
      saveTrades(next);
      return next;
    });

    setAllSpotOpen(prev => {
      if (!prev.some(t => t.id === updatedTrade.id)) return prev;
      const next = prev.map(t => t.id === updatedTrade.id ? updatedTrade : t);
      saveSpotOpen(next);
      return next;
    });

    setAllLiveTrades(prev => {
      if (!prev.some(t => t.id === updatedTrade.id)) return prev;
      const next = prev.map(t => t.id === updatedTrade.id ? updatedTrade : t);
      saveLiveTrades(next);
      return next;
    });

    setEditingTrade(null);
  }, []);

  const saveSymbol = useCallback((sym) => {
    setSavedSymbols(prev => {
      if (prev.includes(sym)) return prev;
      const next = [...prev, sym];
      saveSavedSymbols(next);
      return next;
    });
  }, []);

  const handleQuickAdd = useCallback(async (data) => {
    const sym = data.symbol.trim().toUpperCase();
    const e = parseFloat(data.entry);
    const x = parseFloat(data.exit);
    const q = parseFloat(data.qty);
    const side = data.side;

    if (!sym || isNaN(e) || e <= 0 || isNaN(x) || x <= 0 || isNaN(q) || q <= 0) return;

    saveSymbol(sym);

    const quoteCurrency = getQuoteCurrency(sym);
    const openT = Date.now() - 3600000;
    const closeT = Date.now();

    const [usdtRate, closeUsdtRate] = await Promise.all([
      fetchUsdtRate(quoteCurrency, openT),
      fetchUsdtRate(quoteCurrency, closeT)
    ]);

    const tradeType = "Futures";
    const { nativePnl, pnl } = calculatePnL({
      entry: e,
      exit: x,
      qty: q,
      side,
      leverage: 1,
      tradeType,
      quoteRateOpen: usdtRate,
      quoteRateClose: closeUsdtRate,
      action: side
    });

    const fees = -(e * q * 0.0006 + x * q * 0.0006);

    const nextTrade = createTrade({
      id: Date.now(),
      symbol: sym, tradeType: "Futures",
      exchange: "Binance", side, displayType: `Futures ${side}`, action: side,
      entry: e, exit: x, qty: q,
      leverage: 1,
      nativePnl: parseFloat(nativePnl.toFixed(6)),
      pnl: parseFloat(pnl.toFixed(2)),
      fees: parseFloat(fees.toFixed(4)),
      openTime: openT, closeTime: closeT,
      status: "closed",
      notes: "Quick Logged",
      setup: "BREAKOUT",
      mistake: "None",
      closeReason: "Target Hit",
      tags: ["BREAKOUT"],
      profileId: activeProfileId || "default",
      quoteCurrency,
      usdtRate,
      closeUsdtRate
    });

    setAllTrades(prev => { const next = [...prev, nextTrade].sort((a, b) => a.closeTime - b.closeTime); saveTrades(next); return next; });
  }, [activeProfileId, saveSymbol]);

  const addTrade = useCallback((t) => {
    setAllTrades(prev => { const next = [...prev, t].sort((a, b) => a.closeTime - b.closeTime); saveTrades(next); return next; });
  }, []);

  const importTrades = useCallback((newTrades) => {
    const open = newTrades.filter(t => t.status === "open" || t.status === "spot_open" || t.status === "live");
    const closed = newTrades.filter(t => t.status === "closed" || !t.status);

    if (open.length > 0) {
      const openSpot = open.filter(t => t.tradeType === "Spot").map(t => ({ ...t, status: "spot_open" }));
      const openFutures = open.filter(t => t.tradeType === "Futures" || t.tradeType === "Margin").map(t => ({ ...t, status: "live" }));

      if (openSpot.length > 0) {
        setAllSpotOpen(prev => {
          const prevFiltered = prev.filter(p => !openSpot.some(o => o.id === p.id));
          const next = [...prevFiltered, ...openSpot];
          saveSpotOpen(next);
          return next;
        });
      }
      if (openFutures.length > 0) {
        setAllLiveTrades(prev => {
          const prevFiltered = prev.filter(p => !openFutures.some(o => o.id === p.id));
          const next = [...prevFiltered, ...openFutures];
          saveLiveTrades(next);
          return next;
        });
      }
    }

    if (closed.length > 0) {
      const closedMapped = closed.map(t => ({ ...t, status: "closed" }));
      setAllTrades(prev => {
        const prevFiltered = prev.filter(p => !closedMapped.some(c => c.id === p.id));
        const next = [...prevFiltered, ...closedMapped].sort((a, b) => a.closeTime - b.closeTime);
        saveTrades(next);
        return next;
      });
    }
  }, []);

  const addSpotOpen = useCallback((t) => {
    setAllSpotOpen(prev => { const next = [...prev, t]; saveSpotOpen(next); return next; });
  }, []);

  const closeSpotOpen = useCallback(async (openTrade, { exit, closeTime, fees, closeReason, notes, mistake, chartUrl }) => {
    const quoteCurrency = openTrade.quoteCurrency || "USDT";
    const closeUsdtRate = await fetchUsdtRate(quoteCurrency, closeTime, openTrade.exchange);
    const openUsdtRate = openTrade.usdtRate || 1;

    const nativePnl = (exit - openTrade.entry) * openTrade.qty;
    const pnlUsdt = (exit * openTrade.qty * closeUsdtRate) - (openTrade.entry * openTrade.qty * openUsdtRate);

    const finished = createTrade({
      ...openTrade, exit, closeTime, fees,
      nativePnl: parseFloat(nativePnl.toFixed(6)),
      pnl: parseFloat(pnlUsdt.toFixed(2)),
      closeUsdtRate,
      closeReason, notes: notes || openTrade.notes,
      mistake, chartUrl,
      status: "closed", side: "Long", action: "Buy",
      displayType: "Spot Buy", tags: [openTrade.setup],
    });
    setAllSpotOpen(prev => { const next = prev.filter(t => t.id !== openTrade.id); saveSpotOpen(next); return next; });
    setAllTrades(prev => { const next = [...prev, finished].sort((a, b) => a.closeTime - b.closeTime); saveTrades(next); return next; });
  }, []);

  const deleteSpotOpen = useCallback((id) => {
    setAllSpotOpen(prev => { const next = prev.filter(t => t.id !== id); saveSpotOpen(next); return next; });
  }, []);

  const handleApiSync = async (apiKey, apiSecret) => {
    if (Capacitor.isNativePlatform()) {
      throw new Error("Direct API Sync is not supported on the mobile app. Please use the Web version.");
    }
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = CryptoJS.HmacSHA256(queryString, apiSecret).toString(CryptoJS.enc.Hex);

    const res = await fetch(`https://fapi.binance.com/fapi/v2/positionRisk?${queryString}&signature=${signature}`, {
      headers: { "X-MBX-APIKEY": apiKey }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    const data = await res.json();
    const openPositions = data.filter(p => parseFloat(p.positionAmt) !== 0);

    openPositions.forEach(p => {
      const qty = Math.abs(parseFloat(p.positionAmt));
      const entry = parseFloat(p.entryPrice);
      const side = parseFloat(p.positionAmt) > 0 ? "Long" : "Short";

      setAllLiveTrades(prev => {
        if (prev.some(lt => lt.symbol === p.symbol && lt.profileId === activeProfileId)) return prev;
        const newTrade = createTrade({
          id: Date.now() + Math.random(),
          symbol: p.symbol, tradeType: "Futures",
          side, action: side, displayType: `Futures ${side}`,
          entry, qty,
          openTime: Date.now(),
          status: "open", profileId: activeProfileId
        });
        const next = [...prev, newTrade];
        saveLiveTrades(next);
        return next;
      });
    });
  };

  const addLiveTrade = useCallback((t) => {
    setAllLiveTrades(prev => { const next = [...prev, t]; saveLiveTrades(next); return next; });
  }, []);

  const closeLiveTrade = useCallback(async (liveTrade, { exit, closeReason, mistake, chartUrl, fees }) => {
    const closeTime = Date.now();
    const quoteCurrency = liveTrade.quoteCurrency || "USDT";
    const closeUsdtRate = await fetchUsdtRate(quoteCurrency, closeTime, liveTrade.exchange);
    const openUsdtRate = liveTrade.usdtRate || 1;

    const lev = liveTrade.leverage || 1;
    const nativePnl = (exit - liveTrade.entry) * liveTrade.qty * (liveTrade.side === "Long" ? 1 : -1) * lev;
    const pnlUsdt = (liveTrade.side === "Long"
      ? (exit * liveTrade.qty * closeUsdtRate) - (liveTrade.entry * liveTrade.qty * openUsdtRate)
      : (liveTrade.entry * liveTrade.qty * openUsdtRate) - (exit * liveTrade.qty * closeUsdtRate)) * lev;

    const finished = createTrade({
      ...liveTrade, exit, closeReason, fees, mistake, chartUrl,
      nativePnl: parseFloat(nativePnl.toFixed(6)),
      pnl: parseFloat(pnlUsdt.toFixed(2)),
      closeUsdtRate,
      closeTime, status: "closed", tags: [liveTrade.setup || liveTrade.tradeType]
    });
    setAllLiveTrades(prev => { const next = prev.filter(t => t.id !== liveTrade.id); saveLiveTrades(next); return next; });
    setAllTrades(prev => { const next = [...prev, finished].sort((a, b) => a.closeTime - b.closeTime); saveTrades(next); return next; });
  }, []);

  const saveReview = useCallback((key, data) => {
    setReviews(prev => { const next = { ...prev, [key]: data }; saveReviews(next); return next; });
  }, []);

  const openReview = (key) => { setReviewKey(key); setShowReviewModal(true); };

  const switchProfile = useCallback((id) => {
    setActiveProfileId(id);
    saveActiveProfile(id);
  }, []);

  const addProfile = useCallback((p) => {
    setProfiles(prev => { const next = [...prev, p]; saveProfiles(next); return next; });
  }, []);

  const updateProfile = useCallback((id, updates) => {
    setProfiles(prev => { 
      const next = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      saveProfiles(next); 
      return next; 
    });
  }, []);

  const deleteProfile = useCallback((id) => {
    setProfiles(prev => { const next = prev.filter(p => p.id !== id); saveProfiles(next); return next; });
    if (activeProfileId === id) switchProfile("default");
  }, [activeProfileId, switchProfile]);

  const clearAllData = () => {
    setAllTrades(prev => { const next = prev.filter(t => (t.profileId || "default") !== activeProfileId); saveTrades(next); return next; });
    setAllSpotOpen(prev => { const next = prev.filter(t => (t.profileId || "default") !== activeProfileId); saveSpotOpen(next); return next; });
    setAllLiveTrades(prev => { const next = prev.filter(t => (t.profileId || "default") !== activeProfileId); saveLiveTrades(next); return next; });
    setShowClearConfirm(false);
  };

  const downloadCSV = useCallback(() => {
    const _profileTrades = allTrades.filter(t => (t.profileId || "default") === activeProfileId);
    const profileSpotOpen = allSpotOpen.filter(t => (t.profileId || "default") === activeProfileId);
    const profileLive = allLiveTrades.filter(t => (t.profileId || "default") === activeProfileId);
    const allItems = [..._profileTrades, ...profileSpotOpen, ...profileLive];

    const escapeCsvCell = (val) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      "ID", "Symbol", "Type", "Side", "Action", "Entry", "Exit", "Qty", "Fees", "PnL", 
      "Leverage", "StopLoss", "TakeProfit", "OpenTime", "CloseTime", "Status", "Setup", 
      "Mistake", "CloseReason", "Notes", "Tags", "EntryType"
    ];

    const rows = allItems.map(t => [
      t.id || "",
      t.symbol || "",
      t.tradeType || "Spot",
      t.side || "",
      t.action || "",
      t.entry !== undefined && t.entry !== null ? t.entry : "",
      t.exit !== undefined && t.exit !== null ? t.exit : "",
      t.qty !== undefined && t.qty !== null ? t.qty : "",
      t.fees !== undefined && t.fees !== null ? t.fees : "",
      t.pnl !== undefined && t.pnl !== null ? t.pnl : "",
      t.leverage !== undefined && t.leverage !== null ? t.leverage : "",
      t.stopLoss !== undefined && t.stopLoss !== null ? t.stopLoss : "",
      t.takeProfit !== undefined && t.takeProfit !== null ? t.takeProfit : "",
      t.openTime ? new Date(t.openTime).toISOString() : "",
      t.closeTime ? new Date(t.closeTime).toISOString() : "",
      t.status || "",
      t.setup || "",
      t.mistake || "",
      t.closeReason || "",
      t.notes || "",
      t.tags ? t.tags.join(";") : "",
      t.entryType || ""
    ].map(escapeCsvCell));

    const csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const filename = `trading_journal_${fmtDateShort(Date.now()).replace("/", "-")}.csv`;

    if (Capacitor.isNativePlatform()) {
      // Native: save to Documents via Capacitor Filesystem
      try {
        Filesystem.writeFile({
          path: filename,
          data: csvContent,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        }).then(() => {
          showToast(`CSV saved to Documents/${filename}`, "success");
        }).catch(err => {
          console.error("CSV export failed:", err);
          showToast("Failed to save CSV file.", "error");
        });
      } catch (err) {
        console.error("CSV export failed:", err);
        showToast("Failed to save CSV file.", "error");
      }
    } else {
      // Web: standard blob download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [allTrades, activeProfileId, allSpotOpen, allLiveTrades, showToast]);

  const exportPDF = useCallback((month, year) => {
    const closed = trades.filter(t => t.status === "closed" && new Date(t.closeTime).getMonth() === month && new Date(t.closeTime).getFullYear() === year);
    const totalPnl = closed.reduce((s, t) => s + t.pnl, 0);
    const wins = closed.filter(t => t.pnl > 0);
    const losses = closed.filter(t => t.pnl < 0);
    const winRate = closed.length ? Math.round((wins.length / closed.length) * 100) : 0;
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
    const monthName = new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const review = reviews[`${year}-${month}`];
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}h1{font-size:24px;color:#4f46e5;margin-bottom:4px}.sub{font-size:13px;color:#64748b;margin-bottom:28px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px}.card-label{font-size:10px;color:#94a3b8;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px}.card-val{font-size:20px;font-weight:700;font-family:monospace}.green{color:#059669}.red{color:#e11d48}.blue{color:#4f46e5}table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:28px}th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:9px;letter-spacing:1px;color:#64748b;text-transform:uppercase}td{padding:7px 10px;border-bottom:1px solid #f1f5f9}.section{font-size:14px;font-weight:700;color:#1e293b;margin:24px 0 12px;border-bottom:2px solid #e2e8f0;padding-bottom:6px}.rb{background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:12px}.rl{font-size:10px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}.rt{font-size:13px;color:#334155;line-height:1.6}</style></head><body>
<h1>Trading Report — ${monthName}</h1><div class="sub">Generated ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</div>
<div class="grid"><div class="card"><div class="card-label">Total P&L</div><div class="card-val ${totalPnl >= 0 ? "green" : "red"}">${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} USDT</div></div><div class="card"><div class="card-label">Trades</div><div class="card-val blue">${closed.length}</div></div><div class="card"><div class="card-label">Win Rate</div><div class="card-val ${winRate >= 50 ? "green" : "red"}">${winRate}%</div></div><div class="card"><div class="card-label">Avg Win / Loss</div><div class="card-val" style="font-size:14px"><span class="green">+${avgWin.toFixed(2)}</span> / <span class="red">${avgLoss.toFixed(2)}</span></div></div></div>
<div class="section">Trade History</div><table><thead><tr><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>Qty</th><th>P&L</th><th>Setup</th><th>Date</th></tr></thead><tbody>${closed.sort((a, b) => b.closeTime - a.closeTime).map(t => `<tr><td><b>${t.symbol}</b></td><td style="color:${t.side === "Long" ? "#059669" : "#e11d48"}">${t.side}</td><td>${t.entry?.toFixed(4) ?? '–'}</td><td>${t.exit?.toFixed(4) ?? '–'}</td><td>${t.qty}</td><td style="color:${t.pnl >= 0 ? "#059669" : "#e11d48"};font-weight:700">${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}</td><td>${t.setup || "–"}</td><td>${new Date(t.closeTime).toLocaleDateString("en-IN")}</td></tr>`).join("")}</tbody></table>
${review ? `<div class="section">Monthly Review</div>${review.bestTrade ? `<div class="rb"><div class="rl">Best Trade</div><div class="rt">${review.bestTrade}</div></div>` : ""}${review.worstTrade ? `<div class="rb"><div class="rl">Worst Trade</div><div class="rt">${review.worstTrade}</div></div>` : ""}${review.lesson ? `<div class="rb"><div class="rl">Key Lesson</div><div class="rt">${review.lesson}</div></div>` : ""}${review.improvement ? `<div class="rb"><div class="rl">Focus Next Month</div><div class="rt">${review.improvement}</div></div>` : ""}` : ""}
</body></html>`;
    if (Capacitor.isNativePlatform()) {
      // Native: save HTML report to Documents
      try {
        const filename = `TradeReport_${monthName.replace(" ", "_")}.html`;
        Filesystem.writeFile({
          path: filename,
          data: html,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        }).then(() => {
          showToast(`Report saved to Documents/${filename}`, "success");
        }).catch(err => {
          console.error("PDF export failed:", err);
          showToast("Failed to save report.", "error");
        });
      } catch (err) {
        console.error("PDF export failed:", err);
        showToast("Failed to save report.", "error");
      }
    } else {
      try {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = function() {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          };
          setTimeout(() => {
            try {
              printWindow.focus();
              printWindow.print();
            } catch (e) {}
          }, 500);
        } else {
          throw new Error("Popup blocked");
        }
      } catch (e) {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `TradeReport_${monthName.replace(" ", "_")}.html`; a.click();
        URL.revokeObjectURL(url);
      }
    }
  }, [trades, reviews, showToast]);

  const contextValue = useMemo(() => ({
    view, setView,
    subTab, setSubTab,
    profiles, setProfiles, setShowProfiles, activeProfile,
    activeThemeKey, setActiveThemeKey,
    initialCapital, setInitialCapital,
    apiKeys, setApiKeys,
    allTrades, allSpotOpen, allLiveTrades,
    savedSymbols, setSavedSymbols,
    tradeSetups, setTradeSetups,
    undoTrade, setUndoTrade,
    reviews, setReviews, reviewKey, setReviewKey,
    showDataMenu, setShowDataMenu,
    showAddModal, setShowAddModal,
    showClearConfirm, setShowClearConfirm,
    showCSVModal, setShowCSVModal,
    showReviewModal, setShowReviewModal,
    showSyncModal, setShowSyncModal,
    showSecurityModal, setShowSecurityModal,
    editingTrade, setEditingTrade,
    viewChartTrade, setViewChartTrade,
    dateRange, setDateRange,
    filterSetup, setFilterSetup,
    filterCoin, setFilterCoin,
    filterResult, setFilterResult,
    filterTrade, setFilterTrade,
    filterCapitalActivity, setFilterCapitalActivity,
    prefilledLiveSymbol, setPrefilledLiveSymbol,
    prefilledAlertSymbol, setPrefilledAlertSymbol,
    alerts, setAlerts,
    notifications, setNotifications,
    appToast, setAppToast, showToast,
    profileTrades, trades, spotOpen, liveTrades, closed, isJournalEmpty, isFilteredEmpty,
    isMobile, T,
    addAlert, deleteAlert,
    deleteFinishedTrade, restoreDeletedTrade, handleEditTrade,
    saveSymbol, handleQuickAdd, addTrade, importTrades, addSpotOpen,
    closeSpotOpen, deleteSpotOpen, handleApiSync, addLiveTrade, closeLiveTrade,
    saveReview, openReview, switchProfile, addProfile, updateProfile, deleteProfile, clearAllData,
    downloadCSV, exportPDF
  }), [
    view, subTab, profiles, activeProfileId, showProfiles, activeProfile,
    activeThemeKey, initialCapital, apiKeys, allTrades, allSpotOpen, allLiveTrades, savedSymbols, tradeSetups,
    undoTrade, reviews, reviewKey, showDataMenu, showAddModal, showClearConfirm,
    showCSVModal, showReviewModal, showSyncModal, showSecurityModal, editingTrade, viewChartTrade,
    dateRange, filterSetup, filterCoin, filterResult, filterTrade, filterCapitalActivity,
    prefilledLiveSymbol, prefilledAlertSymbol, alerts, notifications, appToast,
    isMobile, isJournalEmpty, isFilteredEmpty,
    addAlert, deleteAlert, deleteFinishedTrade, restoreDeletedTrade, handleEditTrade,
    saveSymbol, handleQuickAdd, addTrade, importTrades, addSpotOpen,
    closeSpotOpen, deleteSpotOpen, handleApiSync, addLiveTrade, closeLiveTrade,
    saveReview, openReview, switchProfile, addProfile, updateProfile, deleteProfile, clearAllData,
    downloadCSV, exportPDF, showToast
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DashboardContext.Provider value={contextValue}>
      <PricesProvider symbols={allWatchedSymbols}>
        {children}
      </PricesProvider>
    </DashboardContext.Provider>
  );
}
