/**
 * Modal Definitions
 * 
 * Build Slack modal views for interactive workflows.
 */

// ============================================================================
// Types
// ============================================================================

interface ModalView {
  type: 'modal';
  callback_id?: string;
  private_metadata?: string;
  title: {
    type: 'plain_text';
    text: string;
  };
  submit?: {
    type: 'plain_text';
    text: string;
  };
  close?: {
    type: 'plain_text';
    text: string;
  };
  blocks: any[];
}

// ============================================================================
// Verification Details Modal
// ============================================================================

/**
 * Build modal for viewing verification details
 */
export function buildVerificationDetailsModal(
  domain: string,
  behavior: string | undefined,
  result: {
    verdict: string;
    score: number;
    errors: Array<{ code: string; message: string; file: string; line: number }>;
    warnings: Array<{ code: string; message: string; file: string; line: number }>;
    coverage: {
      preconditions: number;
      postconditions: number;
      invariants: number;
      temporal: number;
    };
  }
): ModalView {
  const title = behavior ? `${domain} / ${behavior}` : domain;

  const blocks: any[] = [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Domain:*\n${domain}`,
        },
        {
          type: 'mrkdwn',
          text: `*Behavior:*\n${behavior || 'All'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Verdict:*\n${result.verdict.toUpperCase()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Score:*\n${result.score}/100`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  // Coverage details
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Coverage Details:*',
    },
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [
        `• Preconditions: ${result.coverage.preconditions}%`,
        `• Postconditions: ${result.coverage.postconditions}%`,
        `• Invariants: ${result.coverage.invariants}%`,
        `• Temporal: ${result.coverage.temporal}%`,
      ].join('\n'),
    },
  });

  // Errors
  if (result.errors.length > 0) {
    blocks.push({
      type: 'divider',
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Errors (${result.errors.length}):*`,
      },
    });

    for (const error of result.errors.slice(0, 5)) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`${error.code}\` at \`${error.file}:${error.line}\`\n${error.message}`,
        },
      });
    }

    if (result.errors.length > 5) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_...and ${result.errors.length - 5} more errors_`,
          },
        ],
      });
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    blocks.push({
      type: 'divider',
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Warnings (${result.warnings.length}):*`,
      },
    });

    for (const warning of result.warnings.slice(0, 3)) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`${warning.code}\` at \`${warning.file}:${warning.line}\`\n${warning.message}`,
        },
      });
    }

    if (result.warnings.length > 3) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_...and ${result.warnings.length - 3} more warnings_`,
          },
        ],
      });
    }
  }

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: `Details: ${title.substring(0, 20)}...`,
    },
    close: {
      type: 'plain_text',
      text: 'Close',
    },
    blocks,
  };
}

// ============================================================================
// Configure Notifications Modal
// ============================================================================

/**
 * Build modal for configuring notifications
 */
export function buildNotificationConfigModal(
  currentConfig: {
    channelId: string;
    notifyOnVerified: boolean;
    notifyOnRisky: boolean;
    notifyOnUnsafe: boolean;
    mentionUsers: string[];
  }
): ModalView {
  return {
    type: 'modal',
    callback_id: 'notification_config_submit',
    title: {
      type: 'plain_text',
      text: 'Notification Settings',
    },
    submit: {
      type: 'plain_text',
      text: 'Save',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'input',
        block_id: 'channel_select',
        element: {
          type: 'channels_select',
          action_id: 'channel',
          initial_channel: currentConfig.channelId || undefined,
          placeholder: {
            type: 'plain_text',
            text: 'Select a channel',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Notification Channel',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Notify on:*',
        },
      },
      {
        type: 'actions',
        block_id: 'notify_options',
        elements: [
          {
            type: 'checkboxes',
            action_id: 'notify_verdicts',
            initial_options: [
              ...(currentConfig.notifyOnVerified ? [{ text: { type: 'plain_text', text: '✅ Verified' }, value: 'verified' }] : []),
              ...(currentConfig.notifyOnRisky ? [{ text: { type: 'plain_text', text: '⚠️ Risky' }, value: 'risky' }] : []),
              ...(currentConfig.notifyOnUnsafe ? [{ text: { type: 'plain_text', text: '❌ Unsafe' }, value: 'unsafe' }] : []),
            ],
            options: [
              { text: { type: 'plain_text', text: '✅ Verified' }, value: 'verified' },
              { text: { type: 'plain_text', text: '⚠️ Risky' }, value: 'risky' },
              { text: { type: 'plain_text', text: '❌ Unsafe' }, value: 'unsafe' },
            ],
          },
        ],
      },
      {
        type: 'input',
        block_id: 'mention_users',
        optional: true,
        element: {
          type: 'multi_users_select',
          action_id: 'users',
          initial_users: currentConfig.mentionUsers || undefined,
          placeholder: {
            type: 'plain_text',
            text: 'Select users to mention on unsafe',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Mention on Unsafe',
        },
      },
    ],
  };
}

// ============================================================================
// Run Verification Modal
// ============================================================================

/**
 * Build modal for running verification
 */
export function buildRunVerificationModal(
  domains: string[]
): ModalView {
  return {
    type: 'modal',
    callback_id: 'run_verification_submit',
    title: {
      type: 'plain_text',
      text: 'Run Verification',
    },
    submit: {
      type: 'plain_text',
      text: 'Run',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'input',
        block_id: 'domain_select',
        element: {
          type: 'static_select',
          action_id: 'domain',
          placeholder: {
            type: 'plain_text',
            text: 'Select a domain',
          },
          options: domains.map(d => ({
            text: { type: 'plain_text', text: d },
            value: d,
          })),
        },
        label: {
          type: 'plain_text',
          text: 'Domain',
        },
      },
      {
        type: 'input',
        block_id: 'behavior_input',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'behavior',
          placeholder: {
            type: 'plain_text',
            text: 'Leave empty to verify all behaviors',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Behavior (optional)',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Options:*',
        },
      },
      {
        type: 'actions',
        block_id: 'options',
        elements: [
          {
            type: 'checkboxes',
            action_id: 'verify_options',
            options: [
              { text: { type: 'plain_text', text: 'Post results to channel' }, value: 'post_to_channel' },
              { text: { type: 'plain_text', text: 'Generate detailed report' }, value: 'detailed_report' },
            ],
          },
        ],
      },
    ],
  };
}

// ============================================================================
// History Modal
// ============================================================================

/**
 * Build modal for viewing verification history
 */
export function buildHistoryModal(
  domain: string,
  history: Array<{
    version: string;
    timestamp: Date;
    verdict: string;
    score: number;
  }>
): ModalView {
  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Domain:* ${domain}`,
      },
    },
    {
      type: 'divider',
    },
  ];

  if (history.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_No verification history available_',
      },
    });
  } else {
    for (const entry of history.slice(0, 10)) {
      const emoji = entry.verdict === 'verified' ? '✅' : entry.verdict === 'risky' ? '⚠️' : '❌';
      const date = entry.timestamp.toLocaleDateString();
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${entry.version}* - ${entry.score}/100\n${date}`,
        },
      });
    }

    if (history.length > 10) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_Showing 10 of ${history.length} entries_`,
          },
        ],
      });
    }
  }

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Verification History',
    },
    close: {
      type: 'plain_text',
      text: 'Close',
    },
    blocks,
  };
}
