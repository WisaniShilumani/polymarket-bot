import type { Market, PolymarketMarket } from '../../../common/types';

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

const winRegexPattern = /^will\s+(.+?)\s+win/i;
const drawRegexPattern = /end in a draw/i;
const winnerTitlePattern = /winner$/i;

export const isObviousMutuallyExclusive = (eventTitle: string, markets: PolymarketMarket[], tags: string[]): boolean => {
  const isSoccerMatch = tags.includes('soccer');
  const isSportsMatch = tags.includes('sports');
  if (isSoccerMatch && (eventTitle.includes(' vs. ') || eventTitle.includes(' vs '))) {
    if (markets.length === 3) {
      const [market1, market2, market3] = markets;
      if (!market1?.question || !market2?.question || !market3?.question) return false;
      const isFirstMarketWinString = winRegexPattern.test(market1.question);
      const isSecondMarketWinString = drawRegexPattern.test(market2.question);
      const isThirdMarketWinString = winRegexPattern.test(market3.question);
      return isFirstMarketWinString && isSecondMarketWinString && isThirdMarketWinString;
    }
  }

  const isOtherSportsMatch = isSportsMatch && !isSoccerMatch;
  if (isOtherSportsMatch && winnerTitlePattern.test(eventTitle)) {
    if (markets.length === 2) {
      const [market1, market2] = markets;
      if (!market1?.question || !market2?.question) return false;
      return market1.question !== market2.question;
    }
  }

  return false;
};
