import { getMarketsFromRest } from '../polymarket';
import type { PolymarketMarket } from '../../common/types';

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

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         SCANNING FOR SIMPLE ARBITRAGE OPPORTUNITIES            ║');
  console.log('║              (Markets where YES + NO < 1)                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  let hasMoreMarkets = true;

  while (hasMoreMarkets) {
    try {
      console.log(`Scanning markets ${offset} to ${offset + limit}...`);

      const markets = await getMarketsFromRest({ ...options, offset, limit });

      if (markets.length === 0) {
        console.log('No more markets to scan.');
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
          console.log(
            `  ✅ Found: [${opportunity.marketId}] Profit: $${opportunity.guaranteedProfit.toFixed(
              4,
            )} (${opportunity.roi.toFixed(2)}% ROI)`,
          );
        }
      }

      console.log(`  Found ${foundInBatch} opportunities in this batch\n`);

      offset += limit;
    } catch (error) {
      console.error('Error scanning markets:', error);
      throw error;
    }
  }

  // Final summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              SIMPLE ARBITRAGE SCAN COMPLETE                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Total Markets Scanned: ${totalMarketsScanned}`);
  console.log(`Total Opportunities Found: ${allOpportunities.length}\n`);

  if (allOpportunities.length > 0) {
    // Sort by ROI descending
    allOpportunities.sort((a, b) => b.roi - a.roi);

    console.log('═'.repeat(70));
    console.log('TOP OPPORTUNITIES (sorted by ROI):');
    console.log('═'.repeat(70));
    console.log('');

    allOpportunities.forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.question}`);
      console.log(`   Market ID: ${opp.marketId}`);
      console.log(`   Slug: ${opp.slug}`);
      console.log(`   URL: https://polymarket.com/event/${opp.slug}`);
      console.log(`   YES Price: $${opp.yesPrice.toFixed(4)}`);
      console.log(`   NO Price:  $${opp.noPrice.toFixed(4)}`);
      console.log(`   ─────────────────────────────────`);
      console.log(`   Total Cost:         $${opp.totalCost.toFixed(4)}`);
      console.log(`   Guaranteed Profit:  $${opp.guaranteedProfit.toFixed(4)}`);
      console.log(`   ROI:                ${opp.roi.toFixed(2)}%`);
      console.log('');
    });

    const totalProfit = allOpportunities.reduce((sum, opp) => sum + opp.guaranteedProfit, 0);
    const avgROI = allOpportunities.reduce((sum, opp) => sum + opp.roi, 0) / allOpportunities.length;

    console.log('═'.repeat(70));
    console.log('SUMMARY STATISTICS:');
    console.log('═'.repeat(70));
    console.log(`Total Potential Profit: $${totalProfit.toFixed(4)}`);
    console.log(`Average ROI: ${avgROI.toFixed(2)}%`);
    if (allOpportunities[0]) {
      console.log(`Best ROI: ${allOpportunities[0].roi.toFixed(2)}%`);
    }
    if (allOpportunities[allOpportunities.length - 1]) {
      console.log(`Worst ROI: ${allOpportunities[allOpportunities.length - 1]?.roi.toFixed(2)}%`);
    }
    console.log('');
  } else {
    console.log('No simple arbitrage opportunities found in the scanned markets.\n');
  }
};
