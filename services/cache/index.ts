import { LRUCache } from 'lru-cache';

const orderCancelCache = new LRUCache<string, number>({
  max: 60000,
});

export const setLastPurchaseTime = (tokenId: string) => {
  const now = new Date().getTime();
  orderCancelCache.set(tokenId, now);
};

export const getLastPurchaseTime = (tokenId: string) => {
  return orderCancelCache.get(tokenId);
};
