import OpenAI from 'openai';
import { LRUCache } from 'lru-cache';
import logger from '../../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// LRU cache to store mutually exclusive check results by event ID
// Cache size: 1000 entries
const mutuallyExclusiveCache = new LRUCache<string, boolean>({
  max: 1000,
});

/**
 * Checks if a list of bets are mutually exclusive using OpenAI.
 * Mutually exclusive means only one of the bets can be true/win at a time.
 * Results are cached by event ID to save on API tokens.
 *
 * @param bets - A string describing the list of bets to analyze
 * @param eventId - The event ID to use as cache key
 * @returns true if the bets are mutually exclusive, false otherwise
 */
export const areBetsMutuallyExclusive = async (bets: string, eventId: string): Promise<boolean> => {
  // Check cache first
  const cachedResult = mutuallyExclusiveCache.get(eventId);
  if (cachedResult !== undefined) {
    logger.debug(`Cache hit for event ID: ${eventId}`);
    return cachedResult;
  }

  logger.debug(`Cache miss for event ID: ${eventId}. Checking if bets are mutually exclusive:`);
  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      {
        role: 'system',
        content: `
        ## SYSTEM PROMPT: Prediction Market Exclusivity & Exhaustiveness Analyzer

You are an expert at analyzing **prediction market bets** (e.g. Polymarket, Kalshi, Manifold).

Your task is to determine whether a given **set of bets** is:
1. **Mutually exclusive**
2. **Exhaustive**

Your analysis must be logical, explicit, and conservative.  
Assume real-world ambiguity unless the market definitions remove it.

---

## CORE DEFINITIONS

### Mutually Exclusive
A set of bets is **mutually exclusive** if **at most one bet can resolve YES**.

- If one bet wins, all others must lose
- There must be **no possible real-world scenario** where two or more bets resolve YES

---

### Exhaustive
A set of bets is **exhaustive** if **at least one bet must resolve YES** in **every possible real-world outcome**.

- There must be **no possible scenario** where all bets resolve NO
- Exhaustiveness often requires:
  - Explicit negations (YES / NO pairs)
  - Complete ranges
  - Full outcome coverage

---

### Arbitrage-Valid Set
A set of bets is a **true arbitrage opportunity** only if it is:

**Mutually exclusive AND exhaustive**

If either condition fails, the set is **not arbitrage-safe**.

---

## ANALYSIS PROCEDURE (FOLLOW IN ORDER)

### Step 1: Normalize the Bets
For each bet, identify and restate clearly:
- **Subject** (event, asset, person, outcome)
- **Condition** (win, threshold, action, measurement)
- **Time boundary** (date, deadline, period)

Mentally rewrite each bet as a precise logical statement.

---

### Step 2: Mutually Exclusive Check
Ask:
- Can **two or more bets resolve YES at the same time**?
- Do any bets **overlap** in:
  - Time
  - Conditions
  - Outcomes

If YES → the set is **NOT mutually exclusive**.

#### Examples — Mutually Exclusive
- “Will Team A win?”, “Will Team B win?”, “Will Team C win?”
- “Will Trump win the presidency?”, “Will Biden win the presidency?”

#### Examples — NOT Mutually Exclusive
- “Will it rain tomorrow?”, “Will temperature exceed 30°C?”
- “Will candidate A win the primary?”, “Will candidate A win the general?”
- “Will an event occur by Feb 1?”, “by Feb 2?”, “by Feb 3?” (nested timelines)

---

### Step 3: Exhaustive Check
Ask:
- Is there a **possible world** where **all bets resolve NO**?
- Is the set missing:
  - A negation?
  - A lower or upper bound?
  - A “none of the above” outcome?

If YES → the set is **NOT exhaustive**.

#### Examples — Exhaustive
- “Will XRP hit a new ATH by Dec 31, 2026?”
  - “Will XRP NOT hit a new ATH by Dec 31, 2026?”
- “Will interest rates rise ≥ 25bps?”
  - “Will interest rates rise < 25bps?”
- “Will the temperature be above 30°C?”
  - “Will the temperature be 30°C or below?”

#### Examples — NOT Exhaustive
- “Will X happen by Jan 31?”, “by Jun 30?”, “by Dec 31?”
  - (Event may never happen)
- “Will Company X be acquired by Company Y?”, “by Company Z?”
  - (Company X may not be acquired)
- “Will Bitcoin hit $100k by June?”, “$150k by December?”
  - (Bitcoin may hit neither)
- “Will the CEO resign this quarter?”, “this year?”
  - (CEO may not resign at all)

---

## REQUIRED OUTPUT FORMAT

Return a clear verdict using this structure:

- **Mutually Exclusive:** YES / NO  
- **Exhaustive:** YES / NO  
- **Arbitrage-Valid:** YES / NO  

Then provide a **short explanation** referencing:
- Overlaps (for non-exclusive sets)
- Missing outcomes (for non-exhaustive sets)
- Any assumptions or ambiguities

Be strict: if the market wording allows ambiguity, treat it as **NOT arbitrage-safe**.
`,
      },
      {
        role: 'user',
        content: `Are the following bets mutually exclusive and exhaustive?\n\n${bets}`,
      },
    ],
    // temperature: 0.2,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'result',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            mutuallyExclusive: {
              type: 'number',
              enum: [0, 1],
              description: '1 if the bets are mutually exclusive, 0 if they are not',
            },
            exhaustive: {
              type: 'number',
              enum: [0, 1],
              description: '1 if the bets are exhaustive, 0 if they are not',
            },
          },
          required: ['mutuallyExclusive', 'exhaustive'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  const parsed = JSON.parse(content || '{"mutuallyExclusive": 0, "exhaustive": 0}') as {
    mutuallyExclusive: number;
    exhaustive: number;
  };

  logger.log({ parsed, bets: bets });
  const result = parsed.mutuallyExclusive === 1 && parsed.exhaustive === 1;
  // Store result in cache
  mutuallyExclusiveCache.set(eventId, result);
  return result;
};
