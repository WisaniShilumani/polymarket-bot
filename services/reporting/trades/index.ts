import { Side } from '@polymarket/clob-client';
import { getAggregatedTrades, type AggregatedTradeWithPnl } from '../../polymarket/trade-history';
import logger from '../../../utils/logger';
import { POLYMARKET_FUNDER } from '../../../config';

// User's wallet address
const USER_ADDRESS = POLYMARKET_FUNDER;

// ============================================================================
// CORE TRADE INTERFACES
// ============================================================================

export interface TradeReport {
  id: string;
  question: string;
  image: string;
  executedAt: string;
  shares: number;
  orderPrice: number;
  matchedPrice: number;
  side: Side;
  outcome: string;
  pnl: number;
  percentPnL: number;
  marketSlug: string;
  // Enhanced fields
  assetId: string;
  holdDurationHours: number | null; // null for BUY trades (not yet sold)
  hourOfEntry: number;
  dayOfWeek: string;
  cost: number; // orderPrice * shares
}

export interface ChartDataPoint {
  date: string;
  cumulativePnL: number;
  winRate: number;
  tradeCount: number;
}

export interface MarketStats {
  question: string;
  marketSlug: string;
  image: string;
  totalPnL: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  totalCost: number;
}

export interface OutcomeStats {
  outcome: 'Yes' | 'No';
  totalPnL: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgPnL: number;
}

export interface PriceRangeStats {
  rangeLabel: string;
  minPrice: number;
  maxPrice: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
}

export interface PriceRangeStatsByOutcome {
  yes: PriceRangeStats[];
  no: PriceRangeStats[];
}

// ============================================================================
// HOLD TIME ANALYTICS
// ============================================================================

export interface HoldDurationBucket {
  count: number;
  avgPnL: number;
  totalPnL: number;
  winRate: number;
  winCount: number;
  lossCount: number;
}

export interface HoldTimeStats {
  avgHoldDurationHours: number;
  medianHoldDurationHours: number;
  minHoldDurationHours: number;
  maxHoldDurationHours: number;
  holdDurationDistribution: {
    '0-1h': HoldDurationBucket;
    '1-6h': HoldDurationBucket;
    '6-24h': HoldDurationBucket;
    '1-7d': HoldDurationBucket;
    '7d+': HoldDurationBucket;
  };
}

// ============================================================================
// EXECUTION QUALITY ANALYTICS
// ============================================================================

export interface ExecutionStats {
  makerTradeCount: number;
  takerTradeCount: number;
  makerRatio: number; // % of trades as maker (limit orders)
  avgTradeSize: number;
  medianTradeSize: number;
  totalVolume: number;
}

// ============================================================================
// TEMPORAL PERFORMANCE ANALYTICS
// ============================================================================

export interface TemporalBucket {
  count: number;
  winRate: number;
  avgPnL: number;
  totalPnL: number;
  winCount: number;
  lossCount: number;
}

export interface TemporalPerformance {
  hourOfDay: Record<number, TemporalBucket>; // 0-23
  dayOfWeek: Record<string, TemporalBucket>; // 'Monday', 'Tuesday', etc.
}

// ============================================================================
// DRAWDOWN ANALYTICS
// ============================================================================

export interface DrawdownPeriod {
  startDate: string;
  endDate: string | null; // null if still in drawdown
  depth: number; // max drawdown during this period
  duration: number; // hours
  peakValue: number;
  troughValue: number;
}

export interface DrawdownStats {
  maxDrawdown: number; // Largest peak-to-trough decline (absolute $)
  maxDrawdownPercent: number; // As percentage of peak
  maxDrawdownDuration: number; // Hours in deepest drawdown
  currentDrawdown: number; // Current distance from peak
  currentDrawdownPercent: number;
  isInDrawdown: boolean;
  drawdownHistory: DrawdownPeriod[];
  recoveryFactor: number; // totalPnL / maxDrawdown (higher is better)
}

// ============================================================================
// RISK-ADJUSTED METRICS
// ============================================================================

export interface RiskAdjustedMetrics {
  sharpeRatio: number; // (avgReturn - riskFree) / stdDev
  sortinoRatio: number; // Uses downside deviation only
  calmarRatio: number; // annualizedReturn / maxDrawdown
  profitFactor: number; // grossProfit / grossLoss
  payoffRatio: number; // avgWin / avgLoss
  expectancy: number; // (winRate * avgWin) - (lossRate * avgLoss)
  kellyFraction: number; // Optimal bet sizing: (winRate * payoffRatio - lossRate) / payoffRatio
  returnStdDev: number; // Standard deviation of returns
  downsideDeviation: number; // Std dev of negative returns only
}

// ============================================================================
// STREAK ANALYTICS
// ============================================================================

export interface StreakStats {
  currentStreak: number; // Positive = wins, negative = losses
  currentStreakType: 'win' | 'loss' | 'none';
  longestWinStreak: number;
  longestLossStreak: number;
  avgWinStreak: number;
  avgLossStreak: number;
}

// ============================================================================
// VOLUME CORRELATION ANALYTICS
// ============================================================================

export interface VolumeCorrelationBucket {
  volumeRange: string;
  minVolume: number;
  maxVolume: number;
  tradeCount: number;
  winRate: number;
  avgPnL: number;
  totalPnL: number;
}

export interface VolumeCorrelation {
  buckets: VolumeCorrelationBucket[];
  correlationCoefficient: number; // Pearson correlation between volume and PnL
}

