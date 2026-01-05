import type { EventRangeArbitrageOpportunity, Market, PolymarketEvent } from '../../../common/types';
import { DEFAULT_MIN_ORDER_SIZE } from '../../../config';
import logger from '../../../utils/logger';
import { rangeArbitrage } from '../../../utils/math/range-arbitrage';
import { areBetsMutuallyExclusive } from '../../openai';
import { getEventsFromRest } from '../../polymarket/events';
import { executeArbitrageOrders } from '../order-execution';
import { calculateNormalizedShares, isObviousMutuallyExclusive, isObviouslyNonExhaustive } from './utils';
import { getTrades } from '../../polymarket/trade-history';
import { getOpenOrders } from '../../polymarket/orders';

/**
 * Checks a single event for range arbitrage opportunities
 */
const checkEventForRangeArbitrage = async (event: PolymarketEvent, availableCollateral: number): Promise<EventRangeArbitrageOpportunity | null> => {
  const activeMarkets = event.markets.filter((m) => !m.closed);
  if (!activeMarkets || activeMarkets.length < 2) return null;
  if (isObviouslyNonExhaustive(event.title, activeMarkets)) {
    return null;
  }

  const marketsForAnalysis: Market[] = activeMarkets
    .filter((m) => !m.closed)
    .map((m) => ({
      marketId: m.id,
      question: m.question,
      yesPrice: parseFloat(m.bestAsk || m.lastTradePrice) || 0.5,
      noPrice: 1 - (parseFloat(m.bestAsk || m.lastTradePrice) || 0.5),
      spread: m.spread,
    }));

  const totalYesProbability = marketsForAnalysis.reduce((sum, m) => sum + m.yesPrice, 0);
  const totalNoProbability = marketsForAnalysis.reduce((sum, m) => sum + (1 - m.yesPrice), 0);
  if (totalYesProbability < 0.1 || totalNoProbability < 0.1) return null;
  const orderMinSize = Math.max(...activeMarkets.map((m) => m.orderMinSize ?? DEFAULT_MIN_ORDER_SIZE));
  const yesNormalizedShares = calculateNormalizedShares(marketsForAnalysis, true, orderMinSize);
  const noNormalizedShares = calculateNormalizedShares(marketsForAnalysis, false, orderMinSize);
  const normalizedShares = Math.max(yesNormalizedShares, noNormalizedShares);
  const result = rangeArbitrage(marketsForAnalysis, 1);
  const hasArbitrage = result.arbitrageBundles.some((bundle) => bundle.isArbitrage);
  if (!hasArbitrage) return null;
  const betsDescription = '## Title - ' + event.title + '\n' + activeMarkets.map((m, i) => `${i + 1}. ${m.question}`).join('\n');
  const tags = event.tags?.map((t) => t.slug) || [];
  const isObviousExclusiveCase = isObviousMutuallyExclusive(event.title, activeMarkets, tags);
  const isMutuallyExclusive = isObviousExclusiveCase || (await areBetsMutuallyExclusive(betsDescription, event.id, availableCollateral));
  if (!isMutuallyExclusive) return null;
  return {
    eventId: event.id,
    eventSlug: event.slug,
    eventTitle: event.title,
    markets: activeMarkets.map((m) => ({
      marketId: m.id,
      question: m.question,
      yesPrice: parseFloat(m.bestAsk || m.lastTradePrice) || 0.5,
      noPrice: 1 - (parseFloat(m.bestAsk || m.lastTradePrice) || 0.5),
      spread: m.spread,
    })),
    result: {
      ...result,
      normalizedShares,
    },
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
      const existingMarketIds = new Set([...tradeMarketIds, ...openOrderMarketIds]);
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
            const hasTrade = event.markets.some((m) => existingMarketIds.has(m.conditionId));
            if (hasTrade) return null;
            return checkEventForRangeArbitrage(event, availableCollateral);
          }),
        );
        opportunities.push(...batchResults);
      }

      const sortedOpportunities = opportunities
        .filter((o) => !!o)
        .sort((a, b) => b?.result.arbitrageBundles[0]?.worstCaseProfit - a?.result.arbitrageBundles[0]?.worstCaseProfit);
      logger.progress(`Found ${sortedOpportunities.length} opportunities in this batch...`);
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
