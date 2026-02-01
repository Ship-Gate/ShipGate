/**
 * Intent Marketplace API Entry Point
 * 
 * Starts the Express server for the Intent Marketplace.
 */

import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = createApp({
  corsOrigins: process.env.CORS_ORIGINS?.split(',') ?? '*',
  trustProxy: process.env.TRUST_PROXY === 'true',
});

app.listen(PORT, HOST, () => {
  const logger = {
    info: (msg: string) => process.stdout.write(`[INFO] ${msg}\n`),
  };
  
  logger.info(`Intent Marketplace API running on http://${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

export { createApp };
export * from './services/intent.js';
export * from './services/search.js';
export * from './services/trust.js';
