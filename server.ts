import http from 'http';
import logger from './utils/logger';
import { getOrdersReport } from './services/reporting/orders';
import { getTradesReport } from './services/reporting/trades';
import { generateOrdersHTML } from './views/orders';
import { generateTradesHTML } from './views/trades';

// Start HTTP server for Elastic Beanstalk health checks
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  // Health check endpoint - Elastic Beanstalk checks the root path
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      }),
    );
  } else if (req.url === '/orders') {
    getOrdersReport()
      .then((orders) => {
        const html = generateOrdersHTML(orders);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      })
      .catch((error) => {
        logger.error('Error generating orders report:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch orders' }));
      });
  } else if (req.url === '/trades') {
    getTradesReport()
      .then((report) => {
        const html = generateTradesHTML(report);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      })
      .catch((error) => {
        logger.error('Error generating trades report:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch trades' }));
      });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  logger.info(`Health check server listening on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
