import { MarketSide } from '../../../common/enums';

/**
 * Expected value of a binary prediction market position.
 *
 * @param side YES or NO
 * @param marketPrice Price paid for that side
 * @param trueProbability Your belief of the event happening
 * @returns Expected profit per $1 stake
 */
export const getExpectedValue = (side: MarketSide, marketPrice: number, trueProbability: number): number => {
  if (marketPrice < 0 || marketPrice > 1) throw new Error('Market price must be between 0 and 1');
  if (trueProbability < 0 || trueProbability > 1) throw new Error('Probability must be between 0 and 1');
  return side === MarketSide.Yes ? trueProbability - marketPrice : marketPrice - trueProbability;
};
