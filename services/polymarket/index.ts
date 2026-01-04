import { ClobClient } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';
import { POLYMARKET_CLOB_URL, POLYMARKET_FUNDER, POLYMARKET_PRIVATE_KEY } from '../../config';

/**
 * Gets an initialized CLOB client for trading
 */
export const getClobClient = async (): Promise<ClobClient> => {
  const host = POLYMARKET_CLOB_URL;
  const funder = POLYMARKET_FUNDER;
  const signer = new Wallet(POLYMARKET_PRIVATE_KEY);
  const signatureType = 1;
  const creds = new ClobClient(host, 137, signer).createOrDeriveApiKey();
  return new ClobClient(host, 137, signer, await creds, signatureType, funder);
};
