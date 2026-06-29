import { useState, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { T } from "../../utils/theme.js";
import { Skeleton } from "../shared/index.jsx";

export default function ChartModal({ trade, onClose }) {
  const chartContainerRef = useRef();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trade || !chartContainerRef.current) return;

    let chart;
    const fetchKlineData = async () => {
      try {
        if (CapApp && Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
          setLoading(false);
          return;
        }
        const start = trade.openTime - 3 * 86400000;
        const end = (trade.closeTime || Date.now()) + 3 * 86400000;
        const symbol = trade.symbol.replace(/[^A-Z0-9]/ig, "").toUpperCase();
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${start}&endTime=${end}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        const klines = data.map(d => ({
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        chart = createChart(chartContainerRef.current, {
          layout: { background: { type: "solid", color: T.panel }, textColor: T.text },
          grid: { vertLines: { color: T.border }, horzLines: { color: T.border } },
          width: chartContainerRef.current.clientWidth,
          height: 400,
          timeScale: { timeVisible: true, secondsVisible: false }
        });

        const candlestickSeries = chart.addCandlestickSeries({
          upColor: T.green, downColor: T.red, borderVisible: false,
          wickUpColor: T.green, wickDownColor: T.red
        });
        candlestickSeries.setData(klines);

        const markers = [];
        markers.push({
          time: Math.floor(trade.openTime / 1000),
          position: trade.side === "Long" || trade.action === "Buy" ? "belowBar" : "aboveBar",
          color: trade.side === "Long" || trade.action === "Buy" ? T.green : T.red,
          shape: trade.side === "Long" || trade.action === "Buy" ? "arrowUp" : "arrowDown",
          text: `Entry: ${trade.entry}`
        });

        if (trade.closeTime && trade.exit) {
          markers.push({
            time: Math.floor(trade.closeTime / 1000),
            position: trade.side === "Long" || trade.action === "Buy" ? "aboveBar" : "belowBar",
            color: trade.side === "Long" || trade.action === "Buy" ? T.red : T.green,
            shape: trade.side === "Long" || trade.action === "Buy" ? "arrowDown" : "arrowUp",
            text: `Exit: ${trade.exit}`
          });
        }

        candlestickSeries.setMarkers(markers.sort((a, b) => a.time - b.time));

        if (trade.entry) {
          candlestickSeries.createPriceLine({
            price: parseFloat(trade.entry),
            color: T.blue,
            lineWidth: 2,
            lineStyle: 1, // Dashed
            axisLabelVisible: true,
            title: "Entry",
          });
        }
        if (trade.stopLoss) {
          candlestickSeries.createPriceLine({
            price: parseFloat(trade.stopLoss),
            color: T.red,
            lineWidth: 1.5,
            lineStyle: 2, // Dotted
            axisLabelVisible: true,
            title: "Stop Loss",
          });
        }
        if (trade.takeProfit) {
          candlestickSeries.createPriceLine({
            price: parseFloat(trade.takeProfit),
            color: T.green,
            lineWidth: 1.5,
            lineStyle: 2, // Dotted
            axisLabelVisible: true,
            title: "Take Profit",
          });
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to load chart", err);
        setLoading(false);
      }
    };
    fetchKlineData();

    return () => {
      if (chart) chart.remove();
    };
  }, [trade]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000b0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 14, padding: 26, width: "min(800px,95vw)", boxShadow: "0 30px 80px #00000070" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: T.mono, fontSize: 16, color: T.bright }}>{trade?.symbol} Chart (1H)</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 22 }}>✕</button>
        </div>
        <div style={{ position: "relative", width: "100%", height: 400, background: T.panel2, borderRadius: 6, overflow: "hidden" }}>
          {loading && <div style={{ position: "absolute", inset: 0, padding: 20, display: "flex", flexDirection: "column", gap: 10, zIndex: 10, background: T.panel2 }}>
            <Skeleton height={20} />
            <Skeleton height={320} />
          </div>}
          <div ref={chartContainerRef} style={{ width: "100%", height: 400 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10, marginTop: 14 }}>
          <div style={{ background: T.panel2, padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>PnL</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: trade?.pnl >= 0 ? T.green : T.red }}>
              {trade?.pnl >= 0 ? "+" : ""}{trade?.pnl?.toFixed(2)}
            </div>
          </div>
          <div style={{ background: T.panel2, padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Hold Duration</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.bright }}>
              {trade?.closeTime ? `${((trade.closeTime - trade.openTime) / 3600000).toFixed(1)}h` : "Open"}
            </div>
          </div>
          <div style={{ background: T.panel2, padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Risk Reward</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.cyan }}>
              {trade?.stopLoss && trade?.exit ? `${(Math.abs(trade.exit - trade.entry) / Math.abs(trade.entry - trade.stopLoss)).toFixed(1)}R` : "N/A"}
            </div>
          </div>
          <div style={{ background: T.panel2, padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Setup</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.bright }}>
              {trade?.setup || "None"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
