/**
 * ISL Slack Bot
 * 
 * Entry point for the Slack bot that provides ISL verification
 * commands and notifications.
 */

import { createApp, startApp, type BotConfig } from './app.js';

export { createApp, startApp, type BotConfig };

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const config: BotConfig = {
    token: process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appToken: process.env.SLACK_APP_TOKEN,
    port: parseInt(process.env.PORT || '3000', 10),
  };

  // Validate required config
  if (!config.token) {
    console.error('Error: SLACK_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!config.signingSecret) {
    console.error('Error: SLACK_SIGNING_SECRET environment variable is required');
    process.exit(1);
  }

  try {
    const app = createApp(config);
    await startApp(app, config.port);
    console.log(`⚡️ ISL Slack Bot is running on port ${config.port}`);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Run if this is the main module
main();
