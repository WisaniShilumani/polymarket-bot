import type { MarketSide } from './enums';

export interface Market {
  marketId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  daysToExpiry: number;
  slug?: string;
}

export interface Position {
  marketId: string;
  side: MarketSide;
  price: number; // entry price
  size: number; // number of shares
  daysToExpiry: number;
}

export interface ArbitrageResult {
  isArbitrage: boolean;
  worstCaseProfit: number;
  cost: number;
  minPayout: number;
  daysToExpiry: number;
}

export interface LatencyArbResult {
  isArbitrage: boolean;
  worstCaseProfit: number;
  cost: number;
  minPayout: number;
}

export interface PolymarketMarket {
  id: string;
  outcomePrices: string;
  question: string;
  description?: string;
  slug: string;
  conditionId: string;
  clobTokenIds?: string[]; // [yesTokenId, noTokenId]
  bestBid: string;
  bestAsk: string;
  lastTradePrice: string;
  volume24hr: string;
  volume1wk: string;
  volume1mo: string;
  volume1yr: string;
  liquidityNum: number;
  liquidityAmm: number;
  liquidityClob: number;
  orderMinSize: number; // Minimum order size in shares (e.g., 5)
  active: boolean;
  closed: boolean;
  archived: boolean;
  ready: boolean;
  funded: boolean;
  events?: any[];
  categories?: any[];
  tags?: any[];
  sportsMarketType?: string;
  spread: number;
  endDate: string;
}

export interface MarketForOrder {
  yesTokenId: string;
  noTokenId: string;
  question: string;
  price: number;
  daysToExpiry: number;
}

interface Tag {
  slug: string;
}

export interface PolymarketEvent {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description?: string;
  category: string;
  startDate?: string;
  endDate?: string;
  creationDate?: string;
  closedTime?: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  markets: PolymarketMarket[];
  volume?: string;
  liquidity?: string;
  series?: any[];
  tags?: Tag[];
}

export interface GetMarketsOptions {
  limit?: number;
  offset?: number;
  closed?: boolean;
  order?: string;
  ascending?: boolean;
  end_date_min?: string;
  start_date_max?: string;
  start_date_min?: string;
  exclude_sports?: boolean;
}

export interface GetEventsOptions {
  limit?: number;
  offset?: number;
  closed?: boolean;
  exclude_sports?: boolean;
  end_date_min?: string;
  start_date_min?: string;
}

export interface MarketSimpleArbitrageOpportunity {
  marketId: string;
  marketData: PolymarketMarket;
  slug: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  totalCost: number;
  guaranteedProfit: number;
  roi: number;
}

export interface EventRangeArbitrageOpportunity {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  markets: Market[];
  result: {
    arbitrageBundles: any[];
    normalizedShares: number;
  };
  hasArbitrage: boolean;
  eventData: PolymarketEvent; // Full event JSON
}