// ============================================================================
// TRADE SIZE ANALYSIS
// ============================================================================

export interface TradeSizeBucket {
  sizeRange: string;
  minSize: number;
  maxSize: number;
  tradeCount: number;
  winRate: number;
  avgPnL: number;
  totalPnL: number;
}

export interface TradeSizeAnalysis {
  buckets: TradeSizeBucket[];
  optimalSizeRange: string | null; // Range with best risk-adjusted return
}

// ============================================================================
// CONSECUTIVE ANALYSIS
// ============================================================================

export interface ConsecutiveAnalysis {
  avgTradesPerDay: number;
  avgTradesPerWeek: number;
  mostActiveDay: string;
  mostActiveHour: number;
  tradingDays: number; // Total unique days with trades
  totalDaysInPeriod: number;
  tradingFrequency: number; // tradingDays / totalDaysInPeriod
}

// ============================================================================
// MAIN SUMMARY INTERFACE
// ============================================================================

export interface TradesReportSummary {
  // Core metrics
  trades: TradeReport[];
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalCost: number;
  totalCurrentValue: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  totalTrades: number;
  winRate: number;
  lossRate: number;

  // Existing analytics
  chartData: ChartDataPoint[];
  topWinnersByMarket: MarketStats[];
  topLosersByMarket: MarketStats[];
  outcomeStats: OutcomeStats[];
  priceRangeStats: PriceRangeStatsByOutcome;

  // NEW: Hold time analytics
  holdTimeStats: HoldTimeStats;

  // NEW: Execution quality
  executionStats: ExecutionStats;

  // NEW: Temporal performance
  temporalPerformance: TemporalPerformance;

  // NEW: Drawdown analytics
  drawdownStats: DrawdownStats;

  // NEW: Risk-adjusted metrics
  riskAdjustedMetrics: RiskAdjustedMetrics;

  // NEW: Streak analytics
  streakStats: StreakStats;

  // NEW: Volume correlation
  volumeCorrelation: VolumeCorrelation;

  // NEW: Trade size analysis
  tradeSizeAnalysis: TradeSizeAnalysis;

  // NEW: Trading frequency
  consecutiveAnalysis: ConsecutiveAnalysis;

