import { Side } from '@polymarket/clob-client';
import { MarketSide } from '../../../common/enums';
import type { PolymarketMarket } from '../../../common/types';
import { getOutcomePrice } from '../../../utils/prices';
import { getAllCryptoEvents } from '../../polymarket/events';
import { createOrder, getOpenOrders } from '../../polymarket/orders';
import { getUserPositions } from '../../polymarket/positions';
import type { OrderParams } from '../../polymarket/orders/types';

export const buyCryptoEvents = async () => {
  const [cryptoEvents, positions, orders] = await Promise.all([getAllCryptoEvents(), getUserPositions(), getOpenOrders()]);
  const openPositionMarketIds = positions.map((p) => p.conditionId);
  const openOrderMarketIds = orders.filter((o) => o.outcome === 'Yes' && o.side === Side.BUY).map((o) => o.market);
  const pendingMarketIds = new Set([...openPositionMarketIds, ...openOrderMarketIds]);
  const relevantMarkets: PolymarketMarket[] = [];
  cryptoEvents.forEach((event) => {
    event.markets.forEach((market) => {
      const yesOutcomePrice = getOutcomePrice(market, MarketSide.Yes);
      if (yesOutcomePrice > 0.35 && yesOutcomePrice < 0.6 && market.volumeNum > 10_000 && !pendingMarketIds.has(market.conditionId)) {
        relevantMarkets.push(market);
        console.log(`Buying 5 shares of ${market.question} at ${yesOutcomePrice}`);
      }
    });
  });

  const ordersToPlace: OrderParams[] = relevantMarkets.map((market) => ({
    tokenId: JSON.parse(market.clobTokenIds as unknown as string)[0],
    price: getOutcomePrice(market, MarketSide.Yes) - 0.01,
    size: 10,
    side: Side.BUY,
  }));

  await Promise.all(ordersToPlace.map((order) => createOrder(order)));
};
