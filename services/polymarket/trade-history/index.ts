import { type MakerOrder, type Trade } from '@polymarket/clob-client';
import { getClobClient } from '..';
import logger from '../../../utils/logger';
import { http } from '../../../utils/http';
import { buildTradesUrl } from '../utils';
import type { TradeHistoryItem } from '../../../common/types';
import { POLYMARKET_FUNDER } from '../../../config';
import { getMarketByAssetId } from '../markets';

interface MakerOrderWithMeta extends MakerOrder {
  matchTime: number;
  market: string;
}

export interface AggregatedTrade {
  orderId: string;
  assetId: string;
  totalSize: number;
  totalValue: number;
  averagePrice: number;
  totalOrders: number;
  date: Date;
  side: 'BUY' | 'SELL';
  outcome: string;
  image: string;
  question: string;
  eventSlug: string;
}

export interface AggregatedTradeWithPnl extends AggregatedTrade {
  pnl: number;
  averagePrice: number;
}

export interface TradeFilterOptions {
  startDate?: Date | undefined;
}

/**
 * Aggregates partial fills by assetId.
 * Only terminates a group when the same assetId changes side (BUY→SELL or SELL→BUY).
 * Outcome changes within the same assetId+side are kept in the same group.
 */
export const getAggregatedTrades = async (options: TradeFilterOptions = {}): Promise<AggregatedTradeWithPnl[]> => {
  try {
    const clobClient = await getClobClient();
    const allTrades = await clobClient.getTrades();
    // Default to Jan 14, 2026 if no startDate provided
    const startDate = options.startDate ?? new Date('2026-01-14T08:00:00Z');
    const trades = allTrades.filter((trade) => new Date(Number(trade.match_time) * 1000) > startDate);
    const restTrades = await getAllTrades(startDate);
    const restTradesByAssetIdMap = new Map<string, TradeHistoryItem[]>();
    for (const trade of restTrades) {
      if (!restTradesByAssetIdMap.has(trade.asset)) {
        restTradesByAssetIdMap.set(trade.asset, []);
      }
      restTradesByAssetIdMap.get(trade.asset)!.push(trade);
    }

    // Collect all maker orders where user was the maker
    const userMakerOrders: MakerOrderWithMeta[] = [];
    for (const trade of trades) {
      if (trade.status !== 'CONFIRMED') continue;
      const userOrders = trade.maker_orders.filter((order) => order.maker_address.toLowerCase() === POLYMARKET_FUNDER.toLowerCase());
      for (const order of userOrders) {
        userMakerOrders.push({
          ...order,
          matchTime: Number(trade.match_time),
          market: trade.market,
        });
      }
    }

    const uniqueOrderIds = [...new Set(userMakerOrders.map((o) => o.order_id))];
    const aggregatedTrades: AggregatedTrade[] = [];
    for (const orderId of uniqueOrderIds) {
      const allOrdersForThisOrderId = userMakerOrders.filter((o) => o.order_id === orderId).sort((a, b) => b.matchTime - a.matchTime);
      let totalSize = 0;
      let totalValue = 0;
      for (const order of allOrdersForThisOrderId) {
        totalSize += Number(order.matched_amount);
        totalValue += Number(order.matched_amount) * Number(order.price);
      }

      const restTradesForThisAssetId = restTradesByAssetIdMap.get(allOrdersForThisOrderId[0]!.asset_id)!;
      const marketInfo = !restTradesForThisAssetId?.[0] ? await getMarketByAssetId(allOrdersForThisOrderId[0]!.market, true) : null;

      const averagePrice = totalValue / totalSize;
      aggregatedTrades.push({
        orderId,
        assetId: allOrdersForThisOrderId[0]!.asset_id,
        totalSize,
        totalValue,
        averagePrice,
        totalOrders: allOrdersForThisOrderId.length,
        date: new Date(allOrdersForThisOrderId[0]!.matchTime * 1000),
        side: allOrdersForThisOrderId[0]!.side,
        outcome: allOrdersForThisOrderId[0]!.outcome,
        image: restTradesForThisAssetId?.[0]?.icon ?? marketInfo?.image ?? '',
        question: restTradesForThisAssetId?.[0]?.title ?? marketInfo?.question ?? '',
        eventSlug: restTradesForThisAssetId?.[0]?.eventSlug ?? marketInfo?.slug ?? '',
      });
    }

    const takerTrades = trades.filter((trade) => trade.status === 'CONFIRMED' && trade.maker_address.toLowerCase() === POLYMARKET_FUNDER.toLowerCase());
    const aggregatedTakerTrades: AggregatedTrade[] = [];
    for (const trade of takerTrades) {
      const restTradesForThisAssetId = restTradesByAssetIdMap.get(trade.asset_id)!;
      const marketInfo = !restTradesForThisAssetId?.[0] ? await getMarketByAssetId(trade.market, true) : null;

      aggregatedTakerTrades.push({
        orderId: trade.taker_order_id,
        assetId: trade.asset_id,
        totalSize: Number(trade.size),
        totalValue: Number(trade.size) * Number(trade.price),
        averagePrice: Number(trade.price),
        totalOrders: 1,
        date: new Date(Number(trade.match_time) * 1000),
        side: trade.side,
        outcome: trade.outcome,
        image: restTradesForThisAssetId?.[0]?.icon ?? marketInfo?.image ?? '',
        question: restTradesForThisAssetId?.[0]?.title ?? marketInfo?.question ?? '',
        eventSlug: restTradesForThisAssetId?.[0]?.eventSlug ?? marketInfo?.slug ?? '',
      });
    }

    const allAggregatedTrades = [...aggregatedTrades, ...aggregatedTakerTrades].sort((a, b) => b.date.getTime() - a.date.getTime());

    const tradesByAssetIdMap = new Map<string, AggregatedTrade[]>();
    for (const trade of allAggregatedTrades) {
      if (!tradesByAssetIdMap.has(trade.assetId)) {
        tradesByAssetIdMap.set(trade.assetId, []);
      }
      tradesByAssetIdMap.get(trade.assetId)!.push(trade);
    }

    const tradesWithPnl = allAggregatedTrades.map((trade, index) => {
      if (trade.side === 'BUY') {
        return {
          ...trade,
          pnl: 0,
        };
      }
      const assetIdTrades = tradesByAssetIdMap.get(trade.assetId)!;
      const previousTrades = assetIdTrades.filter((t) => t.date < trade.date && t.side === 'BUY').sort((a, b) => b.date.getTime() - a.date.getTime());
      let remainingSize = trade.totalSize;
      let totalCost = 0;
      let currentIndex = 0;
      let totalShares = 0;
      while (remainingSize > 0 && currentIndex < previousTrades.length) {
        const previousTrade = previousTrades[currentIndex]!;
        const sharesToTake = Math.min(remainingSize, previousTrade.totalSize);
        totalCost += previousTrade.averagePrice * sharesToTake;
        totalShares += sharesToTake;
        remainingSize -= sharesToTake;
        currentIndex++;
      }
      // Handle case where no matching BUY trades were found
      if (totalShares === 0) {
        return {
          ...trade,
          pnl: 0,
          averagePrice: 0,
        };
      }
      const averagePrice = totalCost / totalShares;
      const pnl = (trade.averagePrice - averagePrice) * trade.totalSize;
      return {
        ...trade,
        pnl,
        averagePrice,
      };
    });

    return tradesWithPnl;
  } catch (error) {
    logger.error('Error fetching aggregated maker trades:', error);
    throw error;
  }
};

