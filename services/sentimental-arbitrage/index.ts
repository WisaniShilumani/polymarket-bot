import { getEventsFromRest } from '../polymarket';
import type { PolymarketEvent } from '../../common/types';
import logger from '../../utils/logger';

const BATCH_SIZE = 500;

interface EventPayload {
  id: string;
  title: string;
}

interface IEvent {
  id: string;
  question: string;
}

interface IOpportunity {
  arbitrageSummary: string;
  events: IEvent[];
}

interface SentimentalArbitrageResponse {
  output: IOpportunity[];
}

/**
 * Sends events to the sentimental arbitrage detection API in batches
 */
const sendEventsForArbitrageDetection = async (events: EventPayload[]): Promise<IOpportunity[]> => {
  const webhookUrl = process.env.ARBITRAGE_DETECTION_BOT_URL;

  if (!webhookUrl) {
    throw new Error('ARBITRAGE_DETECTION_BOT_URL environment variable is not set');
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      throw new Error(`Arbitrage detection API failed: ${response.status} ${response.statusText}`);
    }

    const result: SentimentalArbitrageResponse = await response.json();
    logger.success(`  ✅ Received ${result.output?.length || 0} arbitrage opportunities from API`);

    return result.output || [];
  } catch (error) {
    logger.error('Error calling sentimental arbitrage API:', error);
    throw error;
  }
};

/**
 * Main function to scan for sentimental arbitrage opportunities
 * Fetches 500 events at a time, sends to API, and continues until 20 opportunities are found
 */
export const findSentimentalArbitrage = async (): Promise<void> => {
  logger.header('\n╔════════════════════════════════════════════════════════════════╗');
  logger.header('║        SCANNING FOR SENTIMENTAL ARBITRAGE OPPORTUNITIES        ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    let offset = 0;
    const limit = BATCH_SIZE; // Fetch 500 events at a time
    const MAX_OPPORTUNITIES = 20;
    let totalScanned = 0;
    let allOpportunities: IOpportunity[] = [];
    let scannedEvents: PolymarketEvent[] = [];

    logger.info(
      `Fetching events from Polymarket and checking for arbitrage (target: ${MAX_OPPORTUNITIES} opportunities)...\n`,
    );

    // Keep fetching and checking until we find 20 opportunities or run out of events
    while (allOpportunities.length < MAX_OPPORTUNITIES) {
      logger.progress(`Fetching events ${offset} to ${offset + limit}...`);

      const events = await getEventsFromRest({ offset, limit, closed: false });

      if (events.length === 0) {
        logger.info('No more events to fetch.\n');
        break;
      }

      totalScanned += events.length;
      scannedEvents.push(...events);

      // Prepare event payloads (only id and title)
      const eventPayloads: EventPayload[] = events.map((event) => ({
        id: event.id,
        title: event.title,
      }));

      logger.info(`  Sending ${eventPayloads.length} events to sentimental arbitrage detector...`);

      // Send to API and check for arbitrage
      const batchOpportunities = await sendEventsForArbitrageDetection(eventPayloads);

      // Add found opportunities to our collection
      if (batchOpportunities.length > 0) {
        allOpportunities.push(...batchOpportunities);
        logger.success(
          `  ✅ Found ${batchOpportunities.length} opportunities in this batch! Total: ${allOpportunities.length}/${MAX_OPPORTUNITIES}`,
        );

        // If we've reached our target, stop
        if (allOpportunities.length >= MAX_OPPORTUNITIES) {
          logger.success(`\n🎯 Reached target of ${MAX_OPPORTUNITIES} opportunities! Stopping scan.\n`);
          // Trim to exactly MAX_OPPORTUNITIES if we exceeded
          allOpportunities = allOpportunities.slice(0, MAX_OPPORTUNITIES);
          break;
        }
      } else {
        logger.info('  No arbitrage found in this batch.');
      }

      logger.info(`  Continuing to next batch...\n`);
      offset += limit;
    }

    const opportunities = allOpportunities;

    // Display results
    logger.header('═'.repeat(70));
    logger.header('SENTIMENTAL ARBITRAGE SCAN COMPLETE');
    logger.header('═'.repeat(70));
    logger.info(`Total Events Scanned: ${totalScanned}`);
    logger.info(`Total Arbitrage Opportunities Found: ${opportunities.length}\n`);

    if (opportunities.length > 0) {
      // Display opportunities in table format
      logger.header('┌────────────────────────────────────────────────────────────────────┐');
      logger.header('│                  ARBITRAGE OPPORTUNITIES                           │');
      logger.header('└────────────────────────────────────────────────────────────────────┘\n');

      opportunities.forEach((opportunity, index) => {
        logger.highlight(`${index + 1}. ARBITRAGE STRATEGY`);
        logger.log('─'.repeat(70));
        logger.info(`Strategy: ${opportunity.arbitrageSummary}`);
        logger.log('');
        logger.log('Markets to bet on:');
        logger.log('─'.repeat(70));

        // Create table header
        const maxQuestionLength = Math.max(...opportunity.events.map((e) => e.question.length), 20);
        const questionCol = maxQuestionLength + 2;

        logger.log(`${'Question'.padEnd(questionCol)} | ${'Market ID'.padEnd(15)}`);
        logger.log('─'.repeat(questionCol + 20));

        // Display each market
        opportunity.events.forEach((event) => {
          const question =
            event.question.length > questionCol - 2
              ? event.question.substring(0, questionCol - 5) + '...'
              : event.question;

          logger.log(`${question.padEnd(questionCol)} | ${event.id.toString().padEnd(15)}`);
        });

        logger.log('');

        // Get full event details for URL
        const eventIds = opportunity.events.map((e) => e.id);
        const fullEvents = scannedEvents.filter((event) => eventIds.includes(event.id));

        if (fullEvents.length > 0) {
          logger.info('Event URLs:');
          fullEvents.forEach((event) => {
            logger.info(`  • https://polymarket.com/event/${event.slug}`);
          });
        }

        logger.log('\n');
      });
    } else {
      logger.warn('No sentimental arbitrage opportunities found.\n');
    }
  } catch (error) {
    logger.error('Error in sentimental arbitrage scan:', error);
    throw error;
  }
};
