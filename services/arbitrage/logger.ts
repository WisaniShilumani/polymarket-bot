import type { EventRangeArbitrageOpportunity, MarketSimpleArbitrageOpportunity } from '../../common/types';
import logger from '../../utils/logger';

interface TopOpportunity {
  marketId: string;
  type: string;
  roi: number;
  profit: number;
  cost: number;
  question: string;
  bets: string[];
  url: string;
}

export const displayMarketSimpleArbitrageResults = (opportunities: MarketSimpleArbitrageOpportunity[]) => {
  logger.log('\n\n');
  logger.header('╔════════════════════════════════════════════════════════════════╗');
  logger.header('║             MARKET SIMPLE ARBITRAGE RESULTS                    ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');
  logger.info(`Total Opportunities Found: ${opportunities.length}\n`);
  if (opportunities.length > 0) {
    opportunities.sort((a, b) => b.roi - a.roi);
    logger.header('═'.repeat(70));
    logger.header('OPPORTUNITIES (sorted by ROI):');
    logger.header('═'.repeat(70));
    logger.log('');
    opportunities.forEach((opp, index) => {
      logger.highlight(`${index + 1}. ${opp.question}`);
      logger.info(`   Market ID: ${opp.marketId}`);
      logger.info(`   Slug: ${opp.slug}`);
      logger.info(`   URL: https://polymarket.com/event/${opp.slug}`);
      logger.info(`   API: https://gamma-api.polymarket.com/markets/${opp.marketId}`);
      logger.info(`   YES Order Cost: $${opp.yesPrice.toFixed(2)}`);
      logger.info(`   NO Order Cost:  $${opp.noPrice.toFixed(2)}`);
      logger.log(`   ─────────────────────────────────`);
      logger.money(`   Total Cost:         $${opp.totalCost.toFixed(2)}`);
      logger.money(`   Guaranteed Profit:  $${opp.guaranteedProfit.toFixed(2)}`);
      logger.success(`   ROI:                ${opp.roi.toFixed(2)}%`);
      logger.log('');
    });

    const totalProfit = opportunities.reduce((sum, opp) => sum + opp.guaranteedProfit, 0);
    const totalCost = opportunities.reduce((sum, opp) => sum + opp.totalCost, 0);
    const avgROI = opportunities.reduce((sum, opp) => sum + opp.roi, 0) / opportunities.length;
    logger.header('═'.repeat(70));
    logger.header('SUMMARY STATISTICS:');
    logger.header('═'.repeat(70));
    logger.info(`Total Opportunities: ${opportunities.length}`);
    logger.money(`Total Potential Profit: $${totalProfit.toFixed(2)}`);
    logger.money(`Total Required Capital: $${totalCost.toFixed(2)}`);
    logger.success(`Average ROI: ${avgROI.toFixed(2)}%`);
    logger.success(`Best ROI: ${opportunities[0]?.roi.toFixed(2)}%`);
    logger.success(`Worst ROI: ${opportunities[opportunities.length - 1]?.roi.toFixed(2)}%`);
    logger.log('');
  } else {
    logger.warn('No market simple arbitrage opportunities found.\n');
  }
};

export const displayEventRangeArbitrageResults = (opportunities: EventRangeArbitrageOpportunity[]) => {
  logger.log('\n\n');
  logger.header('╔════════════════════════════════════════════════════════════════╗');
  logger.header('║               EVENT RANGE ARBITRAGE RESULTS                    ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');
  logger.info(`Total Opportunities Found: ${opportunities.length}\n`);
  if (opportunities.length > 0) {
    logger.header('═'.repeat(70));
    logger.header('OPPORTUNITIES:');
    logger.header('═'.repeat(70));
    logger.log('');
    opportunities.forEach((opp, index) => {
      logger.highlight(`${index + 1}. ${opp.eventTitle}`);
      logger.info(`   Event ID: ${opp.eventId}`);
      logger.info(`   Slug: ${opp.eventSlug}`);
      logger.info(`   URL: https://polymarket.com/event/${opp.eventSlug}`);
      logger.info(`   Markets (${opp.markets.length}):`);
      opp.markets.forEach((market, idx) => {
        logger.info(`     ${idx + 1}. ${market.question}`);
        logger.debug(`        Market ID: ${market.marketId}`);
        logger.debug(`        Slug: ${market.slug}`);
        logger.info(`        YES Price: ${(market.yesPrice * 100).toFixed(2)}%`);
      });

      logger.log('\n   Arbitrage Bundles:');
      const normalizedShares = opp.result.normalizedShares || 1;
      if (opp.result.arbitrageBundles && opp.result.arbitrageBundles.length > 0) {
        opp.result.arbitrageBundles.forEach((bundle: any, idx: number) => {
          if (bundle.isArbitrage) {
            logger.info(`\n     Bundle ${idx + 1}:`);
            logger.success(`       ✅ Is Arbitrage: ${bundle.isArbitrage}`);
            logger.money(`       💰 Worst Case Profit: $${bundle.worstCaseProfit.toFixed(2)}`);
            logger.money(`       💵 Total Cost: $${bundle.cost.toFixed(2)} (${normalizedShares.toFixed(2)} shares, min $1/order)`);
            logger.info(`       📊 Min Payout: $${bundle.minPayout.toFixed(2)}`);
            logger.success(`       📈 ROI: ${((bundle.worstCaseProfit / bundle.cost) * 100).toFixed(2)}%`);
          }
        });
      }

      logger.log('');
    });
  } else {
    logger.warn('No event range arbitrage opportunities found.\n');
  }
};

