import { getOpenOrders } from '../../polymarket/orders';
import type { UserPosition } from '../../../common/types';
import { getUserPositions } from '../../polymarket/positions';
import { Side, type OpenOrder } from '@polymarket/clob-client';
import { getEvent } from '../../polymarket/events';
import { addMinutes, differenceInMinutes } from 'date-fns';
import logger from '../../../utils/logger';

export const getUpcomingPositions = async () => {
  const [positions, orders] = await Promise.all([getUserPositions(), getOpenOrders()]);
  const positionsByEventIdMap: Record<string, UserPosition[]> = {};
  positions.forEach((position) => {
    positionsByEventIdMap[position.eventId] = [...(positionsByEventIdMap[position.eventId] || []), position];
  });

  const eventIds = Object.keys(positionsByEventIdMap);
  for (const eventId of eventIds) {
    const positions = positionsByEventIdMap[eventId];
    if (!positions) continue;
    const event = await getEvent(eventId);
    const firstMarketEndDate = event.markets.find((m) => m.endDate)?.endDate || addMinutes(new Date(), 120).toISOString();
    const minutesToExpiry = Math.abs(differenceInMinutes(new Date(event.startTime || firstMarketEndDate), new Date()));
    const relatedOrders = orders.filter((o) => event.markets.some((m) => m.conditionId === o.market && o.side === Side.BUY)) as unknown as OpenOrder[];
    if (minutesToExpiry < 5 * 60) {
      logger.info(`\nEvent ${event.title} is upcoming in ${minutesToExpiry} minutes.`);
      logger.progress(`You currently have ${positions.length}/${event.markets.length} positions in this event and ${relatedOrders.length} related orders`);
    }
  }
};
