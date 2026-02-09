// ============================================================================
// Golden Snapshot Tests for Gate Verdict Formatting
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatVerdict,
  formatVerdictCompact,
  formatViolationMessage,
  registerSource,
  clearSourceCache,
  type VerdictResult,
  type VerdictViolation,
} from '../src/index.js';

describe('Verdict Formatting - Golden Snapshots', () => {
  beforeEach(() => {
    clearSourceCache();
  });

  afterEach(() => {
    clearSourceCache();
  });

  // ========================================================================
  // SHIP VERDICTS
  // ========================================================================
  describe('SHIP Verdicts', () => {
    it('formats a clean SHIP verdict', () => {
      const result: VerdictResult = {
        verdict: 'SHIP',
        score: 100,
        summary: 'All 12 postconditions verified',
        violations: [],
        durationMs: 342,
        filesChecked: ['banking.isl', 'auth.isl'],
      };

      expect(formatVerdict(result, { colors: false })).toMatchSnapshot();
    });

    it('formats a SHIP verdict with high score', () => {
      const result: VerdictResult = {
        verdict: 'SHIP',
        score: 97,
        summary: '47 of 48 postconditions verified (1 skipped)',
        violations: [],
        durationMs: 1230,
      };

      expect(formatVerdict(result, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // NO_SHIP VERDICTS
  // ========================================================================
  describe('NO_SHIP Verdicts', () => {
    it('formats a NO_SHIP verdict with security violation', () => {
      const specSource = `domain Auth {\n  version: "1.0.0"\n  behavior Login {\n    security {\n      must "return identical error for wrong email or password"\n    }\n  }\n}`;
      registerSource('login.isl', specSource);

      const result: VerdictResult = {
        verdict: 'NO_SHIP',
        score: 45,
        summary: 'Security policy violated',
        violations: [
          {
            file: 'login.isl',
            specLine: 5,
            rule: 'must "return identical error for wrong email or password"',
            message: 'Error messages differ based on failure reason',
            severity: 'critical',
            blocking: true,
            explanation:
              'Different error messages let attackers enumerate valid email addresses (user existence oracle).',
            fix: 'Return the same 401 status and message for both cases:\nreturn res.status(401).json({ error: "Invalid credentials" })',
          },
        ],
        durationMs: 890,
      };

      expect(formatVerdict(result, { colors: false })).toMatchSnapshot();
    });

    it('formats a NO_SHIP verdict with postcondition failure', () => {
      const specSource = `domain Banking {\n  version: "1.0.0"\n  behavior Transfer {\n    postconditions {\n      sender.balance == old(sender.balance) - amount\n      receiver.balance == old(receiver.balance) + amount\n    }\n  }\n}`;
      registerSource('banking.isl', specSource);

      const result: VerdictResult = {
        verdict: 'NO_SHIP',
        score: 60,
        summary: 'Postcondition violation in Transfer',
        violations: [
          {
            file: 'banking.isl',
            specLine: 5,
            rule: 'sender.balance == old(sender.balance) - amount',
            message: 'Sender balance was not debited after transfer',
            severity: 'critical',
            blocking: true,
            explanation:
              'The sender account balance remained unchanged after the transfer. Money was credited to the receiver but never debited from the sender, creating money from nothing.',
            fix: 'Add sender.balance -= amount before crediting the receiver',
          },
        ],
        durationMs: 456,
      };

      expect(formatVerdict(result, { colors: false })).toMatchSnapshot();
    });

    it('formats a NO_SHIP verdict with multiple violations', () => {
      const result: VerdictResult = {
        verdict: 'NO_SHIP',
        score: 30,
        summary: 'Multiple violations found',
        violations: [
          {
            file: 'payment.isl',
            rule: 'amount > 0',
            message: 'Precondition not enforced: negative amounts accepted',
            severity: 'critical',
            blocking: true,
          },
          {
            file: 'payment.isl',
            rule: 'balance >= 0',
            message: 'Invariant violated: account can go negative',
            severity: 'high',
            blocking: true,
          },
          {
            file: 'payment.isl',
            rule: 'rate_limit 100/minute',
            message: 'Rate limiting not implemented',
            severity: 'medium',
            blocking: false,
          },
        ],
        durationMs: 1500,
      };

      expect(formatVerdict(result, { colors: false })).toMatchSnapshot();
    });

    it('formats a NO_SHIP verdict with invariant violation', () => {
      const specSource = `domain Banking {\n  version: "1.0.0"\n  invariant "non-negative balance" {\n    all a in Account: a.balance >= 0\n  }\n}`;
      registerSource('banking.isl', specSource);

      const result: VerdictResult = {
        verdict: 'NO_SHIP',
        score: 55,
        summary: 'Invariant violated',
        violations: [
          {
            file: 'banking.isl',
            specLine: 4,
            rule: 'all a in Account: a.balance >= 0',
            message: 'Account "acc-123" has balance = -50.00 after Withdraw',
            severity: 'critical',
            blocking: true,
            explanation:
              'The non-negative balance invariant was violated after the Withdraw behavior executed. This means the system allows overdrafts.',
            fix: 'Add precondition to Withdraw: account.balance >= amount',
          },
        ],
        durationMs: 678,
      };

      expect(formatVerdict(result, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // COMPACT FORMAT (CI)
  // ========================================================================
  describe('Compact Format', () => {
    it('formats compact SHIP', () => {
      const result: VerdictResult = {
        verdict: 'SHIP',
        score: 100,
        summary: 'All checks passed',
        violations: [],
      };

      expect(formatVerdictCompact(result, { colors: false })).toMatchSnapshot();
    });

    it('formats compact NO_SHIP', () => {
      const result: VerdictResult = {
        verdict: 'NO_SHIP',
        score: 45,
        summary: 'Security violation',
        violations: [
          {
            file: 'auth.isl',
            rule: 'must hide user existence',
            message: 'User enumeration possible',
            severity: 'critical',
            blocking: true,
          },
          {
            file: 'auth.isl',
            rule: 'rate_limit',
            message: 'Missing rate limit',
            severity: 'high',
            blocking: true,
          },
        ],
      };

      expect(formatVerdictCompact(result, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // SINGLE VIOLATION FORMATTING
  // ========================================================================
  describe('Single Violation', () => {
    it('formats a standalone violation message', () => {
      const violation: VerdictViolation = {
        file: 'auth.isl',
        specLine: 22,
        rule: 'must "return identical error for wrong email or password"',
        message: 'Error messages differ based on failure reason',
        severity: 'critical',
        blocking: true,
        explanation:
          'Different error messages let attackers enumerate valid email addresses.',
        fix: 'Return the same 401 status and message for both cases',
      };

      expect(formatViolationMessage(violation, { colors: false })).toMatchSnapshot();
    });

    it('formats a violation without spec source', () => {
      const violation: VerdictViolation = {
        file: 'payment.isl',
        rule: 'amount > 0',
        message: 'Negative amounts accepted',
        severity: 'high',
        blocking: true,
        fix: 'Add validation: if (amount <= 0) throw new Error("Invalid amount")',
      };

      expect(formatViolationMessage(violation, { colors: false })).toMatchSnapshot();
    });
  });
});
