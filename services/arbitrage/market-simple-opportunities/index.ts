import type { PolymarketMarket } from '../../../common/types';
import { DEFAULT_MIN_ORDER_SIZE, MAX_ORDER_COST } from '../../../config';
import logger from '../../../utils/logger';
import { getNoPrice, getYesPrice } from '../../../utils/prices';
import { getMarketsFromRest } from '../../polymarket/markets';
import { getOpenOrders } from '../../polymarket/orders';

interface MarketSimpleArbitrageOpportunity {
  marketId: string;
  slug: string;
  question: string;
  yesPrice: number; // Actual cost for YES order
  noPrice: number; // Actual cost for NO order
  totalCost: number;
  guaranteedProfit: number;
  roi: number;
  marketData: PolymarketMarket; // Full market JSON
}

/**
 * Checks if a market has a simple arbitrage opportunity (YES + NO < 1)
 */
const checkMarketForSimpleArbitrage = (market: PolymarketMarket): MarketSimpleArbitrageOpportunity | null => {
  const lastTradePrice = parseFloat(market.lastTradePrice);
  const yesPrice = getYesPrice(market);
  const noPrice = getNoPrice(market);
  const totalCostPerShare = yesPrice + noPrice;
  if (totalCostPerShare >= 1 || yesPrice === 0 || noPrice === 0) return null;
  const orderMinSize = market.orderMinSize ?? DEFAULT_MIN_ORDER_SIZE;
  const minSharesForYes = 1 / yesPrice;
  const minSharesForNo = 1 / noPrice;
  const minShares = Math.max(minSharesForYes, minSharesForNo, orderMinSize);
  const shares = Math.ceil(minShares * 100) / 100;
  // Calculate actual costs with minimum shares
  const yesCost = shares * yesPrice;
  const noCost = shares * noPrice;
  const totalCost = yesCost + noCost;
  const totalPrice = yesPrice + noPrice;
  // Calculate guaranteed payout and profit
  const guaranteedPayout = shares; // You get 1 share worth $1
  const guaranteedProfit = guaranteedPayout - totalCost;

  if (totalPrice < 0.99) {
    const yesSpread = yesPrice - lastTradePrice;
    console.log(JSON.stringify({ totalPrice, yesSpread, question: market.question, yesPrice, noPrice, lastTradePrice }));
    console.log(`https://gamma-api.polymarket.com/markets/${market.id}`);
  }
  // Must have positive profit
  if (guaranteedProfit <= 0) return null;
  const roi = (guaranteedProfit / totalCost) * 100;
  return {
    marketId: market.id,
    slug: market.slug,
    question: market.question,
    yesPrice: yesCost, // Store actual cost, not price per share
    noPrice: noCost, // Store actual cost, not price per share
    totalCost,
    guaranteedProfit,
    roi,
    marketData: market, // Store full market JSON
  };
};

/**
 * Scans markets for simple arbitrage opportunities
 */
export const scanMarketsForSimpleArbitrage = async (
  options: { limit?: number } = {},
  collateralBalance: number,
): Promise<MarketSimpleArbitrageOpportunity[]> => {
  const opportunities: MarketSimpleArbitrageOpportunity[] = [];
  let offset = 0;
  const limit = options.limit || 100;

  logger.header('\n╔════════════════════════════════════════════════════════════════╗');
  logger.header('║          SCANNING MARKETS FOR SIMPLE ARBITRAGE                 ║');
  logger.header('║                (Markets where YES + NO < 1)                    ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');

  let hasMoreMarkets = true;

  while (hasMoreMarkets) {
    try {
      logger.progress(`Scanning markets ${offset} to ${offset + limit}...`);

      const [orders, markets] = await Promise.all([getOpenOrders(), getMarketsFromRest({ offset, limit, closed: false })]);
      const totalOpenOrderValue = orders.reduce((sum, o) => sum + parseFloat(o.price) * parseFloat(o.original_size), 0);
      const availableCollateral = collateralBalance - totalOpenOrderValue;
      if (markets.length === 0) {
        logger.info('No more markets to scan.');
        hasMoreMarkets = false;
        break;
      }

      let foundInBatch = 0;
      for (const market of markets) {
        const maxOrderCost = Math.min(MAX_ORDER_COST, availableCollateral);
        const opportunity = checkMarketForSimpleArbitrage(market);
        if (opportunity && opportunity.roi > 0.2 && opportunity.totalCost < maxOrderCost) {
          opportunities.push(opportunity);
          foundInBatch++;
          logger.success(`  ✅ Found: [${opportunity.marketId}] Profit: $${opportunity.guaranteedProfit.toFixed(4)} (${opportunity.roi.toFixed(2)}% ROI)`);
        }
      }

      offset += limit;
    } catch (error) {
      logger.error('Error scanning markets:', error);
      throw error;
    }
  }

  return opportunities;
};
