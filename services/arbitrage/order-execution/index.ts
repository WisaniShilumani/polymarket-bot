import type { EventRangeArbitrageOpportunity } from '../../../common/types';
import { getAccountCollateralBalance } from '../../polymarket/account-balance';
import logger from '../../../utils/logger';
import { MIN_PROFIT_THRESHOLD, MAX_ORDER_COST, MIN_ROI_THRESHOLD } from '../../../config';
import { formatCurrency } from '../../../utils/accounting';
import { createArbitrageOrders } from '../../polymarket/orders';
import { getOrderBookDepth } from '../../polymarket/book-depth';
import { Side } from '@polymarket/clob-client';

/**
 * Executes arbitrage orders for a given opportunity
 * Determines whether to buy YES or NO on all markets based on which strategy is profitable
 * Returns true if orders were actually placed, false otherwise
 */
export const executeArbitrageOrders = async (opportunity: EventRangeArbitrageOpportunity, totalOpenOrderValue: number): Promise<boolean> => {
  const collateralBalance = await getAccountCollateralBalance();
  const availableCollateral = collateralBalance - totalOpenOrderValue;
  const { eventData, result } = opportunity;
  const activeMarkets = eventData.markets.filter((m) => !m.closed);

  // Find the profitable arbitrage bundle (YES strategy is index 0, NO strategy is index 1)
  const yesBundle = result.arbitrageBundles[0];
  const noBundle = result.arbitrageBundles[1];

  // Determine which strategy to use (prefer the one with higher profit)
  const useYesStrategy = yesBundle && (!noBundle || yesBundle.worstCaseProfit >= (noBundle?.worstCaseProfit ?? 0));
  const selectedBundle = useYesStrategy ? yesBundle : noBundle;
  const strategy = useYesStrategy ? 'YES' : 'NO';
  const tokenIndex = useYesStrategy ? 0 : 1; // 0 = YES token, 1 = NO token
  const orderCost = activeMarkets.reduce(
    (aggr, item) => aggr + (useYesStrategy ? parseFloat(item.lastTradePrice) : 1 - parseFloat(item.lastTradePrice)) * result.normalizedShares,
    0,
  );

  // Check minimum profit threshold of $0.01
  if (!selectedBundle || selectedBundle.worstCaseProfit < MIN_PROFIT_THRESHOLD) {
    logger.warn(
      `  ⚠️ Profit $${selectedBundle?.worstCaseProfit.toFixed(4) ?? '0'} is below minimum threshold of $${MIN_PROFIT_THRESHOLD}, skipping order creation`,
    );
    return false;
  }

  // Check maximum order cost
  const maxOrderCost = Math.min(MAX_ORDER_COST, availableCollateral);
  if (orderCost > maxOrderCost) {
    // logger.warn(`  ⚠️ Total order cost ${formatCurrency(orderCost)} exceeds maximum of ${formatCurrency(maxOrderCost)}, skipping order creation`);
    return false;
  }

  // Check minimum ROI threshold of 1.01%
  const roi = (selectedBundle.worstCaseProfit / selectedBundle.cost) * 100;
  if (roi < MIN_ROI_THRESHOLD) {
    logger.warn(`  ⚠️ ROI ${roi.toFixed(2)}% is below minimum threshold of ${MIN_ROI_THRESHOLD}%, skipping order creation`);
    return false;
  }

  // Build market params for order creation
  const marketsWithTokens = activeMarkets.filter((m) => m.clobTokenIds && m.clobTokenIds.length > tokenIndex && m.clobTokenIds[tokenIndex]);

  const marketsForOrders = marketsWithTokens.map((m) => ({
    tokenId: JSON.parse(m.clobTokenIds as unknown as string)[tokenIndex] as string,
    question: m.question,
    price: useYesStrategy ? parseFloat(m.lastTradePrice) || 0.5 : 1 - (parseFloat(m.lastTradePrice) || 0.5),
  }));

  if (marketsWithTokens.length === 0) {
    logger.warn(`  ⚠️ No valid token IDs found for event ${opportunity.eventId}, skipping order creation`);
    return false;
  }

  if (marketsWithTokens.length !== activeMarkets.length) {
    logger.warn(`  ⚠️ Only ${marketsWithTokens.length}/${activeMarkets.length} markets have valid token IDs, skipping order creation`);
    return false;
  }

  // Check if the order book depth is sufficient
  const canFillPromises = marketsForOrders.map(async (market) => {
    const depthCheck = await getOrderBookDepth(market.tokenId, Side.BUY, result.normalizedShares, market.price);
    return depthCheck.canFill;
  });

  const canFill = await Promise.all(canFillPromises);
  const canFillAll = canFill.every((c) => c);
  if (!canFillAll) {
    // logger.warn(`  ⚠️ Not enough order book depth to fill all orders, skipping order creation`);
    return false;
  }

  logger.money(`\n💰 Executing ${strategy} arbitrage on event: ${opportunity.eventTitle} for ${formatCurrency(orderCost)}`);
  const orderResults = await createArbitrageOrders({
    eventId: opportunity.eventId,
    markets: marketsForOrders,
    side: strategy,
    sharesPerMarket: result.normalizedShares,
  });

  const ordersPlaced = orderResults.every((result) => result.success);
  return ordersPlaced;
};
