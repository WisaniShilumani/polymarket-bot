import { Side, type Trade } from '@polymarket/clob-client';
import { getTrades } from '../../polymarket/trade-history';
import { getMarketByAssetId } from '../../polymarket/markets';
import logger from '../../../utils/logger';
import { POLYMARKET_FUNDER } from '../../../config';

// User's wallet address (case-insensitive comparison)
const USER_ADDRESS = POLYMARKET_FUNDER.toLowerCase();

/**
 * Safely parse a date from various formats
 */
function parseTradeDate(dateValue: string | number | undefined): Date {
  if (!dateValue) return new Date();

  // If it's a number or numeric string (unix timestamp)
  const numValue = Number(dateValue);
  if (!isNaN(numValue)) {
    // Check if it's in seconds (10 digits) or milliseconds (13 digits)
    if (numValue < 1e12) {
      return new Date(numValue * 1000);
    }
    return new Date(numValue);
  }

  // Try parsing as ISO string
  const parsed = new Date(dateValue);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Fallback to current date
  return new Date();
}

export interface TradeReport {
  id: string;
  question: string;
  image: string;
  executedAt: string;
  shares: number;
  orderPrice: number; // Price from getOrder() - the limit price you set
  matchedPrice: number; // Price from trade execution - what it actually filled at
  side: Side;
  outcome: string;
  traderSide: 'TAKER' | 'MAKER';
  pnl: number; // (matchedPrice - orderPrice) * shares for SELL, (orderPrice - matchedPrice) * shares for BUY
  percentPnL: number;
  marketResolved: boolean;
  marketSlug: string;
}

export interface ChartDataPoint {
  date: string;
  cumulativePnL: number;
  winRate: number;
  tradeCount: number;
}

export interface MarketStats {
  question: string;
  marketSlug: string;
  image: string;
  totalPnL: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  totalCost: number;
}

export interface OutcomeStats {
  outcome: 'Yes' | 'No';
  totalPnL: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgPnL: number;
}

export interface PriceRangeStats {
  rangeLabel: string;
  minPrice: number;
  maxPrice: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
}

export interface TradesReportSummary {
  trades: TradeReport[];
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalCost: number;
  totalCurrentValue: number;
  winningTrades: number;
  losingTrades: number;
  totalTrades: number;
  chartData: ChartDataPoint[];
  topWinnersByMarket: MarketStats[];
  topLosersByMarket: MarketStats[];
  outcomeStats: OutcomeStats[];
  priceRangeStats: PriceRangeStats[];
}

/**
 * User's trade with their specific portion extracted
 */
interface UserTrade {
  trade: Trade;
  userPortion: {
    shares: number;
    price: number; // The limit price from the order (maker_orders[].price)
    side: Side;
    outcome: string;
  };
}

/**
 * A buy lot representing shares purchased at a specific price
 * Used for FIFO cost basis tracking
 */
interface BuyLot {
  shares: number;
  price: number;
  tradeId: string;
  matchTime: number;
}

/**
 * Extract the user's portions from a trade
 * Returns an array because user might have multiple orders in maker_orders
 */
function extractUserPortions(trade: Trade): UserTrade[] {
  const makerOrders = (trade as any).maker_orders || [];
  const results: UserTrade[] = [];

  // Check if user is the taker (maker_address is the order initiator)
  // When user is taker, they are BUYING
  const isUserTaker = (trade as any).maker_address?.toLowerCase() === USER_ADDRESS;

  if (isUserTaker) {
    results.push({
      trade,
      userPortion: {
        shares: Number(trade.size),
        price: Number(trade.price),
        side: Side.BUY, // Taker = buyer
        outcome: trade.outcome || 'Yes',
      },
    });
  }

  // Check if user appears in maker_orders (user was a maker)
  // Maker = always SELLER
  // Each maker_order is a separate trade entry - don't group them
  for (const order of makerOrders) {
    if (order.maker_address?.toLowerCase() === USER_ADDRESS) {
      results.push({
        trade,
        userPortion: {
          shares: Number(order.matched_amount),
          price: Number(order.price),
          side: Side.SELL, // Maker = seller
          outcome: order.outcome || trade.outcome || 'Yes',
        },
      });
    }
  }

  return results;
}

/**
 * Fetches all trades and calculates P&L for each
 * For SELL trades: P&L = (sell price - buy price) × shares
 * Buy price comes from the nearest previous BUY trades for the same market+outcome (FIFO)
 */
