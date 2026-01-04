import { AssetType } from '@polymarket/clob-client';
import { getClobClient } from '..';
import logger from '../../../utils/logger';

/**
 * Gets the account balance from Polymarket
 * @returns The account balance in USDC (or 0 if unable to fetch)
 */
export const getAccountCollateralBalance = async (): Promise<number> => {
  try {
    const clobClient = await getClobClient();
    const balances = await clobClient.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
    const collateralBalance = +(Number(balances.balance) / 1000000).toFixed(3);
    return collateralBalance;
  } catch (error) {
    logger.error('Error fetching account balance:', error);
    return 0;
  }
};
