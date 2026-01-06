import type { Position } from '../../../common/types';

export const getPayout = (position: Position): number => {
  return 1 * position.size; // essentially = profit + intial cost = 1 - price + price = 1
};
