import 'dotenv/config';
import logger from './utils/logger';
import { displayMarketSimpleArbitrageResults } from './services/arbitrage/utils';
import { scanMarketsForSimpleArbitrage } from './services/arbitrage';

logger.info('Starting Polymarket Arbitrage Detection Bot...');

async function main() {
  let opportunitiesFound = false;

  while (!opportunitiesFound) {
    const marketOpportunities = await scanMarketsForSimpleArbitrage({ limit: 5000 });
    displayMarketSimpleArbitrageResults(marketOpportunities);
    console.log({ marketOpportunities });
    opportunitiesFound = marketOpportunities.length > 0;
    if (!opportunitiesFound) {
      logger.warn('\n⏳ No opportunities found. Waiting 3 seconds before next scan...\n');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } else {
      logger.success('\n✅ Opportunities found! Stopping scan.\n');
    }
  }
  // await findSentimentalArbitrage();
}

main();
