import 'dotenv/config';
import { findAndAnalyzeArbitrage } from './services/arbitrage';
import { findSentimentalArbitrage } from './services/sentimental-arbitrage';

console.log('Starting Polymarket Arbitrage Detection Bot...');

async function main() {
  await findAndAnalyzeArbitrage();
  // await findSentimentalArbitrage();
}

main();
