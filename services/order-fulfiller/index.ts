import { cancelOrder, createOrder, getOpenOrders } from '../polymarket/orders';
import type { UserPosition } from '../../common/types';
import { getUserPositions } from '../polymarket/positions';
import logger from '../../utils/logger';
import { Side, type OpenOrder } from '@polymarket/clob-client';
import { getEvent } from '../polymarket/events';
import { getOrderBookDepth } from '../polymarket/book-depth';
import type { OrderParams } from '../polymarket/orders/types';
import { differenceInHours } from 'date-fns';

// PURPOSE: To fulfill outstanding orders by creating new orders at price + 0.01
// =============================================================================
// Worst case - not all positions have matched their full size; and we order the full size of the outstanding order
// We'll allow this, since we would still be profitable

const MAX_HOURS_FOR_STALE_ORDER = 8;
export const fulfillOutstandingOrders = async () => {
  const [positions, orders] = await Promise.all([getUserPositions(), getOpenOrders()]);
  const positionsByEventIdMap: Record<string, UserPosition[]> = {};
  positions.forEach((position) => {
    positionsByEventIdMap[position.eventId] = [...(positionsByEventIdMap[position.eventId] || []), position];
  });

  const eventIds = Object.keys(positionsByEventIdMap);
  for (const eventId of eventIds) {
    const positions = positionsByEventIdMap[eventId];
    if (!positions) continue;
    if (positions.length !== 2) continue;
    const event = await getEvent(eventId);
    if (!event) continue;
    const relatedOrder = orders.find((o) => event.markets.some((m) => m.conditionId === o.market && o.side === Side.BUY)) as unknown as OpenOrder;
    if (relatedOrder) {
      const hoursSinceCreation = Math.abs(differenceInHours(new Date(), new Date(relatedOrder.created_at * 1000)));
      if (hoursSinceCreation < MAX_HOURS_FOR_STALE_ORDER) continue;
      if (!relatedOrder.price) console.log(JSON.stringify({ relatedOrder }, null, 2));
      const newOrder: OrderParams = {
        tokenId: relatedOrder.asset_id,
        price: +relatedOrder.price + 0.01,
        size: Number(relatedOrder.original_size) - Number(relatedOrder.size_matched),
        side: Side.BUY,
      };

      const { canFill } = await getOrderBookDepth(newOrder.tokenId, Side.SELL, newOrder.size, newOrder.price, 0, false);
      if (!canFill) {
        continue;
      }

      const result = await createOrder(newOrder);
      if (!result.success) {
        logger.warn(`❌ Failed to create order for ${event.title}`);
        continue;
      }

      logger.progress(`Created new order for ${event.title}`);
      await cancelOrder(relatedOrder.id);
      logger.progress(`Cancelled old order for ${event.title}`);
    }
  }
};
