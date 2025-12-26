import { ClobClient } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';

const host = 'https://clob.polymarket.com';
const funder = process.env.POLYMARKET_FUNDER; //This is the address listed below your profile picture when using the Polymarket site.
const signer = new Wallet(process.env.POLYMARKET_API_SECRET!);
const creds = new ClobClient(host, 137, signer).createOrDeriveApiKey();

const signatureType = 1;

export const getMarkets = async () => {
  const clobClient = new ClobClient(host, 137, signer, await creds, signatureType, funder);
  const markets = await clobClient.getMarkets();
  console.log(markets);
  return markets;
};