  // Summary statistics
  avgPnLPerTrade: number;
  avgWinSize: number;
  avgLossSize: number;
  largestWin: number;
  largestLoss: number;
  grossProfit: number;
  grossLoss: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayOfWeek(date: Date): string {
  return DAYS_OF_WEEK[date.getDay()] || 'Unknown';
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateDownsideDeviation(returns: number[]): number {
  const negativeReturns = returns.filter((r) => r < 0);
  if (negativeReturns.length === 0) return 0;
  const mean = negativeReturns.reduce((sum, v) => sum + v, 0) / negativeReturns.length;
  const squaredDiffs = negativeReturns.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / negativeReturns.length;
  return Math.sqrt(variance);
}

function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i]!, 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

// ============================================================================
// CONVERSION FUNCTION
// ============================================================================

interface TradeWithBuyDate extends AggregatedTradeWithPnl {
  buyDate: Date | undefined;
}

/**
 * Converts an AggregatedTradeWithPnl to a TradeReport with enhanced fields
 */
function toTradeReport(trade: TradeWithBuyDate): TradeReport {
  const matchedPrice = trade.side === 'SELL' ? trade.averagePrice : 0;
  const orderPrice = trade.totalValue / trade.totalSize;
  const percentPnL = matchedPrice > 0 ? ((orderPrice - matchedPrice) / matchedPrice) * 100 : 0;

  // Calculate hold duration for SELL trades
  let holdDurationHours: number | null = null;
  if (trade.side === 'SELL' && trade.buyDate) {
    const holdMs = trade.date.getTime() - trade.buyDate.getTime();
    holdDurationHours = holdMs / (1000 * 60 * 60);
  }

  const executedDate = trade.date;

  return {
    id: trade.orderId + trade.averagePrice,
    question: trade.question,
    image: trade.image,
    executedAt: trade.date.toISOString(),
    shares: trade.totalSize,
    orderPrice,
    matchedPrice,
    side: trade.side === 'BUY' ? Side.BUY : Side.SELL,
    outcome: trade.outcome,
    pnl: trade.pnl,
    percentPnL,
    marketSlug: trade.eventSlug,
    assetId: trade.assetId,
    holdDurationHours,
    hourOfEntry: executedDate.getHours(),
    dayOfWeek: getDayOfWeek(executedDate),
    cost: orderPrice * trade.totalSize,
  };
}

// ============================================================================
// HOLD TIME STATS CALCULATION
// ============================================================================

function generateHoldTimeStats(trades: TradeReport[]): HoldTimeStats {
  const sellTrades = trades.filter((t) => t.side === Side.SELL && t.holdDurationHours !== null);
  const holdDurations = sellTrades.map((t) => t.holdDurationHours!);

  const createEmptyBucket = (): HoldDurationBucket => ({
    count: 0,
    avgPnL: 0,
    totalPnL: 0,
    winRate: 0,
    winCount: 0,
    lossCount: 0,
  });

  const distribution: HoldTimeStats['holdDurationDistribution'] = {
    '0-1h': createEmptyBucket(),
    '1-6h': createEmptyBucket(),
    '6-24h': createEmptyBucket(),
    '1-7d': createEmptyBucket(),
    '7d+': createEmptyBucket(),
  };

  for (const trade of sellTrades) {
    const hours = trade.holdDurationHours!;
    let bucket: HoldDurationBucket;

    if (hours < 1) {
      bucket = distribution['0-1h'];
    } else if (hours < 6) {
      bucket = distribution['1-6h'];
    } else if (hours < 24) {
      bucket = distribution['6-24h'];
    } else if (hours < 168) {
      // 7 days
      bucket = distribution['1-7d'];
    } else {
      bucket = distribution['7d+'];
    }

    bucket.count++;
    bucket.totalPnL += trade.pnl;
    if (trade.pnl > 0) bucket.winCount++;
    else if (trade.pnl < 0) bucket.lossCount++;
  }

  // Calculate derived metrics for each bucket
  for (const key of Object.keys(distribution) as (keyof typeof distribution)[]) {
    const bucket = distribution[key];
    if (bucket.count > 0) {
      bucket.avgPnL = bucket.totalPnL / bucket.count;
      bucket.winRate = (bucket.winCount / bucket.count) * 100;
    }
  }

  return {
    avgHoldDurationHours: holdDurations.length > 0 ? holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length : 0,
    medianHoldDurationHours: calculateMedian(holdDurations),
    minHoldDurationHours: holdDurations.length > 0 ? Math.min(...holdDurations) : 0,
    maxHoldDurationHours: holdDurations.length > 0 ? Math.max(...holdDurations) : 0,
    holdDurationDistribution: distribution,
  };
}

// ============================================================================
// EXECUTION STATS CALCULATION
// ============================================================================

function generateExecutionStats(trades: TradeReport[]): ExecutionStats {
  const tradeSizes = trades.map((t) => t.shares);

  // We can infer maker vs taker from whether it's a limit order (maker) vs market order (taker)
  // For now, we estimate based on the number of partial fills aggregated
  // Since we don't have direct access to maker/taker info, we'll track what we can

  return {
    makerTradeCount: trades.length, // We'll assume all are maker since we mostly use limit orders
    takerTradeCount: 0,
    makerRatio: 100,
    avgTradeSize: tradeSizes.length > 0 ? tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length : 0,
    medianTradeSize: calculateMedian(tradeSizes),
    totalVolume: tradeSizes.reduce((a, b) => a + b, 0),
  };
}

// ============================================================================
// TEMPORAL PERFORMANCE CALCULATION
// ============================================================================

function generateTemporalPerformance(trades: TradeReport[]): TemporalPerformance {
  const sellTrades = trades.filter((t) => t.side === Side.SELL);

  const hourOfDay: Record<number, TemporalBucket> = {};
  const dayOfWeek: Record<string, TemporalBucket> = {};

  // Initialize all hours
  for (let h = 0; h < 24; h++) {
    hourOfDay[h] = { count: 0, winRate: 0, avgPnL: 0, totalPnL: 0, winCount: 0, lossCount: 0 };
  }

  // Initialize all days
  for (const day of DAYS_OF_WEEK) {
    dayOfWeek[day] = { count: 0, winRate: 0, avgPnL: 0, totalPnL: 0, winCount: 0, lossCount: 0 };
  }

  for (const trade of sellTrades) {
    // Hour of day
    const hourBucket = hourOfDay[trade.hourOfEntry]!;
    hourBucket.count++;
    hourBucket.totalPnL += trade.pnl;
    if (trade.pnl > 0) hourBucket.winCount++;
    else if (trade.pnl < 0) hourBucket.lossCount++;

    // Day of week
    const dayBucket = dayOfWeek[trade.dayOfWeek]!;
    dayBucket.count++;
    dayBucket.totalPnL += trade.pnl;
    if (trade.pnl > 0) dayBucket.winCount++;
    else if (trade.pnl < 0) dayBucket.lossCount++;
  }

  // Calculate derived metrics
  for (let h = 0; h < 24; h++) {
    const bucket = hourOfDay[h]!;
    if (bucket.count > 0) {
      bucket.winRate = (bucket.winCount / bucket.count) * 100;
      bucket.avgPnL = bucket.totalPnL / bucket.count;
    }
  }

  for (const day of DAYS_OF_WEEK) {
    const bucket = dayOfWeek[day]!;
    if (bucket.count > 0) {
      bucket.winRate = (bucket.winCount / bucket.count) * 100;
      bucket.avgPnL = bucket.totalPnL / bucket.count;
    }
  }

  return { hourOfDay, dayOfWeek };
}

// ============================================================================
// DRAWDOWN STATS CALCULATION
// ============================================================================

function generateDrawdownStats(chartData: ChartDataPoint[]): DrawdownStats {
  if (chartData.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      maxDrawdownDuration: 0,
      currentDrawdown: 0,
      currentDrawdownPercent: 0,
      isInDrawdown: false,
      drawdownHistory: [],
      recoveryFactor: 0,
    };
  }

  let peak = chartData[0]!.cumulativePnL;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let maxDrawdownDuration = 0;

  const drawdownHistory: DrawdownPeriod[] = [];
  let currentDrawdownStart: ChartDataPoint | null = null;
  let currentPeakValue = peak;
  let currentTrough = peak;

