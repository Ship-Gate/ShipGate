/**
 * /isl status Command
 * 
 * Check the status of ISL verifications.
 */

import type { CommandContext } from './verify.js';
import { buildStatusBlocks } from '../views/blocks.js';

// ============================================================================
// Types
// ============================================================================

interface DomainStatus {
  domain: string;
  lastVerified: Date;
  verdict: 'verified' | 'risky' | 'unsafe' | 'unchecked';
  score: number;
  behaviors: BehaviorStatus[];
}

interface BehaviorStatus {
  name: string;
  verdict: 'verified' | 'risky' | 'unsafe' | 'unchecked';
  score: number;
}

// ============================================================================
// Command Handler
// ============================================================================

export const registerStatusCommand = {
  name: 'status',
  description: 'Check the status of ISL verifications',
  usage: '/isl status [domain]',
  examples: [
    '/isl status',
    '/isl status Auth',
    '/isl status --all',
  ],

  async handler(context: CommandContext): Promise<void> {
    const { args, respond, userId } = context;
    const domain = args[0];

    try {
      if (domain) {
        // Get status for specific domain
        const status = await getDomainStatus(domain);
        
        if (!status) {
          await respond({
            response_type: 'ephemeral',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `❓ No verification data found for domain *${domain}*`,
                },
              },
            ],
          });
          return;
        }

        await respond({
          response_type: 'ephemeral',
          blocks: buildDomainStatusBlocks(status),
        });
      } else {
        // Get overall status
        const statuses = await getAllDomainStatuses();
        
        await respond({
          response_type: 'ephemeral',
          blocks: buildStatusBlocks(statuses),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await respond({
        response_type: 'ephemeral',
        text: `Failed to get status: ${message}`,
      });
    }
  },
};

// ============================================================================
// Helpers
// ============================================================================

function buildDomainStatusBlocks(status: DomainStatus): any[] {
  const verdictEmoji = getVerdictEmoji(status.verdict);
  const lastVerified = formatRelativeTime(status.lastVerified);

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 Status: ${status.domain}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Verdict:*\n${verdictEmoji} ${status.verdict.toUpperCase()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Score:*\n${status.score}/100`,
        },
        {
          type: 'mrkdwn',
          text: `*Last Verified:*\n${lastVerified}`,
        },
        {
          type: 'mrkdwn',
          text: `*Behaviors:*\n${status.behaviors.length}`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  // Add behavior breakdown
  if (status.behaviors.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Behaviors:*',
      },
    });

    const behaviorList = status.behaviors
      .map(b => `${getVerdictEmoji(b.verdict)} *${b.name}*: ${b.score}/100`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: behaviorList,
      },
    });
  }

  return blocks;
}

function getVerdictEmoji(verdict: string): string {
  switch (verdict) {
    case 'verified': return '✅';
    case 'risky': return '⚠️';
    case 'unsafe': return '❌';
    default: return '❔';
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Get status for a specific domain (placeholder)
 */
async function getDomainStatus(domain: string): Promise<DomainStatus | null> {
  // TODO: Integrate with actual ISL verification service
  const mockStatuses: Record<string, DomainStatus> = {
    'Auth': {
      domain: 'Auth',
      lastVerified: new Date(Date.now() - 3600000),
      verdict: 'verified',
      score: 94,
      behaviors: [
        { name: 'Login', verdict: 'verified', score: 98 },
        { name: 'Logout', verdict: 'verified', score: 100 },
        { name: 'Register', verdict: 'risky', score: 85 },
      ],
    },
    'Payment': {
      domain: 'Payment',
      lastVerified: new Date(Date.now() - 7200000),
      verdict: 'risky',
      score: 78,
      behaviors: [
        { name: 'CreatePayment', verdict: 'risky', score: 75 },
        { name: 'RefundPayment', verdict: 'verified', score: 92 },
      ],
    },
  };

  return mockStatuses[domain] || null;
}

/**
 * Get status for all domains (placeholder)
 */
async function getAllDomainStatuses(): Promise<DomainStatus[]> {
  // TODO: Integrate with actual ISL verification service
  return [
    await getDomainStatus('Auth'),
    await getDomainStatus('Payment'),
  ].filter((s): s is DomainStatus => s !== null);
}
