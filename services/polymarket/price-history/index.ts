import { subHours } from 'date-fns';
import type { PolymarketPriceHistory, PolymarketPriceHistoryDataPoint } from '../../../common/types';
import { http } from '../../../utils/http';
import { logger } from '../../../utils/logger';
import { buildPriceHistoryUrl } from '../utils';

const SWING_THRESHOLD = 0.02;

export interface RiskMetrics {
  standardDeviation: number; // σ - volatility of price changes
  downsideDeviation: number; // σ of negative returns only (Sortino-style)
  valueAtRisk95: number; // 95% VaR - potential loss at 95% confidence
  valueAtRisk99: number; // 99% VaR - potential loss at 99% confidence
  expectedShortfall95: number; // CVaR - average loss beyond 95% VaR
}

export interface VolatilityInfo {
  totalUpswings: number;
  totalDownswings: number;
  volatility: number; // standard deviation of price changes
  averageSwingMagnitude: number;
  risk: RiskMetrics;
  priceRange: { min: number; max: number };
}

export interface BuySignal {
  maxPrice: number;
  shouldBuy: boolean;
  score: number; // 0-100, higher = better opportunity
  reasons: string[];
  metrics: {
    upswingRatio: number; // upswings / (upswings + downswings), >0.5 is bullish
    riskRewardRatio: number; // target profit / potential loss (VaR95)
    volatilityAdequacy: boolean; // is volatility high enough to expect $0.02 swings?
    upsideDeviation: number; // σ of positive returns
    asymmetryRatio: number; // upsideDeviation / downsideDeviation, >1 favors upside
  };
}

export const getPriceHistory = async (market: string, startTs: Date, endTs: Date): Promise<PolymarketPriceHistory> => {
  const url = buildPriceHistoryUrl(market, startTs, endTs);
  try {
    const priceHistory = await http.get(url).json<PolymarketPriceHistory>();
    if (!priceHistory.history.length) {
      throw new Error(`No price history found for market ${url}`);
    }
    return priceHistory;
  } catch (error) {
    logger.error('Error fetching markets from Polymarket API:', error);
    throw error;
  }
};

/**
 * Counts upswings: starting from index i, find the next index j where price[j] - price[i] > threshold
 * Count that as 1 upswing, then continue from index j.
 */
const countUpswings = (dataPoints: PolymarketPriceHistoryDataPoint[], threshold: number): number => {
  const sorted = [...dataPoints].sort((a, b) => a.t - b.t);
  let upswings = 0;
  let i = 0;

  while (i < sorted.length) {
    const startPrice = sorted[i]!.p;
    let found = false;

    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j]!.p - startPrice > threshold) {
        upswings++;
        i = j; // Continue from this index
        found = true;
        break;
      }
    }

    if (!found) break; // No more upswings found
  }

  return upswings;
};

/**
 * Counts downswings: starting from index i, find the next index j where price[i] - price[j] > threshold
 * Count that as 1 downswing, then continue from index j.
 */
const countDownswings = (dataPoints: PolymarketPriceHistoryDataPoint[], threshold: number): number => {
  const sorted = [...dataPoints].sort((a, b) => a.t - b.t);
  let downswings = 0;
  let i = 0;

  while (i < sorted.length) {
    const startPrice = sorted[i]!.p;
    let found = false;

    for (let j = i + 1; j < sorted.length; j++) {
      if (startPrice - sorted[j]!.p > threshold) {
        downswings++;
        i = j; // Continue from this index
        found = true;
        break;
      }
    }

    if (!found) break; // No more downswings found
  }

  return downswings;
};

/**
 * Collects consecutive price changes for volatility calculations
 */
const collectPriceChanges = (dataPoints: PolymarketPriceHistoryDataPoint[]): number[] => {
  const sorted = [...dataPoints].sort((a, b) => a.t - b.t);
  const priceChanges: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    if (current && previous) {
      priceChanges.push(current.p - previous.p);
    }
  }

  return priceChanges;
};

/**
 * Calculates standard deviation of price changes (volatility measure)
 */
const calculateVolatility = (priceChanges: number[]): number => {
  if (priceChanges.length === 0) return 0;

  const mean = priceChanges.reduce((sum, val) => sum + val, 0) / priceChanges.length;
  const squaredDiffs = priceChanges.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / priceChanges.length;

  return Math.sqrt(variance);
};

/**
 * Calculates downside deviation (standard deviation of negative returns only)
 * Used in Sortino ratio - focuses only on harmful volatility
 */
const calculateDownsideDeviation = (priceChanges: number[]): number => {
  const negativeChanges = priceChanges.filter((c) => c < 0);
  if (negativeChanges.length === 0) return 0;

  const mean = negativeChanges.reduce((sum, val) => sum + val, 0) / negativeChanges.length;
  const squaredDiffs = negativeChanges.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / negativeChanges.length;

  return Math.sqrt(variance);
};

