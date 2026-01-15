import { addDays, addMinutes, subDays, subMonths } from 'date-fns';
import type { GetEventsOptions, GetMarketsOptions } from '../../common/types';
import { POLYMARKET_API_URL, POLYMARKET_CLOB_URL, POLYMARKET_DATA_API_URL } from '../../config';

export const buildEventsUrl = (options: GetEventsOptions = {}) => {
  const minEndDate = addMinutes(new Date(), 30).toISOString();
  const startDate = subMonths(new Date(), 12).toISOString();
  const maxEndDate = addDays(new Date(), 3).toISOString();
  // const maxEndDate = addMinutes(new Date(), 90).toISOString();
  const { limit = 100, offset = 0, closed = false } = options;
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    closed: closed.toString(),
    end_date_min: minEndDate,
    end_date_max: maxEndDate,
    start_date_min: startDate,
    ascending: 'false',
    order: 'creationDate',
    // tag_slug: 'soccer', // highly limiting, but seems to be the strategy for now
  });

  const url = `${POLYMARKET_API_URL}/events?${params.toString()}`;
  return url;
};

export const buildCryptoEventsUrl = (options: GetEventsOptions = {}) => {
  const minEndDate = addDays(new Date(), 3).toISOString();
  const maxEndDate = addDays(new Date(), 90).toISOString();
  const startDate = subMonths(new Date(), 12).toISOString();
  const { limit = 500, offset = 0, closed = false } = options;
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    closed: closed.toString(),
    end_date_min: minEndDate,
    end_date_max: maxEndDate,
    start_date_min: startDate,
    ascending: 'false',
    order: 'volume',
    tag_slug: 'crypto-prices',
  });

  const url = `${POLYMARKET_API_URL}/events?${params.toString()}`;
  return url;
};

export const buildIndicesEventsUrl = (options: GetEventsOptions = {}) => {
  const minEndDate = addDays(new Date(), 5).toISOString();
  const maxEndDate = addDays(new Date(), 90).toISOString();
  const startDate = subMonths(new Date(), 12).toISOString();
  const { limit = 500, offset = 0, closed = false } = options;
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    closed: closed.toString(),
    end_date_min: minEndDate,
    end_date_max: maxEndDate,
    start_date_min: startDate,
    ascending: 'false',
    order: 'volume',
    tag_slug: 'indicies',
  });

  const url = `${POLYMARKET_API_URL}/events?${params.toString()}`;
  return url;
};

export const buildMarketsUrl = (options: GetMarketsOptions = {}) => {
  const startDate = subDays(new Date(), 5).toISOString();
  const today = new Date().toISOString();
  const {
    limit = 100,
    offset = 0,
    closed = false,
    order,
    ascending = false,
    end_date_min = today,
    start_date_max = today,
    start_date_min = startDate,
  } = options;

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    closed: closed.toString(),
  });

  if (order) {
    params.append('order', order);
  }

  if (ascending) {
    params.append('ascending', ascending.toString());
  }

  if (end_date_min) {
    params.append('end_date_min', end_date_min);
  }

  if (start_date_min) {
    params.append('start_date_min', start_date_min);
  }

  if (start_date_max) {
    params.append('start_date_max', start_date_max);
  }

  const url = `${POLYMARKET_API_URL}/markets?${params.toString()}`;
  return url;
};

export const buildMarketsBySlugUrl = (slug: string) => `${POLYMARKET_API_URL}/markets/slug/${slug}`;

export const buildPriceHistoryUrl = (market: string, startTs: Date, endTs: Date) => {
  const params = new URLSearchParams({
    market,
    startTs: Math.round(startTs.getTime() / 1000).toString(),
    endTs: Math.round(endTs.getTime() / 1000).toString(),
  });
  const url = `${POLYMARKET_CLOB_URL}/prices-history?${params.toString()}`;
  return url;
};

export interface GetTradesOptions {
  limit?: number;
  offset?: number;
}
export const buildTradesUrl = (userAddress: string, options: GetTradesOptions = {}) => {
  const { limit = 100, offset = 0 } = options;
  const params = new URLSearchParams({
    user: userAddress,
    limit: limit.toString(),
    offset: offset.toString(),
  });
  const url = `${POLYMARKET_DATA_API_URL}/trades?${params.toString()}`;
  return url;
};
