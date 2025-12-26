import type { LatencyArbResult, Market, Position } from '../../../common/types';
import { checkLatencyArbitrage } from './index';
import { MarketSide } from '../../../common/enums';

export const buildLatencyArb = (subset: Market, superset: Market, size = 1): LatencyArbResult => {
  const positions: Position[] = [
    {
      marketId: subset.marketId,
      side: MarketSide.Yes,
      price: subset.yesPrice,
      size,
    },
    {
      marketId: superset.marketId,
      side: MarketSide.No,
      price: 1 - superset.yesPrice,
      size,
    },
  ];

  return checkLatencyArbitrage(positions, subset.marketId, superset.marketId);
};
