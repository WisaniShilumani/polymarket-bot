import type { ArbitrageResult, Market, Position } from '../../../common/types';
import { MarketSide } from '../../../common/enums';
import { getTotalCost } from '../cost';
import { getPayout } from '../payout';

export interface RangeArbitrageResult {
  arbitrageBundles: ArbitrageResult[];
}

export function checkMutuallyExclusiveArbitrage(positions: Position[], marketIds: string[]): ArbitrageResult {
  if (marketIds.length < 2) {
    throw new Error('At least two outcome states required');
  }

  const cost = getTotalCost(positions);
  const payouts = marketIds.map((marketId) => getPayout(positions, marketId));
  const minPayout = Math.min(...payouts);
  const worstCaseProfit = minPayout - cost;

  return {
    isArbitrage: worstCaseProfit > 0.01,
    worstCaseProfit,
    cost,
    minPayout,
  };
}

export const rangeArbitrage = (markets: Market[], stakePerMarket = 1): RangeArbitrageResult => {
  const marketIds = markets.map((m) => m.marketId);

  // Strategy A: Buy YES on all ranges
  const yesPositions: Position[] = markets.map((m) => ({
    marketId: m.marketId,
    side: MarketSide.Yes,
    price: m.yesPrice,
    size: stakePerMarket,
  }));

  // Strategy B: Buy NO on all ranges
  const noPositions: Position[] = markets.map((m) => ({
    marketId: m.marketId,
    side: MarketSide.No,
    price: m.noPrice,
    size: stakePerMarket,
  }));

  const yesArbitrage = checkMutuallyExclusiveArbitrage(yesPositions, marketIds);
  // const noArbitrage = checkMutuallyExclusiveArbitrage(noPositions, marketIds);
  // TODO - We're only returning the YES bundle for now because in some markets no is not = 1 - yesPrice
  const arbitrageBundles = [yesArbitrage].filter((a) => a.isArbitrage);
  return {
    arbitrageBundles,
  };
};
