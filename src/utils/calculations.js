export function calculatePnL({ entry, exit, qty, side, tradeType = "Spot", quoteRateOpen = 1, quoteRateClose = 1, action = "Buy" }) {
  const isSpot = tradeType === "Spot";
  const finalSide = isSpot ? (action === "Buy" ? "Long" : "Short") : side;
  const multiplier = finalSide === "Long" ? 1 : -1;

  const nativePnLVal = isSpot
    ? (action === "Buy" ? (exit - entry) * qty : (entry - exit) * qty)
    : (exit - entry) * qty * multiplier;

  const pnlUsdtVal = isSpot
    ? (action === "Buy"
        ? (exit * qty * quoteRateClose) - (entry * qty * quoteRateOpen)
        : (entry * qty * quoteRateOpen) - (exit * qty * quoteRateClose))
    : ((exit * qty * quoteRateClose) - (entry * qty * quoteRateOpen)) * multiplier;

  return {
    nativePnl: parseFloat(nativePnLVal.toFixed(6)),
    pnl: parseFloat(pnlUsdtVal.toFixed(2))
  };
}

export function calculateWinRate(trades) {
  const actualTrades = trades.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
  if (!actualTrades.length) return 0;
  const wins = actualTrades.filter(t => t.pnl > 0);
  return (wins.length / actualTrades.length) * 100;
}

export function calculateProfitFactor(trades) {
  const actualTrades = trades.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
  const wins = actualTrades.filter(t => t.pnl > 0);
  const losses = actualTrades.filter(t => t.pnl < 0);
  const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  return grossLosses > 0 ? grossWins / grossLosses : 0;
}

export function calculateExpectancy(trades) {
  const actualTrades = trades.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
  if (!actualTrades.length) return 0;
  const wins = actualTrades.filter(t => t.pnl > 0);
  const losses = actualTrades.filter(t => t.pnl < 0);
  const winRate = wins.length / actualTrades.length;
  const lossRate = 1 - winRate;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
  return (winRate * avgWin) - (lossRate * avgLoss);
}

export function calculateMaxDrawdown(trades) {
  const actualTrades = trades.filter(t => t.entryType !== "Deposit" && t.entryType !== "Withdrawal" && t.symbol !== "Deposit" && t.symbol !== "Withdrawal");
  let running = 0, peak = 0, maxDD = 0;
  [...actualTrades].sort((a, b) => a.closeTime - b.closeTime).forEach(t => {
    running += t.pnl + (t.fees || 0);
    if (running > peak) { peak = running; }
    maxDD = Math.min(maxDD, running - peak);
  });
  return maxDD;
}
