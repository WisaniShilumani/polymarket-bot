import { Side, type OpenOrder } from '@polymarket/clob-client';
import { getClobClient } from '..';
import logger from '../../../utils/logger';
import type { OrderParams, OrderResult, ArbitrageOrderParams } from './types';
import { ORDERS_ENABLED } from '../../../config';
import { LRUCache } from 'lru-cache';
import { getLastPurchaseTime, setLastPurchaseTime } from '../../cache';

const failedOrderEventsCache = new LRUCache<string, boolean>({
  max: 1000,
});

/**
 * Creates and posts a single order to Polymarket
 */
export const createOrder = async (params: OrderParams): Promise<OrderResult> => {
  try {
    const lastPurchaseTime = getLastPurchaseTime(params.tokenId);
    if (lastPurchaseTime && Date.now() - lastPurchaseTime < 30_000) {
      logger.info(`Skipping purchase because last purchase was less than 30 seconds ago for token ${params.tokenId}`);
      return { success: true, orderId: 'LAST_PURCHASE_TIME_CACHE_HIT' };
    }

    if (!ORDERS_ENABLED) {
      setLastPurchaseTime(params.tokenId);
      return { success: true, orderId: 'ORDERS_ENABLED is disabled' };
    }
    const clobClient = await getClobClient();
    const side = params.side === 'BUY' ? Side.BUY : Side.SELL;
    const response = await clobClient.createAndPostOrder({
      tokenID: params.tokenId,
      price: params.price,
      size: params.size,
      side,
    });

    if (!response.orderID) throw new Error('No order ID returned');
    logger.success(`  📝 Order placed: ${params.side} ${params.size} shares @ $${params.price} - Order ID: ${response.orderID}`);
    setLastPurchaseTime(params.tokenId);
    return {
      success: true,
      orderId: response.orderID,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`  ❌ Order failed: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

export const cancelOrder = async (orderID?: string): Promise<void> => {
  if (!ORDERS_ENABLED) return;
  if (!orderID) return;
  const clobClient = await getClobClient();
  await clobClient.cancelOrder({ orderID });
  logger.success(`  📝 Order cancelled: ${orderID}`);
};

/**
 * Creates orders for an arbitrage opportunity (buying YES or NO on all markets)
 */
export const createArbitrageOrders = async (params: ArbitrageOrderParams): Promise<OrderResult[]> => {
  const didEventPreviouslyFail = failedOrderEventsCache.get(params.eventId);
  if (didEventPreviouslyFail) {
    logger.warn(`  ⚠️ Event ${params.eventId} previously failed. Skipping order creation`);
    return [];
  }
  const results: OrderResult[] = [];
  // Currently not guaranteed to fill all orders; we'll need to add a test first
  for (const market of params.markets) {
    const result = await createOrder({
      tokenId: params.side === 'YES' ? market.yesTokenId : market.noTokenId,
      price: market.price,
      size: params.sharesPerMarket,
      side: Side.BUY,
    });

    results.push(result);
    if (!result.success) {
      logger.warn(`  ⚠️ Failed to place order for: ${market.question}`);
    }
  }

  const failedOrders = results.filter((r) => !r.success);
  if (failedOrders.length > 0) {
    logger.warn(`  ⚠️ Failed to place ${failedOrders.length} orders. Cancelling all orders`);
    await Promise.all(results.map((order) => cancelOrder(order.orderId)));
    failedOrderEventsCache.set(params.eventId, true);
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(`📊 Orders completed: ${successCount}/${params.markets.length} successful`);
  return results;
};

export const getOpenOrders = async (): Promise<OpenOrder[]> => {
  const clobClient = await getClobClient();
  const orders = await clobClient.getOpenOrders();
  return orders;
};
