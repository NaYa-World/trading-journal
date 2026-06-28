export function calculatePnL({ entry, exit, qty, side, leverage = 1, tradeType = "Spot", marginType = "USDT-M", quoteRateOpen = 1, quoteRateClose = 1, action = "Buy", fundingFees = 0 }) {
  const isSpot = tradeType === "Spot";
  const finalSide = isSpot ? (action === "Buy" ? "Long" : "Short") : side;
  const multiplier = finalSide === "Long" ? 1 : -1;

  let nativePnLVal;
  let pnlUsdtVal;

  if (isSpot) {
    nativePnLVal = action === "Buy" ? (exit - entry) * qty : (entry - exit) * qty;
    pnlUsdtVal = action === "Buy"
      ? (exit * qty * quoteRateClose) - (entry * qty * quoteRateOpen)
      : (entry * qty * quoteRateOpen) - (exit * qty * quoteRateClose);
  } else if (marginType === "COIN-M") {
    // Inverse futures math. `qty` is in contracts/USD. PNL is settled in base asset.
    nativePnLVal = (1 / entry - 1 / exit) * qty * multiplier * leverage;
    // For USDT equivalent, multiply the base asset PNL by the exit price (or close rate).
    // Often COIN-M uses the contract value in USD directly, so nativePnLVal * exit gives the USD value.
    pnlUsdtVal = nativePnLVal * exit; 
  } else {
    // Standard linear (USDT-M)
    nativePnLVal = (exit - entry) * qty * multiplier * leverage;
    pnlUsdtVal = ((exit * qty * quoteRateClose) - (entry * qty * quoteRateOpen)) * multiplier * leverage;
  }

  return {
    nativePnl: parseFloat((nativePnLVal - (fundingFees / (quoteRateClose || 1))).toFixed(6)),
    pnl: parseFloat((pnlUsdtVal - fundingFees).toFixed(2))
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
