import type { GetMarketsOptions, PolymarketMarket } from '../../../common/types';
import logger from '../../../utils/logger';
import { http } from '../../../utils/http';
import { buildMarketsUrl } from '../utils';

/**
 * Fetches markets from Polymarket REST API
 * @param options - Query options for filtering and pagination
 * @returns Array of market objects
 */
export const getMarketsFromRest = async (options: GetMarketsOptions = {}): Promise<PolymarketMarket[]> => {
  const url = buildMarketsUrl(options);
  try {
    let markets = await http.get(url).json<PolymarketMarket[]>();
    markets = markets.filter((m) => {
      const isSportsMarket = ['moneyline', 'tennis_match_totals'].includes(m.sportsMarketType ?? '');
      return !isSportsMarket;
    });
    return markets;
  } catch (error) {
    logger.error('Error fetching markets from Polymarket API:', error);
    throw error;
  }
};
