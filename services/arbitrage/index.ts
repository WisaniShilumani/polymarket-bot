import { displayTopOpportunities } from './logger';
import logger from '../../utils/logger';
import { scanEventsForRangeArbitrage } from './event-range-opportunities';

export const findAndAnalyzeArbitrage = async (): Promise<boolean> => {
  logger.log('\n\n');
  logger.header('╔════════════════════════════════════════════════════════════════╗');
  logger.header('║           POLYMARKET ARBITRAGE DETECTION BOT                   ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝');
  const { opportunities: eventOpportunities, ordersPlaced } = await scanEventsForRangeArbitrage({ limit: 500 });
  // const marketOpportunities = await scanMarketsForSimpleArbitrage({ limit: 1000 });
  // displayEventRangeArbitrageResults(eventOpportunities);
  // displayMarketSimpleArbitrageResults(marketOpportunities);
  displayTopOpportunities(eventOpportunities, []);

  // Return true only if orders were actually placed, not just if opportunities were found
  return ordersPlaced;
};
