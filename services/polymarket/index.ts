import { ClobClient } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';
import { POLYMARKET_CLOB_URL, POLYMARKET_FUNDER, POLYMARKET_PRIVATE_KEY } from '../../config';

// const muteConsole: any = {
//   log: () => {},
//   error: () => {},
//   warn: () => {},
//   info: () => {},
//   debug: () => {},
// };
/**
 * Gets an initialized CLOB client for trading
 */
export const getClobClient = async (): Promise<ClobClient> => {
  const originalConsoleError = console.error;
  const host = POLYMARKET_CLOB_URL;
  const funder = POLYMARKET_FUNDER;
  const signer = new Wallet(POLYMARKET_PRIVATE_KEY);
  const signatureType = 1;
  console.error = () => {};
  const creds = new ClobClient(host, 137, signer).createOrDeriveApiKey();
  const client = new ClobClient(host, 137, signer, await creds, signatureType, funder);
  console.error = originalConsoleError;
  return client;
};
