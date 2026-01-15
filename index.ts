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
import { buyCryptoEvents } from './services/trader/crypto/buyer';
import { sellCryptoPositions } from './services/trader/crypto/seller';
import { cancelCryptoStaleOrders } from './services/trader/crypto/order-canceller';
import { stopLossSeller } from './services/trader/crypto/stop-loss-seller';
import { MarketSide } from './common/enums';

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
    logger.progress('Starting trading cycle...');
    const collateralBalance = await getAccountCollateralBalance();
    await fulfillOutstandingOrders(collateralBalance);
    await sellGoodEventPositions();
    await Promise.all([buyCryptoEvents(), sellCryptoPositions(), cancelCryptoStaleOrders()]);
    await stopLossSeller();
    await Promise.all([buyCryptoEvents(MarketSide.No), cancelCryptoStaleOrders(MarketSide.No)]);
    await stopLossSeller(MarketSide.No);
    // Temporarily disabled sports orders since it's hard to deal with the 3 market order fulfillment.
    // ================================================================
    // const result = await findAndAnalyzeArbitrage(availableCollateral);
    // if (!result) {
    //   logger.warn('⏳ No orders placed. Scanning again...\n');
    // } else {
    //   logger.success('✅ Orders placed! Looking for more...\n');
    // }
  }
  // await findSentimentalArbitrage();
}

main();
