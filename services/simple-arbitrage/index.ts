import { getMarketsFromRest } from '../polymarket';
import type { PolymarketMarket } from '../../common/types';
import logger from '../../utils/logger';

interface SimpleArbitrageOpportunity {
  marketId: string;
  slug: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  totalCost: number;
  guaranteedProfit: number;
  roi: number;
}

interface SimpleArbitrageOptions {
  limit?: number;
  offset?: number;
  closed?: boolean;
  order?: string;
  ascending?: boolean;
}

/**
 * Checks if a market has a simple arbitrage opportunity (YES + NO < 1)
 */
const checkMarketForSimpleArbitrage = (market: PolymarketMarket): SimpleArbitrageOpportunity | null => {
  // Use bestAsk prices for buying (the price you pay)
  const yesPrice = parseFloat(market.bestAsk) || parseFloat(market.lastTradePrice) || 0;
  const noPrice = 1 - (parseFloat(market.bestBid) || parseFloat(market.lastTradePrice) || 0);

  const totalCost = yesPrice + noPrice;

  // Check if there's an arbitrage opportunity
  if (totalCost < 1) {
    const guaranteedProfit = 1 - totalCost;
    const roi = (guaranteedProfit / totalCost) * 100;

    return {
      marketId: market.id,
      slug: market.slug,
      question: market.question,
      yesPrice,
      noPrice,
      totalCost,
      guaranteedProfit,
      roi,
    };
  }

  return null;
};

/**
 * Finds simple arbitrage opportunities across all markets
 */
export const findSimpleArbitrage = async (options: SimpleArbitrageOptions = {}): Promise<void> => {
  let offset = options.offset || 0;
  const limit = options.limit || 100;
  const allOpportunities: SimpleArbitrageOpportunity[] = [];
  let totalMarketsScanned = 0;

  logger.header('\n╔════════════════════════════════════════════════════════════════╗');
  logger.header('║         SCANNING FOR SIMPLE ARBITRAGE OPPORTUNITIES            ║');
  logger.header('║              (Markets where YES + NO < 1)                      ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');

  let hasMoreMarkets = true;

  while (hasMoreMarkets) {
    try {
      logger.progress(`Scanning markets ${offset} to ${offset + limit}...`);

      const markets = await getMarketsFromRest({ ...options, offset, limit });

      if (markets.length === 0) {
        logger.info('No more markets to scan.');
        hasMoreMarkets = false;
        break;
      }

      totalMarketsScanned += markets.length;

      // Check each market for simple arbitrage
      let foundInBatch = 0;
      for (const market of markets) {
        const opportunity = checkMarketForSimpleArbitrage(market);
        if (opportunity) {
          allOpportunities.push(opportunity);
          foundInBatch++;

          // Log immediately when found
          logger.success(
            `  ✅ Found: [${opportunity.marketId}] Profit: $${opportunity.guaranteedProfit.toFixed(
              4,
            )} (${opportunity.roi.toFixed(2)}% ROI)`,
          );
        }
      }

      logger.info(`  Found ${foundInBatch} opportunities in this batch\n`);

      offset += limit;
    } catch (error) {
      logger.error('Error scanning markets:', error);
      throw error;
    }
  }

  // Final summary
  logger.log('\n\n');
  logger.header('╔════════════════════════════════════════════════════════════════╗');
  logger.header('║              SIMPLE ARBITRAGE SCAN COMPLETE                    ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');

  logger.info(`Total Markets Scanned: ${totalMarketsScanned}`);
  logger.info(`Total Opportunities Found: ${allOpportunities.length}\n`);

  if (allOpportunities.length > 0) {
    // Sort by ROI descending
    allOpportunities.sort((a, b) => b.roi - a.roi);

    logger.header('═'.repeat(70));
    logger.header('TOP OPPORTUNITIES (sorted by ROI):');
    logger.header('═'.repeat(70));
    logger.log('');

    allOpportunities.forEach((opp, index) => {
      logger.highlight(`${index + 1}. ${opp.question}`);
      logger.info(`   Market ID: ${opp.marketId}`);
      logger.info(`   Slug: ${opp.slug}`);
      logger.info(`   URL: https://polymarket.com/event/${opp.slug}`);
      logger.info(`   YES Price: $${opp.yesPrice.toFixed(4)}`);
      logger.info(`   NO Price:  $${opp.noPrice.toFixed(4)}`);
      logger.log(`   ─────────────────────────────────`);
      logger.money(`   Total Cost:         $${opp.totalCost.toFixed(4)}`);
      logger.money(`   Guaranteed Profit:  $${opp.guaranteedProfit.toFixed(4)}`);
      logger.success(`   ROI:                ${opp.roi.toFixed(2)}%`);
      logger.log('');
    });

    const totalProfit = allOpportunities.reduce((sum, opp) => sum + opp.guaranteedProfit, 0);
    const avgROI = allOpportunities.reduce((sum, opp) => sum + opp.roi, 0) / allOpportunities.length;

    logger.header('═'.repeat(70));
    logger.header('SUMMARY STATISTICS:');
    logger.header('═'.repeat(70));
    logger.money(`Total Potential Profit: $${totalProfit.toFixed(4)}`);
    logger.success(`Average ROI: ${avgROI.toFixed(2)}%`);
    if (allOpportunities[0]) {
      logger.success(`Best ROI: ${allOpportunities[0].roi.toFixed(2)}%`);
    }
    if (allOpportunities[allOpportunities.length - 1]) {
      logger.success(`Worst ROI: ${allOpportunities[allOpportunities.length - 1]?.roi.toFixed(2)}%`);
    }
    logger.log('');
  } else {
    logger.warn('No simple arbitrage opportunities found in the scanned markets.\n');
  }
};
