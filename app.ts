import 'dotenv/config';
import logger from './utils/logger';
import { scanMarketsForSimpleArbitrage } from './services/arbitrage/market-simple-opportunities';
import { displayMarketSimpleArbitrageResults } from './services/arbitrage/logger';
import { getAccountCollateralBalance } from './services/polymarket/account-balance';
import { sellCryptoPositions } from './services/crypto-trader/seller';
import { getUpcomingPositions } from './services/order-management/upcoming-positions';

logger.info('Starting Polymarket Arbitrage Detection Bot');

async function main() {
  if (Number(1) === 1) {
    await getUpcomingPositions();
    return;
  }
  let opportunitiesFound = false;
  const collateralBalance = await getAccountCollateralBalance();
  while (!opportunitiesFound) {
    const marketOpportunities = await scanMarketsForSimpleArbitrage({ limit: 10 }, collateralBalance);
    displayMarketSimpleArbitrageResults(marketOpportunities);
    opportunitiesFound = marketOpportunities.length > 0;
    if (!opportunitiesFound) {
      logger.warn('\n⏳ No opportunities found. Waiting 3 seconds before next scan...\n');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } else {
      logger.success('\n✅ Opportunities found!\n');
    }
  }
  // await findSentimentalArbitrage();
}

main();