  for (let i = 0; i < chartData.length; i++) {
    const point = chartData[i]!;
    const value = point.cumulativePnL;

    if (value > peak) {
      // New peak reached - close any existing drawdown period
      if (currentDrawdownStart) {
        const startTime = new Date(currentDrawdownStart.date).getTime();
        const endTime = new Date(point.date).getTime();
        drawdownHistory.push({
          startDate: currentDrawdownStart.date,
          endDate: point.date,
          depth: currentPeakValue - currentTrough,
          duration: (endTime - startTime) / (1000 * 60 * 60),
          peakValue: currentPeakValue,
          troughValue: currentTrough,
        });
        currentDrawdownStart = null;
      }
      peak = value;
      currentPeakValue = value;
      currentTrough = value;
    } else {
      // In drawdown
      const drawdown = peak - value;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

      if (!currentDrawdownStart) {
        currentDrawdownStart = chartData[i - 1] || point;
        currentPeakValue = peak;
        currentTrough = value;
      }

      if (value < currentTrough) {
        currentTrough = value;
      }

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }
  }

  // Handle ongoing drawdown
  const lastPoint = chartData[chartData.length - 1]!;
  const currentDrawdown = peak - lastPoint.cumulativePnL;
  const currentDrawdownPercent = peak > 0 ? (currentDrawdown / peak) * 100 : 0;
  const isInDrawdown = currentDrawdown > 0;

  if (isInDrawdown && currentDrawdownStart) {
    const startTime = new Date(currentDrawdownStart.date).getTime();
    const endTime = new Date(lastPoint.date).getTime();
    maxDrawdownDuration = Math.max(maxDrawdownDuration, (endTime - startTime) / (1000 * 60 * 60));
  }

  // Calculate recovery factor
  const totalPnL = lastPoint.cumulativePnL;
  const recoveryFactor = maxDrawdown > 0 ? totalPnL / maxDrawdown : totalPnL > 0 ? Infinity : 0;

  return {
    maxDrawdown,
    maxDrawdownPercent,
    maxDrawdownDuration,
    currentDrawdown,
    currentDrawdownPercent,
    isInDrawdown,
    drawdownHistory,
    recoveryFactor,
  };
}

// ============================================================================
// RISK-ADJUSTED METRICS CALCULATION
// ============================================================================

function generateRiskAdjustedMetrics(trades: TradeReport[]): RiskAdjustedMetrics {
  const sellTrades = trades.filter((t) => t.side === Side.SELL);
  const returns = sellTrades.map((t) => t.pnl);

  const wins = sellTrades.filter((t) => t.pnl > 0);
  const losses = sellTrades.filter((t) => t.pnl < 0);

  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

  // Win/loss rate based on decided trades only (wins + losses)
  const decidedCount = wins.length + losses.length;
  const winRate = decidedCount > 0 ? wins.length / decidedCount : 0;
  const lossRate = decidedCount > 0 ? losses.length / decidedCount : 0;

  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const returnStdDev = calculateStdDev(returns);
  const downsideDeviation = calculateDownsideDeviation(returns);

  // Sharpe Ratio (assuming 0% risk-free rate for simplicity)
  const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;

  // Sortino Ratio (using downside deviation)
  const sortinoRatio = downsideDeviation > 0 ? avgReturn / downsideDeviation : avgReturn > 0 ? Infinity : 0;

  // Profit Factor
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Payoff Ratio (avgWin / avgLoss)
  // When no losses, payoff ratio is infinite (we cap display elsewhere)
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  // Expectancy = (winRate * avgWin) - (lossRate * avgLoss)
  const expectancy = winRate * avgWin - lossRate * avgLoss;

  // Kelly Fraction = (winRate * payoffRatio - lossRate) / payoffRatio
  // When no losses (payoffRatio = Infinity), Kelly simplifies to winRate
  // When no wins (payoffRatio = 0), Kelly = 0
  let kellyFraction: number;
  if (!isFinite(payoffRatio)) {
    // No losses: Kelly = winRate (bet based on win rate alone)
    kellyFraction = winRate;
  } else if (payoffRatio > 0) {
    kellyFraction = (winRate * payoffRatio - lossRate) / payoffRatio;
  } else {
    kellyFraction = 0;
  }
  // Clamp between 0 and 1
  kellyFraction = Math.max(0, Math.min(1, kellyFraction));

  // Calmar Ratio = annualized return / max drawdown (we'll skip annualization for now)
  // Will be calculated in main function with access to drawdown stats

  return {
    sharpeRatio,
    sortinoRatio,
    calmarRatio: 0, // Will be set in main calculation
    profitFactor,
    payoffRatio,
    expectancy,
    kellyFraction,
    returnStdDev,
    downsideDeviation,
  };
}

// ============================================================================
// STREAK STATS CALCULATION
// ============================================================================

function generateStreakStats(trades: TradeReport[]): StreakStats {
  const sellTrades = trades.filter((t) => t.side === Side.SELL).sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());

  if (sellTrades.length === 0) {
    return {
      currentStreak: 0,
      currentStreakType: 'none',
      longestWinStreak: 0,
      longestLossStreak: 0,
      avgWinStreak: 0,
      avgLossStreak: 0,
    };
  }

  let currentStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];

  for (const trade of sellTrades) {
    if (trade.pnl > 0) {
      tempWinStreak++;
      if (tempLossStreak > 0) {
        lossStreaks.push(tempLossStreak);
        longestLossStreak = Math.max(longestLossStreak, tempLossStreak);
        tempLossStreak = 0;
      }
    } else if (trade.pnl < 0) {
      tempLossStreak++;
      if (tempWinStreak > 0) {
        winStreaks.push(tempWinStreak);
        longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
        tempWinStreak = 0;
      }
    }
  }

  // Finalize last streak
  if (tempWinStreak > 0) {
    winStreaks.push(tempWinStreak);
    longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
    currentStreak = tempWinStreak;
  }
  if (tempLossStreak > 0) {
    lossStreaks.push(tempLossStreak);
    longestLossStreak = Math.max(longestLossStreak, tempLossStreak);
    currentStreak = -tempLossStreak;
  }

  return {
    currentStreak,
    currentStreakType: currentStreak > 0 ? 'win' : currentStreak < 0 ? 'loss' : 'none',
    longestWinStreak,
    longestLossStreak,
    avgWinStreak: winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0,
    avgLossStreak: lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length : 0,
  };
}

