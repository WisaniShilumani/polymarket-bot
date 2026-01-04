import 'dotenv/config';
import logger from './utils/logger';
import { displayMarketSimpleArbitrageResults } from './services/arbitrage/logger';
import { scanMarketsForSimpleArbitrage } from './services/arbitrage/market-simple-opportunities';
import { getAccountCollateralBalance } from './services/polymarket/account-balance';
import { getTradesForUser } from './services/polymarket/trade-history';

logger.info('Starting Polymarket Arbitrage Detection Bot');

async function main() {
  const trades = await getTradesForUser('0x589222a5124a96765443b97a3498d89ffd824ad2');
  console.log('trades=', trades);
  let opportunitiesFound = false;
  const collateralBalance = await getAccountCollateralBalance();
  while (!opportunitiesFound) {
    const marketOpportunities = await scanMarketsForSimpleArbitrage({ limit: 500 }, collateralBalance);
    displayMarketSimpleArbitrageResults(marketOpportunities);
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
