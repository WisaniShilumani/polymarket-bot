import { createOrder, getOpenOrders } from '../../../polymarket/orders';
import { getUserPositions } from '../../../polymarket/positions';
import { Side } from '@polymarket/clob-client';
import { getMarketByAssetId } from '../../../polymarket/markets';
import { evaluateUpSwingsFromPrice } from '../../../polymarket/price-history';
import { MarketSide } from '../../../../common/enums';

export const sellCryptoPositions = async () => {
  const [positions, orders] = await Promise.all([getUserPositions(), getOpenOrders()]);

  for (const position of positions) {
    const market = await getMarketByAssetId(position.conditionId);
    const isCryptoEvent = market.tags?.includes('Crypto');
    if (!isCryptoEvent) continue;
    //
    const clobTokenIndex = position.outcome === MarketSide.Yes ? 0 : 1;
    const tokenId = JSON.parse(market.clobTokenIds as unknown as string)[clobTokenIndex];
    //
    const relatedOrders = orders.filter((o) => o.market === position.conditionId && o.side === Side.SELL);
    const totalOpenOrderSize = relatedOrders.reduce((acc, o) => acc + Number(o.original_size) - Number(o.size_matched), 0);
    const remainingSizeToSell = Number(position.size) - totalOpenOrderSize - 0.001;
    if (remainingSizeToSell <= market.orderMinSize) continue;
    const { highestROIInterval } = await evaluateUpSwingsFromPrice(tokenId, position.avgPrice);
    const flooredToTwoDecimalPlaces = Math.floor(remainingSizeToSell * 100) / 100;
    await createOrder({
      tokenId: position.asset,
      price: position.avgPrice + highestROIInterval,
      size: Number(flooredToTwoDecimalPlaces.toFixed(2)),
      side: Side.SELL,
    });
  }
};
