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

    const connectWebSockets = () => {
      setStatus("fetching");
      const currentSymbols = symbolsRef.current;
      
      const binanceParams = currentSymbols.map(({ symbol }) => {
        const sym = symbol.toUpperCase().replace("/", "").toLowerCase();
        return `${sym}@ticker`;
      });

      if (binanceParams.length > 0) {
        wsBinance = new WebSocket('wss://stream.binance.com:9443/ws');
        wsBinance.onopen = () => {
          wsBinance.send(JSON.stringify({
            method: "SUBSCRIBE",
            params: binanceParams,
            id: 1
          }));
          setStatus("ok");
        };

        wsBinance.onmessage = (event) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(event.data);
            if (data.e === "24hrTicker") {
              // 's' is symbol e.g., BTCUSDT
              // Let's find the original symbol mapping if needed, or just store by raw symbol
              // Our UI uses original symbol like BTC/USDT or BTCUSDT
              const rawSym = data.s;
              const price = parseFloat(data.c);
              const change24h = parseFloat(data.P);
              const high24h = parseFloat(data.h);
              const low24h = parseFloat(data.l);
              const vol24h = parseFloat(data.v);
              
              // Find matching symbol from symbolsRef
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

        wsBinance.onerror = () => {
          setStatus("Error connecting to Binance WS");
        };
      }
    };

    connectWebSockets();

    return () => {
      cancelled = true;
      if (wsBinance) wsBinance.close();
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
