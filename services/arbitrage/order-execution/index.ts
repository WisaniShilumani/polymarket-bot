import type { EventRangeArbitrageOpportunity, Market, MarketForOrder, PolymarketMarket } from '../../../common/types';
import { getAccountCollateralBalance } from '../../polymarket/account-balance';
import logger from '../../../utils/logger';
import { formatCurrency } from '../../../utils/accounting';
import { createArbitrageOrders } from '../../polymarket/orders';
import { getOrderBookDepth } from '../../polymarket/book-depth';
import { Side } from '@polymarket/clob-client';
import { rangeArbitrage, type RangeArbitrageResult } from '../../../utils/math/range-arbitrage';
import { differenceInDays } from 'date-fns';
import { validateOrder } from './validate';
import { getLikelyFillPrice } from '../../polymarket/order-book';

interface RecalculationResult {
  success: boolean;
  adjustedPrices?: number[];
  recalculatedResult?: RangeArbitrageResult;
  strategy?: 'YES' | 'NO';
}

/**
 * Recalculates arbitrage using actual fill prices from order book depth.
 * Returns adjusted prices if arbitrage is still profitable, null otherwise.
 */
const recalculateWithLikelyFillPrices = async (
  eventId: string,
  availableCollateral: number,
  orderCost: number,
  marketsForOrders: MarketForOrder[],
  activeMarkets: PolymarketMarket[],
  normalizedShares: number,
): Promise<RecalculationResult> => {
  const likelyYesFillPricesPromises = marketsForOrders.map(async (market) => {
    const fillPrice = await getLikelyFillPrice(market.yesTokenId, Side.BUY, normalizedShares);
    return fillPrice;
  });

  const likelyNoFillPricesPromises = marketsForOrders.map(async (market) => {
    const fillPrice = await getLikelyFillPrice(market.noTokenId, Side.BUY, normalizedShares);
    return fillPrice;
  });

  const likelyYesFillPrices = await Promise.all(likelyYesFillPricesPromises);
  const likelyNoFillPrices = await Promise.all(likelyNoFillPricesPromises);
  const allHavePrices = likelyYesFillPrices.every((price) => price > 0);
  const allHaveNoPrices = likelyNoFillPrices.every((price) => price > 0);
  if (!allHavePrices || !allHaveNoPrices) {
    return { success: false };
  }

  const marketsWithAdjustedPrices: Market[] = activeMarkets.map((m, index) => {
    const yesPrice = likelyYesFillPrices[index] || 0;
    const noPrice = likelyNoFillPrices[index] || 0;
    return {
      marketId: m.id,
      question: m.question,
      yesPrice,
      noPrice,
      spread: m.spread,
    };
  });

  const recalculatedResult = rangeArbitrage(marketsWithAdjustedPrices, 1);
  const yesBundle = recalculatedResult.arbitrageBundles[0];
  const noBundle = recalculatedResult.arbitrageBundles[1];
  const useYesStrategy = yesBundle && (!noBundle || yesBundle.worstCaseProfit >= (noBundle?.worstCaseProfit ?? 0));
  const recalculatedBundle = useYesStrategy ? recalculatedResult.arbitrageBundles[0] : recalculatedResult.arbitrageBundles[1];
  if (!recalculatedBundle || !recalculatedBundle.isArbitrage) {
    return { success: false };
  }

  if (!validateOrder(recalculatedBundle, availableCollateral, orderCost, marketsForOrders, activeMarkets, eventId)) return { success: false };
  return {
    success: true,
    adjustedPrices: useYesStrategy ? likelyYesFillPrices : likelyNoFillPrices,
    recalculatedResult,
    strategy: useYesStrategy ? 'YES' : 'NO',
  };
};

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
  const collateralBalance = await getAccountCollateralBalance();
  const availableCollateral = collateralBalance - totalOpenOrderValue;
  const { eventData, result } = opportunity;
  const activeMarkets = eventData.markets.filter((m) => !m.closed);
  const yesBundle = result.arbitrageBundles[0];
  const noBundle = result.arbitrageBundles[1];
  const useYesStrategy = yesBundle && (!noBundle || yesBundle.worstCaseProfit >= (noBundle?.worstCaseProfit ?? 0));
  const selectedBundle = useYesStrategy ? yesBundle : noBundle;
  let strategy: 'YES' | 'NO' = useYesStrategy ? 'YES' : 'NO';
  const tokenIndex = useYesStrategy ? 0 : 1;
  const orderCost = activeMarkets.reduce(
    (aggr, item) => aggr + (useYesStrategy ? parseFloat(item.lastTradePrice) : 1 - parseFloat(item.lastTradePrice)) * result.normalizedShares,
    0,
  );

  const marketsWithTokens = activeMarkets.filter((m) => m.clobTokenIds && m.clobTokenIds.length > tokenIndex && m.clobTokenIds[tokenIndex]);
  const marketsForOrders: MarketForOrder[] = marketsWithTokens.map((m) => ({
    yesTokenId: JSON.parse(m.clobTokenIds as unknown as string)[0] as string,
    noTokenId: JSON.parse(m.clobTokenIds as unknown as string)[1] as string,
    question: m.question,
    price: useYesStrategy ? parseFloat(m.lastTradePrice) || 0.5 : 1 - (parseFloat(m.lastTradePrice) || 0.5),
  }));

  if (!validateOrder(selectedBundle, availableCollateral, orderCost, marketsForOrders, activeMarkets, opportunity.eventId)) return defaultResult;
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
  let resultantOpportunity = opportunity;
  const canFillAll = depthResults.every((r) => r.depthCheck.canFill);
  if (!canFillAll) {
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
    logger.money(`\n💰 Executing ${strategy} arbitrage on event: ${opportunity.eventTitle} for ${formatCurrency(orderCost)}`);
  }

  const orderResults = await createArbitrageOrders({
    eventId: opportunity.eventId,
    markets: marketsForOrders,
    side: strategy,
    sharesPerMarket: result.normalizedShares,
  });

  const ordersPlaced = orderResults.every((result) => result.success);
  return { ordersPlaced, opportunity: resultantOpportunity };
};
