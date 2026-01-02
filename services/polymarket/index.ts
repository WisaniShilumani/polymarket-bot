import { ClobClient } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';
import type { GetMarketsOptions, PolymarketEvent, PolymarketMarket } from '../../common/types';

const host = 'https://clob.polymarket.com';
const funder = process.env.POLYMARKET_FUNDER; //This is the address listed below your profile picture when using the Polymarket site.
const signer = new Wallet(process.env.POLYMARKET_PRIVATE_KEY!);
const creds = new ClobClient(host, 137, signer).createOrDeriveApiKey();

const signatureType = 1;

const POLYMARKET_API_URL = 'https://gamma-api.polymarket.com';

export const getMarkets = async () => {
  const clobClient = new ClobClient(host, 137, signer, await creds, signatureType, funder);
  const markets = await clobClient.getMarkets();

  // Filter for active markets that are accepting orders
  const activeMarkets = {
    ...markets,
    data: markets.data.filter((market: any) => {
      // Market must be active (explicitly true or undefined, but not false)
      const isActive = market.active !== false;
      // Market must not be closed
      const isNotClosed = market.closed !== true;
      // Market state should be OPEN or ACTIVE (or undefined, which we'll treat as open)
      const isOpenState = !market.state || market.state === 'OPEN' || market.state === 'ACTIVE';
      // Market should be accepting orders (explicitly true or undefined, but not false)
      const acceptsOrders = market.acceptingOrders !== false;

      return isActive && isNotClosed && isOpenState && acceptsOrders;
    }),
  };
  return activeMarkets;
};

/**
 * Fetches markets from Polymarket REST API
 * @param options - Query options for filtering and pagination
 * @returns Array of market objects
 */
export const getMarketsFromRest = async (options: GetMarketsOptions = {}): Promise<PolymarketMarket[]> => {
  // Default to today's date in ISO format for date filters
  const today = new Date().toISOString();
  const {
    limit = 100,
    offset = 0,
    closed = false,
    order,
    ascending,
    end_date_min = today,
    start_date_max = today,
    exclude_sports = true,
  } = options;

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    closed: closed.toString(),
  });

  if (order) {
    params.append('order', order);
  }

  if (ascending !== undefined) {
    params.append('ascending', ascending.toString());
  }

  if (end_date_min) {
    params.append('end_date_min', end_date_min);
  }

  if (start_date_max) {
    params.append('start_date_max', start_date_max);
  }

  const url = `${POLYMARKET_API_URL}/markets?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.status} ${response.statusText}`);
    }

    let markets: PolymarketMarket[] = await response.json();

    // Filter out sports markets if exclude_sports is enabled
    if (exclude_sports || true) {
      markets = markets.filter((market) => {
        // Check if any category is "Sports"
        const isSportsCategory =
          market.question.toLowerCase().includes('vs. ') ||
          market.question.toLowerCase().includes('vs ') ||
          market.events?.some(
            (event: any) => event.title.toLowerCase().includes('vs. ') || event.title.toLowerCase().includes('vs '),
          ) ||
          market.categories?.some(
            (cat: any) => cat.name?.toLowerCase() === 'sports' || cat.slug?.toLowerCase() === 'sports',
          );
        return !isSportsCategory;
      });
    }

    return markets;
  } catch (error) {
    console.error('Error fetching markets from Polymarket API:', error);
    throw error;
  }
};
/**
 * Fetches specific markets by their IDs
 * @param marketIds - Array of market IDs to fetch
 * @returns Array of markets with full data including prices
 */
export const getMarketsByIds = async (marketIds: string[]): Promise<PolymarketMarket[]> => {
  try {
    // Use the id parameter with comma-separated values
    const params = new URLSearchParams({
      id: marketIds.join(','),
    });

    const url = `${POLYMARKET_API_URL}/markets?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch markets by IDs: ${response.status} ${response.statusText}`);
    }

    const markets: PolymarketMarket[] = await response.json();
    return markets;
  } catch (error) {
    console.error('Error fetching markets by IDs:', error);
    throw error;
  }
};

interface GetEventsOptions {
  limit?: number;
  offset?: number;
  closed?: boolean;
  exclude_sports?: boolean;
  end_date_min?: string;
}

/**
 * Fetches events from Polymarket REST API
 * @param options - Query options for filtering and pagination
 * @returns Array of event objects with their markets
 */
export const getEventsFromRest = async (options: GetEventsOptions = {}): Promise<PolymarketEvent[]> => {
  // Default to today's date in ISO format for end_date_min filter
  const today = new Date().toISOString();
  const { limit = 100, offset = 0, closed = false, exclude_sports = true, end_date_min = today } = options;

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    closed: closed.toString(),
  });

  // Add end_date_min parameter to fetch only events with end date greater than today
  if (end_date_min) {
    params.append('end_date_min', end_date_min);
  }

  const url = `${POLYMARKET_API_URL}/events?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
    }

    let events: PolymarketEvent[] = await response.json();

    // Filter out sports events if exclude_sports is enabled
    if (exclude_sports) {
      events = events.filter((event) => {
        const isSportsEvent =
          event.title.toLowerCase().includes('vs. ') ||
          event.title.toLowerCase().includes('vs ') ||
          event.category?.toLowerCase() === 'sports';
        return !isSportsEvent;
      });
    }

    return events;
  } catch (error) {
    console.error('Error fetching events from Polymarket API:', error);
    throw error;
  }
};
