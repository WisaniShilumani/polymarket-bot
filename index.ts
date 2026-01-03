import 'dotenv/config';
import { findAndAnalyzeArbitrage } from './services/arbitrage';
// import { findSentimentalArbitrage } from './services/sentimental-arbitrage';

console.log('Starting Polymarket Arbitrage Detection Bot...');

async function main() {
  let opportunityFound = false;

  while (!opportunityFound) {
    opportunityFound = await findAndAnalyzeArbitrage();

    if (!opportunityFound) {
      console.log('\n⏳ No opportunities found. Waiting 10 seconds before next scan...\n');
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
    } else {
      console.log('\n✅ Opportunity found! Stopping scan.\n');
    }
  }
  // await findSentimentalArbitrage();
}

main();
