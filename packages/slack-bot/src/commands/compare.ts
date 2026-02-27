/**
 * /isl compare Command
 * 
 * Compare two versions of ISL verification results.
 */

import type { CommandContext } from './verify.js';
import { buildComparisonBlocks, buildErrorBlocks } from '../views/blocks.js';

// ============================================================================
// Types
// ============================================================================

interface VersionResult {
  version: string;
  timestamp: Date;
  verdict: 'verified' | 'risky' | 'unsafe' | 'unchecked';
  score: number;
  coverage: {
    preconditions: number;
    postconditions: number;
    invariants: number;
    temporal: number;
  };
  errors: number;
  warnings: number;
}

interface ComparisonResult {
  v1: VersionResult;
  v2: VersionResult;
  scoreDelta: number;
  improved: string[];
  regressed: string[];
}

// ============================================================================
// Command Handler
// ============================================================================

export const registerCompareCommand = {
  name: 'compare',
  description: 'Compare two versions of verification results',
  usage: '/isl compare <version1> <version2> [domain]',
  examples: [
    '/isl compare v1.2.0 v1.3.0',
    '/isl compare main feature-branch Auth',
    '/isl compare HEAD HEAD~1',
  ],

  async handler(context: CommandContext): Promise<void> {
    const { args, respond } = context;

    const v1 = args[0];
    const v2 = args[1];
    const domain = args[2];

    if (!v1 || !v2) {
      await respond({
        response_type: 'ephemeral',
        blocks: buildErrorBlocks(
          'Missing versions',
          'Usage: `/isl compare <version1> <version2> [domain]`\n\nExample: `/isl compare v1.2.0 v1.3.0`'
        ),
      });
      return;
    }

    try {
      // Get comparison data
      const comparison = await getComparison(v1, v2, domain);

      await respond({
        response_type: 'in_channel',
        blocks: buildComparisonBlocks(comparison),
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await respond({
        response_type: 'ephemeral',
        blocks: buildErrorBlocks('Comparison failed', message),
      });
    }
  },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get comparison between two versions (placeholder)
 */
async function getComparison(
  v1: string,
  v2: string,
  _domain?: string
): Promise<ComparisonResult> {
  // TODO: Integrate with actual ISL verification service
  // For now, return mock data

  return {
    v1: {
      version: v1,
      timestamp: new Date(Date.now() - 86400000),
      verdict: 'risky',
      score: 78,
      coverage: {
        preconditions: 90,
        postconditions: 70,
        invariants: 85,
        temporal: 65,
      },
      errors: 2,
      warnings: 5,
    },
    v2: {
      version: v2,
      timestamp: new Date(),
      verdict: 'verified',
      score: 94,
      coverage: {
        preconditions: 100,
        postconditions: 92,
        invariants: 100,
        temporal: 85,
      },
      errors: 0,
      warnings: 2,
    },
    scoreDelta: 16,
    improved: [
      'Postcondition coverage: 70% → 92%',
      'Temporal coverage: 65% → 85%',
      'Errors: 2 → 0',
    ],
    regressed: [],
  };
}
