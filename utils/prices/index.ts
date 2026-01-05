import { MarketSide } from '../../common/enums';
import type { PolymarketMarket } from '../../common/types';
import { HOPEFUL_DISCOUNT } from '../../config';

const getOutcomePrice = (market: PolymarketMarket, side: MarketSide) => {
  try {
    const outcomePrices = JSON.parse(market.outcomePrices);
    return Math.max(parseFloat(outcomePrices[side === MarketSide.Yes ? 0 : 1]) - HOPEFUL_DISCOUNT, 0);
  } catch (e) {
    return 0;
  }
};

export const getYesPrice = (market: PolymarketMarket) => {
  return Math.max(parseFloat(market.bestAsk || market.lastTradePrice || '1') - HOPEFUL_DISCOUNT, 0.01);
};

export const getNoPrice = (market: PolymarketMarket) => {
  return Math.max(getOutcomePrice(market, MarketSide.No) || 1 - parseFloat(market.bestBid || market.lastTradePrice || '0') - HOPEFUL_DISCOUNT, 0.01);
};
