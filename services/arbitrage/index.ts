import { getMarketsFromRest, getEventsFromRest } from '../polymarket';
import { areBetsMutuallyExclusive } from '../openai';
import { rangeArbitrage } from '../../utils/math/range-arbitrage';
import type { EventRangeArbitrageOpportunity, Market, PolymarketEvent, PolymarketMarket } from '../../common/types';
import {
  displayEventRangeArbitrageResults,
  displayMarketSimpleArbitrageResults,
  displayTopOpportunities,
} from './utils';

const MAX_OPPORTUNITIES = 50;

// ============================================================================
// EVENT-BASED RANGE ARBITRAGE
// ============================================================================

/**
 * Calculates the minimum shares needed so each order meets the $1 minimum
 * For YES strategy: shares * yesPrice >= $1 for all markets
 * For NO strategy: shares * noPrice >= $1 for all markets
 */
const calculateNormalizedShares = (markets: Market[], forYesStrategy: boolean): number => {
  const prices = markets.map((m) => (forYesStrategy ? m.yesPrice : 1 - m.yesPrice));
  const minPrice = Math.min(...prices.filter((p) => p > 0));
  if (minPrice <= 0) return 1;
  const sharesNeeded = 1 / minPrice;
  return Math.ceil(sharesNeeded * 100) / 100;
};

/**
 * Checks a single event for range arbitrage opportunities
 */