export const displayTopOpportunities = (eventOpps: EventRangeArbitrageOpportunity[], marketOpps: MarketSimpleArbitrageOpportunity[]) => {
  if (!eventOpps.length && !marketOpps.length) return logger.warn('No opportunities found.\n');
  logger.log('\n\n');
  logger.header('╔════════════════════════════════════════════════════════════════╗');
  logger.header('║                  TOP ARBITRAGE OPPORTUNITIES                   ║');
  logger.header('║                    (Sorted by ROI)                             ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');
  const allOpportunities: TopOpportunity[] = [];

  // Add market simple arbitrage
  marketOpps.forEach((opp) => {
    allOpportunities.push({
      marketId: opp.marketId,
      type: 'MARKET',
      roi: opp.roi,
      profit: opp.guaranteedProfit,
      cost: opp.totalCost,
      question: opp.question,
      bets: [`Buy YES for $${opp.yesPrice.toFixed(2)}`, `Buy NO for $${opp.noPrice.toFixed(2)}`],
      url: `https://polymarket.com/event/${opp.slug}`,
    });
  });

  // Add event range arbitrage
  eventOpps.forEach((opp) => {
    const bestBundle = opp.result.arbitrageBundles.find((b: any) => b.isArbitrage);
    if (bestBundle) {
      const normalizedShares = opp.result.normalizedShares || 1;
      allOpportunities.push({
        type: 'EVENT',
        roi: (bestBundle.worstCaseProfit / bestBundle.cost) * 100,
        profit: bestBundle.worstCaseProfit,
        cost: bestBundle.cost,
        question: opp.eventTitle,
        marketId: opp.markets[0]?.marketId || '',
        bets: opp.markets.map((m) => {
          const orderCost = normalizedShares * m.yesPrice;
          return `Buy YES on "${m.question}" for $${orderCost.toFixed(2)} (${normalizedShares.toFixed(2)} shares @ ${(m.yesPrice * 100).toFixed(2)}%)`;
        }),
        url: `https://polymarket.com/event/${opp.eventSlug}`,
      });
    }
  });

  allOpportunities.sort((a, b) => b.roi - a.roi);
  const topOpportunities = allOpportunities.slice(0, 20);
  logger.log('┌────┬──────────┬──────────┬───────────┬──────────┐');
  logger.log('│ #  │ Type     │ ROI      │ Profit    │ Cost     │');
  logger.log('├────┼──────────┼──────────┼───────────┼──────────┤');
  topOpportunities.forEach((opp, index) => {
    const num = (index + 1).toString().padEnd(2);
    const type = opp.type.padEnd(8);
    const roi = `${opp.roi.toFixed(2)}%`.padEnd(8);
    const profit = `$${opp.profit.toFixed(2)}`.padEnd(9);
    const cost = `$${opp.cost.toFixed(2)}`.padEnd(8);

    logger.log(`│ ${num} │ ${type} │ ${roi} │ ${profit} │ ${cost} │`);
  });
  logger.log('└────┴──────────┴──────────┴───────────┴──────────┘');
  logger.log('');
  logger.header('═'.repeat(70));
  logger.header('DETAILED BETTING INSTRUCTIONS (Top 10):');
  logger.header('═'.repeat(70));
  logger.log('');
  topOpportunities.slice(0, 10).forEach((opp, index) => {
    logger.highlight(`${index + 1}. ${opp.question}`);
    logger.info(`   Type: ${opp.type} | ROI: ${opp.roi.toFixed(2)}% | Profit: $${opp.profit.toFixed(2)} | Cost: $${opp.cost.toFixed(2)}`);
    logger.info(`   URL: ${opp.url}`);
    logger.debug(`   API: https://gamma-api.polymarket.com/markets/${opp.marketId}`);
    logger.log('   Bets to place:');
    opp.bets.forEach((bet, idx) => {
      logger.money(`     ${idx + 1}. ${bet}`);
    });
    logger.log('');
  });

  const totalProfit = allOpportunities.reduce((sum, opp) => sum + opp.profit, 0);
  const totalCost = allOpportunities.reduce((sum, opp) => sum + opp.cost, 0);
  const avgROI = allOpportunities.reduce((sum, opp) => sum + opp.roi, 0) / allOpportunities.length;
  logger.header('═'.repeat(70));
  logger.header('OVERALL SUMMARY:');
  logger.header('═'.repeat(70));
  logger.info(`Total Opportunities: ${allOpportunities.length}`);
  logger.info(`  - Event-based: ${eventOpps.length}`);
  logger.info(`  - Market-based: ${marketOpps.length}`);
  logger.money(`Total Potential Profit: $${totalProfit.toFixed(2)}`);
  logger.money(`Total Required Capital: $${totalCost.toFixed(2)}`);
  logger.success(`Average ROI: ${avgROI.toFixed(2)}%`);
  logger.success(`Best ROI: ${allOpportunities[0]?.roi.toFixed(2)}%`);
  logger.log('');
};
