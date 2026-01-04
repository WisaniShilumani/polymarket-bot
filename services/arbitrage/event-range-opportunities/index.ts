import type { EventRangeArbitrageOpportunity, Market, PolymarketEvent } from '../../../common/types';
import { DEFAULT_MIN_ORDER_SIZE, MIN_LIQUIDITY } from '../../../config';
import logger from '../../../utils/logger';
import { rangeArbitrage } from '../../../utils/math/range-arbitrage';
import { areBetsMutuallyExclusive } from '../../openai';
import { getEventsFromRest } from '../../polymarket/events';
import { executeArbitrageOrders } from '../order-execution';
import { calculateNormalizedShares } from './utils';
import { getTrades } from '../../polymarket/trade-history';
import { getOpenOrders } from '../../polymarket/orders';

/**
 * Checks a single event for range arbitrage opportunities
 */
const checkEventForRangeArbitrage = async (event: PolymarketEvent): Promise<EventRangeArbitrageOpportunity | null> => {
  const activeMarkets = event.markets.filter((m) => !m.closed);
  if (!activeMarkets || activeMarkets.length < 2) return null;
  const hasLowLiquidityMarket = activeMarkets.some((m) => m.liquidityNum < MIN_LIQUIDITY);
  if (hasLowLiquidityMarket) return null;
  const marketsForAnalysis: Market[] = activeMarkets
    .filter((m) => !m.closed)
    .map((m) => ({
      marketId: m.id,
      question: m.question,
      yesPrice: parseFloat(m.lastTradePrice) || 0.5,
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
  const isMutuallyExclusive = await areBetsMutuallyExclusive(betsDescription, event.id);
  if (!isMutuallyExclusive) return null;
  return {
    eventId: event.id,
    eventSlug: event.slug,
    eventTitle: event.title,
    markets: activeMarkets.map((m) => ({
      marketId: m.id,
      slug: m.slug,
      question: m.question,
      yesPrice: parseFloat(m.lastTradePrice) || 0.5,
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
): Promise<{ opportunities: EventRangeArbitrageOpportunity[]; ordersPlaced: boolean }> => {
  const opportunities: EventRangeArbitrageOpportunity[] = [];
  let offset = 0;
  const limit = options.limit || 100;

  logger.header('\n╔════════════════════════════════════════════════════════════════╗');
  logger.header('║           SCANNING EVENTS FOR RANGE ARBITRAGE                  ║');
  logger.header('║        (Buying YES on all vs NO on all markets)                ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');

  let hasMoreEvents = true;
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
      for (const event of events) {
        const hasTrade = event.markets.some((m) => existingMarketIds.has(m.conditionId));
        if (hasTrade) {
          logger.warn(`Event ${event.id} has trade in market for ${event.title}, skipping...`);
          continue;
        }
        const opportunity = await checkEventForRangeArbitrage(event);
        if (opportunity) {
          opportunities.push(opportunity);
          foundInBatch++;
          logger.success(`  ✅ Found: [${opportunity.eventId}] ${opportunity.eventTitle} - ${opportunity.markets.length} markets`);
          const orderPlaced = await executeArbitrageOrders(opportunity, totalOpenOrderValue);
          if (orderPlaced) {
            logger.success(`\n✅ Orders placed successfully! Stopping scan.\n`);
            return { opportunities, ordersPlaced: true };
          }
        }
      }

      logger.info(`  Found ${foundInBatch} opportunities in this batch\n`);
      offset += limit;
    } catch (error) {
      logger.error('Error scanning events:', error);
      throw error;
    }
  }

  return { opportunities, ordersPlaced: false };
};
