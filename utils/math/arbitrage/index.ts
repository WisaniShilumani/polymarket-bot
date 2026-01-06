import type { ArbitrageResult, Position } from '../../../common/types';
import { getPayout } from '../payout';
import { getTotalCost } from '../cost/index';
import { MarketSide } from '../../../common/enums';

/**
 * Checks whether a portfolio of positions is a guaranteed arbitrage.
 * Arbitrage exists if payout >= cost for ALL outcomes.
 */
export const checkArbitrage = (positions: Position[]): ArbitrageResult => {
  const cost = getTotalCost(positions);
  const allPayouts = positions.map(getPayout);
  const minPayout = Math.min(...allPayouts);
  const maxPayout = Math.max(...allPayouts);
  const worstCaseProfit = minPayout - cost;
  const bestCaseProfit = maxPayout - cost;

  return {
    isArbitrage: worstCaseProfit > 0.01,
    worstCaseProfit,
    bestCaseProfit,
    cost,
    minPayout,
    side: positions[0]?.side || MarketSide.Yes,
  };
};