// ============================================================================
// VOLUME CORRELATION CALCULATION
// ============================================================================

function generateVolumeCorrelation(trades: TradeReport[]): VolumeCorrelation {
  // Since we don't have volume directly in TradeReport, we'll use trade size as a proxy
  // This can be enhanced if market volume data is added to trades

  const sellTrades = trades.filter((t) => t.side === Side.SELL);

  const createEmptyBucket = (range: string, min: number, max: number): VolumeCorrelationBucket => ({
    volumeRange: range,
    minVolume: min,
    maxVolume: max,
    tradeCount: 0,
    winRate: 0,
    avgPnL: 0,
    totalPnL: 0,
  });

  const buckets: VolumeCorrelationBucket[] = [
    createEmptyBucket('0-10', 0, 10),
    createEmptyBucket('10-50', 10, 50),
    createEmptyBucket('50-100', 50, 100),
    createEmptyBucket('100-500', 100, 500),
    createEmptyBucket('500+', 500, Infinity),
  ];

  const winCounts: number[] = [0, 0, 0, 0, 0];

  for (const trade of sellTrades) {
    const size = trade.shares;
    let bucketIndex = 0;

    if (size >= 500) bucketIndex = 4;
    else if (size >= 100) bucketIndex = 3;
    else if (size >= 50) bucketIndex = 2;
    else if (size >= 10) bucketIndex = 1;
    else bucketIndex = 0;

    buckets[bucketIndex]!.tradeCount++;
    buckets[bucketIndex]!.totalPnL += trade.pnl;
    if (trade.pnl > 0) winCounts[bucketIndex]!++;
  }

  // Calculate derived metrics
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i]!;
    if (bucket.tradeCount > 0) {
      bucket.winRate = (winCounts[i]! / bucket.tradeCount) * 100;
      bucket.avgPnL = bucket.totalPnL / bucket.tradeCount;
    }
  }

  // Calculate correlation between trade size and PnL
  const sizes = sellTrades.map((t) => t.shares);
  const pnls = sellTrades.map((t) => t.pnl);
  const correlationCoefficient = calculatePearsonCorrelation(sizes, pnls);

  return {
    buckets: buckets.filter((b) => b.tradeCount > 0),
    correlationCoefficient,
  };
}

// ============================================================================
// TRADE SIZE ANALYSIS
// ============================================================================

function generateTradeSizeAnalysis(trades: TradeReport[]): TradeSizeAnalysis {
  const sellTrades = trades.filter((t) => t.side === Side.SELL);

  const createEmptyBucket = (range: string, min: number, max: number): TradeSizeBucket => ({
    sizeRange: range,
    minSize: min,
    maxSize: max,
    tradeCount: 0,
    winRate: 0,
    avgPnL: 0,
    totalPnL: 0,
  });

  const buckets: TradeSizeBucket[] = [
    createEmptyBucket('$0-$10', 0, 10),
    createEmptyBucket('$10-$25', 10, 25),
    createEmptyBucket('$25-$50', 25, 50),
    createEmptyBucket('$50-$100', 50, 100),
    createEmptyBucket('$100-$250', 100, 250),
    createEmptyBucket('$250+', 250, Infinity),
  ];

  const winCounts: number[] = [0, 0, 0, 0, 0, 0];

  for (const trade of sellTrades) {
    const cost = trade.cost;
    let bucketIndex = 0;

    if (cost >= 250) bucketIndex = 5;
    else if (cost >= 100) bucketIndex = 4;
    else if (cost >= 50) bucketIndex = 3;
    else if (cost >= 25) bucketIndex = 2;
    else if (cost >= 10) bucketIndex = 1;
    else bucketIndex = 0;

    buckets[bucketIndex]!.tradeCount++;
    buckets[bucketIndex]!.totalPnL += trade.pnl;
    if (trade.pnl > 0) winCounts[bucketIndex]!++;
  }

  // Calculate derived metrics and find optimal range
  let optimalBucket: TradeSizeBucket | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i]!;
    if (bucket.tradeCount > 0) {
      bucket.winRate = (winCounts[i]! / bucket.tradeCount) * 100;
      bucket.avgPnL = bucket.totalPnL / bucket.tradeCount;

      // Score = avgPnL * sqrt(tradeCount) to balance profitability with sample size
      const score = bucket.avgPnL * Math.sqrt(bucket.tradeCount);
      if (score > bestScore && bucket.tradeCount >= 3) {
        bestScore = score;
        optimalBucket = bucket;
      }
    }
  }

  return {
    buckets: buckets.filter((b) => b.tradeCount > 0),
    optimalSizeRange: optimalBucket?.sizeRange || null,
  };
}

// ============================================================================
// CONSECUTIVE ANALYSIS CALCULATION
// ============================================================================

