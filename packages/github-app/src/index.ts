/**
 * ISL GitHub App
 * 
 * Main entry point for the GitHub App server.
 */

import express from 'express';
import { createApp } from './app.js';
import { config } from './config.js';

const server = express();

// Create GitHub App instance
const app = createApp({
  appId: config.appId,
  privateKey: config.privateKey,
  webhookSecret: config.webhookSecret,
});

// Mount app routes
server.use('/api', app.router);

// Health check
server.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const port = config.port || 3000;
server.listen(port, () => {
  console.log(`ISL GitHub App listening on port ${port}`);
});

export { app };
