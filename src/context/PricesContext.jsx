import { createContext, useContext, useState, useEffect, useRef } from "react";
import { Capacitor } from '@capacitor/core';

const PricesContext = createContext(null);

export function PricesProvider({ children, symbols }) {
  const [prices, setPrices] = useState({});
  const [status, setStatus] = useState("idle");

  const symbolsRef = useRef(symbols);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);
  const symbolsKey = symbols.map(s => `${s.symbol}-${s.exchange}`).join(",");

  useEffect(() => {
    if (!symbolsRef.current || !symbolsRef.current.length) return;
    
    // Disable live price polling on native mobile to save battery and avoid CORS/Network errors.
    if (Capacitor.isNativePlatform()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("ok");
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      setStatus("fetching");
      const results = {};
      const currentSymbols = symbolsRef.current;

      await Promise.allSettled(currentSymbols.map(async ({ symbol, exchange }) => {
        const sym = symbol.toUpperCase().replace("/", "");
        try {
          const fetchBinance = async () => {
            const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`);
            const data = await r.json();
            if (data && data.lastPrice) {
              return { price: parseFloat(data.lastPrice), change24h: parseFloat(data.priceChangePercent), high24h: parseFloat(data.highPrice), low24h: parseFloat(data.lowPrice), vol24h: parseFloat(data.volume), source: "Binance" };
            }
            throw new Error("Binance fetch failed");
          };

          const fetchBitget = async () => {
            const r = await fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${sym}`);
            const data = await r.json();
            const item = data?.data?.[0];
            if (item && item.lastPr) {
              return { price: parseFloat(item.lastPr), change24h: parseFloat(item.change24h) * 100, high24h: parseFloat(item.high24h), low24h: parseFloat(item.low24h), vol24h: parseFloat(item.baseVolume), source: "Bitget" };
            }
            throw new Error("Bitget fetch failed");
          };

          let prefExchange = exchange || "Binance";

          try {
            if (prefExchange === "Bitget") {
              results[symbol] = await fetchBitget();
            } else {
              results[symbol] = await fetchBinance();
            }
          } catch (e1) {
            try {
              if (prefExchange === "Bitget") {
                const res = await fetchBinance();
                res.source = "Binance(fb)";
                results[symbol] = res;
              } else {
                const res = await fetchBitget();
                res.source = "Bitget(fb)";
                results[symbol] = res;
              }
            } catch (e2) {
              // Both APIs failed
            }
          }
        } catch (err) {
          // Outer catch for overall safety
        }
      }));

      if (!cancelled) { setPrices(p => ({ ...p, ...results })); setStatus("ok"); }
    };

    fetchAll();
    let id;
    if (!Capacitor.isNativePlatform()) {
      id = setInterval(fetchAll, 3000);
    }
    return () => { cancelled = true; if (id) clearInterval(id); };
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
