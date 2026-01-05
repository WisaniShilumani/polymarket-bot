// API keys and URLs
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const POLYMARKET_FUNDER = process.env.POLYMARKET_FUNDER || '';
export const POLYMARKET_PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || '';
export const ARBITRAGE_DETECTION_BOT_URL = process.env.ARBITRAGE_DETECTION_BOT_URL || '';
export const POLYMARKET_API_URL = process.env.POLYMARKET_API_URL || 'https://gamma-api.polymarket.com';
export const POLYMARKET_CLOB_URL = process.env.POLYMARKET_CLOB_URL || 'https://clob.polymarket.com';
// Order configuration
export const ORDERS_ENABLED = process.env.ORDERS_ENABLED === 'true';
export const MAX_ORDER_COST = parseFloat(process.env.MAX_ORDER_COST || '5');
export const MIN_ROI_THRESHOLD = parseFloat(process.env.MIN_ROI_THRESHOLD || '1.01');
export const MIN_PROFIT_THRESHOLD = parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.01');
export const DEFAULT_MIN_ORDER_SIZE = parseInt(process.env.DEFAULT_MIN_ORDER_SIZE || '5');
export const EVENT_HOLDINGS = process.env.EVENT_HOLDINGS || '';
export const MAX_SPREAD = 0.04;
