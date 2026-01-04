import type { Side } from '@polymarket/clob-client';
import { getClobClient } from '..';

export const getLikelyFillPrice = async (tokenId: string, side: Side, desiredSize: number): Promise<number> => {
  const client = await getClobClient();
  const orderBook = await client.getOrderBook(tokenId);
  const orders =
    side === 'BUY'
      ? orderBook.asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      : orderBook.bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

  let remainingSize = desiredSize;
  let totalCost = 0;
  for (const order of orders) {
    const price = parseFloat(order.price);
    const size = parseFloat(order.size);
    const fillSize = Math.min(remainingSize, size);
    totalCost += fillSize * price;
    remainingSize -= fillSize;
    if (remainingSize <= 0) break;
  }

  return totalCost;
};
