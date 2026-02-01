/**
 * Slack Bolt App Setup
 * 
 * Configures the Slack Bolt app with all commands and event handlers.
 */

import { App, LogLevel } from '@slack/bolt';

import { registerVerifyCommand } from './commands/verify.js';
import { registerStatusCommand } from './commands/status.js';
import { registerCompareCommand } from './commands/compare.js';
import { registerHelpCommand } from './commands/help.js';
import { registerVerificationEvents } from './events/verification.js';
import { registerAlertEvents } from './events/alert.js';

// ============================================================================
// Types
// ============================================================================

export interface BotConfig {
  /** Slack bot token (xoxb-...) */
  token: string;
  /** Slack signing secret */
  signingSecret: string;
  /** Slack app-level token for Socket Mode (xapp-...) */
  appToken?: string;
  /** HTTP port for the bot */
  port: number;
  /** Log level */
  logLevel?: LogLevel;
}

// ============================================================================
// App Factory
// ============================================================================

/**
 * Create and configure the Slack Bolt app
 */
export function createApp(config: BotConfig): App {
  const app = new App({
    token: config.token,
    signingSecret: config.signingSecret,
    appToken: config.appToken,
    socketMode: !!config.appToken,
    logLevel: config.logLevel ?? LogLevel.INFO,
  });

  // Register all commands
  registerCommands(app);

  // Register event handlers
  registerEvents(app);

  // Register global error handler
  app.error(async (error) => {
    console.error('Slack app error:', error);
  });

  return app;
}

/**
 * Start the Slack app
 */
export async function startApp(app: App, port: number): Promise<void> {
  await app.start(port);
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Register all slash commands
 */
function registerCommands(app: App): void {
  // Main /isl command router
  app.command('/isl', async ({ command, ack, respond, client }) => {
    await ack();

    const args = command.text.trim().split(/\s+/);
    const subcommand = args[0]?.toLowerCase() || 'help';
    const subArgs = args.slice(1);

    const context = {
      command,
      respond,
      client,
      args: subArgs,
      userId: command.user_id,
      channelId: command.channel_id,
    };

    switch (subcommand) {
      case 'verify':
        await registerVerifyCommand.handler(context);
        break;
      case 'status':
        await registerStatusCommand.handler(context);
        break;
      case 'compare':
        await registerCompareCommand.handler(context);
        break;
      case 'help':
      default:
        await registerHelpCommand.handler(context);
        break;
    }
  });
}

/**
 * Register event handlers
 */
function registerEvents(app: App): void {
  registerVerificationEvents(app);
  registerAlertEvents(app);

  // Handle app_home_opened event
  app.event('app_home_opened', async ({ event, client }) => {
    try {
      await client.views.publish({
        user_id: event.user,
        view: {
          type: 'home',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🔍 ISL Verification Bot',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Welcome to the ISL Verification Bot! Use `/isl help` to see available commands.',
              },
            },
            {
              type: 'divider',
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Quick Commands:*\n• `/isl verify <domain> <behavior>` - Run verification\n• `/isl status` - Check verification status\n• `/isl compare <v1> <v2>` - Compare versions',
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('Error publishing home view:', error);
    }
  });
}
