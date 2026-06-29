/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from "react";

const PricesContext = createContext(null);

export function PricesProvider({ children, symbols }) {
  const [prices, setPrices] = useState({});
  const [status, setStatus] = useState("idle");

  const symbolsRef = useRef(symbols);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);
  const symbolsKey = symbols.map(s => `${s.symbol}-${s.exchange}`).join(",");

  useEffect(() => {
    if (!symbolsRef.current || !symbolsRef.current.length) return;
    
    let cancelled = false;
    let wsBinance = null;
    let reconnectTimer = null;
    let pingTimer = null;
    let retryCount = 0;

    const connectWebSockets = () => {
      if (cancelled) return;
      setStatus("fetching");
      const currentSymbols = symbolsRef.current;
      
      const binanceParams = currentSymbols
        .filter(({ exchange }) => !exchange || exchange.toLowerCase() === "binance")
        .map(({ symbol }) => {
          const sym = symbol.toUpperCase().replace("/", "").toLowerCase();
          return `${sym}@ticker`;
        });

      if (binanceParams.length > 0) {
        if (wsBinance) {
          wsBinance.onclose = null;
          wsBinance.onerror = null;
          wsBinance.close();
        }
        
        wsBinance = new WebSocket('wss://stream.binance.com:9443/ws');
        wsBinance.onopen = () => {
          wsBinance.send(JSON.stringify({
            method: "SUBSCRIBE",
            params: binanceParams,
            id: 1
          }));
          setStatus("ok");
          retryCount = 0; // reset backoff

          // Keepalive ping every 3 minutes
          pingTimer = setInterval(() => {
            if (wsBinance && wsBinance.readyState === WebSocket.OPEN) {
              try {
                wsBinance.send(JSON.stringify({ method: "ping", id: 99 }));
              } catch (e) {
                console.warn("WS ping send error:", e);
              }
            }
          }, 180000);
        };

        wsBinance.onmessage = (event) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(event.data);
            if (data.e === "24hrTicker") {
              const rawSym = data.s;
              const price = parseFloat(data.c);
              const change24h = parseFloat(data.P);
              const high24h = parseFloat(data.h);
              const low24h = parseFloat(data.l);
              const vol24h = parseFloat(data.v);
              
              const matched = currentSymbols.find(s => s.symbol.toUpperCase().replace("/", "") === rawSym);
              if (matched) {
                setPrices(p => ({
                  ...p,
                  [matched.symbol]: { price, change24h, high24h, low24h, vol24h, source: "Binance WS" }
                }));
              }
            }
          } catch {
            // ignore parse errors
          }
        };

        const handleDisconnect = () => {
          if (cancelled) return;
          if (pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
          }
          setStatus(`Reconnecting... (Attempt ${retryCount + 1})`);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          const backoff = Math.min(1000 * Math.pow(2, retryCount), 30000);
          retryCount++;
          reconnectTimer = setTimeout(connectWebSockets, backoff);
        };

        wsBinance.onerror = handleDisconnect;
        wsBinance.onclose = handleDisconnect;
      } else {
        setStatus("ok");
      }
    };

    connectWebSockets();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (wsBinance) {
        wsBinance.onclose = null;
        wsBinance.onerror = null;
        wsBinance.close();
      }
    };
  }, [symbolsKey]);

  // ─── Bitget REST Polling Fallback ───────────────────────────────────────────
  useEffect(() => {
    if (!symbols || !symbols.length) return;
    const bitgetSymbols = symbols.filter(s => s.exchange?.toLowerCase() === "bitget");
    if (bitgetSymbols.length === 0) return;

    let pollInterval = null;

    const pollBitget = async () => {
      try {
        const res = await fetch("https://api.bitget.com/api/v2/spot/market/tickers");
        const json = await res.json();
        if (json && json.code === "00000" && Array.isArray(json.data)) {
          const updates = {};
          bitgetSymbols.forEach(s => {
            const formatted = s.symbol.toUpperCase().replace("/", "");
            const matchedTicker = json.data.find(t => t.symbol === formatted);
            if (matchedTicker) {
              updates[s.symbol] = {
                price: parseFloat(matchedTicker.lastPr),
                change24h: parseFloat(matchedTicker.change24h || 0) * 100, // convert to %
                high24h: parseFloat(matchedTicker.high24h || 0),
                low24h: parseFloat(matchedTicker.low24h || 0),
                vol24h: parseFloat(matchedTicker.usdtVolume || 0),
                source: "Bitget API"
              };
            }
          });
          if (Object.keys(updates).length > 0) {
            setPrices(p => ({ ...p, ...updates }));
          }
        }
      } catch (e) {
        console.warn("Bitget REST polling error:", e);
      }
    };

    pollBitget(); // Immediate poll
    pollInterval = setInterval(pollBitget, 5000); // every 5s

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [symbolsKey, symbols]);

  return (
    <PricesContext.Provider value={{ prices, status }}>
      {children}
    </PricesContext.Provider>
  );
}

export function usePrices() {
  const context = useContext(PricesContext);
  if (!context) throw new Error("usePrices must be used within PricesProvider");
  return context;
}
