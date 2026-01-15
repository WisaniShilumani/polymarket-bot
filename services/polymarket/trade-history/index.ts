import { type Trade } from '@polymarket/clob-client';
import { getClobClient } from '..';
import logger from '../../../utils/logger';
import { http } from '../../../utils/http';
import { buildTradesUrl, type GetTradesOptions } from '../utils';
import type { TradeHistoryItem } from '../../../common/types';
import { POLYMARKET_FUNDER } from '../../../config';

const getAllTrades = async (): Promise<TradeHistoryItem[]> => {
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
    const startDate = new Date('2026-01-14T08:00:00Z');
    return trades.filter((trade) => new Date(+trade.timestamp * 1000) > startDate);
  } catch (error) {
    logger.error('Error fetching trades:', error);
    throw error;
  }
};

export const getTradesForUser = async (): Promise<TradeHistoryItem[]> => {
  try {
    const trades = await getAllTrades();

    const sortedTrades = trades.sort((a, b) => b.timestamp - a.timestamp);
    const tradesByConditionIdMap = new Map<string, TradeHistoryItem[]>();
    console.log(sortedTrades.filter((t) => t.side === 'SELL').slice(0, 9));
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
