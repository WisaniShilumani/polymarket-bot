# Queue-Based Order Execution Pattern

## The Problem with Current Implementation

**Current code (lines 94-108):**
```typescript
const promises = events.map(async (event) => {
  // ... opportunity checking ...
  if (opportunity && hasGoodSpreads) {
    opportunities.push(opportunity);
    foundInBatch++;
    logger.success(`✅ Found: ...`);
    const orderPlaced = await executeArbitrageOrders(opportunity, totalOpenOrderValue); // ❌ PROBLEM
    if (orderPlaced) ordersPlaced = true;
  }
});

await Promise.all(promises);
```

**Issues:**
1. ❌ `executeArbitrageOrders` is called **inside** the parallel map
2. ❌ If 3 opportunities are found simultaneously, 3 orders execute in parallel
3. ❌ `totalOpenOrderValue` is stale - it's the value from the START of the batch
4. ❌ Can over-commit capital (3 × $5 = $15, but only have $10)

---

## Correct Pattern: Separate Discovery from Execution

### Phase 1: Parallel Opportunity Discovery (Fast)
Find all opportunities in parallel without executing

### Phase 2: Sequential Order Execution (Safe)
Execute orders one-by-one with balance checking

---

## Implementation

```typescript
/**
 * Scans events for range arbitrage opportunities
 * Returns both opportunities and whether orders were actually placed
 */
export const scanEventsForRangeArbitrage = async (
  options: { limit?: number } = {},
): Promise<{ opportunities: EventRangeArbitrageOpportunity[]; ordersPlaced: boolean }> => {
  const opportunities: EventRangeArbitrageOpportunity[] = [];
  let offset = 0;
  const limit = options.limit || 100;

  logger.header('\n╔════════════════════════════════════════════════════════════════╗');
  logger.header('║           SCANNING EVENTS FOR RANGE ARBITRAGE                  ║');
  logger.header('║        (Buying YES on all vs NO on all markets)                ║');
  logger.header('╚════════════════════════════════════════════════════════════════╝\n');

  let hasMoreEvents = true;
  let ordersPlaced = false;

  while (hasMoreEvents) {
    try {
      logger.progress(`Scanning events ${offset} to ${offset + limit}...`);

      // Fetch data once per batch
      const [events, trades, openOrders] = await Promise.all([
        getEventsFromRest({ offset, limit, closed: false }),
        getTrades(),
        getOpenOrders()
      ]);

      const tradeMarketIds = trades.map((t) => t.market);
      const openOrderMarketIds = openOrders.map((o) => o.market);
      let totalOpenOrderValue = openOrders.reduce(
        (sum, o) => sum + parseFloat(o.price) * parseFloat(o.original_size),
        0
      );
      const existingMarketIds = new Set([...tradeMarketIds, ...openOrderMarketIds]);

      if (events.length === 0) {
        logger.info('No more events to scan.');
        hasMoreEvents = false;
        break;
      }

      // ========================================================================
      // PHASE 1: PARALLEL OPPORTUNITY DISCOVERY (FAST)
      // ========================================================================
      logger.debug(`  🔍 Discovering opportunities in parallel...`);

      // Filter out events with existing trades first (synchronous, fast)
      const eligibleEvents = events.filter(event =>
        !event.markets.some(m => existingMarketIds.has(m.conditionId))
      );

      logger.debug(`  📋 ${eligibleEvents.length}/${events.length} events eligible (no existing positions)`);

      // Process all eligible events in parallel to find opportunities
      const opportunityPromises = eligibleEvents.map(async (event) => {
        try {
          const opportunity = await checkEventForRangeArbitrage(event);

          if (!opportunity) return null;

          // Check spreads
          const hasGoodSpreads = opportunity.markets.every(m => m.spread <= MAX_SPREAD);
          if (!hasGoodSpreads) {
            logger.debug(`  ⏭️  Skipping ${opportunity.eventId}: spread too wide`);
            return null;
          }

          return opportunity;
        } catch (error) {
          logger.error(`  ❌ Error checking event ${event.id}:`, error);
          return null;
        }
      });

      // Wait for all opportunity checks to complete
      const batchOpportunities = (await Promise.all(opportunityPromises))
        .filter(Boolean) as EventRangeArbitrageOpportunity[];

      logger.info(`  💡 Found ${batchOpportunities.length} opportunities in this batch`);

      // ========================================================================
      // PHASE 2: SEQUENTIAL ORDER EXECUTION (SAFE)
      // ========================================================================
      if (batchOpportunities.length > 0) {
        logger.info(`\n  📋 Executing ${batchOpportunities.length} opportunities sequentially...\n`);

        // Optional: Sort by profitability (best opportunities first)
        batchOpportunities.sort((a, b) => {
          const aProfit = a.result.arbitrageBundles[0]?.worstCaseProfit || 0;
          const bProfit = b.result.arbitrageBundles[0]?.worstCaseProfit || 0;
          return bProfit - aProfit;
        });

        // Execute orders ONE AT A TIME with balance checking
        for (let i = 0; i < batchOpportunities.length; i++) {
          const opportunity = batchOpportunities[i];

          logger.highlight(`\n  [${i + 1}/${batchOpportunities.length}] Processing: ${opportunity.eventTitle}`);

          // Execute order with CURRENT balance state
          const orderPlaced = await executeArbitrageOrders(opportunity, totalOpenOrderValue);

          if (orderPlaced) {
            ordersPlaced = true;
            opportunities.push(opportunity);

            // Update balance for next iteration
            // Re-fetch open orders to get accurate balance
            const updatedOrders = await getOpenOrders();
            totalOpenOrderValue = updatedOrders.reduce(
              (sum, o) => sum + parseFloat(o.price) * parseFloat(o.original_size),
              0
            );

            logger.success(`  ✅ Order placed! Updated open order value: $${totalOpenOrderValue.toFixed(2)}`);
          } else {
            logger.warn(`  ⏭️  Order skipped (likely insufficient capital or failed validation)`);
          }

          // Optional: Add small delay between orders to avoid rate limiting
          if (i < batchOpportunities.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          }
        }
      }

      offset += limit;

    } catch (error) {
      logger.error('Error scanning events:', error);
      throw error;
    }
  }

  if (ordersPlaced) {
    logger.success(`\n✅ Scan complete: ${opportunities.length} orders placed successfully!`);
    return { opportunities, ordersPlaced: true };
  }

  return { opportunities, ordersPlaced: false };
};
```

