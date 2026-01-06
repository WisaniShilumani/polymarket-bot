import type { ArbitrageResult, EventRangeArbitrageOpportunity, PolymarketEvent } from '../../../common/types';
import { DEFAULT_MIN_ORDER_SIZE } from '../../../config';
import logger from '../../../utils/logger';
import { rangeArbitrage } from '../../../utils/math/range-arbitrage';
import { areBetsMutuallyExclusive } from '../../openai';
import { getEventsFromRest } from '../../polymarket/events';
import { executeArbitrageOrders } from '../order-execution';
import { calculateNormalizedShares, isObviousMutuallyExclusive } from './utils';
import { getTrades } from '../../polymarket/trade-history';
import { getOpenOrders } from '../../polymarket/orders';
import { MarketSide } from '../../../common/enums';
import { getNoPrice, getYesPrice } from '../../../utils/prices';
import { getMarketsForAnalysis, getMarketsForOrders } from '../utils';
import { checkBooks } from '../check-books';
import { validateOrder } from '../validation';

/**
 * Checks a single event for range arbitrage opportunities
 */
const checkEventForRangeArbitrage = async (event: PolymarketEvent, availableCollateral: number): Promise<EventRangeArbitrageOpportunity | null> => {
  const activeMarkets = event.markets.filter((m) => !m.closed);
  if (!activeMarkets || activeMarkets.length < 2) return null;
  const marketsForAnalysis = getMarketsForAnalysis(activeMarkets);
  const totalYesProbability = marketsForAnalysis.reduce((sum, m) => sum + m.yesPrice, 0);
  const totalNoProbability = marketsForAnalysis.reduce((sum, m) => sum + (1 - m.yesPrice), 0);
  if (totalYesProbability < 0.1 || totalNoProbability < 0.1) return null;
  const orderMinSize = Math.max(...activeMarkets.map((m) => m.orderMinSize ?? DEFAULT_MIN_ORDER_SIZE));
  const yesNormalizedShares = calculateNormalizedShares(marketsForAnalysis, true, orderMinSize);
  const noNormalizedShares = calculateNormalizedShares(marketsForAnalysis, false, orderMinSize);
  const result = rangeArbitrage(marketsForAnalysis, 1);
  const hasArbitrage = result.arbitrageBundles.some((bundle) => bundle.isArbitrage);
  if (!hasArbitrage) return null;
  const yesBundle = result.arbitrageBundles.find((a) => a.side === MarketSide.Yes);
  const noBundle = result.arbitrageBundles.find((a) => a.side === MarketSide.No);
  const useYesStrategy = !!yesBundle?.isArbitrage;
  const selectedBundle = useYesStrategy ? (yesBundle as ArbitrageResult) : (noBundle as ArbitrageResult);
  const marketsForOrders = getMarketsForOrders(activeMarkets, useYesStrategy);
  const normalizedShares = useYesStrategy ? yesNormalizedShares : noNormalizedShares;
  const normalizedResult = rangeArbitrage(marketsForAnalysis, normalizedShares);
  if (!validateOrder(selectedBundle, marketsForOrders, activeMarkets, event.id)) return null;
  const tags = event.tags?.map((t) => t.slug) || [];
  const isObviousExclusiveCase = isObviousMutuallyExclusive(event.title, activeMarkets, tags);
  if (!isObviousExclusiveCase) {
    // check if the markets can be filled before making expensive AI call
    const { canFillAll } = await checkBooks(marketsForOrders, useYesStrategy, normalizedShares);
    if (!canFillAll) {
      logger.warn(`💰 Not all ${useYesStrategy ? 'YES' : 'NO'} markets can be filled, skipping AI check`);
      return null;
    }
  }

  const betsDescription = '## Title - ' + event.title + '\n' + activeMarkets.map((m, i) => `${i + 1}. ${m.question}`).join('\n');
  const isMutuallyExclusive = isObviousExclusiveCase || (await areBetsMutuallyExclusive(betsDescription, event.id, availableCollateral));
  if (!isMutuallyExclusive) return null;
  return {
    eventId: event.id,
    eventSlug: event.slug,
    eventTitle: event.title,
    volume: Number(event.volume || 0),
    markets: activeMarkets.map((m) => ({
      marketId: m.id,
      question: m.question,
      yesPrice: getYesPrice(m),
      noPrice: getNoPrice(m),
      spread: m.spread,
      volume: Number(m.volume || 0),
    })),
    result: {
      ...result,
      normalizedShares,
    },
    normalizedResult,
    hasArbitrage: true,
    eventData: event,
  };
};

