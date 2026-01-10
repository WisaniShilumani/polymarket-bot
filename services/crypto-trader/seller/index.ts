import { createOrder } from '../../polymarket/orders';
import type { UserPosition } from '../../../common/types';
import { getUserPositions } from '../../polymarket/positions';
import logger from '../../../utils/logger';
import { Side } from '@polymarket/clob-client';
import { getEvent } from '../../polymarket/events';

export const sellCryptoPositions = async () => {
  const positions = await getUserPositions();
  logger.log(`Found ${positions.length} positions`);
  const positionsByEventIdMap = new Map<string, UserPosition[]>();
  positions.forEach((position) => {
    positionsByEventIdMap.set(position.eventId, [...(positionsByEventIdMap.get(position.eventId) || []), position]);
  });

  const eventIds = Array.from(positionsByEventIdMap.keys());
  const eventsPositionsToSell = eventIds.map((eventId) => {
    const positions = positionsByEventIdMap.get(eventId);
    if (!positions) return null;
    return { eventId, positions };
  });

  for (const event of eventsPositionsToSell) {
    if (!event?.positions) return;
    const marketOrders = event.positions.map((position) => ({
      tokenId: position.asset,
      price: position.curPrice + 0.02,
      size: position.size,
      side: 1,
    }));

    const eventData = await getEvent(event.eventId);
    const isCryptoEvent = eventData.tags?.some((t) => t.slug === 'crypto-prices');
    if (!isCryptoEvent) continue;
    for (const order of marketOrders) {
      console.log(`Selling ${order.size} shares for ${eventData.title} at ${order.price}`);
      await createOrder({
        tokenId: order.tokenId,
        price: order.price,
        size: order.size,
        side: Side.SELL,
      });
    }
  }
};
