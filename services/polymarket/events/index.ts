import type { GetEventsOptions, PolymarketEvent } from '../../../common/types';
import logger from '../../../utils/logger';
import { buildEventsUrl } from '../utils';

/**
 * Fetches events from Polymarket REST API
 * @param options - Query options for filtering and pagination
 * @returns Array of event objects with their markets
 */
export const getEventsFromRest = async (options: GetEventsOptions = {}, retries = 0): Promise<PolymarketEvent[]> => {
  const url = buildEventsUrl(options);
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
    }

    const events: PolymarketEvent[] = await response.json();
    return events;
  } catch (error) {
    if (retries < 3) {
      return getEventsFromRest(options, retries + 1);
    }
    logger.error('Error fetching events from Polymarket API:', error);
    throw error;
  }
};
