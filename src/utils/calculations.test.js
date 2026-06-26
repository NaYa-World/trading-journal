import { describe, it, expect } from "vitest";
import {
  calculatePnL,
  calculateWinRate,
  calculateProfitFactor,
  calculateExpectancy,
  calculateMaxDrawdown
} from "./calculations.js";

describe("Trading Calculations Logic", () => {
  describe("calculatePnL", () => {
    it("should calculate correct PnL for Spot Buy (Long) trades", () => {
      const result = calculatePnL({
        entry: 100,
        exit: 120,
        qty: 2,
        tradeType: "Spot",
        action: "Buy"
      });
      expect(result.nativePnl).toBe(40);
      expect(result.pnl).toBe(40);
    });

    it("should calculate correct PnL for Spot Sell (Short) trades", () => {
      const result = calculatePnL({
        entry: 100,
        exit: 80,
        qty: 2,
        tradeType: "Spot",
        action: "Sell"
      });
      expect(result.nativePnl).toBe(40); // (entry - exit) * qty = (100 - 80) * 2 = 40
      expect(result.pnl).toBe(40);
    });

    it("should calculate correct PnL for Futures Long trades with leverage", () => {
      const result = calculatePnL({
        entry: 100,
        exit: 110,
        qty: 5,
        side: "Long",
        leverage: 10,
        tradeType: "Futures"
      });
      // (110 - 100) * 5 * 1 = 50
      expect(result.nativePnl).toBe(50);
      expect(result.pnl).toBe(50);
    });

    it("should calculate correct PnL for Futures Short trades with leverage", () => {
      const result = calculatePnL({
        entry: 100,
        exit: 90,
        qty: 5,
        side: "Short",
        leverage: 10,
        tradeType: "Futures"
      });
      // (100 - 90) * 5 * 1 = 50
      expect(result.nativePnl).toBe(50);
      expect(result.pnl).toBe(50);
    });

    it("should convert PnL correctly using USDT rates", () => {
      const result = calculatePnL({
        entry: 1,
        exit: 1.1,
        qty: 100,
        side: "Long",
        leverage: 1,
        tradeType: "Futures",
        quoteRateOpen: 10, // entry in ETH (10 USDT rate)
        quoteRateClose: 11 // exit in ETH (11 USDT rate)
      });
      // pnlUsdt = ((exit * qty * closeRate) - (entry * qty * openRate))
      // = (1.1 * 100 * 11) - (1 * 100 * 10) = 1210 - 1000 = 210
      expect(result.pnl).toBe(210);
    });
  });

  describe("calculateWinRate", () => {
    it("should return 0 when there are no trades", () => {
      expect(calculateWinRate([])).toBe(0);
    });

    it("should calculate correct win rate excluding deposits/withdrawals", () => {
      const trades = [
        { symbol: "BTC", pnl: 50, entryType: "Trade" },
        { symbol: "BTC", pnl: -20, entryType: "Trade" },
        { symbol: "Deposit", qty: 1000, entryType: "Deposit" },
        { symbol: "BTC", pnl: 10, entryType: "Trade" }
      ];
      // 2 wins out of 3 actual trades = 66.66%
      expect(calculateWinRate(trades)).toBeCloseTo(66.67, 1);
    });

    it("should exclude break-even trades from wins", () => {
      const trades = [
        { symbol: "BTC", pnl: 50, entryType: "Trade" },
        { symbol: "BTC", pnl: 0, entryType: "Trade" },
        { symbol: "BTC", pnl: -10, entryType: "Trade" }
      ];
      // 1 win out of 3 trades = 33.33%
      expect(calculateWinRate(trades)).toBeCloseTo(33.33, 1);
    });
  });

  describe("calculateProfitFactor", () => {
    it("should return 0 when there are no losses", () => {
      const trades = [
        { symbol: "BTC", pnl: 50 },
        { symbol: "BTC", pnl: 10 }
      ];
      expect(calculateProfitFactor(trades)).toBe(0);
    });

    it("should compute correct profit factor", () => {
      const trades = [
        { symbol: "BTC", pnl: 100 },
        { symbol: "BTC", pnl: -50 },
        { symbol: "BTC", pnl: 50 }
      ];
      // wins = 150, losses = 50 -> 150 / 50 = 3
      expect(calculateProfitFactor(trades)).toBe(3);
    });
  });

  describe("calculateExpectancy", () => {
    it("should calculate expectancy correctly", () => {
      const trades = [
        { symbol: "BTC", pnl: 100 },
        { symbol: "BTC", pnl: -50 }
      ];
      // winrate = 0.5, lossrate = 0.5, avgwin = 100, avgloss = 50
      // expectancy = (0.5 * 100) - (0.5 * 50) = 50 - 25 = 25
      expect(calculateExpectancy(trades)).toBe(25);
    });
  });

  describe("calculateMaxDrawdown", () => {
    it("should calculate correct peak-to-trough drawdown", () => {
      const trades = [
        { symbol: "BTC", pnl: 100, fees: -5, closeTime: 1000 },
        { symbol: "BTC", pnl: -50, fees: -5, closeTime: 2000 }, // equity goes from 95 to 40 (DD = 55)
        { symbol: "BTC", pnl: 200, fees: -10, closeTime: 3000 }, // equity goes from 40 to 230
        { symbol: "BTC", pnl: -100, fees: -5, closeTime: 4000 } // equity goes from 230 to 125 (DD = 105)
      ];
      expect(calculateMaxDrawdown(trades)).toBe(-105);
    });
  });
});
