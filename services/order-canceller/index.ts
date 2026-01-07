import { DEMO_MODE } from '../../config';
import { getEvent } from '../polymarket/events';
import { getMarketByAssetId } from '../polymarket/markets';
import { cancelOrder, getOpenOrders } from '../polymarket/orders';
import { getUserPositions } from '../polymarket/positions';
import { differenceInHours } from 'date-fns';

// PURPOSE: To make space for new orders by cancelling stale orders
// ================================================================
// Worst case, this will cancel all outstanding orders for an event; we need to cater for events that end very soon (e.g. a soccer match ending in 30 mins)
// Currently we filter for stale orders, but we should filter for near-expiry orders as well
// To do this, we'll need to change the logic to scan all orders, get event expiry or market expiry (promise).
// If stale & not invested; or if near-expiry & not invested; then cancel the order
const MAX_HOURS_FOR_STALE_ORDER = 24;
const getMarketTitle = async (conditionId: string) => {
  const market = await getMarketByAssetId(conditionId);
  return market?.question;
};

export const cancelStaleIndividualOrders = async () => {
  const [positions, orders] = await Promise.all([getUserPositions(), getOpenOrders()]);
  const unmatchedOrders = orders.filter((order) => !positions.some((position) => position.asset === order.asset_id));
  const staleOrders = unmatchedOrders.filter((order) => Math.abs(differenceInHours(new Date(), new Date(order.created_at * 1000))) > MAX_HOURS_FOR_STALE_ORDER);
  const allEventIds = [...new Set(positions.map((position) => position.eventId))];
  const events = await Promise.all(allEventIds.map((eventId) => getEvent(eventId)));
  const allMarkets = events.flatMap((event) => event.markets);
  const allMarketConditionIds = allMarkets.map((market) => market.conditionId);
  for (const order of staleOrders) {
    const isInvestedInEvent = allMarketConditionIds.includes(order.market);
    const event = events.find((event) => event.markets.some((market) => market.conditionId === order.market));
    const hoursSinceCreation = Math.abs(differenceInHours(new Date(), new Date(order.created_at * 1000)));
    const sizeMatched = Number(order.size_matched);
    const title = event?.title || (await getMarketTitle(order.market));
    if (DEMO_MODE)
      console.log(
        `[${
          isInvestedInEvent ? '✅ INVESTED' : '❌ INVESTED'
        }] ${title} - Order has been opened for ${hoursSinceCreation} hours and has ${sizeMatched} shares matched`,
      );
    if (!isInvestedInEvent) {
      await cancelOrder(order.id);
      console.log(`Cancelled order ${order.id} for ${title}`);
    }
  }
};
