import type { ArbitrageResult, EventRangeArbitrageOpportunity, MarketForOrder } from '../../../common/types';
import { getAccountCollateralBalance } from '../../polymarket/account-balance';
import logger from '../../../utils/logger';
import { formatCurrency } from '../../../utils/accounting';
import { createArbitrageOrders } from '../../polymarket/orders';
import { getOrderBookDepth } from '../../polymarket/book-depth';
import { Side } from '@polymarket/clob-client';
import { differenceInDays } from 'date-fns';
import { validateCollateral, validateOrder } from './validate';
import { MarketSide } from '../../../common/enums';
import { getNoPrice, getYesPrice } from '../../../utils/prices';
import { DEMO_MODE } from '../../../config';

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
  const noBundle = result.arbitrageBundles.find((a) => a.side === MarketSide.No);
  const useYesStrategy = yesBundle?.isArbitrage; // && (!noBundle || yesBundle.worstCaseProfit >= (noBundle?.worstCaseProfit ?? 0)); - in future try both
  const selectedBundle = useYesStrategy ? (yesBundle as ArbitrageResult) : (noBundle as ArbitrageResult);
  let strategy: 'YES' | 'NO' = useYesStrategy ? 'YES' : 'NO';

  const tokenIndex = useYesStrategy ? 0 : 1;
  const orderCost = activeMarkets.reduce((aggr, item) => aggr + (useYesStrategy ? getYesPrice(item) : getNoPrice(item)) * result.normalizedShares, 0);

  const marketsWithTokens = activeMarkets.filter((m) => m.clobTokenIds && m.clobTokenIds.length > tokenIndex && m.clobTokenIds[tokenIndex]);
  const marketsForOrders: MarketForOrder[] = marketsWithTokens.map((m) => ({
    yesTokenId: JSON.parse(m.clobTokenIds as unknown as string)[0] as string,
    noTokenId: JSON.parse(m.clobTokenIds as unknown as string)[1] as string,
    question: m.question,
    price: useYesStrategy ? getYesPrice(m) : getNoPrice(m),
  }));
  // logger.info(
  //   `\n💰 Attempting ${strategy} arbitrage on event: [${opportunity.eventId}] ${opportunity.eventTitle} ${JSON.stringify({
  //     selectedBundle,
  //     marketsForOrders: marketsForOrders.map((p) => `${p.question} - ${p.price}`),
  //   })}`,
  // );
  if (!validateOrder(selectedBundle, marketsForOrders, activeMarkets, opportunity.eventId)) return defaultResult;
  const collateralBalance = await getAccountCollateralBalance();
  const availableCollateral = collateralBalance - totalOpenOrderValue;
  if (!DEMO_MODE && !validateCollateral(availableCollateral, orderCost, opportunity.eventId)) return defaultResult;
  const daysToExpiry = activeMarkets[0]?.endDate ? Math.abs(differenceInDays(new Date(activeMarkets[0].endDate), new Date())) : 7;
  const depthCheckPromises = marketsForOrders.map(async (market) => {
    const depthCheck = await getOrderBookDepth(
      useYesStrategy ? market.yesTokenId : market.noTokenId,
      Side.BUY,
      result.normalizedShares,
      market.price,
      daysToExpiry,
    );
    return { market, depthCheck };
  });

  const depthResults = await Promise.all(depthCheckPromises);
  // console.log(JSON.stringify(depthResults, null, 2));
  // order markets with highest spread first
  const sortedMarketOrders = depthResults
    .sort((a, b) => b.depthCheck.spread - a.depthCheck.spread)
    .map((r) => ({
      ...r.market,
      price: Math.min(r.market.price, r.depthCheck.avgFillPrice),
    }));
  let resultantOpportunity = opportunity;
  const canFillAll = depthResults.every((r) => r.depthCheck.canFill);
  if (!canFillAll) {
    logger.warn(`\n💰 Not all ${useYesStrategy ? 'YES' : 'NO'} markets can be filled, skipping order execution`);
    return defaultResult;
    // TEMP disabled, creating too many requests
    // const hasLiquidity = depthResults.every((r) => r.depthCheck.totalAvailable >= result.normalizedShares);
    // if (!hasLiquidity) return defaultResult;
    // const recalculation = await recalculateWithLikelyFillPrices(
    //   opportunity.eventId,
    //   availableCollateral,
    //   orderCost,
    //   marketsForOrders,
    //   activeMarkets,
    //   result.normalizedShares,
    // );
    // if (!recalculation.success || !recalculation.adjustedPrices) return defaultResult;
    // strategy = recalculation.strategy || strategy;
    // marketsForOrders.forEach((market, index) => {
    //   market.price = recalculation.adjustedPrices?.[index] || market.price;
    // });

    // const adjustedOrderCost = marketsForOrders.reduce((sum, m) => sum + m.price * result.normalizedShares, 0);
    // logger.money(`\n💰 Executing ${strategy} arbitrage (adjusted prices) on event: ${opportunity.eventTitle} for ${formatCurrency(adjustedOrderCost)}`);

    // resultantOpportunity = {
    //   ...opportunity,
    //   result: {
    //     ...result,
    //     arbitrageBundles: [recalculation.recalculatedResult?.arbitrageBundles[0] || result.arbitrageBundles[0]],
    //   },
    //   markets: opportunity.markets.map((market, index) => ({
    //     ...market,
    //     yesPrice: recalculation.adjustedPrices?.[index] || market.yesPrice,
    //   })),
    // };
  } else {
    logger.money(
      `\n💰 Executing ${strategy} arbitrage on event: ${opportunity.eventTitle} for ${formatCurrency(orderCost)} with volume ${formatCurrency(
        opportunity.volume,
      )}`,
    );
  }

  const orderResults = await createArbitrageOrders({
    eventId: opportunity.eventId,
    markets: sortedMarketOrders,
    side: strategy,
    sharesPerMarket: result.normalizedShares,
  });

  const ordersPlaced = orderResults.every((result) => result.success);
  return { ordersPlaced, opportunity: resultantOpportunity };
};