const checkEventForRangeArbitrage = async (event: PolymarketEvent): Promise<EventRangeArbitrageOpportunity | null> => {
  const activeMarkets = event.markets.filter((m) => !m.closed);
  if (!activeMarkets || activeMarkets.length < 2) {
    return null;
  }

  const hasLowLiquidityMarket = activeMarkets.some((m) => m.liquidityNum < 10000);
  if (hasLowLiquidityMarket) {
    return null;
  }

  const marketsForAnalysis: Market[] = activeMarkets
    .filter((m) => !m.closed)
    .map((m) => ({
      marketId: m.id,
      question: m.question,
      yesPrice: parseFloat(m.lastTradePrice) || 0.5,
    }));

  const totalYesProbability = marketsForAnalysis.reduce((sum, m) => sum + m.yesPrice, 0);
  const totalNoProbability = marketsForAnalysis.reduce((sum, m) => sum + (1 - m.yesPrice), 0);

  if (totalYesProbability < 0.1 || totalNoProbability < 0.1) {
    return null;
  }

  const yesNormalizedShares = calculateNormalizedShares(marketsForAnalysis, true);
  const noNormalizedShares = calculateNormalizedShares(marketsForAnalysis, false);
  const normalizedShares = Math.max(yesNormalizedShares, noNormalizedShares);
  const result = rangeArbitrage(marketsForAnalysis, normalizedShares);
  const hasArbitrage = result.arbitrageBundles.some((bundle) => bundle.isArbitrage);
  if (!hasArbitrage) {
    return null;
  }

  // Check if the bets are mutually exclusive using OpenAI
  const betsDescription = activeMarkets.map((m, i) => `${i + 1}. ${m.question}`).join('\n');
  const isMutuallyExclusive = await areBetsMutuallyExclusive(betsDescription);

  if (!isMutuallyExclusive) {
    return null;
  }

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
 */
const scanEventsForRangeArbitrage = async (
  options: { limit?: number } = {},
): Promise<EventRangeArbitrageOpportunity[]> => {
  const opportunities: EventRangeArbitrageOpportunity[] = [];
  let offset = 0;
  const limit = options.limit || 100;

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           SCANNING EVENTS FOR RANGE ARBITRAGE                  ║');
  console.log('║        (Buying YES on all vs NO on all markets)                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  let hasMoreEvents = true;

  while (hasMoreEvents && opportunities.length < MAX_OPPORTUNITIES) {
    try {
      console.log(`Scanning events ${offset} to ${offset + limit}...`);

      const events = await getEventsFromRest({ offset, limit, closed: false });

      if (events.length === 0) {
        console.log('No more events to scan.');
        hasMoreEvents = false;
        break;
      }

      let foundInBatch = 0;
      for (const event of events) {
        const opportunity = await checkEventForRangeArbitrage(event);
        if (opportunity) {
          opportunities.push(opportunity);
          foundInBatch++;

          console.log(
            `  ✅ Found: [${opportunity.eventId}] ${opportunity.eventTitle} - ${opportunity.markets.length} markets`,
          );

          if (opportunities.length >= MAX_OPPORTUNITIES) {
            console.log(`\n⚠️  Reached ${MAX_OPPORTUNITIES} opportunities, stopping event scan...`);
            hasMoreEvents = false;
            break;
          }
        }
      }

      console.log(`  Found ${foundInBatch} opportunities in this batch\n`);
      offset += limit;
    } catch (error) {
      console.error('Error scanning events:', error);
      throw error;
    }
  }

  return opportunities;
};

// ============================================================================
// MARKET-BASED SIMPLE ARBITRAGE
// ============================================================================

interface MarketSimpleArbitrageOpportunity {
  marketId: string;
  slug: string;
  question: string;
  yesPrice: number; // Actual cost for YES order
  noPrice: number; // Actual cost for NO order
  totalCost: number;
  guaranteedProfit: number;
  roi: number;
  marketData: PolymarketMarket; // Full market JSON
}

/**
 * Checks if a market has a simple arbitrage opportunity (YES + NO < 1)
 */
const checkMarketForSimpleArbitrage = (market: PolymarketMarket): MarketSimpleArbitrageOpportunity | null => {
  // Filter out low volume markets (below $10,000)
  if (market.liquidityNum < 10000) {
    return null;
  }

  // Use bestAsk prices for buying (the price you pay)
  const yesPrice = parseFloat(market.bestAsk) || parseFloat(market.lastTradePrice) || 0;
  const noPrice = 1 - (parseFloat(market.bestBid) || parseFloat(market.lastTradePrice) || 0);

  const totalCostPerShare = yesPrice + noPrice;

  // Check if there's an arbitrage opportunity (price sum < 1)
  if (totalCostPerShare >= 1 || yesPrice === 0 || noPrice === 0) {
    return null;
  }

  // Calculate minimum shares needed to meet $1 minimum per order
  const minSharesForYes = 1 / yesPrice;
  const minSharesForNo = 1 / noPrice;
  const minShares = Math.max(minSharesForYes, minSharesForNo);
  const shares = Math.ceil(minShares * 100) / 100;

  // Calculate actual costs with minimum shares
  const yesCost = shares * yesPrice;
  const noCost = shares * noPrice;
  const totalCost = yesCost + noCost;

  // Calculate guaranteed payout and profit
  const guaranteedPayout = shares; // You get 1 share worth $1
  const guaranteedProfit = guaranteedPayout - totalCost;

  // Must have positive profit
  if (guaranteedProfit <= 0) {
    return null;
  }

  const roi = (guaranteedProfit / totalCost) * 100;

  return {
    marketId: market.id,
    slug: market.slug,
    question: market.question,
    yesPrice: yesCost, // Store actual cost, not price per share
    noPrice: noCost, // Store actual cost, not price per share
    totalCost,
    guaranteedProfit,
    roi,
    marketData: market, // Store full market JSON
  };
};

/**
 * Scans markets for simple arbitrage opportunities
 */
const scanMarketsForSimpleArbitrage = async (
  options: { limit?: number } = {},
): Promise<MarketSimpleArbitrageOpportunity[]> => {
  const opportunities: MarketSimpleArbitrageOpportunity[] = [];
  let offset = 0;
  const limit = options.limit || 100;

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          SCANNING MARKETS FOR SIMPLE ARBITRAGE                 ║');
  console.log('║                (Markets where YES + NO < 1)                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  let hasMoreMarkets = true;

  while (hasMoreMarkets && opportunities.length < MAX_OPPORTUNITIES) {
    try {
      console.log(`Scanning markets ${offset} to ${offset + limit}...`);

      const markets = await getMarketsFromRest({ offset, limit, closed: false });

      if (markets.length === 0) {
        console.log('No more markets to scan.');
        hasMoreMarkets = false;
        break;
      }

      let foundInBatch = 0;
      for (const market of markets) {
        const opportunity = checkMarketForSimpleArbitrage(market);
        if (opportunity) {
          opportunities.push(opportunity);
          foundInBatch++;

          console.log(
            `  ✅ Found: [${opportunity.marketId}] Profit: $${opportunity.guaranteedProfit.toFixed(
              4,
            )} (${opportunity.roi.toFixed(2)}% ROI)`,
          );

          if (opportunities.length >= MAX_OPPORTUNITIES) {
            console.log(`\n⚠️  Reached ${MAX_OPPORTUNITIES} opportunities, stopping market scan...`);
            hasMoreMarkets = false;
            break;
          }
        }
      }

      console.log(`  Found ${foundInBatch} opportunities in this batch\n`);
      offset += limit;
    } catch (error) {
      console.error('Error scanning markets:', error);
      throw error;
    }
  }

  return opportunities;
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export const findAndAnalyzeArbitrage = async (): Promise<void> => {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           POLYMARKET ARBITRAGE DETECTION BOT                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  const eventOpportunities = await scanEventsForRangeArbitrage({ limit: 1000 });
  const marketOpportunities = await scanMarketsForSimpleArbitrage({ limit: 1000 });
  displayEventRangeArbitrageResults(eventOpportunities);
  displayMarketSimpleArbitrageResults(marketOpportunities);
  displayTopOpportunities(eventOpportunities, marketOpportunities);
};