export const getTradesReport = async (): Promise<TradesReportSummary> => {
  const allTrades = await getTrades();
  console.log(JSON.stringify(allTrades.slice(0, 3), null, 2));

  // Extract user portions from trades
  const userTrades: UserTrade[] = allTrades.flatMap((trade) => extractUserPortions(trade));
  logger.info(`Found ${userTrades.length} user positions (from ${allTrades.length} total trades)`);

  // Sort by time (oldest first) to process trades chronologically
  const sortedTrades = [...userTrades].sort((a, b) => parseTradeDate(a.trade.match_time).getTime() - parseTradeDate(b.trade.match_time).getTime());

  // Create index mapping for sorted trades back to original userTrades
  const sortedIndexMap = new Map<UserTrade, number>();
  sortedTrades.forEach((ut, idx) => sortedIndexMap.set(ut, idx));

  // FIFO cost basis tracking: Map of market+outcome -> array of buy lots (oldest first)
  const buyLots = new Map<string, BuyLot[]>();

  // Track P&L calculations by sorted index
  const pnlResults: Array<{
    pnl: number;
    avgBuyPrice: number | null;
    costBasisDetails: Array<{ shares: number; buyPrice: number }>;
  }> = new Array(sortedTrades.length);

  // First pass: Build buy lots and calculate P&L for sells using FIFO
  // Key by market + outcome (not asset_id) since asset_ids can differ for maker vs taker
  for (let i = 0; i < sortedTrades.length; i++) {
    const { trade, userPortion } = sortedTrades[i]!;
    const positionKey = `${trade.market}-${userPortion.outcome}`;
    const matchTime = parseTradeDate(trade.match_time).getTime();

    if (userPortion.side === Side.BUY) {
      // Add to buy lots for this position
      const lots = buyLots.get(positionKey) || [];
      lots.push({
        shares: userPortion.shares,
        price: userPortion.price,
        tradeId: trade.id,
        matchTime,
      });
      buyLots.set(positionKey, lots);

      // BUY trades: no realized P&L yet (only realized on SELL)
      pnlResults[i] = {
        pnl: 0,
        avgBuyPrice: null,
        costBasisDetails: [],
      };
    } else {
      // SELL trade: consume shares from oldest buy lots (FIFO)
      const lots = buyLots.get(positionKey) || [];
      let sharesToSell = userPortion.shares;
      let totalCost = 0;
      const costBasisDetails: Array<{ shares: number; buyPrice: number }> = [];

      // Consume from oldest lots first
      while (sharesToSell > 0 && lots.length > 0) {
        const oldestLot = lots[0];
        if (!oldestLot) break;

        const sharesToTake = Math.min(sharesToSell, oldestLot.shares);
        totalCost += sharesToTake * oldestLot.price;
        costBasisDetails.push({ shares: sharesToTake, buyPrice: oldestLot.price });

        oldestLot.shares -= sharesToTake;
        sharesToSell -= sharesToTake;

        // Remove depleted lot
        if (oldestLot.shares <= 0) {
          lots.shift();
        }
      }

      const sharesSold = userPortion.shares - sharesToSell;
      let pnl: number;
      let avgBuyPrice: number | null = null;

      if (sharesSold > 0) {
        avgBuyPrice = totalCost / sharesSold;
        // P&L only for the portion with cost basis
        pnl = (userPortion.price - avgBuyPrice) * sharesSold;
        // Shares without cost basis don't contribute to P&L (we don't know the buy price)
        if (sharesToSell > 0) {
          logger.warn(`SELL trade ${trade.id}: ${sharesToSell.toFixed(2)} shares sold without matching BUY for ${positionKey}`);
        }
      } else {
        // No matching buy lots found at all - can't calculate P&L
        pnl = 0;
        logger.warn(`SELL trade ${trade.id}: No cost basis found for ${userPortion.shares} shares in ${positionKey}`);
      }

      pnlResults[i] = { pnl, avgBuyPrice, costBasisDetails };
    }
  }

  // Fetch market info (for names/images only)
  const uniqueMarketIds = [...new Set(userTrades.map((ut) => ut.trade.market))];
  const marketCache = new Map<string, any>();
  const batchSize = 5;
  for (let i = 0; i < uniqueMarketIds.length; i += batchSize) {
    const batch = uniqueMarketIds.slice(i, i + batchSize);
    const batchPromises = batch.map(async (marketId) => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const market = await getMarketByAssetId(marketId);
        return { marketId, market };
      } catch {
        return null;
      }
    });
    const results = await Promise.all(batchPromises);
    for (const result of results) {
      if (result) marketCache.set(result.marketId, result.market);
    }
  }

  // Build trade reports with calculated P&L
  const tradeReports: TradeReport[] = [];
  for (const userTrade of sortedTrades) {
    const { trade, userPortion } = userTrade;
    const market = marketCache.get(trade.market);
    if (!market) continue;

    const executionPrice = userPortion.price;
    const shares = userPortion.shares;

    const sortedIdx = sortedIndexMap.get(userTrade) ?? 0;
    const pnlResult = pnlResults[sortedIdx] || { pnl: 0, avgBuyPrice: null, costBasisDetails: [] };
    const { pnl, avgBuyPrice } = pnlResult;

    const percentPnL = avgBuyPrice && avgBuyPrice > 0 ? ((executionPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;

    tradeReports.push({
      id: trade.id,
      question: market.question || 'Unknown Market',
      image: market.image || '',
      executedAt: parseTradeDate(trade.match_time).toISOString(),
      shares,
      orderPrice: executionPrice,
      matchedPrice: avgBuyPrice ?? 0, // Cost basis (0 if unknown)
      side: userPortion.side,
      outcome: userPortion.outcome,
      traderSide: trade.trader_side,
      pnl,
      percentPnL,
      marketResolved: market.closed || market.resolved || false,
      marketSlug: market.market_slug || market.slug || '',
    });
  }

  // Sort by execution time (most recent first)
  tradeReports.sort((a, b) => parseTradeDate(b.executedAt).getTime() - parseTradeDate(a.executedAt).getTime());

  const summary = calculateSummary(tradeReports);
  return { trades: tradeReports, ...summary };
};

function calculateSummary(trades: TradeReport[]) {
  // Only SELL trades have realized P&L
  const sellTrades = trades.filter((t) => t.side === Side.SELL);
  const buyTrades = trades.filter((t) => t.side === Side.BUY);

  let totalPnL = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  for (const trade of sellTrades) {
    totalPnL += trade.pnl;
    if (trade.pnl > 0) {
      winningTrades++;
    } else if (trade.pnl < 0) {
      losingTrades++;
    }
  }

  // Total cost is from BUY trades only
  const totalCost = buyTrades.reduce((sum, t) => sum + t.orderPrice * t.shares, 0);

  // Generate chart data (sorted oldest first for chronological display)
  const chartData = generateChartData(trades);

  // Generate market and outcome stats (SELL trades only for P&L stats)
  const { topWinnersByMarket, topLosersByMarket } = generateMarketStats(sellTrades);
  const outcomeStats = generateOutcomeStats(sellTrades);
  const priceRangeStats = generatePriceRangeStats(sellTrades);

  return {
    totalRealizedPnL: totalPnL,
    totalUnrealizedPnL: totalPnL,
    totalCost,
    totalCurrentValue: sellTrades.reduce((sum, t) => sum + t.orderPrice * t.shares, 0),
    winningTrades,
    losingTrades,
    totalTrades: trades.length,
    chartData,
    topWinnersByMarket,
    topLosersByMarket,
    outcomeStats,
    priceRangeStats,
  };
}

function generateChartData(trades: TradeReport[]): ChartDataPoint[] {
  // Only SELL trades have realized P&L for charting
  const sellTrades = trades.filter((t) => t.side === Side.SELL);
  if (sellTrades.length === 0) return [];

  // Sort trades by date (oldest first)
  const sortedTrades = [...sellTrades].sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());

  const chartData: ChartDataPoint[] = [];
  let cumulativePnL = 0;
  let wins = 0;
  let totalCount = 0;

  for (const trade of sortedTrades) {
    totalCount++;
    cumulativePnL += trade.pnl;

    if (trade.pnl > 0) {
      wins++;
    }

    const winRate = totalCount > 0 ? (wins / totalCount) * 100 : 0;

    chartData.push({
      date: trade.executedAt,
      cumulativePnL: Number(cumulativePnL.toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
      tradeCount: totalCount,
    });
  }

  return chartData;
}

function generateMarketStats(trades: TradeReport[]): {
  topWinnersByMarket: MarketStats[];
  topLosersByMarket: MarketStats[];
} {
  const marketMap = new Map<string, MarketStats>();

  for (const trade of trades) {
    const key = trade.question;
    const existing = marketMap.get(key);
    const cost = trade.orderPrice * trade.shares;

    if (existing) {
      existing.totalPnL += trade.pnl;
      existing.tradeCount++;
      existing.totalCost += cost;
      if (trade.pnl > 0) {
        existing.winCount++;
      } else if (trade.pnl < 0) {
        existing.lossCount++;
      }
    } else {
      marketMap.set(key, {
        question: trade.question,
        marketSlug: trade.marketSlug,
        image: trade.image,
        totalPnL: trade.pnl,
        tradeCount: 1,
        winCount: trade.pnl > 0 ? 1 : 0,
        lossCount: trade.pnl < 0 ? 1 : 0,
        totalCost: cost,
      });
    }
  }

  const allMarkets = Array.from(marketMap.values());

  // Top winners (sorted by highest P&L)
  const topWinnersByMarket = allMarkets
    .filter((m) => m.totalPnL > 0)
    .sort((a, b) => b.totalPnL - a.totalPnL)
    .slice(0, 5);

  // Top losers (sorted by lowest P&L)
  const topLosersByMarket = allMarkets
    .filter((m) => m.totalPnL < 0)
    .sort((a, b) => a.totalPnL - b.totalPnL)
    .slice(0, 5);

  return { topWinnersByMarket, topLosersByMarket };
}

function generateOutcomeStats(trades: TradeReport[]): OutcomeStats[] {
  const yesStats: OutcomeStats = {
    outcome: 'Yes',
    totalPnL: 0,
    tradeCount: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    avgPnL: 0,
  };

  const noStats: OutcomeStats = {
    outcome: 'No',
    totalPnL: 0,
    tradeCount: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    avgPnL: 0,
  };

  for (const trade of trades) {
    const stats = trade.outcome === 'Yes' ? yesStats : noStats;
    stats.totalPnL += trade.pnl;
    stats.tradeCount++;

    if (trade.pnl > 0) {
      stats.winCount++;
    } else if (trade.pnl < 0) {
      stats.lossCount++;
    }
  }

  // Calculate derived stats
  if (yesStats.tradeCount > 0) {
    yesStats.winRate = (yesStats.winCount / yesStats.tradeCount) * 100;
    yesStats.avgPnL = yesStats.totalPnL / yesStats.tradeCount;
  }

  if (noStats.tradeCount > 0) {
    noStats.winRate = (noStats.winCount / noStats.tradeCount) * 100;
    noStats.avgPnL = noStats.totalPnL / noStats.tradeCount;
  }

  return [yesStats, noStats];
}

function generatePriceRangeStats(trades: TradeReport[]): PriceRangeStats[] {
  // Define price ranges (in cents: 0-10, 10-20, ..., 90-100)
  const ranges: PriceRangeStats[] = [
    { rangeLabel: '0-10¢', minPrice: 0, maxPrice: 0.1, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '10-20¢', minPrice: 0.1, maxPrice: 0.2, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '20-30¢', minPrice: 0.2, maxPrice: 0.3, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '30-40¢', minPrice: 0.3, maxPrice: 0.4, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '40-50¢', minPrice: 0.4, maxPrice: 0.5, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '50-60¢', minPrice: 0.5, maxPrice: 0.6, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '60-70¢', minPrice: 0.6, maxPrice: 0.7, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '70-80¢', minPrice: 0.7, maxPrice: 0.8, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '80-90¢', minPrice: 0.8, maxPrice: 0.9, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
    { rangeLabel: '90-100¢', minPrice: 0.9, maxPrice: 1.0, tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnL: 0, avgPnL: 0 },
  ];

  for (const trade of trades) {
    const price = trade.orderPrice;

    // Find the matching range
    for (const range of ranges) {
      if (price >= range.minPrice && price < range.maxPrice) {
        range.tradeCount++;
        range.totalPnL += trade.pnl;

        if (trade.pnl > 0) {
          range.winCount++;
        } else if (trade.pnl < 0) {
          range.lossCount++;
        }
        break;
      }
    }

    // Handle edge case for exactly 1.0
    if (price >= 1.0) {
      const lastRange = ranges[ranges.length - 1];
      if (lastRange) {
        lastRange.tradeCount++;
        lastRange.totalPnL += trade.pnl;
        if (trade.pnl > 0) {
          lastRange.winCount++;
        } else if (trade.pnl < 0) {
          lastRange.lossCount++;
        }
      }
    }
  }

  // Calculate derived stats
  for (const range of ranges) {
    if (range.tradeCount > 0) {
      range.winRate = (range.winCount / range.tradeCount) * 100;
      range.avgPnL = range.totalPnL / range.tradeCount;
    }
  }

  // Only return ranges that have trades
  return ranges.filter((r) => r.tradeCount > 0);
}
