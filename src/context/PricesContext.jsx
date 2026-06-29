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
    let retryCount = 0;

    const connectWebSockets = () => {
      if (cancelled) return;
      setStatus("fetching");
      const currentSymbols = symbolsRef.current;
      
      const binanceParams = currentSymbols.map(({ symbol }) => {
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
          setStatus(`Reconnecting... (Attempt ${retryCount + 1})`);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          const backoff = Math.min(1000 * Math.pow(2, retryCount), 30000);
          retryCount++;
          reconnectTimer = setTimeout(connectWebSockets, backoff);
        };

        wsBinance.onerror = handleDisconnect;
        wsBinance.onclose = handleDisconnect;
      }
    };

    connectWebSockets();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsBinance) {
        wsBinance.onclose = null;
        wsBinance.onerror = null;
        wsBinance.close();
      }
    };
  }, [symbolsKey]);

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
