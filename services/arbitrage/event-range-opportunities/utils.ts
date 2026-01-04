import type { Market } from '../../../common/types';

/**
 * Calculates the minimum shares needed so each order meets the minimum
 * Uses the orderMinSize from the market data
 */
export const calculateNormalizedShares = (markets: Market[], forYesStrategy: boolean, orderMinSize: number): number => {
  const prices = markets.map((m) => (forYesStrategy ? m.yesPrice : 1 - m.yesPrice));
  const minPrice = Math.min(...prices.filter((p) => p > 0));
  if (minPrice <= 0) return orderMinSize;
  const sharesNeeded = 1 / minPrice;
  return Math.max(orderMinSize, Math.ceil(sharesNeeded * 100) / 100);
};
