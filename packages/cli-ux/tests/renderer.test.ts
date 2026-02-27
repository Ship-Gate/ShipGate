/**
 * Renderer Tests
 *
 * Snapshot tests for pretty output rendering.
 */

import { describe, it, expect } from 'vitest';
import {
  render,
  renderBanner,
  renderFailures,
  renderHowToFix,
  renderReproCommands,
  renderBreakdown,
  groupFailures,
  generateReproCommands,
} from '../src/renderer.js';
import {
  passingResult,
  failingResult,
  criticalResult,
  partialResult,
  emptyResult,
  failingClauses,
} from './fixtures.js';

// ─────────────────────────────────────────────────────────────────────────────
// Banner Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('renderBanner', () => {
  it('renders SHIP banner for passing result', () => {
    const output = renderBanner(passingResult, { colors: false });
    expect(output).toContain('SHIP');
    expect(output).toContain('100');
    expect(output).toContain('Production Ready');
    expect(output).toMatchSnapshot();
  });

  it('renders NO_SHIP banner for failing result', () => {
    const output = renderBanner(failingResult, { colors: false });
    expect(output).toContain('NO_SHIP');
    expect(output).toContain('50');
    expect(output).toContain('Not Ready');
    expect(output).toMatchSnapshot();
  });

  it('renders critical issues banner', () => {
    const output = renderBanner(criticalResult, { colors: false });
    expect(output).toContain('NO_SHIP');
    expect(output).toContain('Critical Issues');
    expect(output).toMatchSnapshot();
  });

  it('renders staging recommended banner', () => {
    const output = renderBanner(partialResult, { colors: false });
    expect(output).toContain('NO_SHIP');
    expect(output).toContain('Staging Recommended');
    expect(output).toMatchSnapshot();
  });

  it('renders with custom terminal width', () => {
    const output = renderBanner(passingResult, { colors: false, terminalWidth: 50 });
    expect(output).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Failures Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('renderFailures', () => {
  it('renders empty for passing result', () => {
    const output = renderFailures(passingResult, { colors: false });
    expect(output).toBe('');
  });

  it('renders failures for failing result', () => {
    const output = renderFailures(failingResult, { colors: false });
    expect(output).toContain('Failed Clauses');
    expect(output).toContain('CRITICAL');
    expect(output).toContain('transfer_credits_receiver_balance');
    expect(output).toContain('specs/payment.isl:16:5');
    expect(output).toMatchSnapshot();
  });

  it('renders critical failures', () => {
    const output = renderFailures(criticalResult, { colors: false });
    expect(output).toContain('CRITICAL');
    expect(output).toContain('auth_token_validation');
    expect(output).toContain('password_hashing');
    expect(output).toMatchSnapshot();
  });

  it('respects maxFailures option', () => {
    const output = renderFailures(failingResult, { colors: false, maxFailures: 1 });
    expect(output).toContain('and 2 more failure(s)');
    expect(output).toMatchSnapshot();
  });

  it('shows actual vs expected values', () => {
    const output = renderFailures(failingResult, { colors: false });
    expect(output).toContain('Expected:');
    expect(output).toContain('Actual:');
  });
});

describe('groupFailures', () => {
  it('groups failures by impact level', () => {
    const grouped = groupFailures(failingClauses);
    expect(grouped.critical).toHaveLength(1);
    expect(grouped.high).toHaveLength(1);
    expect(grouped.medium).toHaveLength(1);
    expect(grouped.low).toHaveLength(0);
  });

  it('returns empty groups for passing clauses', () => {
    const grouped = groupFailures([]);
    expect(grouped.critical).toHaveLength(0);
    expect(grouped.high).toHaveLength(0);
    expect(grouped.medium).toHaveLength(0);
    expect(grouped.low).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// How to Fix Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('renderHowToFix', () => {
  it('renders empty for passing result', () => {
    const output = renderHowToFix(passingResult, { colors: false });
    expect(output).toBe('');
  });

  it('renders fix suggestions for failing result', () => {
    const output = renderHowToFix(failingResult, { colors: false });
    expect(output).toContain('How to Fix');
    expect(output).toContain('critical');
    expect(output).toMatchSnapshot();
  });

  it('renders critical fixes for critical result', () => {
    const output = renderHowToFix(criticalResult, { colors: false });
    expect(output).toContain('critical issue(s)');
    expect(output).toMatchSnapshot();
  });

  it('respects showFixes option', () => {
    const output = renderHowToFix(failingResult, { colors: false, showFixes: false });
    expect(output).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Repro Commands Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('generateReproCommands', () => {
  it('generates repro commands for result', () => {
    const commands = generateReproCommands(failingResult);
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.some(c => c.command.includes('isl verify'))).toBe(true);
    expect(commands.some(c => c.command.includes('--detailed'))).toBe(true);
  });

  it('includes filter command for failures', () => {
    const commands = generateReproCommands(failingResult);
    expect(commands.some(c => c.command.includes('--filter'))).toBe(true);
  });

  it('uses custom spec/impl files', () => {
    const commands = generateReproCommands(failingResult, {
      specFile: 'custom/spec.isl',
      implFile: 'custom/impl.ts',
    });
    expect(commands.some(c => c.command.includes('custom/spec.isl'))).toBe(true);
  });
});

describe('renderReproCommands', () => {
  it('renders repro commands section', () => {
    const output = renderReproCommands(failingResult, { colors: false });
    expect(output).toContain('Repro Commands');
    expect(output).toContain('isl verify');
    expect(output).toMatchSnapshot();
  });

  it('respects showRepro option', () => {
    const output = renderReproCommands(failingResult, { colors: false, showRepro: false });
    expect(output).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Breakdown Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('renderBreakdown', () => {
  it('renders category breakdown', () => {
    const output = renderBreakdown(passingResult, { colors: false });
    expect(output).toContain('Category Breakdown');
    expect(output).toContain('Postconditions');
    expect(output).toContain('Invariants');
    expect(output).toMatchSnapshot();
  });

  it('shows scores and pass/fail counts', () => {
    const output = renderBreakdown(failingResult, { colors: false });
    expect(output).toContain('50%');
    expect(output).toContain('1/2');
    expect(output).toMatchSnapshot();
  });

  it('respects showBreakdown option', () => {
    const output = renderBreakdown(failingResult, { colors: false, showBreakdown: false });
    expect(output).toBe('');
  });

  it('handles empty breakdown', () => {
    const output = renderBreakdown(emptyResult, { colors: false });
    // Should render header but no category bars (all totals are 0)
    expect(output).toContain('Category Breakdown');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full Render Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('render', () => {
  it('renders complete output for passing result', () => {
    const output = render(passingResult, { colors: false });
    expect(output).toContain('SHIP');
    expect(output).toContain('Category Breakdown');
    expect(output).toMatchSnapshot();
  });

  it('renders complete output for failing result', () => {
    const output = render(failingResult, { colors: false });
    expect(output).toContain('NO_SHIP');
    expect(output).toContain('Failed Clauses');
    expect(output).toContain('How to Fix');
    expect(output).toContain('Repro Commands');
    expect(output).toMatchSnapshot();
  });

  it('renders complete output for critical result', () => {
    const output = render(criticalResult, { colors: false });
    expect(output).toContain('CRITICAL');
    expect(output).toMatchSnapshot();
  });

  it('renders with all options disabled', () => {
    const output = render(failingResult, {
      colors: false,
      showFixes: false,
      showRepro: false,
      showBreakdown: false,
    });
    expect(output).toContain('NO_SHIP');
    expect(output).toContain('Failed Clauses');
    expect(output).not.toContain('How to Fix');
    expect(output).not.toContain('Repro Commands');
    expect(output).not.toContain('Category Breakdown');
    expect(output).toMatchSnapshot();
  });

  it('renders empty result', () => {
    const output = render(emptyResult, { colors: false });
    expect(output).toContain('SHIP');
    expect(output).toMatchSnapshot();
  });
});
