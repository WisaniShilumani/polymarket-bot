import { getMarketsFromRest, getEventsFromRest, createArbitrageOrders } from '../polymarket';
import { areBetsMutuallyExclusive } from '../openai';
import { rangeArbitrage } from '../../utils/math/range-arbitrage';
import type { EventRangeArbitrageOpportunity, Market, PolymarketEvent, PolymarketMarket } from '../../common/types';
import { displayEventRangeArbitrageResults, displayTopOpportunities } from './utils';
import { formatCurrency } from '../../utils/accounting';
import * as fs from 'fs';
import * as path from 'path';

const ORDERS_FILE_PATH = path.join(process.cwd(), 'ORDERS.txt');

const MAX_OPPORTUNITIES = 50;
const MIN_LIQUIDITY = 4_000;

/**
 * Reads event IDs from the ORDERS.txt file
 */
const getOrderedEventIds = (): string[] => {
  try {
    if (fs.existsSync(ORDERS_FILE_PATH)) {
      const content = fs.readFileSync(ORDERS_FILE_PATH, 'utf-8');
      return content
        .split('\n')
        .map((id) => id.trim())
        .filter(Boolean);
    }
  } catch (error) {
    console.error('Error reading ORDERS.txt:', error);
  }
  return [];
};

/**
 * Appends an event ID to the ORDERS.txt file
 */
const appendEventToOrdersFile = (eventId: string): void => {
  try {
    fs.appendFileSync(ORDERS_FILE_PATH, `${eventId}\n`, 'utf-8');
    console.log(`  📝 Recorded event ${eventId} in ORDERS.txt`);
  } catch (error) {
    console.error('Error writing to ORDERS.txt:', error);
  }
};

/**
 * Gets the list of held event IDs from the environment variable and ORDERS.txt
 */
const getHeldEventIds = (): Set<string> => {
  const heldEvents = process.env.HELD_EVENTS || '';
  const envEventIds = heldEvents
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const orderedEventIds = getOrderedEventIds();

  return new Set([...envEventIds, ...orderedEventIds]);
};

// ============================================================================
// ORDER EXECUTION
// ============================================================================

/**
 * Executes arbitrage orders for a given opportunity
 * Determines whether to buy YES or NO on all markets based on which strategy is profitable
 */
const executeArbitrageOrders = async (opportunity: EventRangeArbitrageOpportunity): Promise<void> => {
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
    (aggr, item) =>
      aggr +
      (useYesStrategy ? parseFloat(item.lastTradePrice) : 1 - parseFloat(item.lastTradePrice)) *
        result.normalizedShares,
    0,
  );

  // Check minimum profit threshold of $0.01
  const MIN_PROFIT_THRESHOLD = 0.01;
  if (!selectedBundle || selectedBundle.worstCaseProfit < MIN_PROFIT_THRESHOLD) {
    console.log(
      `  ⚠️ Profit $${
        selectedBundle?.worstCaseProfit.toFixed(4) ?? '0'
      } is below minimum threshold of $${MIN_PROFIT_THRESHOLD}, skipping order creation`,
    );
    return;
  }

  // Check maximum order cost
  const MAX_ORDER_COST = parseFloat(process.env.MAX_ORDER_COST || '4');
  if (orderCost > MAX_ORDER_COST) {
    console.log(
      `  ⚠️ Total order cost ${formatCurrency(orderCost)} exceeds maximum of ${formatCurrency(
        MAX_ORDER_COST,
      )}, skipping order creation`,
    );
    return;
  }

  // Check minimum ROI threshold of 1.01%
  const MIN_ROI_THRESHOLD = 1.01;
  const roi = (selectedBundle.worstCaseProfit / selectedBundle.cost) * 100;
  if (roi < MIN_ROI_THRESHOLD) {
    console.log(
      `  ⚠️ ROI ${roi.toFixed(2)}% is below minimum threshold of ${MIN_ROI_THRESHOLD}%, skipping order creation`,
    );
    return;
  }

  // Build market params for order creation
  const marketsWithTokens = activeMarkets.filter(
    (m) => m.clobTokenIds && m.clobTokenIds.length > tokenIndex && m.clobTokenIds[tokenIndex],
  );

  const marketsForOrders = marketsWithTokens.map((m) => ({
    tokenId: JSON.parse(m.clobTokenIds as unknown as string)[tokenIndex] as string,
    question: m.question,
    price: useYesStrategy ? parseFloat(m.lastTradePrice) || 0.5 : 1 - (parseFloat(m.lastTradePrice) || 0.5),
  }));

  if (marketsWithTokens.length === 0) {
    console.log(`  ⚠️ No valid token IDs found for event ${opportunity.eventId}, skipping order creation`);
    return;
  }

  if (marketsWithTokens.length !== activeMarkets.length) {
    console.log(
      `  ⚠️ Only ${marketsWithTokens.length}/${activeMarkets.length} markets have valid token IDs, skipping order creation`,
    );
    return;
  }

  console.log(
    `\n💰 Executing ${strategy} arbitrage on event: ${opportunity.eventTitle} for ${formatCurrency(orderCost)}`,
  );

  await createArbitrageOrders({
    markets: marketsForOrders,
    side: strategy,
    sharesPerMarket: result.normalizedShares,
  });

  // Record the event ID in ORDERS.txt after successful order
  appendEventToOrdersFile(opportunity.eventId);
};

