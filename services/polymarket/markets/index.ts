import type { GetMarketsOptions, PolymarketMarket } from '../../../common/types';
import { MIN_LIQUIDITY } from '../../../config';
import logger from '../../../utils/logger';
import { buildMarketsUrl } from '../utils';

/**
 * Fetches markets from Polymarket REST API
 * @param options - Query options for filtering and pagination
 * @returns Array of market objects
 */
export const getMarketsFromRest = async (options: GetMarketsOptions = {}, retries = 0): Promise<PolymarketMarket[]> => {
  const url = buildMarketsUrl(options);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (retries < 3) {
        logger.warn(`Failed to fetch markets: ${response.status} ${response.statusText}. Retrying...`);
        return getMarketsFromRest(options, retries + 1);
      }
      throw new Error(`Failed to fetch markets: ${response.status} ${response.statusText}`);
    }

    let markets: PolymarketMarket[] = await response.json();
    markets = markets.filter((m) => {
      if (m.liquidityNum < MIN_LIQUIDITY) return false;
      const isSportsMarket = ['moneyline', 'tennis_match_totals'].includes(m.sportsMarketType ?? '');
      return !isSportsMarket;
    });
    return markets;
  } catch (error) {
    logger.error('Error fetching markets from Polymarket API:', error);
    throw error;
  }
};
