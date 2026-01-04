import * as fs from 'fs';
import * as path from 'path';
import logger from '../../../utils/logger';
import { EVENT_HOLDINGS } from '../../../config';

const ORDERS_FILE_PATH = path.join(process.cwd(), 'ORDERS.txt');

/**
 * Reads event IDs from the ORDERS.txt file
 */
const getOrderedEventIds = (): string[] => {
  try {
    if (fs.existsSync(ORDERS_FILE_PATH)) {
      const content = fs.readFileSync(ORDERS_FILE_PATH, 'utf-8');
      return content
        .split('\n')
        .map((id) => id.trim())
        .filter(Boolean);
    }
  } catch (error) {
    logger.error('Error reading ORDERS.txt:', error);
  }
  return [];
};

/**
 * Appends an event ID to the ORDERS.txt file
 */
export const appendEventToOrdersFile = (eventId: string): void => {
  try {
    fs.appendFileSync(ORDERS_FILE_PATH, `${eventId}\n`, 'utf-8');
    logger.success(`  📝 Recorded event ${eventId} in ORDERS.txt`);
  } catch (error) {
    logger.error('Error writing to ORDERS.txt:', error);
  }
};

/**
 * Gets the list of held event IDs from the environment variable and ORDERS.txt
 */
export const getHeldEventIds = (): Set<string> => {
  const eventIds = EVENT_HOLDINGS.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const orderedEventIds = getOrderedEventIds();
  return new Set([...eventIds, ...orderedEventIds]);
};
