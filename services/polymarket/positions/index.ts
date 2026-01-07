import { endOfDay } from 'date-fns';
import type { UserPosition } from '../../../common/types';
import { http } from '../../../utils/http';
import { logger } from '../../../utils/logger';

export const getUserPositions = async () => {
  const userAddress = '0x2c19DF8019fF8E13BA32d2C6927e223Ec574Cc52';
  const url = `https://data-api.polymarket.com/positions?limit=500&user=${userAddress}`;
  try {
    const positions = await http.get(url).json<UserPosition[]>();
    return positions.filter((p) => endOfDay(p.endDate) > new Date());
  } catch (error) {
    logger.error('Error fetching user positions from Polymarket API:', error);
    throw error;
  }
};
