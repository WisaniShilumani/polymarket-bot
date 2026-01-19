import { createOrder, getOpenOrders } from '../../../polymarket/orders';
import { getUserPositions } from '../../../polymarket/positions';
import { Side } from '@polymarket/clob-client';
import { getMarketByAssetId } from '../../../polymarket/markets';

export const sellCryptoPositions = async () => {
  const [positions, orders] = await Promise.all([getUserPositions(), getOpenOrders()]);

  for (const position of positions) {
    const market = await getMarketByAssetId(position.conditionId);
    const isCryptoEvent = market.tags?.includes('Crypto');
    if (!isCryptoEvent) continue;
    const relatedOrders = orders.filter((o) => o.market === position.conditionId && o.side === Side.SELL);
    const totalOpenOrderSize = relatedOrders.reduce((acc, o) => acc + Number(o.original_size) - Number(o.size_matched), 0);
    const remainingSizeToSell = Number(position.size) - totalOpenOrderSize - 0.001;
    if (remainingSizeToSell <= market.orderMinSize) continue;
    const flooredToTwoDecimalPlaces = Math.floor(remainingSizeToSell * 100) / 100;
    await createOrder({
      tokenId: position.asset,
      price: position.avgPrice + 0.019,
      size: Number(flooredToTwoDecimalPlaces.toFixed(2)),
      side: Side.SELL,
    });
  }
};
