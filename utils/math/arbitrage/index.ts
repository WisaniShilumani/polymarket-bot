import type { ArbitrageResult, Position } from '../../../common/types';
import { getPayout } from '../payout';
import { getTotalCost } from '../cost/index';

/**
 * Checks whether a portfolio of positions is a guaranteed arbitrage.
 * Arbitrage exists if payout >= cost for ALL outcomes.
 */
export const checkArbitrage = (positions: Position[]): ArbitrageResult => {
  const cost = getTotalCost(positions);
  const payoutYes = getPayout(positions, positions[0]?.marketId || '');
  const payoutNo = getPayout(positions, positions[0]?.marketId || '');
  const minPayout = Math.min(payoutYes, payoutNo);
  const worstCaseProfit = minPayout - cost;

  return {
    isArbitrage: worstCaseProfit > 0.01,
    worstCaseProfit,
    cost,
    minPayout,
  };
};