/**
 * Scans events for range arbitrage opportunities
 * Returns both opportunities and whether orders were actually placed
 */
export const scanEventsForRangeArbitrage = async (
  options: { limit?: number } = {},
  availableCollateral: number,
): Promise<{ opportunities: EventRangeArbitrageOpportunity[]; ordersPlaced: boolean }> => {
  const allOpportunities: EventRangeArbitrageOpportunity[] = [];
  let offset = 0;
  const limit = options.limit || 100;

  logger.header('\n╔════════════════════════════════════════════════════════════════╗');
  logger.header('║           SCANNING EVENTS FOR RANGE ARBITRAGE                  ║');
  logger.header('║        (Buying YES on all vs NO on all markets)                ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');

  let hasMoreEvents = true;
  let ordersPlaced = false;
  while (hasMoreEvents) {
    try {
      logger.progress(`Scanning events ${offset} to ${offset + limit}...`);
      const [events, trades, openOrders] = await Promise.all([getEventsFromRest({ offset, limit, closed: false }), getTrades(), getOpenOrders()]);
      const tradeMarketIds = trades.map((t) => t.market);
      const openOrderMarketIds = openOrders.map((o) => o.market);
      const totalOpenOrderValue = openOrders.reduce((sum, o) => sum + parseFloat(o.price) * parseFloat(o.original_size), 0);
      const openOrderMarketIdsSet = new Set(openOrderMarketIds);
      const tradeMarketIdsSet = new Set(tradeMarketIds);
      if (events.length === 0) {
        logger.info('No more events to scan.');
        hasMoreEvents = false;
        break;
      }

      let foundInBatch = 0;
      const opportunities: (EventRangeArbitrageOpportunity | null)[] = [];
      const BATCH_SIZE = 5;
      const batches: PolymarketEvent[][] = [];
      for (let i = 0; i < events.length; i += BATCH_SIZE) {
        batches.push(events.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(async (event) => {
            const hasOpenOrder = event.markets.some((m) => openOrderMarketIdsSet.has(m.conditionId));
            if (hasOpenOrder) return null;
            if (tradeMarketIdsSet.has(event.id)) logger.warn('Checking existing trade...');
            // Might be dangerous but who cares
            // const hasTrade = event.markets.some((m) => existingMarketIds.has(m.conditionId));
            // if (hasTrade) {
            //   logger.warn(`\n💰 Event ${event.title} has trade, skipping`);
            //   return null;
            // }
            return checkEventForRangeArbitrage(event, availableCollateral);
          }),
        );
        opportunities.push(...batchResults);
      }

      // BUG: Despite finding a NO arbitrage, we use the opportunity to buy YES regardless.
      const sortedOpportunities = opportunities
        .filter((o) => !!o)
        .sort((a, b) => (b?.result.arbitrageBundles[0]?.worstCaseProfit ?? 0) - (a?.result.arbitrageBundles[0]?.worstCaseProfit ?? 0));

      for (const opportunity of sortedOpportunities) {
        if (!opportunity) continue;

        foundInBatch++;
        const { ordersPlaced: placed, opportunity: resultantOpportunity } = await executeArbitrageOrders(opportunity, totalOpenOrderValue);
        if (placed) {
          ordersPlaced = true;
          allOpportunities.push(resultantOpportunity);
        }
      }

      offset += limit;
    } catch (error) {
      logger.error('Error scanning events:', error);
      throw error;
    }
  }

  if (ordersPlaced) {
    logger.success(`\n✅ Orders placed successfully!`);
    return { opportunities: allOpportunities, ordersPlaced: true };
  }

  return { opportunities: allOpportunities, ordersPlaced: false };
};
