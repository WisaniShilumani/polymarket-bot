import type { MarketSide } from './enums';
export interface Market {
    marketId: string;
    yesPrice: number;
}
export interface Position {
    marketId: string;
    side: MarketSide;
    price: number;
    size: number;
}
export interface ArbitrageResult {
    isArbitrage: boolean;
    worstCaseProfit: number;
    cost: number;
    minPayout: number;
}
export interface LatencyArbResult {
    isArbitrage: boolean;
    worstCaseProfit: number;
    cost: number;
    minPayout: number;
}
//# sourceMappingURL=types.d.ts.map