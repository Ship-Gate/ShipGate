/**
 * Block Kit Builders
 * 
 * Build Slack Block Kit UI components for messages.
 */

import { formatScore, formatDuration } from '../utils/format.js';
import { createProgressBar, createComparisonBar } from '../utils/charts.js';

// ============================================================================
// Types
// ============================================================================

interface VerificationResult {
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
}

interface DomainStatus {
  domain: string;
  lastVerified: Date;
  verdict: string;
  score: number;
  behaviors: Array<{
    name: string;
    verdict: string;
    score: number;
  }>;
}

interface ComparisonResult {
  v1: {
    version: string;
    verdict: string;
    score: number;
    coverage: {
      preconditions: number;
      postconditions: number;
      invariants: number;
      temporal: number;
    };
  };
  v2: {
    version: string;
    verdict: string;
    score: number;
    coverage: {
      preconditions: number;
      postconditions: number;
      invariants: number;
      temporal: number;
    };
  };
  scoreDelta: number;
  improved: string[];
  regressed: string[];
}

// ============================================================================
// Verification Result Blocks
// ============================================================================

/**
 * Build blocks for verification result message
 */
export function buildVerificationResultBlocks(
  domain: string,
  behavior: string | undefined,
  result: VerificationResult
): any[] {
  const verdictEmoji = getVerdictEmoji(result.verdict);
  const title = behavior ? `${domain} / ${behavior}` : domain;

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${verdictEmoji} ISL Verification: ${title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Verdict:*\n${verdictEmoji} ${result.verdict.toUpperCase()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Score:*\n${formatScore(result.score)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Errors:*\n${result.errors}`,
        },
        {
          type: 'mrkdwn',
          text: `*Warnings:*\n${result.warnings}`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  // Coverage section
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Coverage:*',
    },
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [
        `Preconditions:  ${createProgressBar(result.coverage.preconditions)} ${result.coverage.preconditions}%`,
        `Postconditions: ${createProgressBar(result.coverage.postconditions)} ${result.coverage.postconditions}%`,
        `Invariants:     ${createProgressBar(result.coverage.invariants)} ${result.coverage.invariants}%`,
        `Temporal:       ${createProgressBar(result.coverage.temporal)} ${result.coverage.temporal}%`,
      ].join('\n'),
    },
  });

  // Context with duration
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `⏱️ Completed in ${formatDuration(result.duration)}`,
      },
    ],
  });

  // Action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '📋 Details',
          emoji: true,
        },
        action_id: 'view_verification_details',
        value: `${domain}:${behavior || 'all'}`,
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '🔄 Re-run',
          emoji: true,
        },
        action_id: 'rerun_verification',
        value: JSON.stringify({ domain, behavior }),
      },
    ],
  });

  return blocks;
}

// ============================================================================
// Status Blocks
// ============================================================================

/**
 * Build blocks for status overview
 */
export function buildStatusBlocks(statuses: DomainStatus[]): any[] {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📊 ISL Verification Status',
        emoji: true,
      },
    },
  ];

  if (statuses.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_No verification data available_',
      },
    });
    return blocks;
  }

  // Summary counts
  const verified = statuses.filter(s => s.verdict === 'verified').length;
  const risky = statuses.filter(s => s.verdict === 'risky').length;
  const unsafe = statuses.filter(s => s.verdict === 'unsafe').length;

  blocks.push({
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*✅ Verified:* ${verified}`,
      },
      {
        type: 'mrkdwn',
        text: `*⚠️ Risky:* ${risky}`,
      },
      {
        type: 'mrkdwn',
        text: `*❌ Unsafe:* ${unsafe}`,
      },
      {
        type: 'mrkdwn',
        text: `*Total:* ${statuses.length}`,
      },
    ],
  });

  blocks.push({ type: 'divider' });

  // Domain list
  for (const status of statuses) {
    const emoji = getVerdictEmoji(status.verdict);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${status.domain}*: ${status.score}/100`,
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Details',
        },
        action_id: 'view_domain_status',
        value: status.domain,
      },
    });
  }

  return blocks;
}

// ============================================================================
// Comparison Blocks
// ============================================================================

/**
 * Build blocks for version comparison
 */
export function buildComparisonBlocks(comparison: ComparisonResult): any[] {
  const { v1, v2, scoreDelta, improved, regressed } = comparison;
  const deltaEmoji = scoreDelta > 0 ? '📈' : scoreDelta < 0 ? '📉' : '➡️';
  const deltaText = scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta.toString();

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${deltaEmoji} Comparison: ${v1.version} → ${v2.version}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*${v1.version}:*\n${getVerdictEmoji(v1.verdict)} ${v1.score}/100`,
        },
        {
          type: 'mrkdwn',
          text: `*${v2.version}:*\n${getVerdictEmoji(v2.verdict)} ${v2.score}/100`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Score Change:* ${deltaText} points`,
      },
    },
    {
      type: 'divider',
    },
  ];

  // Coverage comparison
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Coverage Comparison:*',
    },
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [
        `Preconditions:  ${createComparisonBar(v1.coverage.preconditions, v2.coverage.preconditions)}`,
        `Postconditions: ${createComparisonBar(v1.coverage.postconditions, v2.coverage.postconditions)}`,
        `Invariants:     ${createComparisonBar(v1.coverage.invariants, v2.coverage.invariants)}`,
        `Temporal:       ${createComparisonBar(v1.coverage.temporal, v2.coverage.temporal)}`,
      ].join('\n'),
    },
  });

  // Improvements
  if (improved.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*✅ Improvements:*\n${improved.map(i => `• ${i}`).join('\n')}`,
      },
    });
  }

  // Regressions
  if (regressed.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*❌ Regressions:*\n${regressed.map(r => `• ${r}`).join('\n')}`,
      },
    });
  }

  return blocks;
}

// ============================================================================
// Error Blocks
// ============================================================================

/**
 * Build blocks for error message
 */
export function buildErrorBlocks(title: string, message: string): any[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `❌ *${title}*\n\n${message}`,
      },
    },
  ];
}

// ============================================================================
// Helpers
// ============================================================================

function getVerdictEmoji(verdict: string): string {
  switch (verdict.toLowerCase()) {
    case 'verified': return '✅';
    case 'risky': return '⚠️';
    case 'unsafe': return '❌';
    case 'checked': return '✓';
    default: return '❔';
  }
}
