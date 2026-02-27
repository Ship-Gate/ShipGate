/**
 * Verification Event Handlers
 * 
 * Handle verification completion events and notifications.
 */

import type { App } from '@slack/bolt';
import { buildVerificationResultBlocks } from '../views/blocks.js';

// ============================================================================
// Types
// ============================================================================

export interface VerificationEvent {
  type: 'verification_complete';
  domain: string;
  behavior?: string;
  result: {
    verdict: 'verified' | 'risky' | 'unsafe' | 'unchecked';
    score: number;
    errors: number;
    warnings: number;
    coverage: {
      preconditions: number;
      postconditions: number;
      invariants: number;
      temporal: number;
    };
    duration: number;
  };
  triggeredBy: {
    type: 'user' | 'ci' | 'scheduled';
    id?: string;
  };
  timestamp: Date;
}

interface NotificationConfig {
  channelId: string;
  notifyOnVerified: boolean;
  notifyOnRisky: boolean;
  notifyOnUnsafe: boolean;
  mentionUsers: string[];
}

// ============================================================================
// Event Registration
// ============================================================================

/**
 * Register verification-related event handlers
 */
export function registerVerificationEvents(app: App): void {
  // Handle custom verification_complete event
  // This would be triggered by the ISL verification service
  
  // For now, we'll set up a message action as a placeholder
  app.action('view_verification_details', async ({ ack, body, client }) => {
    await ack();

    // Extract verification ID from action value
    const actionBody = body as any;
    const verificationId = actionBody.actions?.[0]?.value;

    if (!verificationId) {
      return;
    }

    try {
      // Open a modal with verification details
      await client.views.open({
        trigger_id: actionBody.trigger_id,
        view: {
          type: 'modal',
          title: {
            type: 'plain_text',
            text: 'Verification Details',
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Verification ID:* ${verificationId}`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '_Detailed verification data would be shown here._',
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('Error opening verification details modal:', error);
    }
  });

  // Handle rerun verification action
  app.action('rerun_verification', async ({ ack, body, respond }) => {
    await ack();

    const actionBody = body as any;
    const verificationData = actionBody.actions?.[0]?.value;

    if (!verificationData) {
      return;
    }

    try {
      const { domain, behavior } = JSON.parse(verificationData);

      // Send acknowledgment
      if (respond) {
        await respond({
          response_type: 'ephemeral',
          text: `🔄 Re-running verification for ${domain}${behavior ? ` / ${behavior}` : ''}...`,
        });
      }

      // TODO: Trigger actual verification
      console.log(`Rerunning verification for ${domain}/${behavior}`);

    } catch (error) {
      console.error('Error rerunning verification:', error);
    }
  });
}

// ============================================================================
// Notification Functions
// ============================================================================

/**
 * Send verification complete notification to a channel
 */
export async function sendVerificationNotification(
  client: any,
  event: VerificationEvent,
  config: NotificationConfig
): Promise<void> {
  // Check if we should notify for this verdict
  const shouldNotify = 
    (event.result.verdict === 'verified' && config.notifyOnVerified) ||
    (event.result.verdict === 'risky' && config.notifyOnRisky) ||
    (event.result.verdict === 'unsafe' && config.notifyOnUnsafe);

  if (!shouldNotify) {
    return;
  }

  const blocks = buildVerificationResultBlocks(
    event.domain,
    event.behavior,
    event.result
  );

  // Add mentions if configured
  let text = `ISL Verification: ${event.result.verdict} (${event.result.score}/100)`;
  if (config.mentionUsers.length > 0 && event.result.verdict === 'unsafe') {
    const mentions = config.mentionUsers.map(u => `<@${u}>`).join(' ');
    text = `${mentions} ${text}`;
  }

  try {
    await client.chat.postMessage({
      channel: config.channelId,
      blocks,
      text,
    });
  } catch (error) {
    console.error('Failed to send verification notification:', error);
  }
}

/**
 * Send a scheduled verification summary
 */
export async function sendVerificationSummary(
  client: any,
  channelId: string,
  domains: Array<{
    name: string;
    verdict: string;
    score: number;
  }>
): Promise<void> {
  const verifiedCount = domains.filter(d => d.verdict === 'verified').length;
  const riskyCount = domains.filter(d => d.verdict === 'risky').length;
  const unsafeCount = domains.filter(d => d.verdict === 'unsafe').length;

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📋 Daily Verification Summary',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*✅ Verified:* ${verifiedCount}`,
        },
        {
          type: 'mrkdwn',
          text: `*⚠️ Risky:* ${riskyCount}`,
        },
        {
          type: 'mrkdwn',
          text: `*❌ Unsafe:* ${unsafeCount}`,
        },
        {
          type: 'mrkdwn',
          text: `*Total:* ${domains.length}`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  // Add domain list
  const domainList = domains
    .sort((a, b) => a.score - b.score)
    .map(d => {
      const emoji = d.verdict === 'verified' ? '✅' : d.verdict === 'risky' ? '⚠️' : '❌';
      return `${emoji} *${d.name}*: ${d.score}/100`;
    })
    .join('\n');

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: domainList,
    },
  });

  try {
    await client.chat.postMessage({
      channel: channelId,
      blocks,
      text: `Daily Verification Summary: ${verifiedCount} verified, ${riskyCount} risky, ${unsafeCount} unsafe`,
    });
  } catch (error) {
    console.error('Failed to send verification summary:', error);
  }
}
