import { AssetType, type MarketTradeEvent, type Trade } from '@polymarket/clob-client';
import { getClobClient } from '..';
import logger from '../../../utils/logger';

/**
 * Gets the trades from Polymarket
 * @returns The trades
 */
export const getTrades = async (): Promise<Trade[]> => {
  try {
    const clobClient = await getClobClient();
    const trades = await clobClient.getTrades();
    return trades;
  } catch (error) {
    logger.error('Error fetching trades:', error);
    throw error;
  }
};

export const getTradesForUser = async (userAddress: string): Promise<Trade[]> => {
  try {
    const clobClient = await getClobClient();
    const trades = await clobClient.getTrades({ maker_address: userAddress });
    return trades;
  } catch (error) {
    logger.warn('Error fetching trades for user:', error);
    throw error;
  }
};
