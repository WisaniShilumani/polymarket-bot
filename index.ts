import 'dotenv/config';
import { findAndAnalyzeArbitrage } from './services/arbitrage';
import logger from './utils/logger';
// import { findSentimentalArbitrage } from './services/sentimental-arbitrage';

logger.info('Starting Polymarket Arbitrage Detection Bot...');

async function main() {
  let ordersPlaced = false;

  while (!ordersPlaced) {
    ordersPlaced = await findAndAnalyzeArbitrage();

    if (!ordersPlaced) {
      logger.warn('\n⏳ No orders placed. Waiting 10 seconds before next scan...\n');
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 60 seconds
    } else {
      logger.success('\n✅ Orders placed! Stopping scan.\n');
    }
  }
  // await findSentimentalArbitrage();
}

main();
