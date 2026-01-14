import { Side } from '@polymarket/clob-client';
import { getOpenOrders } from '../../polymarket/orders';
import { differenceInHours } from 'date-fns';
import { getMarketByAssetId } from '../../polymarket/markets';
import { getOutcomePrice } from '../../../utils/prices';
import { MarketSide } from '../../../common/enums';
import { formatCurrency } from '../../../utils/accounting';

export const getOrdersReport = async () => {
  const orders = await getOpenOrders();

  // const buyOrders = orders.filter((o) => o.side === Side.BUY);
  const sellOrders = orders.filter((o) => o.side === Side.SELL);
  const ordersReport = [];
  for (const order of sellOrders) {
    const market = await getMarketByAssetId(order.market);
    const priceDifference = Math.abs(Number(order.price) - getOutcomePrice(market, MarketSide.Yes, false));
    const orderAge = differenceInHours(new Date(), new Date(order.created_at * 1000));
    ordersReport.push({
      question: market.question,
      orderAge,
      priceDifference,
    });
    console.log(`${market.question} - ${orderAge} hours - ${formatCurrency(priceDifference)} price difference`);
  }
  return ordersReport;
};
