/**
 * Alert Event Handlers
 * 
 * Handle alert notifications for critical ISL events.
 */

import type { App } from '@slack/bolt';

// ============================================================================
// Types
// ============================================================================

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AlertEvent {
  type: 'alert';
  severity: AlertSeverity;
  title: string;
  message: string;
  domain?: string;
  behavior?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

interface AlertConfig {
  channelId: string;
  criticalMentions: string[];
  highMentions: string[];
  enabledSeverities: AlertSeverity[];
}

// ============================================================================
// Event Registration
// ============================================================================

/**
 * Register alert-related event handlers
 */
export function registerAlertEvents(app: App): void {
  // Handle alert acknowledgment action
  app.action('acknowledge_alert', async ({ ack, body, client }) => {
    await ack();

    const actionBody = body as any;
    const alertId = actionBody.actions?.[0]?.value;
    const userId = actionBody.user?.id;

    if (!alertId || !userId) {
      return;
    }

    try {
      // Update the message to show acknowledgment
      if (actionBody.message && actionBody.channel) {
        await client.chat.update({
          channel: actionBody.channel.id,
          ts: actionBody.message.ts,
          blocks: [
            ...actionBody.message.blocks.slice(0, -1), // Remove the action block
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `✅ Acknowledged by <@${userId}> at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|now>`,
                },
              ],
            },
          ],
          text: actionBody.message.text,
        });
      }

      // Log acknowledgment
      console.log(`Alert ${alertId} acknowledged by ${userId}`);

    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  });

  // Handle investigate action
  app.action('investigate_alert', async ({ ack, body, client }) => {
    await ack();

    const actionBody = body as any;
    const alertData = actionBody.actions?.[0]?.value;

    if (!alertData) {
      return;
    }

    try {
      const alert = JSON.parse(alertData);

      // Open investigation modal
      await client.views.open({
        trigger_id: actionBody.trigger_id,
        view: buildInvestigationModal(alert),
      });
    } catch (error) {
      console.error('Error opening investigation modal:', error);
    }
  });

  // Handle snooze action
  app.action('snooze_alert', async ({ ack, body, client }) => {
    await ack();

    const actionBody = body as any;
    const alertId = actionBody.actions?.[0]?.value;

    if (!alertId) {
      return;
    }

    try {
      // Open snooze options modal
      await client.views.open({
        trigger_id: actionBody.trigger_id,
        view: buildSnoozeModal(alertId),
      });
    } catch (error) {
      console.error('Error opening snooze modal:', error);
    }
  });

  // Handle snooze submission
  app.view('snooze_alert_submit', async ({ ack, view }) => {
    await ack();

    const values = view.state.values;
    const duration = values['snooze_duration']?.['snooze_select']?.selected_option?.value;
    const alertId = view.private_metadata;

    console.log(`Snoozing alert ${alertId} for ${duration}`);
    // TODO: Implement actual snooze logic
  });
}

// ============================================================================
// Alert Functions
// ============================================================================

/**
 * Send an alert notification
 */
export async function sendAlert(
  client: any,
  alert: AlertEvent,
  config: AlertConfig
): Promise<void> {
  // Check if this severity is enabled
  if (!config.enabledSeverities.includes(alert.severity)) {
    return;
  }

  const blocks = buildAlertBlocks(alert);
  
  // Build mention string based on severity
  let mentions = '';
  if (alert.severity === 'critical' && config.criticalMentions.length > 0) {
    mentions = config.criticalMentions.map(u => `<@${u}>`).join(' ') + ' ';
  } else if (alert.severity === 'high' && config.highMentions.length > 0) {
    mentions = config.highMentions.map(u => `<@${u}>`).join(' ') + ' ';
  }

  const text = `${mentions}${getSeverityEmoji(alert.severity)} ${alert.title}`;

  try {
    await client.chat.postMessage({
      channel: config.channelId,
      blocks,
      text,
    });
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}

/**
 * Build Block Kit blocks for an alert
 */
function buildAlertBlocks(alert: AlertEvent): any[] {
  const emoji = getSeverityEmoji(alert.severity);

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${alert.severity.toUpperCase()}: ${alert.title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: alert.message,
      },
    },
  ];

  // Add domain/behavior context if present
  if (alert.domain || alert.behavior) {
    const context = [];
    if (alert.domain) context.push(`*Domain:* ${alert.domain}`);
    if (alert.behavior) context.push(`*Behavior:* ${alert.behavior}`);

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: context.join(' | '),
        },
      ],
    });
  }

  // Add details if present
  if (alert.details && Object.keys(alert.details).length > 0) {
    const detailsText = Object.entries(alert.details)
      .map(([key, value]) => `• *${key}:* ${value}`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Details:*\n${detailsText}`,
      },
    });
  }

  // Add timestamp
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `<!date^${Math.floor(alert.timestamp.getTime() / 1000)}^{date_short_pretty} at {time}|${alert.timestamp.toISOString()}>`,
      },
    ],
  });

  // Add action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✅ Acknowledge',
          emoji: true,
        },
        style: 'primary',
        action_id: 'acknowledge_alert',
        value: `alert_${Date.now()}`,
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '🔍 Investigate',
          emoji: true,
        },
        action_id: 'investigate_alert',
        value: JSON.stringify({
          title: alert.title,
          domain: alert.domain,
          behavior: alert.behavior,
        }),
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '⏰ Snooze',
          emoji: true,
        },
        action_id: 'snooze_alert',
        value: `alert_${Date.now()}`,
      },
    ],
  });

  return blocks;
}

/**
 * Build investigation modal
 */
function buildInvestigationModal(alert: any): any {
  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Investigate Alert',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Alert:* ${alert.title}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alert.domain 
            ? `*Domain:* ${alert.domain}${alert.behavior ? ` / ${alert.behavior}` : ''}`
            : '_No domain specified_',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Quick Actions:*',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Logs',
            },
            url: `https://logs.example.com?domain=${alert.domain || ''}`,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Traces',
            },
            url: `https://traces.example.com?domain=${alert.domain || ''}`,
          },
        ],
      },
    ],
  };
}

/**
 * Build snooze modal
 */
function buildSnoozeModal(alertId: string): any {
  return {
    type: 'modal',
    callback_id: 'snooze_alert_submit',
    private_metadata: alertId,
    title: {
      type: 'plain_text',
      text: 'Snooze Alert',
    },
    submit: {
      type: 'plain_text',
      text: 'Snooze',
    },
    blocks: [
      {
        type: 'input',
        block_id: 'snooze_duration',
        element: {
          type: 'static_select',
          action_id: 'snooze_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select duration',
          },
          options: [
            { text: { type: 'plain_text', text: '30 minutes' }, value: '30m' },
            { text: { type: 'plain_text', text: '1 hour' }, value: '1h' },
            { text: { type: 'plain_text', text: '4 hours' }, value: '4h' },
            { text: { type: 'plain_text', text: '24 hours' }, value: '24h' },
            { text: { type: 'plain_text', text: '1 week' }, value: '1w' },
          ],
        },
        label: {
          type: 'plain_text',
          text: 'Snooze for',
        },
      },
    ],
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getSeverityEmoji(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high': return '🔴';
    case 'medium': return '🟠';
    case 'low': return '🟡';
    default: return '⚪';
  }
}

