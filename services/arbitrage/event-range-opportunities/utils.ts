import type { Market, PolymarketMarket } from '../../../common/types';
import logger from '../../../utils/logger';

/**
 * Calculates the minimum shares needed so each order meets the minimum
 * Uses the orderMinSize from the market data
 */
export const calculateNormalizedShares = (markets: Market[], forYesStrategy: boolean, orderMinSize: number): number => {
  const prices = markets.map((m) => (forYesStrategy ? m.yesPrice : 1 - m.yesPrice));
  const minPrice = Math.min(...prices.filter((p) => p > 0));
  if (minPrice <= 0) return orderMinSize;
  const sharesNeeded = 1 / minPrice;
  return Math.max(orderMinSize, Math.ceil(sharesNeeded * 100) / 100);
};

const winRegexPattern = /^will\s+(.+?)\s+(win|be\s+the\s+winner)/i;
const drawRegexPattern = /end in a draw/i;
const winnerTitlePattern = /winner$/i;

export const isObviousMutuallyExclusive = (eventTitle: string, markets: PolymarketMarket[], tags: string[]): boolean => {
  const isSoccerMatch = tags.includes('soccer');
  const isSportsMatch = tags.includes('sports');
  if (isSoccerMatch && (eventTitle.includes(' vs. ') || eventTitle.includes(' vs '))) {
    if (markets.length === 3) {
      const [market1, market2, market3] = markets;
      if (!market1?.question || !market2?.question || !market3?.question) return false;
      const isFirstMarketWinString = winRegexPattern.test(market1.question);
      const isSecondMarketWinString = drawRegexPattern.test(market2.question);
      const isThirdMarketWinString = winRegexPattern.test(market3.question);
      return isFirstMarketWinString && isSecondMarketWinString && isThirdMarketWinString;
    }
  }

  const isOtherSportsMatch = isSportsMatch && !isSoccerMatch;
  if (isOtherSportsMatch && winnerTitlePattern.test(eventTitle)) {
    if (markets.length === 2) {
      const [market1, market2] = markets;
      if (!market1?.question || !market2?.question) return false;
      return market1.question !== market2.question;
    }
  }

  return false;
};

// Patterns for obviously non-exhaustive events (to ignore/skip)
const spreadBettingPattern = /beat .+ by more than \d+\.?\d* (points?|goals?)/i;
const priceThresholdPattern = /\$\w+ (be above|hit|reach|close above|drop below) \$?\d/i;
const priceThresholdPattern2 = /$z.+(above|below|reach).+(on|by)/i;
const floorPricePattern = /floor price .+ (be above|be over|reach) \d/i;
const approvalRatingPattern = /approval rating.+ (be \d+%|or higher|or more)/i;
const vaccineThresholdPattern = /\d+ million (people|Americans).+ (received|have)/i;
const grossRevenuePattern = /gross more than \$?\d+ million/i;
const koTkoPattern = /KO,? TKO/i;
const singleOutcomeWinPattern = /^Will .+ win (the|their|a) .+(Championship|Tournament|Finals|Playoffs|Cup|Award)/i;
const topRankPattern = /be (in the )?top \d+ (most played|games|on)/i;
const thresholdOrMorePattern = /\d+\.?\d*%? or (more|higher)/i;
const countThresholdPattern = /more than \d+.*(cases|people|votes|goals)/i;

/**
 * Identifies events that are obviously NOT mutually exclusive
 * These should be skipped for arbitrage analysis
 *
 * TODO - can include more
 */
export const isObviouslyNonExhaustive = (eventTitle: string, markets: PolymarketMarket[]): boolean => {
  // Single-market events are inherently exhaustive (Yes/No) but not useful for multi-market arbitrage
  if (markets.length === 1) return true;

  // Point/Goal spread betting - "Will X beat Y by more than Z points"
  if (spreadBettingPattern.test(eventTitle)) return true;

  // Price threshold questions - "Will $ETH be above $3,000"
  if (priceThresholdPattern.test(eventTitle) || priceThresholdPattern2.test(eventTitle)) return true;

  // NFT floor price thresholds
  if (floorPricePattern.test(eventTitle)) return true;

  // Approval rating thresholds
  if (approvalRatingPattern.test(eventTitle)) return true;

  // Vaccination thresholds
  if (vaccineThresholdPattern.test(eventTitle)) return true;

  // Box office/revenue thresholds
  if (grossRevenuePattern.test(eventTitle)) return true;

  // KO/TKO specific outcomes (doesn't cover decision wins)
  if (koTkoPattern.test(eventTitle)) return true;

  // Single team/person winning multi-participant events
  if (singleOutcomeWinPattern.test(eventTitle)) return true;

  // "Top X" rankings
  if (topRankPattern.test(eventTitle)) return true;

  // General "X% or more/higher" thresholds
  if (thresholdOrMorePattern.test(eventTitle)) return true;

  // Count thresholds - "more than X cases/people/votes"
  if (countThresholdPattern.test(eventTitle)) return true;

  return false;
};
