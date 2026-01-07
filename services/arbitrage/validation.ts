import { differenceInDays } from 'date-fns';
import type { ArbitrageResult, MarketForOrder, PolymarketMarket } from '../../common/types';
import { DEMO_MODE, MAX_ORDER_COST, MIN_PROFIT_THRESHOLD, MIN_ROI_THRESHOLD } from '../../config';
import { logger } from '../../utils/logger';
import { formatCurrency } from '../../utils/accounting';

const D = 10; // Days to expiry divisor
export const validateOrder = (selectedBundle: ArbitrageResult, marketsWithTokens: MarketForOrder[], activeMarkets: PolymarketMarket[], eventId: string) => {
  const daysToExpiry = activeMarkets[0]?.endDate ? Math.abs(differenceInDays(new Date(activeMarkets[0].endDate), new Date())) : 7;
  const minimumProfitNum = MIN_PROFIT_THRESHOLD + Number((MIN_PROFIT_THRESHOLD / D) * (daysToExpiry + 1));
  const minimumProfit = parseFloat(minimumProfitNum.toFixed(4));

  if (!selectedBundle || selectedBundle.worstCaseProfit < minimumProfit) {
    if (DEMO_MODE)
      logger.warn(
        `  ⚠️ [${eventId}] Profit ${formatCurrency(selectedBundle?.worstCaseProfit ?? 0)} is below minimum threshold of ${formatCurrency(
          minimumProfit,
        )}, skipping order creation (Best case profit: ${formatCurrency(selectedBundle?.bestCaseProfit ?? 0)})`,
      );
    return false;
  }

  const roi = (selectedBundle.worstCaseProfit / selectedBundle.cost) * 100;
  if (roi < MIN_ROI_THRESHOLD) {
    logger.warn(`  ⚠️ [${eventId}] ROI ${roi.toFixed(2)}% is below minimum threshold of ${MIN_ROI_THRESHOLD}%, skipping order creation`);
    return false;
  }

  if (marketsWithTokens.length === 0) {
    logger.warn(`  ⚠️ No valid token IDs found for event ${eventId}, skipping order creation`);
    return false;
  }

  if (marketsWithTokens.length !== activeMarkets.length) {
    logger.warn(`  ⚠️ Only ${marketsWithTokens.length}/${activeMarkets.length} markets have valid token IDs, skipping order creation`);
    return false;
  }

  return true;
};

export const validateCollateral = (availableCollateral: number, orderCost: number, eventId: string) => {
  const maxOrderCost = Math.min(MAX_ORDER_COST, availableCollateral);
  if (orderCost > maxOrderCost) {
    logger.warn(`  ⚠️ [${eventId}] Total order cost ${formatCurrency(orderCost)} exceeds maximum of ${formatCurrency(maxOrderCost)}, skipping order creation`);
    return false;
  }

  return true;
};
