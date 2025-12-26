import 'dotenv/config';
import type { Market } from './common/types';
import { buildLatencyArb } from './utils/math/latency-arbitrage/build';
import { checkMutuallyExclusiveArbitrage } from './utils/math/mutually-exclusive';
import { rangeArbitrage } from './utils/math/range-arbitrage';
import { getMarkets } from './services/polymarket';

console.log('Running arbitrage check...');

const markets: Market[] = [
  { marketId: 'trump', yesPrice: 0.55 },
  { marketId: 'biden', yesPrice: 0.48 },
];

const rangeMarkets: Market[] = [
  { marketId: 'btc_lt_90', yesPrice: 0.1 },
  { marketId: 'btc_90_110', yesPrice: 0.5 },
  { marketId: 'btc_gt_110', yesPrice: 0.35 },
];

const latencyMarkets: Market[] = [
  { marketId: 'june_cut', yesPrice: 0.54 },
  { marketId: 'before_july', yesPrice: 0.55 },
];

console.log('\n\n\nMutually Exclusive Arbitrage:');
const mutuallyExclusiveResult = checkMutuallyExclusiveArbitrage(markets);
console.log(mutuallyExclusiveResult);

console.log('\n\n\nRange Arbitrage:');
const rangeResult = rangeArbitrage(rangeMarkets);
console.log(rangeResult);

console.log('\n\n\nLatency Arbitrage:');
const latencyResult = buildLatencyArb(latencyMarkets[0]!, latencyMarkets[1]!);
console.log(latencyResult);

async function main() {
  console.log('\n\n\nPolymarket Markets:');
  const polymarketMarkets = await getMarkets();
  console.log(polymarketMarkets);
}

main();
