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
    const remainingSizeToSell = Number(position.size) - totalOpenOrderSize;
    if (remainingSizeToSell <= 0) continue;
    console.log(`Selling ${remainingSizeToSell} shares for ${market.question} at ${position.avgPrice + 0.008}`);
    await createOrder({
      tokenId: position.asset,
      price: position.avgPrice + 0.008,
      size: remainingSizeToSell,
      side: Side.SELL,
    });
  }
};
