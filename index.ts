import 'dotenv/config';
import './server';
import { findAndAnalyzeArbitrage } from './services/arbitrage';
import logger from './utils/logger';

logger.info('Starting Polymarket Arbitrage Detection Bot...');

async function main() {
  logger.log('\n\n');
  logger.header('╔════════════════════════════════════════════════════════════════╗');
  logger.header('║           POLYMARKET ARBITRAGE DETECTION BOT                   ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝');
  let ordersPlaced = false; // Will run indefinitely
  while (!ordersPlaced) {
    const result = await findAndAnalyzeArbitrage();
    if (!result) {
      logger.warn('⏳ No orders placed. Scanning again...\n');
    } else {
      logger.success('✅ Orders placed! Looking for more...\n');
    }
  }
  // await findSentimentalArbitrage();
}

main();