function generateConsecutiveAnalysis(trades: TradeReport[]): ConsecutiveAnalysis {
  if (trades.length === 0) {
    return {
      avgTradesPerDay: 0,
      avgTradesPerWeek: 0,
      mostActiveDay: 'N/A',
      mostActiveHour: 0,
      tradingDays: 0,
      totalDaysInPeriod: 0,
      tradingFrequency: 0,
    };
  }

  const sortedTrades = [...trades].sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());

  // Get unique trading days
  const tradingDaysSet = new Set<string>();
  const dayCount: Record<string, number> = {};
  const hourCount: Record<number, number> = {};

  for (const trade of sortedTrades) {
    const date = new Date(trade.executedAt);
    const dayKey = date.toISOString().split('T')[0]!;
    tradingDaysSet.add(dayKey);

    const dayOfWeek = trade.dayOfWeek;
    dayCount[dayOfWeek] = (dayCount[dayOfWeek] || 0) + 1;

    const hour = trade.hourOfEntry;
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  }

  const firstTradeDate = new Date(sortedTrades[0]!.executedAt);
  const lastTradeDate = new Date(sortedTrades[sortedTrades.length - 1]!.executedAt);
  const totalDaysInPeriod = Math.max(1, Math.ceil((lastTradeDate.getTime() - firstTradeDate.getTime()) / (1000 * 60 * 60 * 24)));

  const tradingDays = tradingDaysSet.size;
  const avgTradesPerDay = tradingDays > 0 ? trades.length / tradingDays : 0;
  const weeks = totalDaysInPeriod / 7;
  const avgTradesPerWeek = weeks > 0 ? trades.length / weeks : trades.length;

  // Find most active day and hour
  let mostActiveDay = 'N/A';
  let maxDayCount = 0;
  for (const [day, count] of Object.entries(dayCount)) {
    if (count > maxDayCount) {
      maxDayCount = count;
      mostActiveDay = day;
    }
  }

  let mostActiveHour = 0;
  let maxHourCount = 0;
  for (const [hour, count] of Object.entries(hourCount)) {
    if (count > maxHourCount) {
      maxHourCount = count;
      mostActiveHour = parseInt(hour);
    }
  }

  return {
    avgTradesPerDay,
    avgTradesPerWeek,
    mostActiveDay,
    mostActiveHour,
    tradingDays,
    totalDaysInPeriod,
    tradingFrequency: totalDaysInPeriod > 0 ? tradingDays / totalDaysInPeriod : 0,
  };
}

// ============================================================================
// TIME FILTER OPTIONS
// ============================================================================

export interface TimeFilterOption {
  value: string;
  label: string;
  hours: number;
}

export const TIME_FILTER_OPTIONS: TimeFilterOption[] = [
  { value: '48h', label: '48 hours ago', hours: 48 },
  { value: '36h', label: '36 hours ago', hours: 36 },
  { value: '24h', label: '24 hours ago', hours: 24 },
  { value: '18h', label: '18 hours ago', hours: 18 },
  { value: '12h', label: '12 hours ago', hours: 12 },
  { value: '8h', label: '8 hours ago', hours: 8 },
  { value: '6h', label: '6 hours ago', hours: 6 },
  { value: '3h', label: '3 hours ago', hours: 3 },
  { value: '2h', label: '2 hours ago', hours: 2 },
  { value: '1h', label: '1 hour ago', hours: 1 },
];

export const getStartDateFromFilter = (filter: string): Date => {
  const option = TIME_FILTER_OPTIONS.find((o) => o.value === filter);
  if (option) {
    return new Date(Date.now() - option.hours * 60 * 60 * 1000);
  }
  // Default: return the original default date
  return new Date('2026-01-14T08:00:00Z');
};

export interface TradesReportOptions {
  startDateFilter?: string; // e.g., '24h', '12h', etc.
}

// ============================================================================
// MAIN REPORT FUNCTION
// ============================================================================

/**
 * Fetches all trades and calculates P&L for each using the getAggregatedTrades service
 */
export const getTradesReport = async (options: TradesReportOptions = {}): Promise<TradesReportSummary & { selectedFilter: string }> => {
  const selectedFilter = options.startDateFilter || 'all';
  const startDate = options.startDateFilter ? getStartDateFromFilter(options.startDateFilter) : undefined;

  const trades = await getAggregatedTrades({ startDate });
  logger.info(`Found ${trades.length} aggregated trades for user ${USER_ADDRESS} (filter: ${selectedFilter})`);

  // Build a map of BUY trades by assetId for hold duration calculation
  const buyTradesByAssetId = new Map<string, AggregatedTradeWithPnl[]>();
  for (const trade of trades) {
    if (trade.side === 'BUY') {
      if (!buyTradesByAssetId.has(trade.assetId)) {
        buyTradesByAssetId.set(trade.assetId, []);
      }
      buyTradesByAssetId.get(trade.assetId)!.push(trade);
    }
  }

  // Enhance trades with buy date for hold duration
  const enhancedTrades: TradeWithBuyDate[] = trades.map((trade) => {
    if (trade.side === 'SELL') {
      const assetBuys = buyTradesByAssetId.get(trade.assetId) || [];
      // Find the most recent BUY before this SELL
      const priorBuys = assetBuys.filter((b) => b.date < trade.date).sort((a, b) => b.date.getTime() - a.date.getTime());
      const buyDate = priorBuys[0]?.date;
      return { ...trade, buyDate };
    }
    return { ...trade, buyDate: undefined };
  });

  // Convert to TradeReport format
  const tradeReports = enhancedTrades.map((trade) => toTradeReport(trade));

  // Sort by execution time (most recent first)
  tradeReports.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

  const summary = calculateSummary(tradeReports);
  return { trades: tradeReports, ...summary, selectedFilter };
};

