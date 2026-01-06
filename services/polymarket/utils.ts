import { addDays, addMinutes, subDays, subMonths } from 'date-fns';
import type { GetEventsOptions, GetMarketsOptions } from '../../common/types';
import { POLYMARKET_API_URL } from '../../config';

export const buildEventsUrl = (options: GetEventsOptions = {}) => {
  const today = addMinutes(new Date(), 5).toISOString();
  const startDate = subMonths(new Date(), 12).toISOString();
  const maxEndDate = addDays(new Date(), 3).toISOString();
  const { limit = 100, offset = 0, closed = false } = options;
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    closed: closed.toString(),
    end_date_min: today,
    end_date_max: maxEndDate,
    start_date_min: startDate,
    ascending: 'false',
    order: 'creationDate',
    // tag_slug: 'soccer', // highly limiting, but seems to be the strategy for now
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
