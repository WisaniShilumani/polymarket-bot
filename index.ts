import 'dotenv/config';
import './server';
import { findAndAnalyzeArbitrage } from './services/arbitrage';
import logger from './utils/logger';
import { getAccountCollateralBalance } from './services/polymarket/account-balance';
import { getOpenOrders } from './services/polymarket/orders';
import { loadCacheFromFile } from './services/openai';
import { DEMO_MODE } from './config';
import { sellGoodEventPositions } from './services/order-management/positions-seller';
import { fulfillOutstandingOrders } from './services/order-management/order-fulfiller';
import { cancelStaleIndividualOrders } from './services/order-management/order-canceller';
import { buyCryptoEvents } from './services/crypto-trader/buyer';
import { sellCryptoPositions } from './services/crypto-trader/seller';

logger.info('Starting Polymarket Arbitrage Detection Bot...');

async function main() {
  logger.log('\n\n');
  logger.header('╔════════════════════════════════════════════════════════════════╗');
  logger.header('║           POLYMARKET ARBITRAGE DETECTION BOT                   ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝');

  // Load mutually exclusive cache from file
  loadCacheFromFile();

  let ordersPlaced = false; // Will run indefinitely
  while (!ordersPlaced) {
    const [openOrders, collateralBalance] = await Promise.all([getOpenOrders(), getAccountCollateralBalance()]);
    await fulfillOutstandingOrders(collateralBalance);
    await sellGoodEventPositions();
    await Promise.all([buyCryptoEvents(), sellCryptoPositions(), cancelStaleIndividualOrders()]);
    const totalOpenOrderValue = openOrders.reduce((sum, o) => sum + parseFloat(o.price) * parseFloat(o.original_size), 0);
    const availableCollateral = collateralBalance - totalOpenOrderValue;
    if (availableCollateral <= 2 && !DEMO_MODE) {
      logger.warn('⏳ No available collateral. Scanning again after a few moments...\n');
      await new Promise((resolve) => setTimeout(resolve, 10000));
      continue;
    }
    const result = await findAndAnalyzeArbitrage(availableCollateral);
    if (!result) {
      logger.warn('⏳ No orders placed. Scanning again...\n');
    } else {
      logger.success('✅ Orders placed! Looking for more...\n');
    }
  }
  // await findSentimentalArbitrage();
}

main();