function calculateSummary(trades: TradeReport[]) {
  // Only SELL trades have realized P&L
  const sellTrades = trades.filter((t) => t.side === Side.SELL);
  const buyTrades = trades.filter((t) => t.side === Side.BUY);

  let totalPnL = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let breakEvenTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  const wins: TradeReport[] = [];
  const losses: TradeReport[] = [];

  for (const trade of sellTrades) {
    totalPnL += trade.pnl;
    if (trade.pnl > 0) {
      winningTrades++;
      grossProfit += trade.pnl;
      wins.push(trade);
    } else if (trade.pnl < 0) {
      losingTrades++;
      grossLoss += Math.abs(trade.pnl);
      losses.push(trade);
    } else {
      breakEvenTrades++;
    }
  }

  // Total cost is from BUY trades only
  const totalCost = buyTrades.reduce((sum, t) => sum + t.orderPrice * t.shares, 0);

  // Generate chart data (sorted oldest first for chronological display)
  const chartData = generateChartData(trades);

  // Generate market and outcome stats (SELL trades only for P&L stats)
  const { topWinnersByMarket, topLosersByMarket } = generateMarketStats(sellTrades);
  const outcomeStats = generateOutcomeStats(sellTrades);
  const priceRangeStats = generatePriceRangeStats(sellTrades);

  // NEW: Generate all analytics
  const holdTimeStats = generateHoldTimeStats(trades);
  const executionStats = generateExecutionStats(trades);
  const temporalPerformance = generateTemporalPerformance(trades);
  const drawdownStats = generateDrawdownStats(chartData);
  const riskAdjustedMetrics = generateRiskAdjustedMetrics(trades);
  const streakStats = generateStreakStats(trades);
  const volumeCorrelation = generateVolumeCorrelation(trades);
  const tradeSizeAnalysis = generateTradeSizeAnalysis(trades);
  const consecutiveAnalysis = generateConsecutiveAnalysis(trades);

  // Calculate Calmar Ratio (needs both total PnL and max drawdown)
  if (drawdownStats.maxDrawdown > 0) {
    riskAdjustedMetrics.calmarRatio = totalPnL / drawdownStats.maxDrawdown;
  }

  // Summary statistics
  const avgWinSize = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLossSize = losses.length > 0 ? grossLoss / losses.length : 0;
  const avgPnLPerTrade = sellTrades.length > 0 ? totalPnL / sellTrades.length : 0;
  const largestWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl)) : 0;

  // Win rate is based on decided trades only (wins + losses), excluding break-even
  const decidedTrades = winningTrades + losingTrades;
  const winRate = decidedTrades > 0 ? (winningTrades / decidedTrades) * 100 : 0;
  const lossRate = decidedTrades > 0 ? (losingTrades / decidedTrades) * 100 : 0;

  return {
    totalRealizedPnL: totalPnL,
    totalUnrealizedPnL: totalPnL,
    totalCost,
    totalCurrentValue: sellTrades.reduce((sum, t) => sum + t.orderPrice * t.shares, 0),
    winningTrades,
    losingTrades,
    breakEvenTrades,
    totalTrades: trades.length,
    winRate,
    lossRate,
    chartData,
    topWinnersByMarket,
    topLosersByMarket,
    outcomeStats,
    priceRangeStats,
    // NEW analytics
    holdTimeStats,
    executionStats,
    temporalPerformance,
    drawdownStats,
    riskAdjustedMetrics,
    streakStats,
    volumeCorrelation,
    tradeSizeAnalysis,
    consecutiveAnalysis,
    // Summary stats
    avgPnLPerTrade,
    avgWinSize,
    avgLossSize,
    largestWin,
    largestLoss,
    grossProfit,
    grossLoss,
  };
}

// ============================================================================
// EXISTING HELPER FUNCTIONS (unchanged logic)
// ============================================================================

// Rolling window size for win rate calculation
const WIN_RATE_WINDOW_SIZE = 3;

function generateChartData(trades: TradeReport[]): ChartDataPoint[] {
  // Only SELL trades have realized P&L for charting
  const sellTrades = trades.filter((t) => t.side === Side.SELL);
  if (sellTrades.length === 0) return [];

  // Sort trades by date (oldest first)
  const sortedTrades = [...sellTrades].sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());

  const chartData: ChartDataPoint[] = [];
  let cumulativePnL = 0;
  let totalCount = 0;

  // Track recent decided trades for rolling win rate
  const recentOutcomes: ('win' | 'loss')[] = [];

  for (const trade of sortedTrades) {
    totalCount++;
    cumulativePnL += trade.pnl;

    // Track wins/losses for rolling window (skip break-even)
    if (trade.pnl > 0) {
      recentOutcomes.push('win');
    } else if (trade.pnl < 0) {
      recentOutcomes.push('loss');
    }

    // Calculate rolling win rate based on last N decided trades
    const windowOutcomes = recentOutcomes.slice(-WIN_RATE_WINDOW_SIZE);
    const windowWins = windowOutcomes.filter((o) => o === 'win').length;
    const winRate = windowOutcomes.length > 0 ? (windowWins / windowOutcomes.length) * 100 : 0;

    chartData.push({
      date: trade.executedAt,
      cumulativePnL: Number(cumulativePnL.toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
      tradeCount: totalCount,
    });
  }

  return chartData;
}

