import type { GetEventsOptions, PolymarketEvent } from '../../../common/types';
import logger from '../../../utils/logger';
import { http } from '../../../utils/http';
import { buildCryptoEventsUrl, buildEventsUrl, buildIndicesEventsUrl } from '../utils';

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

export const getIndicesEvents = async (options: GetEventsOptions = {}): Promise<PolymarketEvent[]> => {
  const url = buildIndicesEventsUrl(options);
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
      logger.progress(`Scanning events ${offset} to ${offset + limit}...`);
      const events = await getCryptoEvents({ offset, limit, closed: false });
      allEvents.push(...events);
      if (events.length === 0) {
        logger.info('No more events to scan.');
        hasMoreEvents = false;
        break;
      }

      offset += limit;
    } catch (error) {
      logger.error('Error scanning events:', error);
      throw error;
    }
  }
  return allEvents;
};

export const getAllIndicesEvents = async (): Promise<PolymarketEvent[]> => {
  const allEvents: PolymarketEvent[] = [];
  let offset = 0;
  const limit = 500;
  let hasMoreEvents = true;
  while (hasMoreEvents) {
    try {
      logger.progress(`Scanning events ${offset} to ${offset + limit}...`);
      const events = await getIndicesEvents({ offset, limit, closed: false });
      const filteredEvents = events.filter((event) => {
        const qualifies = event.slug.includes('up-or-down') || event.slug.includes('close') || event.slug.includes('above') || event.slug.includes('-hit-');
        return qualifies;
      });
      allEvents.push(...filteredEvents);
      if (events.length === 0) {
        logger.info('No more events to scan.');
        hasMoreEvents = false;
        break;
      }

      offset += limit;
    } catch (error) {
      logger.error('Error scanning events:', error);
      throw error;
    }
  }
  return allEvents;
};