export const getTrades = async (): Promise<Trade[]> => {
  try {
    const clobClient = await getClobClient();
    const trades = await clobClient.getTrades();
    const sortedTrades = trades.sort((a, b) => Number(b.match_time) - Number(a.match_time));
    return sortedTrades;
  } catch (error) {
    logger.error('Error fetching trades:', error);
    throw error;
  }
};

const getAllTrades = async (startDate: Date): Promise<TradeHistoryItem[]> => {
  try {
    let limit = 100;
    let offset = 0;
    let trades: TradeHistoryItem[] = [];
    let hasMore = true;
    while (hasMore) {
      const url = buildTradesUrl(POLYMARKET_FUNDER, { limit, offset });
      const newTrades = await http.get(url).json<TradeHistoryItem[]>();
      trades.push(...newTrades);
      offset += limit;
      if (newTrades.length < limit) {
        hasMore = false;
      }
    }
    return trades.filter((trade) => new Date(+trade.timestamp * 1000) > startDate);
  } catch (error) {
    logger.error('Error fetching trades:', error);
    throw error;
  }
};

export const getTradesForUser = async (): Promise<TradeHistoryItem[]> => {
  try {
    const startDate = new Date('2026-01-14T08:00:00Z');
    const trades = await getAllTrades(startDate);

    const sortedTrades = trades.sort((a, b) => b.timestamp - a.timestamp);
    const tradesByConditionIdMap = new Map<string, TradeHistoryItem[]>();
    for (const trade of sortedTrades) {
      const conditionId = trade.conditionId;
      if (!tradesByConditionIdMap.has(conditionId)) {
        tradesByConditionIdMap.set(conditionId, []);
      }
      tradesByConditionIdMap.get(conditionId)!.push(trade);
    }

    const tradesWithPnl = trades.map((trade, index) => {
      if (trade.side === 'BUY') {
        return {
          ...trade,
          pnl: 0,
        };
      }
      const conditionTrades = tradesByConditionIdMap.get(trade.conditionId)!;
      const previousTrades = conditionTrades.filter((t) => t.timestamp < trade.timestamp && t.side === 'BUY').sort((a, b) => b.timestamp - a.timestamp);
      let remainingSize = trade.size;
      let totalCost = 0;
      let currentIndex = 0;
      let totalShares = 0;
      while (remainingSize > 0 && currentIndex < previousTrades.length) {
        const previousTrade = previousTrades[currentIndex]!;
        const sharesToTake = Math.min(remainingSize, previousTrade.size);
        totalCost += previousTrade.price * sharesToTake;
        totalShares += sharesToTake;
        remainingSize -= sharesToTake;
        currentIndex++;
      }
      // Handle case where no matching BUY trades were found
      if (totalShares === 0) {
        return {
          ...trade,
          pnl: 0,
          averagePrice: 0,
        };
      }
      const averagePrice = totalCost / totalShares;
      const pnl = (trade.price - averagePrice) * trade.size;
      return {
        ...trade,
        pnl,
        averagePrice,
      };
    });

    return tradesWithPnl;
  } catch (error) {
    logger.warn('Error fetching trades for user:', error);
    throw error;
  }
};
