import { Side, type OpenOrder } from '@polymarket/clob-client';
import { MarketSide } from '../../../../common/enums';
import type { PolymarketMarket, UserPosition } from '../../../../common/types';
import { getOutcomePrice } from '../../../../utils/prices';
import { getAllCryptoEvents } from '../../../polymarket/events';
import { createOrder, getOpenOrders } from '../../../polymarket/orders';
import { getUserPositions } from '../../../polymarket/positions';
import type { OrderParams } from '../../../polymarket/orders/types';
import { evaluateBuySignal } from '../../../polymarket/price-history';
import logger from '../../../../utils/logger';
import { getAccountCollateralBalance } from '../../../polymarket/account-balance';

const MIN_PRICE = 0.3;
const MAX_PRICE = 0.67;
const MIN_VOLUME = 5_000;

const calculateMaxShares = (availableBalance: number) => {
  const averageAnticipatedScore = 60;
  const averagePrice = 0.5;
  const anticipatedMarketCount = 8;
  const maxShares = (100 * availableBalance) / (averageAnticipatedScore * averagePrice * anticipatedMarketCount);
  return Math.round(maxShares);
};
// const max shares = (60/(100/80))*0.5*8

interface IMarketWithOrder extends PolymarketMarket {
  size: number;
  existingOrderPrice: number;
  useMarketOrder: boolean;
}

const getPositionAndOrderSize = (conditionId: string, positions: UserPosition[], orders: OpenOrder[]) => {
  const position = positions.find((p) => p.conditionId === conditionId);
  const order = orders.find((o) => o.market === conditionId && o.side === Side.BUY && o.outcome === 'Yes');
  const totalSize = Number(position?.size || 0) + Number(order?.original_size || 0) - Number(order?.size_matched || 0);
  return {
    totalSize,
    existingOrderPrice: Number(order?.price || 0),
  };
};
export const buyCryptoEvents = async (marketSide: MarketSide = MarketSide.Yes) => {
  const clobTokenIndex = marketSide === MarketSide.Yes ? 0 : 1;
  const [cryptoEvents, positions, orders, collateralBalance] = await Promise.all([
    getAllCryptoEvents(),
    getUserPositions(),
    getOpenOrders(),
    getAccountCollateralBalance(),
  ]);

  const relevantMarkets: IMarketWithOrder[] = [];
  for (const event of cryptoEvents) {
    for (const market of event.markets) {
      if (market.closed) continue;
      if (market.feesEnabled) continue;
      const outcomePrice = getOutcomePrice(market, marketSide);
      const tokenId = JSON.parse(market.clobTokenIds as unknown as string)[clobTokenIndex];
      if (market.volumeNum < MIN_VOLUME) continue;
      const isInPriceRange = outcomePrice > MIN_PRICE && outcomePrice < MAX_PRICE;
      if (!isInPriceRange) continue;
      const { shouldBuy, score, maxPrice } = await evaluateBuySignal(tokenId);
      if (!shouldBuy) continue;
      if (market.spread >= 0.05) continue;
      if (outcomePrice + 0.01 >= maxPrice) continue;
      const { totalSize, existingOrderPrice } = getPositionAndOrderSize(market.conditionId, positions, orders);
      const maxShares = calculateMaxShares(collateralBalance);
      const divisor = 100 / maxShares;
      const maxSizeForMarket = Math.round(score / divisor);
      const remainingPurchaseableShares = Math.round(maxSizeForMarket - totalSize);
      if (remainingPurchaseableShares <= 0) continue;
      const normalizedSize = Math.max(remainingPurchaseableShares, market.orderMinSize);
      relevantMarkets.push({
        ...market,
        size: normalizedSize,
        existingOrderPrice,
        useMarketOrder: market.spread <= 0.01,
      });
      logger.progress(`[score=${score}] Buying ${normalizedSize} shares of ${market.question} at ${outcomePrice}`);
    }
  }

  const ordersToPlace: OrderParams[] = relevantMarkets.map((market) => ({
    tokenId: JSON.parse(market.clobTokenIds as unknown as string)[clobTokenIndex],
    price: market.existingOrderPrice || getOutcomePrice(market, marketSide), // buy at exact price so we don't miss out on opportunities // or midpoint for efficiency?
    size: market.size,
    side: Side.BUY,
    useMarketOrder: market.useMarketOrder,
  }));

  await Promise.all(ordersToPlace.map((order) => createOrder(order)));
};
