import { Side } from '@polymarket/clob-client';
import { MarketSide } from '../../../../common/enums';
import type { PolymarketMarket } from '../../../../common/types';
import { getOutcomePrice } from '../../../../utils/prices';
import { getAllCryptoEvents } from '../../../polymarket/events';
import { createOrder, getOpenOrders } from '../../../polymarket/orders';
import { getUserPositions } from '../../../polymarket/positions';
import type { OrderParams } from '../../../polymarket/orders/types';
import { evaluateBuySignal } from '../../../polymarket/price-history';
import logger from '../../../../utils/logger';

const MIN_PRICE = 0.3;
const MAX_PRICE = 0.6;
const MIN_VOLUME = 10_000;
interface IMarketWithOrder extends PolymarketMarket {
  size: number;
}
export const buyCryptoEvents = async () => {
  const [cryptoEvents, positions, orders] = await Promise.all([getAllCryptoEvents(), getUserPositions(), getOpenOrders()]);
  const openPositionMarketIds = positions.map((p) => p.conditionId);
  const openOrderMarketIds = orders.filter((o) => o.outcome === 'Yes' && o.side === Side.BUY).map((o) => o.market);
  const pendingMarketIds = new Set([...openPositionMarketIds, ...openOrderMarketIds]);
  const relevantMarkets: IMarketWithOrder[] = [];
  for (const event of cryptoEvents) {
    for (const market of event.markets) {
      if (market.closed) continue;
      const yesOutcomePrice = getOutcomePrice(market, MarketSide.Yes);
      const tokenId = JSON.parse(market.clobTokenIds as unknown as string)[0];
      if (market.volumeNum < MIN_VOLUME) continue;
      const isInPriceRange = yesOutcomePrice > MIN_PRICE && yesOutcomePrice < MAX_PRICE;
      if (!isInPriceRange) continue;
      const { shouldBuy, score, reasons, metrics } = await evaluateBuySignal(tokenId);
      if (shouldBuy && !pendingMarketIds.has(market.conditionId)) {
        relevantMarkets.push({
          ...market,
          size: Math.round(score / 5),
        });
        logger.progress(`Buying 5 shares of ${market.question} at ${yesOutcomePrice}`);
        logger.info(`Signal information:\nSCORE = ${score}\nREASONS \n=========================\n ${reasons.join('\n')}`);
      }
    }
  }

  const ordersToPlace: OrderParams[] = relevantMarkets.map((market) => ({
    tokenId: JSON.parse(market.clobTokenIds as unknown as string)[0],
    price: getOutcomePrice(market, MarketSide.Yes) - 0.004,
    size: 20,
    side: Side.BUY,
  }));

  await Promise.all(ordersToPlace.map((order) => createOrder(order)));
};
