import { Side, type OpenOrder } from '@polymarket/clob-client';
import type { UserPosition } from '../../../../common/types';
import { getEvent } from '../../../polymarket/events';
import { cancelOrder, getOpenOrders } from '../../../polymarket/orders';
import { getUserPositions } from '../../../polymarket/positions';
import { differenceInMinutes } from 'date-fns';
import { getOutcomePrice } from '../../../../utils/prices';
import { MarketSide } from '../../../../common/enums';
import { getMarketByAssetId } from '../../../polymarket/markets';

export const cancelCryptoStaleOrders = async (marketSide: MarketSide = MarketSide.Yes) => {
  const [positions, orders] = await Promise.all([getUserPositions(), getOpenOrders()]);
  const unmatchedOrders = orders.filter((order) => !positions.some((position) => position.asset === order.asset_id));
  const positionsByEventIdMap: Record<string, UserPosition[]> = {};
  positions.forEach((position) => {
    positionsByEventIdMap[position.eventId] = [...(positionsByEventIdMap[position.eventId] || []), position];
  });
  const allEventIds = [...new Set(positions.map((position) => position.eventId))];
  const events = await Promise.all(allEventIds.map((eventId) => getEvent(eventId)));

  for (const order of unmatchedOrders) {
    if (order.side !== Side.BUY) continue;
    const market = await getMarketByAssetId(order.market);
    const event = events.find((event) => event.markets.some((market) => market.conditionId === order.market));
    const isCryptoEvent = market.tags?.includes('Crypto');
    if (!isCryptoEvent) continue;
    const positions = event ? positionsByEventIdMap[event.id] : [];
    const existingMarketPositions = positions?.filter((p) => p.conditionId === order.market); // TODO - should we check on condition id instead?
    if (existingMarketPositions?.length) continue;
    const minutesSinceCreation = Math.abs(differenceInMinutes(new Date(), new Date(order.created_at * 1000)));
    const priceDifference = getOutcomePrice(market, marketSide) - Number(order.price);
    if (minutesSinceCreation > 5 || priceDifference >= 0.03) {
      await cancelOrder(order.id);
      console.log(`Cancelled BUY crypto order ${market.question} at $${order.price} @ ${Number(order.original_size) - Number(order.size_matched)} shares`);
    }
    continue;
  }

  const buyOrdersByMarketId = orders
    .filter((o) => o.side === Side.BUY)
    .reduce((acc, order) => {
      acc[order.market] = [...(acc[order.market] || []), order];
      return acc;
    }, {} as Record<string, OpenOrder[]>);

  for (const marketId in buyOrdersByMarketId) {
    const orders = buyOrdersByMarketId[marketId] || [];
    const buyOrders = orders.filter((o) => o.side === Side.BUY);
    if (buyOrders.length <= 2) continue;
    const otherOrders = buyOrders.slice(2);
    if (otherOrders.length > 0) {
      await Promise.all(otherOrders.map((o) => cancelOrder(o.id)));
      console.log(`Cancelled ${otherOrders.length} BUY crypto orders for market ${marketId}`);
    }
  }
};
