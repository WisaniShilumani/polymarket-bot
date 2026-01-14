import { Side } from '@polymarket/clob-client';
import { getOpenOrders } from '../../polymarket/orders';
import { differenceInHours } from 'date-fns';
import { getMarketByAssetId } from '../../polymarket/markets';
import { getOutcomePrice } from '../../../utils/prices';
import { MarketSide } from '../../../common/enums';

export const getOrdersReport = async () => {
  const orders = await getOpenOrders();
  const promises = orders.map(async (order) => {
    const market = await getMarketByAssetId(order.market);

    // Determine if this is a Yes or No order by comparing asset_id with token IDs
    let outcome = 'Yes';
    if (market.clobTokenIds && Array.isArray(market.clobTokenIds)) {
      const tokenIds = typeof market.clobTokenIds === 'string' ? JSON.parse(market.clobTokenIds) : market.clobTokenIds;
      const assetId = (order as any).asset_id || order.market;
      if (tokenIds[1] && assetId === tokenIds[1]) {
        outcome = 'No';
      }
    } else if ((order as any).outcome) {
      outcome = (order as any).outcome;
    }

    // Get the appropriate current price based on outcome
    const currentPrice = getOutcomePrice(market, outcome === 'Yes' ? MarketSide.Yes : MarketSide.No, false);
    const priceDifference = +(Number(order.price) - currentPrice).toFixed(2);
    const orderAge = differenceInHours(new Date(), new Date(order.created_at * 1000));

    // Calculate profit/loss: for BUY orders, profit when current price > purchase price
    // For SELL orders, profit when purchase price > current price
    const profitLoss =
      order.side === Side.BUY
        ? (currentPrice - Number(order.price)) * Number(order.original_size || 0)
        : (Number(order.price) - currentPrice) * Number(order.original_size || 0);

    return {
      question: market.question,
      image: market.image || '',
      createdAt: new Date(order.created_at * 1000).toISOString(),
      shares: Number(order.original_size || 0),
      averagePurchasePrice: Number(order.price),
      currentMarketPrice: currentPrice,
      orderAge,
      priceDifference,
      side: order.side,
      outcome,
      profitLoss,
    };
  });
  const ordersReport = await Promise.all(promises);
  const buyOrdersReport = ordersReport.filter((o) => o.side === Side.BUY);
  const sellOrdersReport = ordersReport.filter((o) => o.side === Side.SELL);
  return {
    buyOrdersReport,
    sellOrdersReport,
  };
};
