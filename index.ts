import 'dotenv/config';
import './server';
import { findAndAnalyzeArbitrage } from './services/arbitrage';
import logger from './utils/logger';
import { getAccountCollateralBalance } from './services/polymarket/account-balance';
import { getOpenOrders } from './services/polymarket/orders';

logger.info('Starting Polymarket Arbitrage Detection Bot...');

async function main() {
  logger.log('\n\n');
  logger.header('╔════════════════════════════════════════════════════════════════╗');
  logger.header('║           POLYMARKET ARBITRAGE DETECTION BOT                   ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝');
  let ordersPlaced = false; // Will run indefinitely
  while (!ordersPlaced) {
    const [openOrders, collateralBalance] = await Promise.all([getOpenOrders(), getAccountCollateralBalance()]);
    const totalOpenOrderValue = openOrders.reduce((sum, o) => sum + parseFloat(o.price) * parseFloat(o.original_size), 0);
    const availableCollateral = collateralBalance - totalOpenOrderValue;
    if (availableCollateral <= 2) {
      logger.warn('⏳ No available collateral. Scanning again after a few moments...\n');
      await new Promise((resolve) => setTimeout(resolve, 10000));
      continue;
    }
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
