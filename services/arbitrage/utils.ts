import type { EventRangeArbitrageOpportunity, MarketSimpleArbitrageOpportunity } from '../../common/types';

export const displayMarketSimpleArbitrageResults = (opportunities: MarketSimpleArbitrageOpportunity[]) => {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║             MARKET SIMPLE ARBITRAGE RESULTS                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Total Opportunities Found: ${opportunities.length}\n`);

  if (opportunities.length > 0) {
    // Sort by ROI descending
    opportunities.sort((a, b) => b.roi - a.roi);

    console.log('═'.repeat(70));
    console.log('OPPORTUNITIES (sorted by ROI):');
    console.log('═'.repeat(70));
    console.log('');

    opportunities.forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.question}`);
      console.log(`   Market ID: ${opp.marketId}`);
      console.log(`   Slug: ${opp.slug}`);
      console.log(`   URL: https://polymarket.com/event/${opp.slug}`);
      console.log(`   API: https://gamma-api.polymarket.com/markets/${opp.marketId}`);
      console.log(`   YES Order Cost: $${opp.yesPrice.toFixed(2)}`);
      console.log(`   NO Order Cost:  $${opp.noPrice.toFixed(2)}`);
      console.log(`   ─────────────────────────────────`);
      console.log(`   Total Cost:         $${opp.totalCost.toFixed(2)}`);
      console.log(`   Guaranteed Profit:  $${opp.guaranteedProfit.toFixed(2)}`);
      console.log(`   ROI:                ${opp.roi.toFixed(2)}%`);
      console.log('');
    });

    const totalProfit = opportunities.reduce((sum, opp) => sum + opp.guaranteedProfit, 0);
    const totalCost = opportunities.reduce((sum, opp) => sum + opp.totalCost, 0);
    const avgROI = opportunities.reduce((sum, opp) => sum + opp.roi, 0) / opportunities.length;

    console.log('═'.repeat(70));
    console.log('SUMMARY STATISTICS:');
    console.log('═'.repeat(70));
    console.log(`Total Opportunities: ${opportunities.length}`);
    console.log(`Total Potential Profit: $${totalProfit.toFixed(2)}`);
    console.log(`Total Required Capital: $${totalCost.toFixed(2)}`);
    console.log(`Average ROI: ${avgROI.toFixed(2)}%`);
    console.log(`Best ROI: ${opportunities[0]?.roi.toFixed(2)}%`);
    console.log(`Worst ROI: ${opportunities[opportunities.length - 1]?.roi.toFixed(2)}%`);
    console.log('');
  } else {
    console.log('No market simple arbitrage opportunities found.\n');
  }
};

export const displayEventRangeArbitrageResults = (opportunities: EventRangeArbitrageOpportunity[]) => {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║               EVENT RANGE ARBITRAGE RESULTS                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Total Opportunities Found: ${opportunities.length}\n`);

  if (opportunities.length > 0) {
    console.log('═'.repeat(70));
    console.log('OPPORTUNITIES:');
    console.log('═'.repeat(70));
    console.log('');

    opportunities.forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.eventTitle}`);
      console.log(`   Event ID: ${opp.eventId}`);
      console.log(`   Slug: ${opp.eventSlug}`);
      console.log(`   URL: https://polymarket.com/event/${opp.eventSlug}`);
      console.log(`   Markets (${opp.markets.length}):`);

      opp.markets.forEach((market, idx) => {
        console.log(`     ${idx + 1}. ${market.question}`);
        console.log(`        Market ID: ${market.marketId}`);
        console.log(`        Slug: ${market.slug}`);
        console.log(`        YES Price: ${(market.yesPrice * 100).toFixed(2)}%`);
      });

      console.log('\n   Arbitrage Bundles:');
      const normalizedShares = opp.result.normalizedShares || 1;
      if (opp.result.arbitrageBundles && opp.result.arbitrageBundles.length > 0) {
        opp.result.arbitrageBundles.forEach((bundle: any, idx: number) => {
          if (bundle.isArbitrage) {
            console.log(`\n     Bundle ${idx + 1}:`);
            console.log(`       ✅ Is Arbitrage: ${bundle.isArbitrage}`);
            console.log(`       💰 Worst Case Profit: $${bundle.worstCaseProfit.toFixed(2)}`);
            console.log(
              `       💵 Total Cost: $${bundle.cost.toFixed(2)} (${normalizedShares.toFixed(2)} shares, min $1/order)`,
            );
            console.log(`       📊 Min Payout: $${bundle.minPayout.toFixed(2)}`);
            console.log(`       📈 ROI: ${((bundle.worstCaseProfit / bundle.cost) * 100).toFixed(2)}%`);
          }
        });
      }

      console.log('');
    });
  } else {
    console.log('No event range arbitrage opportunities found.\n');
  }
};

