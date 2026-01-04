import 'dotenv/config';
import './server';
import { findAndAnalyzeArbitrage } from './services/arbitrage';
import logger from './utils/logger';

logger.info('Starting Polymarket Arbitrage Detection Bot...');

async function main() {
  let ordersPlaced = false; // Will run indefinitely
  while (!ordersPlaced) {
    const result = await findAndAnalyzeArbitrage();
    if (!result) {
      logger.warn('\n⏳ No orders placed. Waiting 3 seconds before next scan...\n');
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds
    } else {
      logger.success('\n✅ Orders placed! Stopping scan.\n');
    }
  }
  // await findSentimentalArbitrage();
}

main();
