import got from 'got';

/**
 * Shared got instance with retry and timeout configuration
 */
export const http = got.extend({
  retry: {
    limit: 3,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
  },
  timeout: {
    request: 15000, // 15 seconds
  },
  hooks: {
    beforeRetry: [
      (error, retryCount) => {
        console.warn(`Retrying request (${retryCount}/3): ${error.message}`);
      },
    ],
  },
});
