import OpenAI from 'openai';
import { LRUCache } from 'lru-cache';
import logger from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { OPENAI_API_KEY } from '../../config';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const ARBITRAGE_OPPORTUNITIES_FILE_PATH = path.join(process.cwd(), 'ARBITRAGE_OPPORTUNITIES.txt');

// Type definition for arbitrage opportunities
export interface IArbitrageEvent {
  id: number | string;
  title: string;
}

export interface IArbitrageOpportunity {
  arbitrageSummary: string;
  events: IArbitrageEvent[];
}

// LRU cache to store arbitrage opportunities by event ID
// Cache size: 1000 entries
const arbitrageCache = new LRUCache<string, IArbitrageOpportunity[]>({
  max: 1000,
});

/**
 * Loads the arbitrage opportunities cache from ARBITRAGE_OPPORTUNITIES.txt on startup
 */
const loadCacheFromFile = (): void => {
  try {
    if (fs.existsSync(ARBITRAGE_OPPORTUNITIES_FILE_PATH)) {
      const content = fs.readFileSync(ARBITRAGE_OPPORTUNITIES_FILE_PATH, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      let loadedCount = 0;

      for (const line of lines) {
        try {
          const [eventId, ...jsonParts] = line.split(':');
          if (eventId && jsonParts.length > 0) {
            const jsonStr = jsonParts.join(':');
            const opportunities = JSON.parse(jsonStr) as IArbitrageOpportunity[];
            arbitrageCache.set(eventId.trim(), opportunities);
            loadedCount++;
          }
        } catch (parseError) {
          // Skip invalid lines
          continue;
        }
      }

      if (loadedCount > 0) {
        logger.info(`Loaded ${loadedCount} entries from ARBITRAGE_OPPORTUNITIES.txt into cache`);
      }
    }
  } catch (error) {
    logger.error('Error loading ARBITRAGE_OPPORTUNITIES.txt:', error);
  }
};

/**
 * Appends arbitrage opportunities to ARBITRAGE_OPPORTUNITIES.txt
 */
const appendResultToFile = (eventId: string, opportunities: IArbitrageOpportunity[]): void => {
  try {
    const jsonStr = JSON.stringify(opportunities);
    fs.appendFileSync(ARBITRAGE_OPPORTUNITIES_FILE_PATH, `${eventId}:${jsonStr}\n`, 'utf-8');
    logger.debug(`  📝 Recorded ${opportunities.length} opportunities for event ${eventId} in ARBITRAGE_OPPORTUNITIES.txt`);
  } catch (error) {
    logger.error('Error writing to ARBITRAGE_OPPORTUNITIES.txt:', error);
  }
};

// Load cache from file on startup
loadCacheFromFile();

/**
 * Identifies arbitrage opportunities by detecting markets that are effectively betting on
 * the same underlying outcome, where at most one outcome can be true.
 * Results are cached by event ID to save on API tokens.
 *
 * @param events - A string describing the list of events to analyze
 * @param id - The event ID to use as cache key
 * @returns Array of arbitrage opportunities, each containing a summary and grouped events
 */
export const hasArbitrageEvents = async (events: string, id: string): Promise<IArbitrageOpportunity[]> => {
  // Check cache first
  const cachedResult = arbitrageCache.get(id);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  logger.debug(`Cache miss for ID: ${id}. Checking if events have arbitrage opportunities:`);
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `
  # System Prompt: Prediction Market Arbitrage Grouper

- You are an analytical agent that identifies **arbitrage opportunities** in prediction markets by detecting events that are effectively betting on the **same underlying outcome**, where **at most one outcome can be true**.
- You will be given a list of events, each with an id and title of that event.

Your task is to:
- Detect events that resolve against the same real-world event or state.
- Group only those events where the outcomes are **mutually exclusive**.
- Return the result as an array of arrays, where each inner array represents one arbitrage group.

---

## Core Rules

1. **Only return markets that create arbitrage opportunities**
   - If no arbitrage exists, return an empty array.
   - There must be at least two events in each group.

2. **Mutual exclusivity is required**
   - Every group must consist of events where **all outcomes cannot be true at the same time**.

3. **Same underlying event**
   - Events must refer to the same real-world event, entity, or measurement.
   - Slightly different wording or framing is acceptable if the outcome being resolved is the same.

4. **Do not invent events**
   - Only group events that are explicitly provided.

---

## Output Format

Return a JSON object with an "opportunities" array containing IOpportunity objects.

Where 
\`\`\`
interface Result {
  opportunities: IOpportunity[];
}

interface IOpportunity {
arbitrageSummary: string
events: IEvent[];
}

interface IEvent {
  id: number | string;
  title: string;
}
\`\`\`

Example:
{
  "opportunities": [
    { 
      "arbitrageSummary": "US presidency outcome",
      "events": [
        {"id": 1, "title": "Will Trump be elected US president"},
        {"id": 2, "title": "Biden will be elected president"}
      ]
    },
    {
      "arbitrageSummary": "Price of coffee",
      "events": [
        {"id": 1, "title": "The price of coffee will go up?"},
        {"id": 2, "title": "The price of coffee will go down?"} 
      ]
    }
  ]
}

---

## Examples of Markets That Should Be Grouped

- "Trump approval up or down this week?"  
  and  
  "Trump approval rating on January 2?"  
  → Both resolve to the same approval outcome over the same period.

- "Trump will be elected President of the US"  
  and  
  "Biden will be elected President of the US"  
  → Only one can be true.

- "Nvidia will be the largest company by market cap at year-end"  
  and  
  "Nvidia will be the second-largest company by market cap at year-end"  
  → Both cannot be true simultaneously.

---

## Examples of Markets That Should NOT Be Grouped

- "OpenAI will have the best model by May 2026"  
  and  
  "OpenAI will have the best model by June 2026"  
  → Different resolution dates.

- "Nvidia will be the largest company by the end of the year"  
  and  
  "Google will be the second-largest company by the end of the year"  
  → Both can be true at the same time.

- "Russia–Ukraine ceasefire before GTA VI?"  
  and  
  "New Rihanna album before GTA VI?"  
  → Independent events; no shared outcome.
- "1st place in X", "2nd place in X", "3rd place in X", these are not mutually exclusive.
- "Best X in category A", "Best X in category B", "Best X in category C", not mutually exclusive (E.g. NBA Sixth Man of the Year Winner and BA Defensive Player of the Year Winner; or Oscar Best Movie and Oscar Best Actor)
- Unrelated events. E.g. Zelensky out by 2025; Trump out by 2025. These are not the same bet as both can be true at the same time.

The following patterns may appear superficially related but **must NOT be grouped**, as they do **not** create true arbitrage opportunities. These examples are provided to prevent false positives.

---

### 1. Ranked Outcome Sets (1st / 2nd / 3rd / Nth)

**Example:**
- "Highest grossing movie in 2025?"
- "Second highest grossing movie in 2025?"
- "Third highest grossing movie in 2025?"

**Why this is NOT arbitrage:**
- These markets resolve from a **single ordered ranking**.
- Exactly one movie can occupy each rank, but **multiple markets can resolve TRUE simultaneously** (for different movies).
- They are **not mutually exclusive binary outcomes** of the same proposition.
- This is a *partitioned ranking problem*, not an arbitrage setup.

**Rule:**  
Do NOT group markets that represent different ranks, placements, or ordered positions within the same leaderboard.

---

### 2. Threshold vs Numeric Resolution Markets

**Example:**
- "How many people will Trump deport in 2025?"
- "Will Trump deport 750,000 or more people in 2025?"

**Why this is NOT arbitrage:**
- One market resolves to a **numeric value**, the other to a **boolean threshold**.
- Both can resolve TRUE at the same time (e.g. deportations = 900,000).
- These markets are **nested**, not opposing.

**Rule:**  
Do NOT group markets where one outcome logically implies the other without contradiction.

---

### 3. Overlapping Thresholds (≥X vs ≥Y)

**Example:**
- "Will Elon cut the budget by at least 5% in 2025?"
- "Will Elon cut the budget by at least 10% in 2025?"

**Why this is NOT arbitrage:**
- A ≥10% cut implies ≥5% is also TRUE.
- Outcomes are **monotonic**, not exclusive.
- No possible world exists where one is TRUE and the other is necessarily FALSE.

**Rule:**  
Markets with inclusive or hierarchical thresholds are not arbitrage candidates.

---

### 4. Different Stages or Milestones of the Same Process

**Example:**
- "Ukraine election called by...?"
- "Ukraine election held by...?"

**Why this is NOT arbitrage:**
- Calling an election and holding an election are **distinct events**.
- Both can occur within the same timeline.
- These are **sequential**, not contradictory.

**Rule:**  
Do NOT group markets that describe different phases of the same process.

---

### 5. Sub-event vs Superset Event

**Example:**
- "Trump cabinet member out by...?"
- "Will Trump resign by December 31, 2026?"

**Why this is NOT arbitrage:**
- A cabinet member leaving does not contradict Trump staying in office.
- Trump resigning does not preclude a cabinet member leaving earlier.
- Outcomes are **not mutually exclusive**.

**Rule:**  
Markets describing broader and narrower events must not be grouped.

---

### 6. Numeric Outcome vs Threshold Outcome (Revenue, Totals, Counts)

**Example:**
- "How much revenue will the U.S. raise from tariffs in 2025?"
- "Will tariffs generate more than $250B in 2025?"

**Why this is NOT arbitrage:**
- A single numeric outcome can satisfy the threshold.
- Both markets can resolve TRUE.
- This is a **measurement + condition**, not opposing bets.

**Rule:**  
Numeric-resolution markets and threshold markets should not be grouped together.

---

### 7. Attribute Derivations from the Same Winner

**Example:**
- "Super Bowl Champion 2026"
- "Winning Conference"
- "Winning Division"
- "Winning State"

**Why this is NOT arbitrage:**
- All attributes resolve from the **same winning team**.
- Multiple markets will resolve TRUE together.
- These are **derived properties**, not conflicting outcomes.

**Rule:**  
Do NOT group markets where outcomes are attributes of the same entity.

---

### 8. Unrelated or Accidentally Grouped Topics

**Example:**
- "US–Russia military clash by...?"
- "Will Russia capture Lyman by...?"
- "NFL MVP"

**Why this is NOT arbitrage:**
- Markets refer to **entirely unrelated domains**.
- No logical dependency or contradiction exists.

**Rule:**  
Never group markets unless they clearly resolve the same real-world proposition.

---

### 9. Qualification vs Winner Markets

**Example:**
- "Which countries qualify for the 2026 World Cup?"
- "2026 World Cup Winner"

**Why this is NOT arbitrage:**
- Qualification is a prerequisite, not a competing outcome.
- One country can qualify without winning.
- Winner must qualify first.

**Rule:**  
Prerequisites and final outcomes must not be grouped.

---

### 10. Multiple Independent Elections or Awards

**Examples:**
- Senate elections across different states
- NBA MVP vs Conference Champion
- Oscars nominations vs winners
- Different sports awards in the same season

**Why this is NOT arbitrage:**
- These markets resolve **independently**.
- Multiple outcomes can be TRUE simultaneously.
- Shared category or time period does not imply exclusivity.

**Rule:**  
Shared domain ≠ shared outcome.

---

### 11. Same Event, Different Deadlines (Earlier vs Later)

**Example:**
- "NATO Article 5 by March 31?"
- "NATO Article 5 before 2027?"

**Why this is NOT arbitrage:**
- If it happens early, both markets resolve TRUE.
- These are **nested time windows**, not contradictions.

**Rule:**  
Markets with overlapping time horizons are not arbitrage unless deadlines are mutually exclusive.

---

## Summary Exclusion Test

If **any realistic scenario exists** where two markets can both resolve TRUE,  
**they must NOT be grouped**.

Only group markets where:
> One resolving TRUE logically forces the other to resolve FALSE.
---

## Decision Heuristic

Ask yourself:
> If one market resolves TRUE, does that force the other market(s) to resolve FALSE?

Only if the answer is **yes** should the markets be grouped.
`,
      },
      {
        role: 'user',
        content: `Here are the relevant market events:\n\n${events}`,
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
            opportunities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  arbitrageSummary: {
                    type: 'string',
                    description: 'A brief summary describing the arbitrage opportunity',
                  },
                  events: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: {
                          type: ['number', 'string'],
                          description: 'The event ID',
                        },
                        title: {
                          type: 'string',
                          description: 'The event title',
                        },
                      },
                      required: ['id', 'title'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['arbitrageSummary', 'events'],
                additionalProperties: false,
              },
            },
          },
          required: ['opportunities'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  const parsed = JSON.parse(content || '{"opportunities": []}') as {
    opportunities: IArbitrageOpportunity[];
  };

  const opportunities = parsed.opportunities || [];
  arbitrageCache.set(id, opportunities);
  appendResultToFile(id, opportunities);
  return opportunities;
};
