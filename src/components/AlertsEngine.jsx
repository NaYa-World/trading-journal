import { useEffect, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePrices } from '../context/PricesContext.jsx';
import { saveAlerts } from '../utils/storage.js';

export default function AlertsEngine() {
  const { alerts, setAlerts, setNotifications } = useDashboard();
  const { prices } = usePrices();
  const alertsRef = useRef(alerts);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  // Request Notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!prices || Object.keys(prices).length === 0) return;

    let triggeredAny = false;
    const newNotifs = [];
    
    const updatedAlerts = alertsRef.current.map(alert => {
      if (alert.triggered) return alert;
      
      const currentPriceObj = prices[alert.symbol];
      if (!currentPriceObj) return alert;
      
      const currentPrice = currentPriceObj.price;
      let isTriggered = false;
      
      if (alert.condition === "above" && currentPrice >= alert.targetPrice) {
        isTriggered = true;
      } else if (alert.condition === "below" && currentPrice <= alert.targetPrice) {
        isTriggered = true;
      }

      if (isTriggered) {
        triggeredAny = true;

        // Browser/OS Native Push notification
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`Price Alert: ${alert.symbol}`, {
              body: `${alert.symbol} is now ${alert.condition} ${alert.targetPrice} (Current: ${currentPrice})`,
            });
          } catch (e) {
            console.error("Failed to fire browser notification:", e);
          }
        }

        const newNotif = {
          id: Date.now() + Math.random().toString(),
          symbol: alert.symbol,
          condition: alert.condition,
          targetPrice: alert.targetPrice,
          currentPrice: currentPrice,
          timestamp: Date.now()
        };
        newNotifs.push(newNotif);
        return { ...alert, triggered: true, triggeredAt: Date.now() };
      }
      return alert;
    });

    if (triggeredAny) {
      setAlerts(updatedAlerts);
      setNotifications(prev => [...newNotifs, ...prev]);
      saveAlerts(updatedAlerts);
    }
  }, [prices, setAlerts, setNotifications]);

  return null;
}
