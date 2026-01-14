import { Side } from '@polymarket/clob-client';
import { getOpenOrders } from '../../polymarket/orders';
import { differenceInHours } from 'date-fns';
import { getMarketByAssetId } from '../../polymarket/markets';
import { getOutcomePrice } from '../../../utils/prices';
import { MarketSide } from '../../../common/enums';
import { formatCurrency } from '../../../utils/accounting';

export const getOrdersReport = async () => {
  const orders = await getOpenOrders();
  const promises = orders.map(async (order) => {
    const market = await getMarketByAssetId(order.market);
    const priceDifference = Math.abs(Number(order.price) - getOutcomePrice(market, MarketSide.Yes, false));
    const orderAge = differenceInHours(new Date(), new Date(order.created_at * 1000));
    return {
      question: market.question,
      orderAge,
      priceDifference,
    };
  });
  const ordersReport = await Promise.all(promises);
  return ordersReport;
};
