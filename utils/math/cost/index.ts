import type { Position } from '../../../common/types';

export const getTotalCost = (positions: Position[]): number => positions.reduce((sum, p) => sum + p.price * p.size, 0);