// ============================================================================
// EVENT-BASED RANGE ARBITRAGE
// ============================================================================

/**
 * Default minimum order size if not specified on market
 */
const DEFAULT_MIN_ORDER_SIZE = 5;

/**
 * Calculates the minimum shares needed so each order meets the minimum
 * Uses the orderMinSize from the market data
 */
const calculateNormalizedShares = (markets: Market[], forYesStrategy: boolean, orderMinSize: number): number => {
  const prices = markets.map((m) => (forYesStrategy ? m.yesPrice : 1 - m.yesPrice));
  const minPrice = Math.min(...prices.filter((p) => p > 0));
  if (minPrice <= 0) return orderMinSize;
  const sharesNeeded = 1 / minPrice;
  // Ensure we meet the market's minimum order size
  return Math.max(orderMinSize, Math.ceil(sharesNeeded * 100) / 100);
};

/**
 * Checks a single event for range arbitrage opportunities
 */
const checkEventForRangeArbitrage = async (event: PolymarketEvent): Promise<EventRangeArbitrageOpportunity | null> => {
  // Skip events that are already held
  const heldEventIds = getHeldEventIds();
  if (heldEventIds.has(event.id)) {
    return null;
  }

  const activeMarkets = event.markets.filter((m) => !m.closed);
  if (!activeMarkets || activeMarkets.length < 2) {
    return null;
  }

  const hasLowLiquidityMarket = activeMarkets.some((m) => m.liquidityNum < MIN_LIQUIDITY);
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

  // Get the maximum orderMinSize across all markets in this event
  const orderMinSize = Math.max(...activeMarkets.map((m) => m.orderMinSize ?? DEFAULT_MIN_ORDER_SIZE));

  const yesNormalizedShares = calculateNormalizedShares(marketsForAnalysis, true, orderMinSize);
  const noNormalizedShares = calculateNormalizedShares(marketsForAnalysis, false, orderMinSize);
  const normalizedShares = Math.max(yesNormalizedShares, noNormalizedShares);
  const result = rangeArbitrage(marketsForAnalysis, 1);
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

          // Execute the arbitrage orders
          await executeArbitrageOrders(opportunity);

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
  if (market.liquidityNum < MIN_LIQUIDITY) {
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

  // Calculate minimum shares needed using the market's orderMinSize
  const orderMinSize = market.orderMinSize ?? DEFAULT_MIN_ORDER_SIZE;
  const minSharesForYes = 1 / yesPrice;
  const minSharesForNo = 1 / noPrice;
  const minShares = Math.max(minSharesForYes, minSharesForNo, orderMinSize);
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
  // const marketOpportunities = await scanMarketsForSimpleArbitrage({ limit: 1000 });
  displayEventRangeArbitrageResults(eventOpportunities);
  // displayMarketSimpleArbitrageResults(marketOpportunities);
  displayTopOpportunities(eventOpportunities, []);
};
