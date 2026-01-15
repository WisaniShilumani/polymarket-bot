import type { GetEventsOptions, PolymarketEvent } from '../../../common/types';
import logger from '../../../utils/logger';
import { http } from '../../../utils/http';
import { buildCryptoEventsUrl, buildEventsUrl } from '../utils';

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

export const getCryptoEvents = async (options: GetEventsOptions = {}): Promise<PolymarketEvent[]> => {
  const url = buildCryptoEventsUrl(options);
  try {
    const events = await http.get(url).json<PolymarketEvent[]>();
    return events;
  } catch (error) {
    logger.error('Error fetching events from Polymarket API:', error);
    throw error;
  }
};

export const getEvent = async (eventId: string): Promise<PolymarketEvent> => {
  const url = `https://gamma-api.polymarket.com/events/${eventId}`;
  try {
    const event = await http.get(url).json<PolymarketEvent>();
    return event;
  } catch (error) {
    logger.error('Error fetching event from Polymarket API:', error);
    throw error;
  }
};

export const getAllCryptoEvents = async (): Promise<PolymarketEvent[]> => {
  const allEvents: PolymarketEvent[] = [];
  let offset = 0;
  const limit = 500;
  let hasMoreEvents = true;
  while (hasMoreEvents) {
    try {
      const events = await getCryptoEvents({ offset, limit, closed: false });
      allEvents.push(...events);
      if (events.length === 0) {
        hasMoreEvents = false;
        break;
      }

      offset += limit;
    } catch (error) {
      logger.error('Error scanning events:', error);
      throw error;
    }
  }
  logger.success(`Found ${allEvents.length} crypto events`);
  return allEvents;
};
