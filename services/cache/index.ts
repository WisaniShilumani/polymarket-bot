import { LRUCache } from 'lru-cache';

const orderCancelCache = new LRUCache<string, number>({
  max: 3 * 60 * 1000,
});

export const setLastPurchaseTime = (tokenId: string) => {
  const now = new Date().getTime();
  orderCancelCache.set(tokenId, now);
};

export const getLastPurchaseTime = (tokenId: string) => {
  return orderCancelCache.get(tokenId);
};