/**
 * Calculates upside deviation (standard deviation of positive returns only)
 * Higher upside deviation = more opportunity for profitable swings
 */
const calculateUpsideDeviation = (priceChanges: number[]): number => {
  const positiveChanges = priceChanges.filter((c) => c > 0);
  if (positiveChanges.length === 0) return 0;

  const mean = positiveChanges.reduce((sum, val) => sum + val, 0) / positiveChanges.length;
  const squaredDiffs = positiveChanges.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / positiveChanges.length;

  return Math.sqrt(variance);
};

/**
 * Calculates Value at Risk (VaR) using parametric method
 * VaR = μ - z * σ (potential loss at given confidence level)
 * @param confidenceLevel - e.g., 0.95 for 95% VaR
 */
const calculateVaR = (priceChanges: number[], confidenceLevel: number): number => {
  if (priceChanges.length === 0) return 0;
  const mean = priceChanges.reduce((sum, val) => sum + val, 0) / priceChanges.length;
  const volatility = calculateVolatility(priceChanges);
  const zScores: Record<number, number> = {
    0.95: 1.645,
    0.99: 2.326,
  };

  const z = zScores[confidenceLevel] ?? 1.645;

  // VaR is the potential loss (negative value means loss)
  return mean - z * volatility;
};

/**
 * Calculates Expected Shortfall (CVaR) - average loss beyond VaR
 * Uses historical simulation method
 */
const calculateExpectedShortfall = (priceChanges: number[], confidenceLevel: number): number => {
  if (priceChanges.length === 0) return 0;

  const sorted = [...priceChanges].sort((a, b) => a - b);
  const cutoffIndex = Math.floor(sorted.length * (1 - confidenceLevel));

  if (cutoffIndex === 0) return sorted[0] ?? 0;

  // Average of the worst (1 - confidence) returns
  const tailLosses = sorted.slice(0, cutoffIndex);
  return tailLosses.reduce((sum, val) => sum + val, 0) / tailLosses.length;
};

/**
 * Calculates comprehensive financial risk metrics using standard deviation
 */
const calculateRiskMetrics = (priceChanges: number[]): RiskMetrics => {
  return {
    standardDeviation: calculateVolatility(priceChanges),
    downsideDeviation: calculateDownsideDeviation(priceChanges),
    valueAtRisk95: calculateVaR(priceChanges, 0.95),
    valueAtRisk99: calculateVaR(priceChanges, 0.99),
    expectedShortfall95: calculateExpectedShortfall(priceChanges, 0.95),
  };
};

export const getVolatilityInformation = async (market: string): Promise<VolatilityInfo> => {
  const startDate = subHours(new Date(), 6);
  const endDate = new Date();
  const priceHistoryResponse = await getPriceHistory(market, startDate, endDate);

  const allDataPoints = priceHistoryResponse.history;

  if (allDataPoints.length === 0) {
    return {
      totalUpswings: 0,
      totalDownswings: 0,
      volatility: 0,
      averageSwingMagnitude: 0,
      risk: {
        standardDeviation: 0,
        downsideDeviation: 0,
        valueAtRisk95: 0,
        valueAtRisk99: 0,
        expectedShortfall95: 0,
      },
      priceRange: { min: 0, max: 0 },
    };
  }

  // Count swings across all data (not grouped by hour)
  const totalUpswings = countUpswings(allDataPoints, SWING_THRESHOLD);
  const totalDownswings = countDownswings(allDataPoints, SWING_THRESHOLD);

  // Collect consecutive price changes for volatility calculations
  const allPriceChanges = collectPriceChanges(allDataPoints);

  const volatility = calculateVolatility(allPriceChanges);
  const prices = allDataPoints.map((dp) => dp.p);
  const priceRange = {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };

  const significantChanges = allPriceChanges.filter((c) => Math.abs(c) > SWING_THRESHOLD);
  const averageSwingMagnitude = significantChanges.length > 0 ? significantChanges.reduce((sum, c) => sum + Math.abs(c), 0) / significantChanges.length : 0;

  const risk = calculateRiskMetrics(allPriceChanges);

  return {
    totalUpswings,
    totalDownswings,
    volatility,
    averageSwingMagnitude,
    risk,
    priceRange,
  };
};

/**
 * Evaluates whether a market is a good buy based on volatility analysis.
 *
 * Strategy: Buy uncertain bets (45-65%), sell at +$0.02 profit.
 *
 * Favorable conditions:
 * 1. More upswings than downswings historically (upswingRatio > 0.5)
 * 2. Volatility high enough to expect $0.02 swings (σ > 0.01)
 * 3. Asymmetric volatility favoring upside (upsideDeviation > downsideDeviation)
 * 4. Good risk/reward ratio (target profit / VaR95 loss > 1)
 */
