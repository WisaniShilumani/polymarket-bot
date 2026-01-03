import 'dotenv/config';
import logger from './utils/logger';
import { displayMarketSimpleArbitrageResults } from './services/arbitrage/utils';
import { scanMarketsForSimpleArbitrage } from './services/arbitrage';
import { getAccountCollateralBalance } from './services/polymarket';

logger.info('Starting Polymarket Arbitrage Detection Bot...');

async function main() {
  let opportunitiesFound = false;
  const collateralBalance = await getAccountCollateralBalance();
  console.log({ collateralBalance });
  while (!opportunitiesFound) {
    const marketOpportunities = await scanMarketsForSimpleArbitrage({ limit: 5000 }, collateralBalance);
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
