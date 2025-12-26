import { LatencyState, MarketSide } from '../../../common/enums';
import type { Position } from '../../../common/types';

export const getLatencyPayout = (
  positions: Position[],
  state: LatencyState,
  subsetId: string,
  supersetId: string,
): number =>
  positions.reduce((total, pos) => {
    const isSubset = pos.marketId === subsetId;
    const isSuperset = pos.marketId === supersetId;

    const yesWins =
      (state === LatencyState.Both && isSubset) ||
      (state === LatencyState.Both && isSuperset) ||
      (state === LatencyState.B && isSuperset);

    const noWins =
      (state === LatencyState.B && isSubset) ||
      (state === LatencyState.Neither && isSubset) ||
      (state === LatencyState.Neither && isSuperset);

    if (pos.side === MarketSide.Yes && yesWins) {
      return total + pos.size;
    }

    if (pos.side === MarketSide.No && noWins) {
      return total + pos.size;
    }

    return total;
  }, 0);
