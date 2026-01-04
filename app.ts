import 'dotenv/config';
import logger from './utils/logger';
import { findSentimentalArbitrage } from './services/sentimental-arbitrage';

logger.info('Starting Polymarket Arbitrage Detection Bot');

async function main() {
  await findSentimentalArbitrage();
  // while (!opportunitiesFound) {
  //   const marketOpportunities = await scanMarketsForSimpleArbitrage({ limit: 500 }, collateralBalance);
  //   displayMarketSimpleArbitrageResults(marketOpportunities);
  //   opportunitiesFound = marketOpportunities.length > 0;
  //   if (!opportunitiesFound) {
  //     logger.warn('\n⏳ No opportunities found. Waiting 3 seconds before next scan...\n');
  //     await new Promise((resolve) => setTimeout(resolve, 3000));
  //   } else {
  //     logger.success('\n✅ Opportunities found! Stopping scan.\n');
  //   }
  // }
  // await findSentimentalArbitrage();
}

main();
