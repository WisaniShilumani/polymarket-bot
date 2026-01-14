import 'dotenv/config';
import logger from './utils/logger';
import { scanMarketsForSimpleArbitrage } from './services/arbitrage/market-simple-opportunities';
import { displayMarketSimpleArbitrageResults } from './services/arbitrage/logger';
import { getAccountCollateralBalance } from './services/polymarket/account-balance';
import { evaluateBuySignal } from './services/polymarket/price-history';
import { getOrdersReport } from './services/reporting/orders';
import { stopLossSeller } from './services/trader/crypto/stop-loss-seller';
import { cancelCryptoStaleOrders } from './services/trader/crypto/order-canceller';

logger.info('Starting Polymarket Arbitrage Detection Bot');

async function main() {
  if (Number(1) === 1) {
    // await getUpcomingPositions();
    // await cancelCryptoStaleOrders();
    await cancelCryptoStaleOrders();
    // await getOrdersReport();
    // const info = await evaluateBuySignal('103177127930055330392441373349372732434896433945295434937281341249293735506094');
    // console.log(info);
    // await buyIndicesEvents();
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
