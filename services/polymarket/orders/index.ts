import { Side, type OpenOrder } from '@polymarket/clob-client';
import { getClobClient } from '..';
import logger from '../../../utils/logger';
import type { OrderParams, OrderResult, ArbitrageOrderParams } from './types';
import { ORDERS_ENABLED } from '../../../config';

/**
 * Creates and posts a single order to Polymarket
 */
export const createOrder = async (params: OrderParams): Promise<OrderResult> => {
  try {
    if (!ORDERS_ENABLED) return { success: false, error: 'ORDERS_ENABLED is disabled' };
    const clobClient = await getClobClient();
    const side = params.side === 'BUY' ? Side.BUY : Side.SELL;
    const response = await clobClient.createAndPostOrder({
      tokenID: params.tokenId,
      price: params.price,
      size: params.size,
      side,
    });

    logger.success(`  📝 Order placed: ${params.side} ${params.size} shares @ $${params.price} - Order ID: ${response.orderID}`);
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

/**
 * Creates orders for an arbitrage opportunity (buying YES or NO on all markets)
 */
export const createArbitrageOrders = async (params: ArbitrageOrderParams): Promise<OrderResult[]> => {
  const results: OrderResult[] = [];
  logger.info(`\n🚀 Placing ${params.side} orders on ${params.markets.length} markets (${params.sharesPerMarket} shares each)...`);
  for (const market of params.markets) {
    const result = await createOrder({
      tokenId: market.tokenId,
      price: market.price,
      size: params.sharesPerMarket,
      side: Side.BUY,
    });

    results.push(result);
    if (!result.success) {
      logger.warn(`  ⚠️ Failed to place order for: ${market.question}`);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(`\n📊 Orders completed: ${successCount}/${params.markets.length} successful`);
  return results;
};

export const getOpenOrders = async (): Promise<OpenOrder[]> => {
  const clobClient = await getClobClient();
  const orders = await clobClient.getOpenOrders();
  return orders;
};
