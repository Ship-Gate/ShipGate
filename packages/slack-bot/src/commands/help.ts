/**
 * /isl help Command
 * 
 * Display help information for ISL bot commands.
 */

import type { CommandContext } from './verify.js';

// ============================================================================
// Command Handler
// ============================================================================

export const registerHelpCommand = {
  name: 'help',
  description: 'Display help information',
  usage: '/isl help [command]',
  examples: [
    '/isl help',
    '/isl help verify',
  ],

  async handler(context: CommandContext): Promise<void> {
    const { args, respond } = context;
    const command = args[0]?.toLowerCase();

    if (command) {
      // Show help for specific command
      const commandHelp = getCommandHelp(command);
      await respond({
        response_type: 'ephemeral',
        blocks: commandHelp,
      });
    } else {
      // Show general help
      await respond({
        response_type: 'ephemeral',
        blocks: buildHelpBlocks(),
      });
    }
  },
};

// ============================================================================
// Help Builders
// ============================================================================

function buildHelpBlocks(): any[] {
  return [
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
        text: 'The ISL bot helps you verify specifications and track implementation compliance.',
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Available Commands:*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          '`/isl verify <domain> [behavior]`',
          'Run verification on a domain or specific behavior',
          '',
          '`/isl status [domain]`',
          'Check verification status for all domains or a specific one',
          '',
          '`/isl compare <v1> <v2> [domain]`',
          'Compare verification results between two versions',
          '',
          '`/isl help [command]`',
          'Show this help or help for a specific command',
        ].join('\n'),
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Quick Examples:*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          '• `/isl verify Auth Login` - Verify the Login behavior in Auth domain',
          '• `/isl status` - See status of all domains',
          '• `/isl compare main develop` - Compare main vs develop branch',
        ].join('\n'),
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 Use `/isl help <command>` for detailed help on any command',
        },
      ],
    },
  ];
}

function getCommandHelp(command: string): any[] {
  const helpContent: Record<string, any[]> = {
    verify: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔬 /isl verify',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Run ISL verification on a domain and optionally a specific behavior.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Usage:*\n`/isl verify <domain> [behavior] [flags]`',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*Arguments:*',
            '• `<domain>` - Required. The domain to verify (e.g., Auth, Payment)',
            '• `[behavior]` - Optional. Specific behavior to verify (e.g., Login)',
            '',
            '*Flags:*',
            '• `--all` / `-a` - Verify all behaviors in the domain',
            '• `--verbose` / `-v` - Show detailed output',
          ].join('\n'),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*Examples:*',
            '```',
            '/isl verify Auth',
            '/isl verify Auth Login',
            '/isl verify Payment --all',
            '```',
          ].join('\n'),
        },
      },
    ],

    status: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 /isl status',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Check the verification status of your ISL domains.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Usage:*\n`/isl status [domain]`',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*Arguments:*',
            '• `[domain]` - Optional. Show status for a specific domain',
            '',
            '*Without arguments:*',
            'Shows a summary of all domains and their verification status.',
          ].join('\n'),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*Examples:*',
            '```',
            '/isl status',
            '/isl status Auth',
            '```',
          ].join('\n'),
        },
      },
    ],

    compare: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📈 /isl compare',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Compare verification results between two versions.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Usage:*\n`/isl compare <version1> <version2> [domain]`',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*Arguments:*',
            '• `<version1>` - First version (older)',
            '• `<version2>` - Second version (newer)',
            '• `[domain]` - Optional. Compare specific domain only',
            '',
            '*Version formats:*',
            '• Semantic versions: `v1.2.0`, `v1.3.0`',
            '• Git refs: `main`, `develop`, `HEAD~1`',
            '• Commit SHAs: `abc1234`',
          ].join('\n'),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*Examples:*',
            '```',
            '/isl compare v1.2.0 v1.3.0',
            '/isl compare main feature-branch',
            '/isl compare HEAD HEAD~1 Auth',
            '```',
          ].join('\n'),
        },
      },
    ],
  };

  return helpContent[command] || [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `❓ Unknown command: \`${command}\`\n\nUse \`/isl help\` to see all available commands.`,
      },
    },
  ];
}
