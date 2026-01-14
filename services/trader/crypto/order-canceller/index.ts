import { Side } from '@polymarket/clob-client';
import type { PolymarketMarket, UserPosition } from '../../../../common/types';
import { getEvent } from '../../../polymarket/events';
import { cancelOrder, getOpenOrders } from '../../../polymarket/orders';
import { getUserPositions } from '../../../polymarket/positions';
import { differenceInHours } from 'date-fns';
import { getOutcomePrice } from '../../../../utils/prices';
import { MarketSide } from '../../../../common/enums';

export const cancelCryptoStaleOrders = async () => {
  const [positions, orders] = await Promise.all([getUserPositions(), getOpenOrders()]);
  const unmatchedOrders = orders.filter((order) => !positions.some((position) => position.asset === order.asset_id));
  const staleOrders = unmatchedOrders.filter((order) => Math.abs(differenceInHours(new Date(), new Date(order.created_at * 1000))));
  const positionsByEventIdMap: Record<string, UserPosition[]> = {};
  positions.forEach((position) => {
    positionsByEventIdMap[position.eventId] = [...(positionsByEventIdMap[position.eventId] || []), position];
  });
  const allEventIds = [...new Set(positions.map((position) => position.eventId))];
  const events = await Promise.all(allEventIds.map((eventId) => getEvent(eventId)));
  for (const order of staleOrders) {
    if (order.side !== Side.BUY) continue;
    const event = events.find((event) => event.markets.some((market) => market.conditionId === order.market));
    const isCryptoEvent = event?.tags?.some((t) => t.slug === 'crypto');
    if (!isCryptoEvent) continue;
    if (!event) continue;
    const positions = positionsByEventIdMap[event.id];
    const existingMarketPositions = positions?.filter((p) => p.conditionId === order.market); // TODO - should we check on condition id instead?
    if (existingMarketPositions?.length) continue;
    const hoursSinceCreation = Math.abs(differenceInHours(new Date(), new Date(order.created_at * 1000)));
    const market = event.markets.find((m) => m.conditionId === order.market) as PolymarketMarket;
    const priceDifference = getOutcomePrice(market, MarketSide.Yes) - Number(order.price);
    if (hoursSinceCreation > 4 || priceDifference >= 0.02) {
      await cancelOrder(order.id);
      console.log(`Cancelled BUY crypto order ${market.question} at $${order.price} @ ${Number(order.original_size) - Number(order.size_matched)} shares`);
    }
    continue;
  }
};
