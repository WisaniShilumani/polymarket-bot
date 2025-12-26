import { MarketSide } from '../../../common/enums';
import type { Position } from '../../../common/types';

export const getPayout = (positions: Position[], winningMarketId: string): number => {
  return positions.reduce((total, pos) => {
    if (pos.side === MarketSide.Yes && pos.marketId === winningMarketId) {
      return total + pos.size;
    }

    if (pos.side === MarketSide.No && pos.marketId === winningMarketId) {
      return total + pos.size;
    }

    return total;
  }, 0);
};
