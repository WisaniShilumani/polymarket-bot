import { MarketSide } from '../../../common/enums';
import type { ArbitrageResult, Market, Position } from '../../../common/types';
import { formatCurrency } from '../../accounting';
import { checkArbitrage } from '../arbitrage';

interface MutuallyExclusiveArbResult {
  arbitrageBundles: ArbitrageResult[];
}

/**
 * Builds arbitrage positions for mutually exclusive outcomes.
 */
export const checkMutuallyExclusiveArbitrage = (markets: Market[], stakePerMarket = 1): MutuallyExclusiveArbResult => {
  // Strategy 1: Buy YES on all
  const yesPositions: Position[] = markets.map((m) => ({
    marketId: m.marketId,
    side: MarketSide.Yes,
    price: m.yesPrice,
    size: stakePerMarket,
    daysToExpiry: m.daysToExpiry,
  }));

  // Strategy 2: Buy NO on all
  const noPositions: Position[] = markets.map((m) => ({
    marketId: m.marketId,
    side: MarketSide.No,
    price: 1 - m.yesPrice,
    size: stakePerMarket,
    daysToExpiry: m.daysToExpiry,
  }));

  const yesArbitrage = checkArbitrage(yesPositions);
  const noArbitrage = checkArbitrage(noPositions);
  const arbitrageBundles = [yesArbitrage, noArbitrage].filter((a) => a.isArbitrage);

  return {
    arbitrageBundles,
  };
};
