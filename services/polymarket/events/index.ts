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
    return events.filter((event) => {
      if (event.title.includes('NBA:')) return false;
      if (event.title.includes('NFL:')) return false;
      if (event.category?.toLowerCase().includes('pop-culture')) return false;
      if (event.description?.toLowerCase().includes('box office')) return false;
      return true;
    });
  } catch (error) {
    logger.error('Error fetching events from Polymarket API:', error);
    throw error;
  }
};
