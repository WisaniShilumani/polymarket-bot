import type { GetEventsOptions, PolymarketEvent } from '../../../common/types';
import logger from '../../../utils/logger';
import { http } from '../../../utils/http';
import { buildEventsUrl } from '../utils';

/**
 * Fetches events from Polymarket REST API
 * @param options - Query options for filtering and pagination
 * @returns Array of event objects with their markets
 */
export const getEventsFromRest = async (options: GetEventsOptions = {}): Promise<PolymarketEvent[]> => {
  const url = buildEventsUrl(options);
  try {
    const events = await http.get(url).json<PolymarketEvent[]>();
    return events;
  } catch (error) {
    logger.error('Error fetching events from Polymarket API:', error);
    throw error;
  }
};
