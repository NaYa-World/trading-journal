// ─────────────────────────────────────────────────────────────────────────────
// Fee Engine — Binance & Bitget · Spot & Futures
// Zero backend, runs entirely in the browser
// ─────────────────────────────────────────────────────────────────────────────

export type Exchange = "binance" | "bitget";
export type TradeType = "spot" | "futures";
export type OrderType = "maker" | "taker";
export type Direction = "long" | "short";

// ── Fee rate tables (as of 2025 — update if VIP tier changes) ────────────────

export const FEE_RATES: Record<
  Exchange,
  Record<TradeType, { maker: number; taker: number }>
> = {
  binance: {
    spot: { maker: 0.001, taker: 0.001 },       // 0.10% / 0.10%
    futures: { maker: 0.0002, taker: 0.0004 },   // 0.02% / 0.04%
  },
  bitget: {
    spot: { maker: 0.001, taker: 0.001 },        // 0.10% / 0.10%
    futures: { maker: 0.0002, taker: 0.0006 },   // 0.02% / 0.06%
  },
};

// BNB discount: Binance gives 25% off when "Pay fees in BNB" is enabled
export const BNB_DISCOUNT = 0.25;

// ── Core types ────────────────────────────────────────────────────────────────

export interface TradeInput {
  exchange: Exchange;
  tradeType: TradeType;
  direction: Direction;
  entryPrice: number;
  exitPrice: number;
  quantity: number;          // in base asset (e.g. BTC, SOL)
  leverage?: number;         // futures only; defaults to 1
  entryOrderType: OrderType;
  exitOrderType: OrderType;
  useBnbDiscount?: boolean;  // Binance only
  customMakerRate?: number;  // override (e.g. VIP tier)
  customTakerRate?: number;
}

export interface FeeBreakdown {
  entryNotional: number;    // entry price × quantity
  exitNotional: number;     // exit price × quantity
  entryFeeRate: number;
  exitFeeRate: number;
  entryFee: number;
  exitFee: number;
  totalFee: number;
  grossPnl: number;
  netPnl: number;
  netPnlPercent: number;    // as % of margin (futures) or entry notional (spot)
  margin: number;           // capital at risk
  roi: number;              // net P&L / margin × 100
  breakEvenPrice: number;   // exit price where net P&L = 0
}

// ── Main calculation function ─────────────────────────────────────────────────

export function calculateFees(input: TradeInput): FeeBreakdown {
  const {
    exchange,
    tradeType,
    direction,
    entryPrice,
    exitPrice,
    quantity,
    leverage = 1,
    entryOrderType,
    exitOrderType,
    useBnbDiscount = false,
    customMakerRate,
    customTakerRate,
  } = input;

  const rates = FEE_RATES[exchange][tradeType];

  // Resolve rates (custom override wins)
  const makerRate = customMakerRate ?? rates.maker;
  const takerRate = customTakerRate ?? rates.taker;

  // BNB discount only applies to Binance
  const discount = exchange === "binance" && useBnbDiscount ? (1 - BNB_DISCOUNT) : 1;

  const entryFeeRate = (entryOrderType === "maker" ? makerRate : takerRate) * discount;
  const exitFeeRate  = (exitOrderType  === "maker" ? makerRate : takerRate) * discount;

  // Notional values
  const entryNotional = entryPrice * quantity;
  const exitNotional  = exitPrice  * quantity;

  // Fees are always on notional (not margin)
  const entryFee = entryNotional * entryFeeRate;
  const exitFee  = exitNotional  * exitFeeRate;
  const totalFee = entryFee + exitFee;

  // Gross P&L
  const grossPnl =
    direction === "long"
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;

  const netPnl = grossPnl - totalFee;

  // Margin = notional / leverage
  const margin = entryNotional / leverage;

  const netPnlPercent = (netPnl / entryNotional) * 100;
  const roi           = (netPnl / margin) * 100;

  // Break-even: solve for exit price where netPnl = 0
  // grossPnl = totalFee
  // For long:  (be - entry) × qty - (entry × qty × entryRate) - (be × qty × exitRate) = 0
  // be × qty × (1 - exitRate) = entry × qty × (1 + entryRate)
  // be = entry × (1 + entryRate) / (1 - exitRate)
  const breakEvenPrice =
    direction === "long"
      ? (entryPrice * (1 + entryFeeRate)) / (1 - exitFeeRate)
      : (entryPrice * (1 - entryFeeRate)) / (1 + exitFeeRate);

  return {
    entryNotional,
    exitNotional,
    entryFeeRate,
    exitFeeRate,
    entryFee,
    exitFee,
    totalFee,
    grossPnl,
    netPnl,
    netPnlPercent,
    margin,
    roi,
    breakEvenPrice,
  };
}

// ── TP calculator with fees built in ─────────────────────────────────────────

export interface TPLevel {
  label: string;
  rMultiple: number;
  targetPrice: number;
  grossPnl: number;
  netPnl: number;
  roi: number;
  fee: number;
}

export interface RiskCalcInput {
  exchange: Exchange;
  tradeType: TradeType;
  direction: Direction;
  entryPrice: number;
  stopLoss: number;
  quantity: number;
  leverage?: number;
  entryOrderType: OrderType;
  exitOrderType: OrderType;
  useBnbDiscount?: boolean;
  customMakerRate?: number;
  customTakerRate?: number;
}

export function calculateTPLevels(input: RiskCalcInput): TPLevel[] {
  const { entryPrice, stopLoss, direction } = input;

  const riskPerUnit =
    direction === "long"
      ? entryPrice - stopLoss
      : stopLoss - entryPrice;

  if (riskPerUnit <= 0) return [];

  const multiples = [1, 1.5, 2, 3];

  return multiples.map((r, i) => {
    const targetPrice =
      direction === "long"
        ? entryPrice + riskPerUnit * r
        : entryPrice - riskPerUnit * r;

    const result = calculateFees({ ...input, exitPrice: targetPrice });

    return {
      label: i < 3 ? `TP${i + 1}` : "TP3+",
      rMultiple: r,
      targetPrice,
      grossPnl: result.grossPnl,
      netPnl: result.netPnl,
      roi: result.roi,
      fee: result.totalFee,
    };
  });
}

// ── Position size from risk % ─────────────────────────────────────────────────

export function calcPositionSize(
  accountBalance: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number
): { quantity: number; dollarRisk: number; positionValue: number } {
  const dollarRisk = accountBalance * (riskPercent / 100);
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  const quantity = riskPerUnit > 0 ? dollarRisk / riskPerUnit : 0;
  const positionValue = quantity * entryPrice;

  return { quantity, dollarRisk, positionValue };
}
