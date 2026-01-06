import { Side } from '@polymarket/clob-client';
import type { MarketForOrder } from '../../../common/types';
import { getOrderBookDepth } from '../../polymarket/book-depth';
import { differenceInDays } from 'date-fns';

export const checkBooks = async (marketsForOrders: MarketForOrder[], useYesStrategy: boolean, normalizedShares: number) => {
  const daysToExpiry = marketsForOrders[0]?.endDate ? Math.abs(differenceInDays(new Date(marketsForOrders[0].endDate), new Date())) : 7;
  const depthCheckPromises = marketsForOrders.map(async (market) => {
    const depthCheck = await getOrderBookDepth(useYesStrategy ? market.yesTokenId : market.noTokenId, Side.BUY, normalizedShares, market.price, daysToExpiry);
    return { market, depthCheck };
  });

  const depthResults = await Promise.all(depthCheckPromises);
  const sortedMarketOrders = depthResults
    .sort((a, b) => b.depthCheck.spread - a.depthCheck.spread)
    .map((r) => ({
      ...r.market,
      price: Math.min(r.market.price, r.depthCheck.avgFillPrice),
    }));

  const canFillAll = depthResults.every((r) => r.depthCheck.canFill);
  return { sortedMarketOrders, canFillAll };
};
