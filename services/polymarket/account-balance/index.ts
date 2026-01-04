import { AssetType } from '@polymarket/clob-client';
import { getClobClient } from '..';
import logger from '../../../utils/logger';
import { LRUCache } from 'lru-cache';
import { POLYMARKET_FUNDER } from '../../../config';

const balanceCache = new LRUCache<string, number>({
  max: 2,
  ttl: 1000,
});

/**
 * Gets the account balance from Polymarket
 * @returns The account balance in USDC (or 0 if unable to fetch)
 */
export const getAccountCollateralBalance = async (): Promise<number> => {
  try {
    const cachedBalance = balanceCache.get(POLYMARKET_FUNDER);
    if (cachedBalance) return cachedBalance;
    const clobClient = await getClobClient();
    const balances = await clobClient.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
    const collateralBalance = +(Number(balances.balance) / 1000000).toFixed(3);
    balanceCache.set(POLYMARKET_FUNDER, collateralBalance);
    return collateralBalance;
  } catch (error) {
    logger.error('Error fetching account balance:', error);
    return 0;
  }
};
