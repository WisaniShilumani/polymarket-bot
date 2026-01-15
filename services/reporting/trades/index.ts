import { Side } from '@polymarket/clob-client';
import { getTradesForUser } from '../../polymarket/trade-history';
import logger from '../../../utils/logger';
import { POLYMARKET_FUNDER } from '../../../config';
import type { TradeHistoryItem } from '../../../common/types';

// User's wallet address
const USER_ADDRESS = POLYMARKET_FUNDER;

export interface TradeReport {
  id: string;
  question: string;
  image: string;
  executedAt: string;
  shares: number;
  orderPrice: number;
  matchedPrice: number;
  side: Side;
  outcome: string;
  pnl: number;
  percentPnL: number;
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

export interface PriceRangeStatsByOutcome {
  yes: PriceRangeStats[];
  no: PriceRangeStats[];
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
  priceRangeStats: PriceRangeStatsByOutcome;
}

interface TradeHistoryItemWithPnl extends TradeHistoryItem {
  pnl: number;
  averagePrice?: number;
}

/**
 * Converts a TradeHistoryItem to a TradeReport
 */
function toTradeReport(trade: TradeHistoryItemWithPnl): TradeReport {
  const averagePrice = trade.averagePrice ?? 0;
  const percentPnL = averagePrice > 0 ? ((trade.price - averagePrice) / averagePrice) * 100 : 0;

  return {
    id: trade.transactionHash,
    question: trade.title,
    image: trade.icon,
    executedAt: new Date(trade.timestamp * 1000).toISOString(),
    shares: trade.size,
    orderPrice: trade.price,
    matchedPrice: averagePrice,
    side: trade.side === 'BUY' ? Side.BUY : Side.SELL,
    outcome: trade.outcome,
    pnl: trade.pnl,
    percentPnL,
    marketSlug: trade.eventSlug,
  };
}

/**
 * Fetches all trades and calculates P&L for each using the getTradesForUser service
 */
export const getTradesReport = async (): Promise<TradesReportSummary> => {
  const trades = await getTradesForUser();
  logger.info(`Found ${trades.length} trades for user ${USER_ADDRESS}`);

  // Convert to TradeReport format
  const tradeReports = trades.map((trade) => toTradeReport(trade as TradeHistoryItemWithPnl));

  // Sort by execution time (most recent first)
  tradeReports.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

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

function createEmptyRanges(): PriceRangeStats[] {
  return [
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
}

function populateRangeStats(ranges: PriceRangeStats[], trades: TradeReport[]): void {
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
}

function generatePriceRangeStats(trades: TradeReport[]): PriceRangeStatsByOutcome {
  const yesTrades = trades.filter((t) => t.outcome === 'Yes');
  const noTrades = trades.filter((t) => t.outcome === 'No');

  const yesRanges = createEmptyRanges();
  const noRanges = createEmptyRanges();

  populateRangeStats(yesRanges, yesTrades);
  populateRangeStats(noRanges, noTrades);

  return {
    yes: yesRanges.filter((r) => r.tradeCount > 0),
    no: noRanges.filter((r) => r.tradeCount > 0),
  };
}
