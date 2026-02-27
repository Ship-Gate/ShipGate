/**
 * Tests for ISL Slack Bot
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @slack/bolt
vi.mock('@slack/bolt', () => ({
  App: vi.fn().mockImplementation(() => ({
    command: vi.fn(),
    action: vi.fn(),
    view: vi.fn(),
    event: vi.fn(),
    error: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
  })),
  LogLevel: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
  },
}));

import { createApp, type BotConfig } from '../src/app.js';
import {
  formatScore,
  formatVerdict,
  formatDuration,
  formatRelativeTime,
  formatPercentage,
  formatDelta,
  truncate,
  escapeMarkdown,
} from '../src/utils/format.js';
import {
  createProgressBar,
  createEmojiProgressBar,
  createComparisonBar,
  createSparkline,
  createCoverageChart,
  createVerdictDistribution,
} from '../src/utils/charts.js';
import {
  buildVerificationResultBlocks,
  buildStatusBlocks,
  buildComparisonBlocks,
  buildErrorBlocks,
} from '../src/views/blocks.js';

// ============================================================================
// App Tests
// ============================================================================

describe('App', () => {
  const mockConfig: BotConfig = {
    token: 'xoxb-test-token',
    signingSecret: 'test-signing-secret',
    port: 3000,
  };

  describe('createApp', () => {
    it('should create a Slack app with config', () => {
      const app = createApp(mockConfig);
      expect(app).toBeDefined();
    });

    it('should enable socket mode when appToken is provided', () => {
      const configWithAppToken = {
        ...mockConfig,
        appToken: 'xapp-test-token',
      };
      const app = createApp(configWithAppToken);
      expect(app).toBeDefined();
    });
  });
});

// ============================================================================
// Format Utils Tests
// ============================================================================

describe('Format Utils', () => {
  describe('formatScore', () => {
    it('should format high scores with green indicator', () => {
      expect(formatScore(95)).toContain('🟢');
      expect(formatScore(95)).toContain('95/100');
    });

    it('should format medium scores with yellow indicator', () => {
      expect(formatScore(75)).toContain('🟡');
    });

    it('should format low scores with red indicator', () => {
      expect(formatScore(30)).toContain('🔴');
    });
  });

  describe('formatVerdict', () => {
    it('should format verified verdict', () => {
      expect(formatVerdict('verified')).toBe('✅ VERIFIED');
    });

    it('should format risky verdict', () => {
      expect(formatVerdict('risky')).toBe('⚠️ RISKY');
    });

    it('should format unsafe verdict', () => {
      expect(formatVerdict('unsafe')).toBe('❌ UNSAFE');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(2500)).toBe('2.5s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3725000)).toBe('1h 2m');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent times as "just now"', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('should format minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000);
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    });

    it('should format days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage', () => {
      expect(formatPercentage(85.7)).toBe('86%');
    });
  });

  describe('formatDelta', () => {
    it('should format positive delta', () => {
      expect(formatDelta(10)).toContain('+10');
      expect(formatDelta(10)).toContain('📈');
    });

    it('should format negative delta', () => {
      expect(formatDelta(-5)).toContain('-5');
      expect(formatDelta(-5)).toContain('📉');
    });

    it('should format zero delta', () => {
      expect(formatDelta(0)).toContain('0');
      expect(formatDelta(0)).toContain('➡️');
    });
  });

  describe('truncate', () => {
    it('should not truncate short text', () => {
      expect(truncate('short', 10)).toBe('short');
    });

    it('should truncate long text with ellipsis', () => {
      expect(truncate('this is a long text', 10)).toBe('this is...');
    });
  });

  describe('escapeMarkdown', () => {
    it('should escape special characters', () => {
      expect(escapeMarkdown('<script>')).toBe('&lt;script&gt;');
      expect(escapeMarkdown('a & b')).toBe('a &amp; b');
    });
  });
});

// ============================================================================
// Chart Utils Tests
// ============================================================================

describe('Chart Utils', () => {
  describe('createProgressBar', () => {
    it('should create a full progress bar for 100%', () => {
      const bar = createProgressBar(100, { width: 10 });
      expect(bar).toBe('██████████');
    });

    it('should create an empty progress bar for 0%', () => {
      const bar = createProgressBar(0, { width: 10 });
      expect(bar).toBe('░░░░░░░░░░');
    });

    it('should create a half-filled bar for 50%', () => {
      const bar = createProgressBar(50, { width: 10 });
      expect(bar).toBe('█████░░░░░');
    });

    it('should show percentage when enabled', () => {
      const bar = createProgressBar(75, { width: 10, showPercentage: true });
      expect(bar).toContain('75%');
    });
  });

  describe('createEmojiProgressBar', () => {
    it('should use green squares for high values', () => {
      const bar = createEmojiProgressBar(90, 5);
      expect(bar).toContain('🟩');
    });

    it('should use red squares for low values', () => {
      const bar = createEmojiProgressBar(20, 5);
      expect(bar).toContain('🟥');
    });
  });

  describe('createSparkline', () => {
    it('should create sparkline from values', () => {
      const sparkline = createSparkline([0, 50, 100]);
      expect(sparkline.length).toBe(3);
    });

    it('should handle empty array', () => {
      expect(createSparkline([])).toBe('');
    });
  });

  describe('createCoverageChart', () => {
    it('should create coverage chart', () => {
      const chart = createCoverageChart({
        preconditions: 100,
        postconditions: 80,
        invariants: 90,
        temporal: 60,
      });
      
      expect(chart).toContain('Pre:');
      expect(chart).toContain('Post:');
      expect(chart).toContain('Inv:');
      expect(chart).toContain('Temp:');
    });
  });

  describe('createVerdictDistribution', () => {
    it('should create distribution chart', () => {
      const chart = createVerdictDistribution(5, 3, 2);
      
      expect(chart).toContain('🟩');
      expect(chart).toContain('🟨');
      expect(chart).toContain('🟥');
      expect(chart).toContain('50%');
    });

    it('should handle empty data', () => {
      const chart = createVerdictDistribution(0, 0, 0);
      expect(chart).toBe('_No data_');
    });
  });

  describe('createComparisonBar', () => {
    it('should create comparison bar', () => {
      const bar = createComparisonBar(50, 75, 10);
      
      expect(bar).toContain('50%');
      expect(bar).toContain('75%');
      expect(bar).toContain('→');
    });
  });
});

// ============================================================================
// Block Builder Tests
// ============================================================================

describe('Block Builders', () => {
  describe('buildVerificationResultBlocks', () => {
    it('should build blocks for verified result', () => {
      const blocks = buildVerificationResultBlocks('Auth', 'Login', {
        verdict: 'verified',
        score: 94,
        errors: 0,
        warnings: 2,
        coverage: {
          preconditions: 100,
          postconditions: 92,
          invariants: 100,
          temporal: 85,
        },
        duration: 1234,
      });

      expect(blocks).toBeInstanceOf(Array);
      expect(blocks.length).toBeGreaterThan(0);
      
      // Should have header
      const header = blocks.find((b: any) => b.type === 'header');
      expect(header?.text?.text).toContain('Auth');
      expect(header?.text?.text).toContain('Login');
    });

    it('should build blocks without behavior', () => {
      const blocks = buildVerificationResultBlocks('Payment', undefined, {
        verdict: 'risky',
        score: 78,
        errors: 1,
        warnings: 3,
        coverage: {
          preconditions: 90,
          postconditions: 70,
          invariants: 80,
          temporal: 60,
        },
        duration: 2000,
      });

      expect(blocks).toBeInstanceOf(Array);
      const header = blocks.find((b: any) => b.type === 'header');
      expect(header?.text?.text).toContain('Payment');
    });
  });

  describe('buildStatusBlocks', () => {
    it('should build status blocks', () => {
      const blocks = buildStatusBlocks([
        {
          domain: 'Auth',
          lastVerified: new Date(),
          verdict: 'verified',
          score: 94,
          behaviors: [],
        },
        {
          domain: 'Payment',
          lastVerified: new Date(),
          verdict: 'risky',
          score: 78,
          behaviors: [],
        },
      ]);

      expect(blocks).toBeInstanceOf(Array);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('should handle empty status list', () => {
      const blocks = buildStatusBlocks([]);
      
      expect(blocks).toBeInstanceOf(Array);
      const emptyMessage = blocks.find((b: any) => 
        b.text?.text?.includes('No verification data')
      );
      expect(emptyMessage).toBeDefined();
    });
  });

  describe('buildComparisonBlocks', () => {
    it('should build comparison blocks', () => {
      const blocks = buildComparisonBlocks({
        v1: {
          version: 'v1.0.0',
          verdict: 'risky',
          score: 78,
          coverage: {
            preconditions: 90,
            postconditions: 70,
            invariants: 85,
            temporal: 65,
          },
        },
        v2: {
          version: 'v1.1.0',
          verdict: 'verified',
          score: 94,
          coverage: {
            preconditions: 100,
            postconditions: 92,
            invariants: 100,
            temporal: 85,
          },
        },
        scoreDelta: 16,
        improved: ['Postconditions improved'],
        regressed: [],
      });

      expect(blocks).toBeInstanceOf(Array);
      
      const header = blocks.find((b: any) => b.type === 'header');
      expect(header?.text?.text).toContain('v1.0.0');
      expect(header?.text?.text).toContain('v1.1.0');
    });
  });

  describe('buildErrorBlocks', () => {
    it('should build error blocks', () => {
      const blocks = buildErrorBlocks('Test Error', 'This is an error message');

      expect(blocks).toBeInstanceOf(Array);
      expect(blocks[0]?.text?.text).toContain('Test Error');
      expect(blocks[0]?.text?.text).toContain('error message');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration', () => {
  it('should format complete verification result', () => {
    const result = {
      verdict: 'verified' as const,
      score: 94,
      errors: 0,
      warnings: 2,
      coverage: {
        preconditions: 100,
        postconditions: 92,
        invariants: 100,
        temporal: 85,
      },
      duration: 1500,
    };

    // Build blocks
    const blocks = buildVerificationResultBlocks('Auth', 'Login', result);
    expect(blocks.length).toBeGreaterThan(0);

    // Format individual values
    expect(formatScore(result.score)).toContain('94');
    expect(formatVerdict(result.verdict)).toContain('VERIFIED');
    expect(formatDuration(result.duration)).toContain('1.5');

    // Create charts
    const coverageChart = createCoverageChart(result.coverage);
    expect(coverageChart).toContain('Pre:');
    expect(coverageChart).toContain('100%');
  });
});
