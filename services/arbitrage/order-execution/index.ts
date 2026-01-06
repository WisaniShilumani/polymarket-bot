import type { EventRangeArbitrageOpportunity } from '../../../common/types';
import { getAccountCollateralBalance } from '../../polymarket/account-balance';
import logger from '../../../utils/logger';
import { formatCurrency } from '../../../utils/accounting';
import { createArbitrageOrders } from '../../polymarket/orders';
import { validateCollateral } from '../validation';
import { MarketSide } from '../../../common/enums';
import { getNoPrice, getYesPrice } from '../../../utils/prices';
import { DEMO_MODE } from '../../../config';
import { checkBooks } from '../check-books';
import { getMarketsForOrders } from '../utils';

/**
 * Executes arbitrage orders for a given opportunity
 * Determines whether to buy YES or NO on all markets based on which strategy is profitable
 * Returns true if orders were actually placed, false otherwise
 */
export const executeArbitrageOrders = async (
  opportunity: EventRangeArbitrageOpportunity,
  totalOpenOrderValue: number,
): Promise<{ ordersPlaced: boolean; opportunity: EventRangeArbitrageOpportunity }> => {
  const defaultResult = { ordersPlaced: false, opportunity: opportunity };
  const { eventData, result } = opportunity;
  const activeMarkets = eventData.markets.filter((m) => !m.closed);
  const yesBundle = result.arbitrageBundles.find((a) => a.side === MarketSide.Yes);
  const useYesStrategy = !!yesBundle?.isArbitrage; // && (!noBundle || yesBundle.worstCaseProfit >= (noBundle?.worstCaseProfit ?? 0)); - in future try both
  let strategy: 'YES' | 'NO' = useYesStrategy ? 'YES' : 'NO';
  const orderCost = activeMarkets.reduce((aggr, item) => aggr + (useYesStrategy ? getYesPrice(item) : getNoPrice(item)) * result.normalizedShares, 0);
  const marketsForOrders = getMarketsForOrders(activeMarkets, useYesStrategy);
  // logger.info(
  //   `\n💰 Attempting ${strategy} arbitrage on event: [${opportunity.eventId}] ${opportunity.eventTitle} ${JSON.stringify({
  //     selectedBundle,
  //     marketsForOrders: marketsForOrders.map((p) => `${p.question} - ${p.price}`),
  //   })}`,
  // );
  const collateralBalance = await getAccountCollateralBalance();
  const availableCollateral = collateralBalance - totalOpenOrderValue;
  if (!DEMO_MODE && !validateCollateral(availableCollateral, orderCost, opportunity.eventId)) return defaultResult;
  const { sortedMarketOrders, canFillAll } = await checkBooks(marketsForOrders, useYesStrategy, result.normalizedShares);
  if (!canFillAll) {
    logger.warn(`💰 Not all ${useYesStrategy ? 'YES' : 'NO'} markets can be filled, skipping order execution`);
    return defaultResult;
  }

  logger.money(
    `\n💰 Executing ${strategy} arbitrage on event: ${opportunity.eventTitle} for ${formatCurrency(orderCost)} with volume ${formatCurrency(
      opportunity.volume,
    )}`,
  );
  const orderResults = await createArbitrageOrders({
    eventId: opportunity.eventId,
    markets: sortedMarketOrders,
    side: strategy,
    sharesPerMarket: result.normalizedShares,
  });

  const ordersPlaced = orderResults.every((result) => result.success);
  return { ordersPlaced, opportunity };
};
