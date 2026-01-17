import { cancelOrder, createOrder, getOpenOrders } from '../../../polymarket/orders';
import type { UserPosition } from '../../../../common/types';
import { getUserPositions } from '../../../polymarket/positions';
import logger from '../../../../utils/logger';
import { Side } from '@polymarket/clob-client';
import { getEvent } from '../../../polymarket/events';
import { getOutcomePrice } from '../../../../utils/prices';
import { MarketSide } from '../../../../common/enums';

const STOP_LOSS_THRESHOLD = 0.08; // Exit if price drops 15 cents below avgPrice

export const stopLossSeller = async (marketSide: MarketSide = MarketSide.Yes) => {
  const [positions, orders] = await Promise.all([getUserPositions(), getOpenOrders()]);
  const positionsByEventIdMap = new Map<string, UserPosition[]>();
  positions.forEach((position) => {
    positionsByEventIdMap.set(position.eventId, [...(positionsByEventIdMap.get(position.eventId) || []), position]);
  });

  const eventIds = Array.from(positionsByEventIdMap.keys());
  const eventsPositionsToCheck = eventIds.map((eventId) => {
    const positions = positionsByEventIdMap.get(eventId);
    if (!positions) return null;
    return { eventId, positions };
  });

  for (const event of eventsPositionsToCheck) {
    if (!event?.positions) continue;
    const eventData = await getEvent(event.eventId);
    const isCryptoEvent = eventData.tags?.some((t) => t.slug === 'crypto-prices');
    if (!isCryptoEvent) continue;
    for (const position of event.positions) {
      if (position.outcome !== marketSide) continue;
      const currentOrder = orders.find((o) => o.market === position.conditionId && o.side === Side.SELL);
      const market = eventData.markets.find((m) => m.conditionId === position.conditionId);
      if (!market) continue;
      const currentPrice = getOutcomePrice(market, marketSide);
      if (currentOrder && Number(currentOrder?.price || 0) <= currentPrice) {
        console.log(`Current order price is less than current price, skipping`);
        continue;
      }
      const unrealizedLoss = position.avgPrice - currentPrice;
      // const minutesSinceCreation = Math.abs(differenceInMinutes(new Date(), new Date(position. * 1000)));
      if (unrealizedLoss < STOP_LOSS_THRESHOLD) continue;
      logger.info(
        `🛑 STOP LOSS: Selling ${position.size} shares of ${market.question} at $${currentPrice.toFixed(2)} (avg: $${position.avgPrice.toFixed(
          2,
        )}, loss: $${unrealizedLoss.toFixed(2)})`,
      );

      if (currentOrder) {
        await cancelOrder(currentOrder.id);
        console.log(`Cancelled current order ${currentOrder.id} for ${eventData.title}`);
      }

      await createOrder({
        tokenId: position.asset,
        price: currentPrice,
        size: position.size,
        side: Side.SELL,
        useMarketOrder: market.spread <= 0.01,
      });
    }
  }
};
