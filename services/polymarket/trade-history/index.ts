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
    const events = await clobClient.getTrades();
    return events;
  } catch (error) {
    logger.error('Error fetching trades:', error);
    return [];
  }
};
