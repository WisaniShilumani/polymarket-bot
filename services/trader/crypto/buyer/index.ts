import { Side, type OpenOrder } from '@polymarket/clob-client';
import { MarketSide } from '../../../../common/enums';
import type { PolymarketMarket, UserPosition } from '../../../../common/types';
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
const MAX_SHARES = 60;
const DIVISOR = 100 / MAX_SHARES;

interface IMarketWithOrder extends PolymarketMarket {
  size: number;
  existingOrderPrice: number;
}

const getPositionAndOrderSize = (conditionId: string, positions: UserPosition[], orders: OpenOrder[]) => {
  const position = positions.find((p) => p.conditionId === conditionId);
  const order = orders.find((o) => o.market === conditionId && o.side === Side.BUY && o.outcome === 'Yes');
  const totalSize = Number(position?.size || 0) + Number(order?.original_size || 0) - Number(order?.size_matched || 0);
  console.log(`Found ${totalSize} total shares for ${conditionId}`);
  return {
    totalSize,
    existingOrderPrice: Number(order?.price || 0),
  };
};
export const buyCryptoEvents = async () => {
  const [cryptoEvents, positions, orders] = await Promise.all([getAllCryptoEvents(), getUserPositions(), getOpenOrders()]);
  const relevantMarkets: IMarketWithOrder[] = [];
  for (const event of cryptoEvents) {
    for (const market of event.markets) {
      if (market.closed) continue;
      const yesOutcomePrice = getOutcomePrice(market, MarketSide.Yes);
      const tokenId = JSON.parse(market.clobTokenIds as unknown as string)[0];
      if (market.volumeNum < MIN_VOLUME) continue;
      const isInPriceRange = yesOutcomePrice > MIN_PRICE && yesOutcomePrice < MAX_PRICE;
      if (!isInPriceRange) continue;
      const { shouldBuy, score, reasons } = await evaluateBuySignal(tokenId);
      if (!shouldBuy) continue;
      const { totalSize, existingOrderPrice } = getPositionAndOrderSize(market.conditionId, positions, orders);
      const maxSizeForMarket = Math.round(score / DIVISOR);
      const remainingPurchaseableShares = Math.round(maxSizeForMarket - totalSize);
      if (remainingPurchaseableShares <= 0) continue;
      relevantMarkets.push({
        ...market,
        size: remainingPurchaseableShares,
        existingOrderPrice,
      });
      logger.progress(`Buying ${remainingPurchaseableShares} shares of ${market.question} at ${yesOutcomePrice}`);
      logger.info(`Signal information:\nSCORE = ${score}\nREASONS \n=========================\n ${reasons.join('\n')}`);
    }
  }

  const ordersToPlace: OrderParams[] = relevantMarkets.map((market) => ({
    tokenId: JSON.parse(market.clobTokenIds as unknown as string)[0],
    price: market.existingOrderPrice || getOutcomePrice(market, MarketSide.Yes), // buy at exact price so we don't miss out on opportunities
    size: market.size,
    side: Side.BUY,
  }));

  await Promise.all(ordersToPlace.map((order) => createOrder(order)));
};