---

## Key Improvements

### 1. **Separate Phases**
```typescript
// PHASE 1: Find opportunities (parallel = fast)
const opportunities = await Promise.all(events.map(checkEvent));

// PHASE 2: Execute orders (sequential = safe)
for (const opp of opportunities) {
  await executeOrder(opp);
  updateBalance(); // ← Critical!
}
```

### 2. **Balance Updates After Each Order**
```typescript
// Execute order
const orderPlaced = await executeArbitrageOrders(opportunity, totalOpenOrderValue);

if (orderPlaced) {
  // Re-fetch balance immediately
  const updatedOrders = await getOpenOrders();
  totalOpenOrderValue = updatedOrders.reduce(...);

  logger.success(`Updated balance: $${totalOpenOrderValue}`);
}
```

**Why this matters:**
- Order 1: Uses $5, balance = $10 → $5 remaining
- Order 2: Sees updated $5 balance, not stale $10
- Order 3: Sees updated balance after order 2

### 3. **Prioritize Best Opportunities**
```typescript
// Sort by profit (best first)
opportunities.sort((a, b) => b.profit - a.profit);

// Execute best opportunities before capital runs out
for (const opp of opportunities) {
  // ...
}
```

If you find 5 opportunities but only have capital for 3, you want to execute the 3 most profitable ones.

### 4. **Error Handling Per Event**
```typescript
const opportunityPromises = eligibleEvents.map(async (event) => {
  try {
    return await checkEventForRangeArbitrage(event);
  } catch (error) {
    logger.error(`Error on event ${event.id}:`, error);
    return null; // Don't let one error kill the whole batch
  }
});
```

If 1 out of 100 events errors, you still process the other 99.

---

## Performance Comparison

### Old Approach (Sequential Everything)
```
Event 1: Check (500ms) → Execute (200ms)
Event 2: Check (500ms) → Execute (200ms)
Event 3: Check (500ms) → Execute (200ms)
Total: 2100ms for 3 opportunities
```