function generateMarketStats(trades: TradeReport[]): {
  topWinnersByMarket: MarketStats[];
  topLosersByMarket: MarketStats[];
} {
  const marketMap = new Map<string, MarketStats>();

  for (const trade of trades) {
    const key = trade.question;
    const existing = marketMap.get(key);
    const cost = trade.orderPrice * trade.shares;

    if (existing) {
      existing.totalPnL += trade.pnl;
      existing.tradeCount++;
      existing.totalCost += cost;
      if (trade.pnl > 0) {
        existing.winCount++;
      } else if (trade.pnl < 0) {
        existing.lossCount++;
      }
    } else {
      marketMap.set(key, {
        question: trade.question,
        marketSlug: trade.marketSlug,
        image: trade.image,
        totalPnL: trade.pnl,
        tradeCount: 1,
        winCount: trade.pnl > 0 ? 1 : 0,
        lossCount: trade.pnl < 0 ? 1 : 0,
        totalCost: cost,
      });
    }
  }

  const allMarkets = Array.from(marketMap.values());

  // Top winners (sorted by highest P&L)
  const topWinnersByMarket = allMarkets
    .filter((m) => m.totalPnL > 0)
    .sort((a, b) => b.totalPnL - a.totalPnL)
    .slice(0, 5);

  // Top losers (sorted by lowest P&L)
  const topLosersByMarket = allMarkets
    .filter((m) => m.totalPnL < 0)
    .sort((a, b) => a.totalPnL - b.totalPnL)
    .slice(0, 5);

  return { topWinnersByMarket, topLosersByMarket };
}

function generateOutcomeStats(trades: TradeReport[]): OutcomeStats[] {
  const yesStats: OutcomeStats = {
    outcome: 'Yes',
    totalPnL: 0,
    tradeCount: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    avgPnL: 0,
  };

  const noStats: OutcomeStats = {
    outcome: 'No',
    totalPnL: 0,
    tradeCount: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    avgPnL: 0,
  };

  for (const trade of trades) {
    const stats = trade.outcome === 'Yes' ? yesStats : noStats;
    stats.totalPnL += trade.pnl;
    stats.tradeCount++;

    if (trade.pnl > 0) {
      stats.winCount++;
    } else if (trade.pnl < 0) {
      stats.lossCount++;
    }
  }

  // Calculate derived stats
  if (yesStats.tradeCount > 0) {
    yesStats.winRate = (yesStats.winCount / yesStats.tradeCount) * 100;
    yesStats.avgPnL = yesStats.totalPnL / yesStats.tradeCount;
  }

  if (noStats.tradeCount > 0) {
    noStats.winRate = (noStats.winCount / noStats.tradeCount) * 100;
    noStats.avgPnL = noStats.totalPnL / noStats.tradeCount;
  }

  return [yesStats, noStats];
}

function createEmptyRanges(): PriceRangeStats[] {
  return [
    { rangeLabel: '0-10¢', minPrice: 0, maxPrice: 0.1, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '10-20¢', minPrice: 0.1, maxPrice: 0.2, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '20-30¢', minPrice: 0.2, maxPrice: 0.3, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '30-40¢', minPrice: 0.3, maxPrice: 0.4, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '40-50¢', minPrice: 0.4, maxPrice: 0.5, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '50-60¢', minPrice: 0.5, maxPrice: 0.6, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '60-70¢', minPrice: 0.6, maxPrice: 0.7, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '70-80¢', minPrice: 0.7, maxPrice: 0.8, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '80-90¢', minPrice: 0.8, maxPrice: 0.9, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '90-100¢', minPrice: 0.9, maxPrice: 1.0, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
  ];
}

function populateRangeStats(ranges: PriceRangeStats[], trades: TradeReport[]): void {
  for (const trade of trades) {
    const price = trade.matchedPrice;

    // Find the matching range
    for (const range of ranges) {
      if (price >= range.minPrice && price < range.maxPrice) {
        range.tradeCount++;
        range.totalPnL += trade.pnl;

        if (trade.pnl > 0) {
          range.winCount++;
        } else if (trade.pnl < 0) {
          range.lossCount++;
        }
        break;
      }
    }

    // Handle edge case for exactly 1.0
    if (price >= 1.0) {
      const lastRange = ranges[ranges.length - 1];
      if (lastRange) {
        lastRange.tradeCount++;
        lastRange.totalPnL += trade.pnl;
        if (trade.pnl > 0) {
          lastRange.winCount++;
        } else if (trade.pnl < 0) {
          lastRange.lossCount++;
        }
      }
    }
  }

  // Calculate derived stats
  for (const range of ranges) {
    if (range.tradeCount > 0) {
      range.winRate = (range.winCount / range.tradeCount) * 100;
      range.avgPnL = range.totalPnL / range.tradeCount;
    }
  }
}

function generatePriceRangeStats(trades: TradeReport[]): PriceRangeStatsByOutcome {
  const yesTrades = trades.filter((t) => t.outcome === 'Yes');
  const noTrades = trades.filter((t) => t.outcome === 'No');

  const yesRanges = createEmptyRanges();
  const noRanges = createEmptyRanges();

  populateRangeStats(yesRanges, yesTrades);
  populateRangeStats(noRanges, noTrades);

  return {
    yes: yesRanges.filter((r) => r.tradeCount > 0),
    no: noRanges.filter((r) => r.tradeCount > 0),
  };
}