export const evaluateBuySignal = async (market: string): Promise<BuySignal> => {
  try {
    const info = await getVolatilityInformation(market);
    const reasons: string[] = [];
    let score = 50; // Start neutral

    const totalSwings = info.totalUpswings + info.totalDownswings;
    const upswingRatio = totalSwings > 0 ? info.totalUpswings / totalSwings : 0.5;

    // Calculate upside deviation from fresh price history
    const startDate = subHours(new Date(), 1);
    const endDate = new Date();
    const priceHistoryResponse = await getPriceHistory(market, startDate, endDate);
    const priceChanges = collectPriceChanges(priceHistoryResponse.history);
    const upsideDeviation = calculateUpsideDeviation(priceChanges);
    const downsideDeviation = info.risk.downsideDeviation;
    const maxPrice = Math.max(...priceHistoryResponse.history.map((dp) => dp.p));

    // Asymmetry ratio: >1 means upside volatility exceeds downside (good for our strategy)
    const asymmetryRatio = downsideDeviation > 0 ? upsideDeviation / downsideDeviation : upsideDeviation > 0 ? 2 : 1;

    // Volatility adequacy: need enough movement to expect $0.02 swings
    // Rule of thumb: σ should be at least half the target swing
    const volatilityAdequacy = info.volatility >= SWING_THRESHOLD / 2;

    // Risk/reward: compare target profit ($0.02) to potential loss (VaR95)
    // VaR95 is typically negative, so we take absolute value
    const potentialLoss = Math.abs(info.risk.valueAtRisk95);
    const riskRewardRatio = potentialLoss > 0 ? SWING_THRESHOLD / potentialLoss : SWING_THRESHOLD > 0 ? 10 : 0;

    // === SCORING ===

    // 1. Upswing ratio (±20 points)
    if (upswingRatio > 0.6) {
      score += 20;
      reasons.push(`Strong upward bias: ${(upswingRatio * 100).toFixed(0)}% of swings are upward`);
    } else if (upswingRatio > 0.5) {
      score += 10;
      reasons.push(`Slight upward bias: ${(upswingRatio * 100).toFixed(0)}% upswings`);
    } else if (upswingRatio < 0.4) {
      score -= 20;
      reasons.push(`⚠️ Downward bias: only ${(upswingRatio * 100).toFixed(0)}% upswings`);
    }

    // 2. Volatility adequacy (±15 points)
    if (volatilityAdequacy) {
      score += 15;
      reasons.push(`Volatility (σ=${(info.volatility * 100).toFixed(2)}¢) supports $0.02 swings`);
    } else {
      score -= 15;
      reasons.push(`⚠️ Low volatility (σ=${(info.volatility * 100).toFixed(2)}¢) - swings unlikely`);
    }

    // 3. Asymmetry ratio (±15 points)
    if (asymmetryRatio > 1.2) {
      score += 15;
      reasons.push(`Favorable asymmetry: upside σ ${asymmetryRatio.toFixed(2)}x downside σ`);
    } else if (asymmetryRatio < 0.8) {
      score -= 15;
      reasons.push(`⚠️ Unfavorable asymmetry: downside σ dominates`);
    }

    // 4. Risk/reward ratio (±15 points)
    if (riskRewardRatio > 1.5) {
      score += 15;
      reasons.push(`Good risk/reward: ${riskRewardRatio.toFixed(2)}x (profit potential vs VaR95 loss)`);
    } else if (riskRewardRatio < 0.5) {
      score -= 15;
      reasons.push(`⚠️ Poor risk/reward: ${riskRewardRatio.toFixed(2)}x`);
    }

    // 5. Historical swing frequency (±10 points)
    // In 6 hours, having at least 2-3 upswings is healthy
    if (info.totalUpswings >= 3) {
      score += 10;
      reasons.push(`Active market: ${info.totalUpswings} upswings in last 6h`);
    } else if (info.totalUpswings === 0) {
      score -= 10;
      reasons.push(`⚠️ No upswings detected in last 6h`);
    }

    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));

    // Decision threshold: score >= 60 is a buy
    const shouldBuy = score >= 60;

    if (shouldBuy) {
      reasons.unshift('✅ BUY SIGNAL');
    } else {
      reasons.unshift('❌ NO BUY');
    }

    return {
      shouldBuy,
      score,
      reasons,
      maxPrice,
      metrics: {
        upswingRatio,
        riskRewardRatio,
        volatilityAdequacy,
        upsideDeviation,
        asymmetryRatio,
      },
    };
  } catch (error) {
    logger.error('Error evaluating buy signal:', error);
    return {
      maxPrice: 0,
      shouldBuy: false,
      score: 0,
      reasons: [],
      metrics: {} as any,
    };
  }
};
