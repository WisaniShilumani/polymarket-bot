import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Checks if a list of bets are mutually exclusive using OpenAI.
 * Mutually exclusive means only one of the bets can be true/win at a time.
 *
 * @param bets - A string describing the list of bets to analyze
 * @returns true if the bets are mutually exclusive, false otherwise
 */
export const areBetsMutuallyExclusive = async (bets: string): Promise<boolean> => {
  console.log('Checking if bets are mutually exclusive:');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert at analyzing prediction market bets. Your task is to determine if a set of bets are mutually exclusive.

Mutually exclusive bets are bets where only ONE outcome can be true/win. If one bet wins, all other bets in the set must lose.

Examples of mutually exclusive bets:
- "Will the winner be Team A?", "Will the winner be Team B?", "Will the winner be Team C?" (only one team can win)
- "Will Trump win the US presidency?", "Will Biden win the US presidency?" (only 1 can be true)

Examples of NON-mutually exclusive bets:
- "Will it rain tomorrow?", "Will the temperature exceed 30°C tomorrow?" (both can happen)
- "Will candidate A win the primary?", "Will candidate A win the general election?" (both can be true)
- "Event by February 1st?", "Event by February 2nd?", "Event by February 3rd?" (overlapping events)`,
      },
      {
        role: 'user',
        content: `Are the following bets mutually exclusive?\n\n${bets}`,
      },
    ],
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'mutual_exclusivity_result',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            result: {
              type: 'number',
              enum: [0, 1],
              description: '1 if the bets are mutually exclusive, 0 if they are not',
            },
          },
          required: ['result'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  const parsed = JSON.parse(content || '{"result": 0}') as { result: number };

  return parsed.result === 1;
};
