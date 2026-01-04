import type { Side } from '@polymarket/clob-client';
import { getClobClient } from '..';
import { MAX_SPREAD } from '../../../config';
import logger from '../../../utils/logger';
import { formatCurrency } from '../../../utils/accounting';

export interface OrderBookDepth {
  canFill: boolean;
  avgFillPrice: number;
  worstFillPrice: number;
  slippagePct: number;
  totalAvailable: number;
}

/**
 * Analyzes order book to predict actual fill price
 */
export const getOrderBookDepth = async (
  tokenId: string,
  side: Side,
  desiredSize: number,
  desiredPrice: number,
  daysToExpiry: number,
): Promise<OrderBookDepth> => {
  const client = await getClobClient();
  const orderBook = await client.getOrderBook(tokenId);

  // For BUY orders, we take from ASKs (sellers)
  // For SELL orders, we take from BIDs (buyers)
  const orders =
    side === 'BUY'
      ? orderBook.asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      : orderBook.bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

  let remainingSize = desiredSize;
  let totalCost = 0;
  let totalFilled = 0;
  let worstPrice = 0;

  for (const order of orders) {
    const price = parseFloat(order.price);
    const size = parseFloat(order.size);

    const fillSize = Math.min(remainingSize, size);

    totalCost += fillSize * price;
    totalFilled += fillSize;
    worstPrice = price;
    remainingSize -= fillSize;

    if (remainingSize <= 0) break;
  }

  if (remainingSize > 0) {
    // logger.info(`❌ Not enough order book depth to fill the order`);
    return {
      canFill: false,
      avgFillPrice: 0,
      worstFillPrice: 0,
      slippagePct: Infinity,
      totalAvailable: totalFilled,
    };
  }

  const avgFillPrice = totalCost / desiredSize;
  const midPrice = (parseFloat(orderBook.asks[0]?.price || '0') + parseFloat(orderBook.bids[0]?.price || '0')) / 2;
  const slippagePct = midPrice !== 0 ? Math.abs(avgFillPrice - midPrice) / midPrice : 0;
  const maxAcceptableSpread = MAX_SPREAD + Math.min(daysToExpiry, 4) * 0.01; // not an exact science, but the more days we have, the more spread we can tolerate
  const canFillWithAcceptablePrice = avgFillPrice <= desiredPrice + maxAcceptableSpread;
  // logger.info(
  //   `${canFillWithAcceptablePrice ? '✅' : '❌'} Price difference: ${formatCurrency(avgFillPrice - desiredPrice)} [${formatCurrency(
  //     avgFillPrice,
  //   )}/${formatCurrency(desiredPrice)}](spread: ${formatCurrency(maxAcceptableSpread)})`,
  // );
  return {
    canFill: canFillWithAcceptablePrice,
    avgFillPrice,
    worstFillPrice: worstPrice,
    slippagePct,
    totalAvailable: totalFilled,
  };
};
