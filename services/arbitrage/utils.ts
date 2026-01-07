import type { Market, MarketForOrder, PolymarketMarket } from '../../common/types';
import { getNoPrice, getYesPrice } from '../../utils/prices';

export const getMarketsForOrders = (activeMarkets: PolymarketMarket[], useYesStrategy: boolean): MarketForOrder[] => {
  const tokenIndex = useYesStrategy ? 0 : 1;
  const marketsWithTokens = activeMarkets.filter((m) => m.clobTokenIds && m.clobTokenIds.length > tokenIndex && m.clobTokenIds[tokenIndex]);
  const marketsForOrders: MarketForOrder[] = marketsWithTokens.map((m) => ({
    yesTokenId: JSON.parse(m.clobTokenIds as unknown as string)[0] as string,
    noTokenId: JSON.parse(m.clobTokenIds as unknown as string)[1] as string,
    question: m.question,
    price: useYesStrategy ? getYesPrice(m) : getNoPrice(m),
    endDate: m.endDate,
  }));

  return marketsForOrders;
};

export const getMarketsForAnalysis = (activeMarkets: PolymarketMarket[]): Market[] => {
  const marketsForAnalysis: Market[] = activeMarkets
    .filter((m) => !m.closed)
    .map((m) => ({
      marketId: m.id,
      question: m.question,
      yesPrice: getYesPrice(m),
      noPrice: getNoPrice(m), // since no price is available for NO
      spread: m.spread,
      volume: Number(m.volume || 0),
      endDate: m.endDate,
    }));

  return marketsForAnalysis;
};
