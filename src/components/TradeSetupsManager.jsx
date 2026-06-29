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

const CANDLESTICK_PRESETS = [
  {
    name: "Bullish Hammer Reversal",
    type: "Reversal",
    rules: [
      "Prior downtrend in place",
      "Hammer candle shows long lower wick (2x body)",
      "Next candle closes bullish to confirm",
      "RSI indicator is oversold (< 30)",
      "Reversal occurs on high volume"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iNTAiIHkxPSIzMCIgeDI9IjUwIiB5Mj0iOTAiIHN0cm9rZT0iIzIyYzU1ZSIgc3Ryb2tlLXdpZHRoPSI0Ii8+PHJlY3QgeD0iNDAiIHk9IjMwIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIGZpbGw9IiMyMmM1NWUiIHJ4PSIyIi8+PC9zdmc+"
  },
  {
    name: "Bearish Shooting Star",
    type: "Reversal",
    rules: [
      "Prior uptrend in place",
      "Shooting Star candle has long upper wick (2x body)",
      "RSI indicator is overbought (> 70)",
      "Entry trigger below Shooting Star low",
      "Stop Loss set above upper wick high"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4gPGxpbmUgeDE9IjUwIiB5MT0iMTAiIHgyPSI1MCIgeTI9IjcwIiBzdHJva2U9IiNlZjQ0NDQiIHN0cm9rZT0iNCIvPjxyZWN0IHg9IjQwIiB5PSI1MCIgd2lkdGg9IjIwIiBlaWdodD0iMjAiIGZpbGw9IiNlZjQ0NDQiIHJ4PSIyIi8+PC9zdmc+"
  },
  {
    name: "Bullish Engulfing Breakout",
    type: "Breakout",
    rules: [
      "Prior downtrend approaching support zone",
      "Bullish body completely engulfs previous bearish body",
      "Volume spikes significantly on engulfing candle",
      "Confirm breakout above the engulfing high"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyNSIgeT0iNDAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIzMCIgZmlsbD0iI2VmNDQ0NCIgcng9IjIiLz48bGluZSB4MT0iMzIiIHkxPSIzMCIgeDI9IjMyIiB5Mj0iODAiIHN0cm9rZT0iI2VmNDQ0NCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHJlY3QgeD0iNTUiIHk9IjI1IiB3aWR0aD0iMjAiIGhlaWdodD0iNjAiIGZpbGw9IiMyMmM1NWUiIHJ4PSIyIi8+PGxpbmUgeDE9IjY1IiB5MT0iMTUiIHgyPSI2NSIgeTI9IjkwIiBzdHJva2U9IiMyMmM1NWUiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg=="
  },
  {
    name: "Bearish Engulfing Reversal",
    type: "Reversal",
    rules: [
      "Prior uptrend approaching key resistance zone",
      "Bearish body completely engulfs previous bullish body",
      "Volume spikes significantly on engulfing candle",
      "Confirm breakdown below the engulfing low"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyNSIgeT0iMzUiIHdpZHRoPSIxNSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48bGluZSB4MT0iMzIiIHkxPSIyMCIgeDI9IjMyIiB5Mj0iOTAiIHN0cm9rZT0iIzIyYzU1ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHJlY3QgeD0iNTUiIHk9IjI1IiB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIGZpbGw9IiNlZjQ0NDQiIHJ4PSIyIi8+PGxpbmUgeDE9IjY1IiB5MT0iMTUiIHgyPSI2NSIgeTI9IjkwIiBzdHJva2U9IiNlZjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg=="
  },
  {
    name: "Morning Star Bullish Reversal",
    type: "Reversal",
    rules: [
      "Candle 1: Large bearish candle continuation",
      "Candle 2: Small body star (gaps down or lower)",
      "Candle 3: Large bullish candle closes > 50% of Candle 1",
      "Occurs on strong support level",
      "Confirm with volume spike on Candle 3"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxNSIgeT0iMjAiIHdpZHRoPSIxNSIgaGVpZ2h0PSI1MCIgZmlsbD0iI2VmNDQ0NCIgcng9IjIiLz48cmVjdCB4PSI0MiIgeT0iNjUiIHdpZHRoPSIxNSIgaGVpZ2h0PSIxNSIgZmlsbD0iIzNiODJmNiIgcng9IjIiLz48cmVjdCB4PSI3MCIgeT0iMzAiIHdpZHRoPSIxNSIgaGVpZ2h0PSI0NSIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48L3N2Zz4="
  },
  {
    name: "Evening Star Bearish Reversal",
    type: "Reversal",
    rules: [
      "Candle 1: Large bullish candle continuation",
      "Candle 2: Small body star (gaps up or higher)",
      "Candle 3: Large bearish candle closes > 50% of Candle 1",
      "Occurs on strong resistance level",
      "Confirm with volume spike on Candle 3"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxNSIgeT0iMzAiIHdpZHRoPSIxNSIgaGVpZ2h0PSI0NSIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48cmVjdCB4PSI0MiIgeT0iMjAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIxNSIgZmlsbD0iIzNiODJmNiIgcng9IjIiLz48cmVjdCB4PSI3MCIgeT0iMzUiIHdpZHRoPSIxNSIgaGVpZ2h0PSI0NSIgZmlsbD0iI2VmNDQ0NCIgcng9IjIiLz48L3N2Zz4="
  },
  {
    name: "Doji Decision Breakout",
    type: "Breakout",
    rules: [
      "Price trading in consolidated narrow range",
      "Doji candle formed (open and close are nearly identical)",
      "Enter on break of Doji high (long) or low (short)",
      "Volume expansion confirms the breakout direction"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iNTAiIHkxPSIxMCIgeDI9IjUwIiB5Mj0iOTAiIHN0cm9rZT0iIzhiOTQ5ZSIgc3Ryb2tlLXdpZHRoPSI0Ii8+PGxpbmUgeDE9IjMwIiB5MT0iNTAiIHgyPSI3MCIgeTI9IjUwIiBzdHJva2U9IiM4Yjk0OWUiIHN0cm9rZT0iZDkiLz48L3N2Zz4="
  },
  {
    name: "Bullish Harami Continuation",
    type: "Continuation",
    rules: [
      "Downtrend slowing near major support zone",
      "Candle 1: Large bearish candle",
      "Candle 2: Small bullish candle contained inside Candle 1 body",
      "Trigger long trade when price breaks above Candle 1 high"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyMCIgaGVpZ2h0PSI2MCIgZmlsbD0iI2VmNDQ0NCIgcng9IjIiLz48cmVjdCB4PSI1NSIgeT0iNDAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIyMCIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48L3N2Zz4="
  },
  {
    name: "Bearish Harami Continuation",
    type: "Continuation",
    rules: [
      "Uptrend slowing near major resistance zone",
      "Candle 1: Large bullish candle",
      "Candle 2: Small bearish candle contained inside Candle 1 body",
      "Trigger short trade when price breaks below Candle 1 low"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyMCIgaGVpZ2h0PSI2MCIgZmlsbD0iIzIyYzU1ZSIgcng9IjIiLz48cmVjdCB4PSI1NSIgeT0iNDAiIHdpZHRoPSIxNSIgaGVpZ2h0PSIyMCIgZmlsbD0iI2VmNDQ0NCIgIHJ4PSIyIi8+PC9zdmc+"
  },
  {
    name: "Three White Soldiers",
    type: "Continuation",
    rules: [
      "Prior downtrend bottoming out",
      "Three consecutive long-bodied green candles",
      "Each candle opens within previous body and closes near high",
      "Volume increases on each successive candle"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4gPHJlY3QgeD0iMTUiIHk9IjYwIiB3aWR0aD0iMTUiIGhlaWdodD0iMjUiIGZpbGw9IiMyMmM1NWUiIHJ4PSIyIi8+PHJlY3QgeD0iNDIiIHk9IjQwIiB3aWR0aD0iMTUiIGhlaWdodD0iMzAiIGZpbGw9IiMyMmM1NWUiIHJ4PSIyIi8+PHJlY3QgeD0iNzAiIHk9IjIwIiB3aWR0aD0iMTUiIGhlaWdodD0iMzUiIGZpbGw9IiMyMmM1NWUiIHJ4PSIyIi8+PC9zdmc+"
  }
];

const CHART_PRESETS = [
  {
    name: "Head and Shoulders Reversal",
    type: "Reversal",
    rules: [
      "Identify established uptrend",
      "Left shoulder peaks, then higher Head peak forms",
      "Right shoulder peak forms matching Left Shoulder high",
      "Neckline trendline connects the interim lows",
      "Enter short trade on Neckline breakdown with high volume"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgODAgTDMwIDUwIEw0MCA2MCBMNTAgMzAgTDYwIDYwIEw3MCA1MCBMOTAgODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2VmNDQ0NCIgc3Ryb2tlLXdpZHRoPSI0Ii8+PGxpbmUgeDE9IjI1IiB5MT0iNjAiIHgyPSI3NSIgeTI9IjYwIiBzdHJva2U9IiM4Yjk0OWUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWRhc2hhcnJheT0iNCw0Ii8+PC9zdmc+"
  },
  {
    name: "Double Top Reversal",
    type: "Reversal",
    rules: [
      "Prior strong uptrend in place",
      "Two distinct peaks formed at similar resistance level",
      "Neckline level is mapped at the intermediate valley low",
      "Enter short on candle close breakdown below neckline",
      "Stop Loss positioned just above double top peak heights"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgODAgTDMwIDMwIEw1MCA2MCBMNzAgMzAgTDkwIDgwIiBmaWxsPSJub25lIiBzdHJva2U9IiNlZjQ0NDQiIHN0cm9rZS13aWR0aD0iNCIvPjxsaW5lIHgxPSIyMCIgeTE9IjYwIiB4Mj0iODAiIHkyPSI2MCIgc3Ryb2tlPSIjOGI5NDllIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1kYXNoYXJyYXk9IjQsNCIvPjwvc3ZnPg=="
  },
  {
    name: "Double Bottom Reversal",
    type: "Reversal",
    rules: [
      "Prior strong downtrend in place",
      "Two distinct valleys formed at similar support level",
      "Neckline level is mapped at the intermediate peak high",
      "Enter long on candle close breakout above neckline",
      "Stop Loss positioned just below double bottom valley lows"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgMjAgTDMwIDcwIEw1MCA0MCBMNzAgNzAgTDkwIDgwIiBmaWxsPSJub25lIiBzdHJva2U9IiMyMmM1NWUiIHN0cm9rZT0iNCIvPjxsaW5lIHgxPSIyMCIgeTE9IjQwIiB4Mj0iODAiIHkyPSI0MCIgc3Ryb2tlPSIjOGI5NDllIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1kYXNoYXJyYXk9IjQsNCIvPjwvc3ZnPg=="
  },
  {
    name: "Bull Flag Continuation",
    type: "Continuation",
    rules: [
      "Sharp near-vertical upward pole price action",
      "Orderly downward sloping consolidation flag channel",
      "Enter long trade upon clear breakout of upper flag boundary",
      "Stop Loss set right below the lowest flag consolidation point"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iMjUiIHkxPSI4MCIgeDI9IjI1IiB5Mj0iMjAiIHN0cm9rZT0iIzIyYzU1ZSIgc3Ryb2tlLXdpZHRoPSI0Ii8+PHBhdGggZD0iTTI1IDIwIEw2MCAzMCBMNTUgNDUgTDI1IDM1IFoiIGZpbGw9IiMyMmM1NWUiIG9wYWNpdHk9IjAuMyIgc3Ryb2tlPSIjMjJjNTVlIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4="
  },
  {
    name: "Bear Flag Continuation",
    type: "Continuation",
    rules: [
      "Sharp near-vertical downward pole price action",
      "Orderly upward sloping consolidation flag channel",
      "Enter short trade upon clear breakdown of lower flag boundary",
      "Stop Loss set right above the highest flag consolidation point"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iMjUiIHkxPSI4MCIgeDI9IjI1IiB5Mj0iMjAiIHN0cm9rZT0iI2VmNDQ0NCIgc3Ryb2tlLXdpZHRoPSI0Ii8+PHBhdGggZD0iTTI1IDgwIEw2MCA3MCBMNTUgNTUgTDI1IDY1IFoiIGZpbGw9IiNlZjQ0NDQiIG9wYWNpdHk9IjAuMyIgc3Ryb2tlPSIjZWY0NDQ0IiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4="
  },
  {
    name: "Ascending Triangle Breakout",
    type: "Breakout",
    rules: [
      "Flat horizontal resistance ceiling line",
      "Upward-sloping support baseline showing higher lows",
      "Price compresses as converging lines meet at apex",
      "Enter long trade on high-volume breakout above resistance"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iMTAiIHkxPSIzMCIgeDI9IjkwIiB5Mj0iMzAiIHN0cm9rZT0iIzhiOTQ5ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTEwIDcwIEw0MCA1MCBMNjAgNDAgTDkwIDMwIiBmaWxsPSJub25lIiBzdHJva2U9IiMyMmM1NWUiIHN0cm9rZT0iNCIvPjwvc3ZnPg=="
  },
  {
    name: "Descending Triangle Breakout",
    type: "Breakout",
    rules: [
      "Flat horizontal support floor line",
      "Downward-sloping resistance baseline showing lower highs",
      "Price compresses as converging lines meet at apex",
      "Enter short trade on high-volume breakdown below support"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iMTAiIHkxPSI3MCIgeDI9IjkwIiB5Mj0iNzAiIHN0cm9rZT0iIzhiOTQ5ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTEwIDMwIEw0MCA1MCBMNjAgNjAgTDkwIDcwIiBmaWxsPSJub25lIiBzdHJva2U9IiNlZjQ0NDQiIHN0cm9rZT0iNCIvPjwvc3ZnPg=="
  },
  {
    name: "Symmetrical Triangle Decision",
    type: "Breakout",
    rules: [
      "Downward-sloping resistance trendline on top",
      "Upward-sloping support trendline on bottom",
      "Converging lines showing lower highs and higher lows",
      "Enter in direction of high-volume breakout from either line"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iMTAiIHkxPSIyMCIgeDI9IjgwIiB5Mj0iNTAiIHN0cm9rZT0iIzhiOTQ5ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PGxpbmUgeDE9IjEwIiB5MT0iODAiIHgyPSI4MCIgeTI9IjUwIiBzdHJva2U9IiM4Yjk0OWUiIHN0cm9rZT0iMiIvPjwvc3ZnPg=="
  },
  {
    name: "Cup and Handle Continuation",
    type: "Continuation",
    rules: [
      "Smooth U-shaped round bowl consolidation (Cup)",
      "Flag-like downward sloping brief consolidation (Handle)",
      "Enter long trade when price breaks out above Handle resistance",
      "Set Stop Loss near the bottom pivot point of the Handle"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgMzAgQzI1IDgwIDc1IDgwIDgwIDMwIEw4NSA0NSBMNzUgNTUgTDgwIDMwIiBmaWxsPSJub25lIiBzdHJva2U9IiMyMmM1NWUiIHN0cm9rZT0iNCIvPjwvc3ZnPg=="
  },
  {
    name: "Falling Wedge Reversal",
    type: "Reversal",
    rules: [
      "Two converging downward sloping boundary lines",
      "Price making lower highs and lower lows narrowing together",
      "Wedge slopes against the primary trend slope direction",
      "Enter long trade on high-volume breakout of upper wedge line"
    ],
    image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iMTAiIHkxPSIyMCIgeDI9IjgwIiB5Mj0iNjAiIHN0cm9rZT0iIzhiOTQ5ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PGxpbmUgeDE9IjEwIiB5MT0iNTAiIHgyPSI4MCIgeTI9IjcwIiBzdHJva2U9IiM4Yjk0OWUiIHN0cm9rZT0iMiIvPjwvc3ZnPg=="
  }
];

export default function TradeSetupsManager({ trades = [], tradeSetups = [], setTradeSetups, showToast }) {
  const [showAddSetup, setShowAddSetup] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [newSetup, setNewSetup] = useState({ name: "", type: "Unassigned", image: "", rules: [{ id: crypto.randomUUID(), text: "" }] });
  const { userEmail, authenticateGoogle } = useBackup();
  const fileInputRef = useRef(null);

  const [customTypes, setCustomTypes] = useState([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState("");

  // Handle clicking outside the preset dropdown to close it
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowPresetDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleAddPreset = (preset) => {
    if (tradeSetups.some(s => s.name === preset.name)) {
      if (showToast) showToast(`Setup "${preset.name}" is already added!`, "error");
      return;
    }

    const selectedType = allSetupTypes.find(t => t.id === preset.type) || allSetupTypes[0];

    setTradeSetups([...tradeSetups, {
      id: crypto.randomUUID(),
      name: preset.name,
      type: preset.type,
      typeColor: selectedType.color,
      rulesCount: preset.rules.length,
      rules: preset.rules,
      image: preset.image,
      timestamp: new Date().toLocaleDateString()
    }]);

    if (showToast) showToast(`Added preset: ${preset.name}`, "success");
  };

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
        <div style={{ display: "flex", gap: 10, position: "relative" }} ref={dropdownRef}>
          {/* Preset Dropdown Button */}
          <div style={{ position: "relative" }}>
            <button 
              onClick={() => setShowPresetDropdown(!showPresetDropdown)} 
              style={{ 
                background: T.panel2, border: `1px solid ${T.border}`, color: "#FFF", 
                borderRadius: 10, padding: "10px 16px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
                fontSize: 14, cursor: "pointer", outline: "none"
              }}
            >
              📚 Add Preset ▾
            </button>
            
            {showPresetDropdown && (
              <div style={{
                position: "absolute", top: "110%", right: 0,
                background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12,
                width: 260, maxHeight: 320, overflowY: "auto", zIndex: 100,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)", padding: "8px 0"
              }}>
                <div style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, color: T.purple, letterSpacing: 0.8, textTransform: "uppercase" }}>
                  🕯️ Candlestick Patterns
                </div>
                {CANDLESTICK_PRESETS.map(p => (
                  <div 
                    key={p.name}
                    onClick={() => {
                      handleAddPreset(p);
                      setShowPresetDropdown(false);
                    }}
                    style={{
                      padding: "8px 16px", fontSize: 13, color: T.bright, cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={e => e.target.style.background = T.border}
                    onMouseLeave={e => e.target.style.background = "none"}
                  >
                    {p.name}
                  </div>
                ))}
                
                <div style={{ height: 1, background: T.border, margin: "8px 0" }}></div>
                
                <div style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, color: T.blue, letterSpacing: 0.8, textTransform: "uppercase" }}>
                  📈 Chart Patterns
                </div>
                {CHART_PRESETS.map(p => (
                  <div 
                    key={p.name}
                    onClick={() => {
                      handleAddPreset(p);
                      setShowPresetDropdown(false);
                    }}
                    style={{
                      padding: "8px 16px", fontSize: 13, color: T.bright, cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={e => e.target.style.background = T.border}
                    onMouseLeave={e => e.target.style.background = "none"}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setShowAddSetup(true)} style={{ 
            background: T.purple, border: "none", color: "#FFF", 
            borderRadius: 10, padding: "10px 16px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
            fontSize: 14, cursor: "pointer"
          }}>
            <span style={{ fontSize: 18, fontWeight: 400 }}>+</span> New Setup
          </button>
        </div>
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