export const displayTopOpportunities = (
  eventOpps: EventRangeArbitrageOpportunity[],
  marketOpps: MarketSimpleArbitrageOpportunity[],
) => {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  TOP ARBITRAGE OPPORTUNITIES                   ║');
  console.log('║                    (Sorted by ROI)                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

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
          return `Buy YES on "${m.question}" for $${orderCost.toFixed(2)} (${normalizedShares.toFixed(2)} shares @ ${(
            m.yesPrice * 100
          ).toFixed(2)}%)`;
        }),
        url: `https://polymarket.com/event/${opp.eventSlug}`,
      });
    }
  });

  // Sort by ROI descending and take top 20
  allOpportunities.sort((a, b) => b.roi - a.roi);
  const topOpportunities = allOpportunities.slice(0, 20);

  // Display table
  console.log('┌────┬──────────┬──────────┬───────────┬──────────┐');
  console.log('│ #  │ Type     │ ROI      │ Profit    │ Cost     │');
  console.log('├────┼──────────┼──────────┼───────────┼──────────┤');

  topOpportunities.forEach((opp, index) => {
    const num = (index + 1).toString().padEnd(2);
    const type = opp.type.padEnd(8);
    const roi = `${opp.roi.toFixed(2)}%`.padEnd(8);
    const profit = `$${opp.profit.toFixed(2)}`.padEnd(9);
    const cost = `$${opp.cost.toFixed(2)}`.padEnd(8);

    console.log(`│ ${num} │ ${type} │ ${roi} │ ${profit} │ ${cost} │`);
  });

  console.log('└────┴──────────┴──────────┴───────────┴──────────┘');
  console.log('');

  // Display detailed betting instructions for top 10
  console.log('═'.repeat(70));
  console.log('DETAILED BETTING INSTRUCTIONS (Top 10):');
  console.log('═'.repeat(70));
  console.log('');

  topOpportunities.slice(0, 10).forEach((opp, index) => {
    console.log(`${index + 1}. ${opp.question}`);
    console.log(
      `   Type: ${opp.type} | ROI: ${opp.roi.toFixed(2)}% | Profit: $${opp.profit.toFixed(
        2,
      )} | Cost: $${opp.cost.toFixed(2)}`,
    );
    console.log(`   URL: ${opp.url}`);
    console.log(`   API: https://gamma-api.polymarket.com/markets/${opp.marketId}`);
    console.log('   Bets to place:');
    opp.bets.forEach((bet, idx) => {
      console.log(`     ${idx + 1}. ${bet}`);
    });
    console.log('');
  });

  // Summary statistics
  const totalProfit = allOpportunities.reduce((sum, opp) => sum + opp.profit, 0);
  const totalCost = allOpportunities.reduce((sum, opp) => sum + opp.cost, 0);
  const avgROI = allOpportunities.reduce((sum, opp) => sum + opp.roi, 0) / allOpportunities.length;

  console.log('═'.repeat(70));
  console.log('OVERALL SUMMARY:');
  console.log('═'.repeat(70));
  console.log(`Total Opportunities: ${allOpportunities.length}`);
  console.log(`  - Event-based: ${eventOpps.length}`);
  console.log(`  - Market-based: ${marketOpps.length}`);
  console.log(`Total Potential Profit: $${totalProfit.toFixed(2)}`);
  console.log(`Total Required Capital: $${totalCost.toFixed(2)}`);
  console.log(`Average ROI: ${avgROI.toFixed(2)}%`);
  console.log(`Best ROI: ${allOpportunities[0]?.roi.toFixed(2)}%`);
  console.log('');
};