### New Approach (Parallel Discovery + Sequential Execution)
```
Events 1-100: Check in parallel (500ms)
Opportunity 1: Execute (200ms)
Opportunity 2: Execute (200ms)
Opportunity 3: Execute (200ms)
Total: 1100ms for 3 opportunities (47% faster!)
```

---

## Example Execution Log

```
🔍 Scanning events 0 to 100...
  🔍 Discovering opportunities in parallel...
  📋 89/100 events eligible (no existing positions)

  💡 Found 4 opportunities in this batch

  📋 Executing 4 opportunities sequentially...

  [1/4] Processing: XRP Price Range Event
  💰 Executing YES arbitrage on event: XRP Price Range Event for $4.23
  ✅ Order placed! Updated open order value: $4.23

  [2/4] Processing: Election Winner Event
  💰 Executing NO arbitrage on event: Election Winner Event for $3.87
  ✅ Order placed! Updated open order value: $8.10

  [3/4] Processing: Interest Rate Event
  💰 Executing YES arbitrage on event: Interest Rate Event for $2.45
  ⏭️  Order skipped (insufficient capital - need $2.45, have $1.90)

  [4/4] Processing: Sports Match Event
  ⏭️  Order skipped (insufficient capital)

✅ Scan complete: 2 orders placed successfully!
```

---

## Additional Safety Features

### 1. Capital Reservation
```typescript
// Reserve some capital for existing positions
const CAPITAL_RESERVE = 0.2; // 20% reserve
const availableCapital = (accountBalance - totalOpenOrderValue) * (1 - CAPITAL_RESERVE);

if (orderCost > availableCapital) {
  logger.warn(`Insufficient capital (need $${orderCost}, have $${availableCapital})`);
  return false;
}
```

### 2. Rate Limiting
```typescript
// Don't hammer the API
if (i < opportunities.length - 1) {
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

### 3. Order Limit Per Batch
```typescript
const MAX_ORDERS_PER_BATCH = 5;

for (let i = 0; i < Math.min(opportunities.length, MAX_ORDERS_PER_BATCH); i++) {
  // ...
}
```

Prevent placing 50 orders in one batch (risk management).

---

## Testing

### Test Case 1: Multiple Opportunities, Limited Capital
```typescript
// Setup: Account has $10
// Find 5 opportunities: $4, $3, $2.50, $2, $1.50

// Expected behavior:
// Order 1: $4 → Success (balance: $6)
// Order 2: $3 → Success (balance: $3)
// Order 3: $2.50 → Success (balance: $0.50)
// Order 4: $2 → Skip (insufficient capital)
// Order 5: $1.50 → Skip (insufficient capital)

// Result: 3 orders placed, no over-commitment
```

### Test Case 2: Order Failure Mid-Queue
```typescript
// Order 1: Success
// Order 2: Fails (market moved, spreads too wide)
// Order 3: Should still try (don't stop on failure)

// Result: Order 1 and 3 placed, Order 2 skipped
```

---

## Metrics to Track

```typescript
interface ExecutionMetrics {
  opportunitiesFound: number;
  opportunitiesExecuted: number;
  opportunitiesSkipped: {
    insufficientCapital: number;
    validationFailed: number;
    marketMoved: number;
  };
  avgDiscoveryTimeMs: number;  // Time to find opportunities
  avgExecutionTimeMs: number;  // Time to place orders
  totalTimeMs: number;
}
```

This helps you understand:
- How many opportunities you're missing due to capital constraints
- Whether parallel discovery is working (should be ~500ms for 100 events)
- Where the bottlenecks are

---

## Summary

**Key Principle:**
> Fast discovery (parallel) + Safe execution (sequential) = Best of both worlds

**Benefits:**
1. ✅ Find opportunities 10x faster (parallel processing)
2. ✅ Never over-commit capital (sequential execution)
3. ✅ Always use current balance (update after each order)
4. ✅ Execute best opportunities first (sorting)
5. ✅ Resilient to errors (per-event error handling)

**Implementation Time:** 30-60 minutes to refactor existing code

**Expected Impact:**
- 40-50% faster overall (parallel discovery)
- 0% capital over-commitment (sequential execution)
- Better opportunity selection (sorting)
