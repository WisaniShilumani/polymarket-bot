import type { LatencyArbResult, Position } from '../../../common/types';
import { getTotalCost } from '../cost';
import { getLatencyPayout } from '../latency-payout';
import { LatencyState } from '../../../common/enums';

/**
 * Checks subset/superset latency arbitrage.
 *
 * subset ⊆ superset
 */
export const checkLatencyArbitrage = (
  positions: Position[],
  subsetId: string,
  supersetId: string,
): LatencyArbResult => {
  const cost = getTotalCost(positions);
  const states: LatencyState[] = [LatencyState.Both, LatencyState.B, LatencyState.Neither];
  const payouts = states.map((state) => getLatencyPayout(positions, state, subsetId, supersetId));
  console.log('Payouts:', payouts);
  const minPayout = Math.min(...payouts);
  const worstCaseProfit = minPayout - cost;

  return {
    isArbitrage: worstCaseProfit > 0,
    worstCaseProfit,
    cost,
    minPayout,
  };
};
