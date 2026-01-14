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
    const priceDifference = +(Number(order.price) - getOutcomePrice(market, MarketSide.Yes, false)).toFixed(2);
    const orderAge = differenceInHours(new Date(), new Date(order.created_at * 1000));
    return {
      question: market.question,
      orderAge,
      priceDifference,
      side: order.side,
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
