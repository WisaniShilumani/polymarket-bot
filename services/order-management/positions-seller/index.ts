import { cancelOrder, createOrder, getOpenOrders } from '../../polymarket/orders';
import type { UserPosition } from '../../../common/types';
import { getUserPositions } from '../../polymarket/positions';
import { formatCurrency } from '../../../utils/accounting';
import logger from '../../../utils/logger';
import { Side, type OpenOrder } from '@polymarket/clob-client';
import { getOrderBookDepth } from '../../polymarket/book-depth';
import { getEvent } from '../../polymarket/events';
import { DEMO_MODE } from '../../../config';

// PURPOSE: To sell positions that have a profit > minProfit
// =========================================================
// This will sell all positions with a profit > minProfit, and ALL the outstanding orders

const minProfit = 0.02;
const EXCLUSION_LIST = [114242]; // IRAN BET
const isMonitorMode = !!DEMO_MODE;
export const sellGoodEventPositions = async () => {
  const [positions, orders] = await Promise.all([getUserPositions(), getOpenOrders()]);
  logger.log(`Found ${positions.length} positions and ${orders.length} open orders`);
  const positionsByEventIdMap = new Map<string, UserPosition[]>();
  positions.forEach((position) => {
    positionsByEventIdMap.set(position.eventId, [...(positionsByEventIdMap.get(position.eventId) || []), position]);
  });

  const eventIds = Array.from(positionsByEventIdMap.keys()).filter((eventId) => !EXCLUSION_LIST.includes(Number(eventId)));
  const profitsPerEvent = eventIds.map((eventId) => {
    const positions = positionsByEventIdMap.get(eventId);
    if (!positions) return null;
    const profit = positions.reduce((acc, position) => acc + position.curPrice - position.avgPrice, 0);
    if (profit > minProfit) logger.log(`Event ${eventId} (${positions[0]?.title}) profit: ${formatCurrency(profit)}`);
    return { eventId, profit, positions };
  });

  const eventsToSell = profitsPerEvent.filter((p) => p && p.profit > minProfit);
  for (const event of eventsToSell) {
    if (!event?.positions) return;
    const marketOrders = event.positions.map((position) => ({
      tokenId: position.asset,
      price: position.curPrice,
      size: position.size,
      side: 1,
    }));

    const depthCheckPromises = marketOrders.map(async (order) => {
      const depthCheck = await getOrderBookDepth(order.tokenId, Side.SELL, order.size, order.price, 0, false);
      return { depthCheck, order };
    });

    const depthResults = await Promise.all(depthCheckPromises);
    const canFillAll = depthResults.every((r) => r.depthCheck.canFill);
    if (!canFillAll) {
      continue;
    }

    const eventData = await getEvent(event.eventId);
    const relatedOrders: OpenOrder[] = (orders.find((o) => eventData.markets.some((m) => m.conditionId === o.market)) as unknown as OpenOrder[]) || [];
    console.log(JSON.stringify({ relatedOrders }, null, 2));
    const results = [];
    for (const { order, depthCheck } of depthResults) {
      console.log(`Creating order for ${order.tokenId} at ${order.price} for ${order.size} shares`);
      if (!isMonitorMode) {
        const result = await createOrder({
          tokenId: order.tokenId,
          price: Math.max(order.price, depthCheck.avgFillPrice),
          size: order.size,
          side: Side.SELL,
        });
        results.push(result);
        if (!result.success) {
          logger.warn(`❌ Failed to place order for ${order.tokenId}`);
        }
      }
    }

    const failedOrders = results.filter((r) => !r.success);
    if (failedOrders.length > 0) {
      logger.warn(`  ⚠️ Failed to place ${failedOrders.length} orders. Cancelling all orders`);
      if (!isMonitorMode) await Promise.all(results.map((order) => cancelOrder(order.orderId)));
    } else {
      console.log(`Cancelling related orders for ${event.eventId}`);
      if (!isMonitorMode) await Promise.all(relatedOrders.map((o) => cancelOrder(o.id)));
    }
  }

  return profitsPerEvent;
};
