import type { Side } from '@polymarket/clob-client';

export interface OrderParams {
  tokenId: string;
  price: number;
  size: number;
  side: Side;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export interface ArbitrageOrderParams {
  markets: Array<{
    tokenId: string;
    question: string;
    price: number;
  }>;
  side: 'YES' | 'NO';
  sharesPerMarket: number;
}
