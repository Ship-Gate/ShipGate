/**
 * Authoritative Gate Tests
 * 
 * Tests for definitive SHIP/NO_SHIP decisions.
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateSignals,
  createSignal,
  createBlockingSignal,
  createFinding,
  makeDecision,
  getSuggestions,
  hashContent,
  generateFingerprint,
  DEFAULT_THRESHOLDS,
  DEV_THRESHOLDS,
  EXIT_CODES,
} from '../src/authoritative/index.js';

import type {
  VerificationSignal,
  AggregatedSignals,
  ThresholdConfig,
} from '../src/authoritative/index.js';

// ============================================================================
// Signal Creation Tests
// ============================================================================

describe('Signal Creation', () => {
  it('creates a basic signal', () => {
    const signal = createSignal('parser', true, 'Parse successful');
    
    expect(signal.source).toBe('parser');
    expect(signal.passed).toBe(true);
    expect(signal.summary).toBe('Parse successful');
    expect(signal.blocking).toBe(false);
    expect(signal.weight).toBe(1);
  });

  it('creates a blocking signal', () => {
    const signal = createBlockingSignal('typechecker', false, 'Type error');
    
    expect(signal.source).toBe('typechecker');
    expect(signal.passed).toBe(false);
    expect(signal.blocking).toBe(true);
  });

  it('creates a finding', () => {
    const finding = createFinding('err-001', 'critical', 'Missing return type', {
      file: 'src/index.ts',
      line: 42,
    });
    
    expect(finding.id).toBe('err-001');
    expect(finding.severity).toBe('critical');
    expect(finding.message).toBe('Missing return type');
    expect(finding.file).toBe('src/index.ts');
    expect(finding.line).toBe(42);
    expect(finding.blocking).toBe(true); // critical = blocking by default
  });

  it('creates non-blocking finding for low severity', () => {
    const finding = createFinding('warn-001', 'low', 'Minor style issue');
    expect(finding.blocking).toBe(false);
  });
});

// ============================================================================
// Signal Aggregation Tests
// ============================================================================

describe('Signal Aggregation', () => {
  it('aggregates passing signals', () => {
    const signals: VerificationSignal[] = [
      createBlockingSignal('parser', true, 'OK', { score: 100 }),
      createBlockingSignal('typechecker', true, 'OK', { score: 100 }),
      createBlockingSignal('verifier', true, 'OK', { score: 95 }),
    ];
    
    const result = aggregateSignals(signals);
    
    expect(result.overallScore).toBeGreaterThanOrEqual(95);
    expect(result.blockingIssues).toHaveLength(0);
    expect(result.findings.critical).toBe(0);
  });

  it('aggregates failing signals', () => {
    const signals: VerificationSignal[] = [
      createBlockingSignal('parser', true, 'OK', { score: 100 }),
      createBlockingSignal('typechecker', false, '2 type errors', {
        score: 0,
        findings: [
          createFinding('t1', 'critical', 'Type mismatch'),
          createFinding('t2', 'critical', 'Missing property'),
        ],
      }),
    ];
    
    const result = aggregateSignals(signals);
    
    expect(result.blockingIssues.length).toBeGreaterThan(0);
    expect(result.findings.critical).toBe(2);
  });

  it('calculates weighted score correctly', () => {
    const signals: VerificationSignal[] = [
      createSignal('parser', true, 'OK', { score: 100, weight: 1 }),
      createSignal('verifier', true, 'OK', { score: 80, weight: 2 }),
    ];
    
    const result = aggregateSignals(signals);
    
    // Weighted: (100*1 + 80*2) / 3 = 260/3 ≈ 87
    expect(result.overallScore).toBeCloseTo(87, 0);
  });

  it('collects blocking issues from failed blocking signals', () => {
    const signals: VerificationSignal[] = [
      createBlockingSignal('security_scan', false, 'Credential leak detected'),
    ];
    
    const result = aggregateSignals(signals);
    
    expect(result.blockingIssues).toContain('[security_scan] Credential leak detected');
  });
});

// ============================================================================
// Decision Engine Tests
// ============================================================================

describe('Decision Engine', () => {
  describe('SHIP decisions', () => {
    it('returns SHIP when all checks pass', () => {
      const aggregation: AggregatedSignals = {
        signals: [createBlockingSignal('verifier', true, 'OK', { score: 90 })],
        overallScore: 90,
        tests: { total: 10, passed: 10, failed: 0, skipped: 0, passRate: 100 },
        findings: { critical: 0, high: 0, medium: 2, low: 5, total: 7 },
        blockingIssues: [],
      };
      
      const decision = makeDecision(aggregation, DEFAULT_THRESHOLDS);
      
      expect(decision.verdict).toBe('SHIP');
      expect(decision.exitCode).toBe(EXIT_CODES.SHIP);
      expect(decision.exitCode).toBe(0);
    });

    it('returns SHIP at exact threshold', () => {
      const aggregation: AggregatedSignals = {
        signals: [],
        overallScore: 80, // Exactly at threshold
        tests: { total: 5, passed: 5, failed: 0, skipped: 0, passRate: 100 },
        findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        blockingIssues: [],
      };
      
      const decision = makeDecision(aggregation, DEFAULT_THRESHOLDS);
      
      expect(decision.verdict).toBe('SHIP');
    });
  });

  describe('NO_SHIP decisions', () => {
    it('returns NO_SHIP for blocking issues', () => {
      const aggregation: AggregatedSignals = {
        signals: [],
        overallScore: 95,
        tests: { total: 10, passed: 10, failed: 0, skipped: 0, passRate: 100 },
        findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        blockingIssues: ['[security_scan] Credential detected'],
      };
      
      const decision = makeDecision(aggregation, DEFAULT_THRESHOLDS);
      
      expect(decision.verdict).toBe('NO_SHIP');
      expect(decision.exitCode).toBe(EXIT_CODES.NO_SHIP);
      expect(decision.exitCode).toBe(1);
    });

    it('returns NO_SHIP for critical findings', () => {
      const aggregation: AggregatedSignals = {
        signals: [],
        overallScore: 90,
        tests: { total: 10, passed: 10, failed: 0, skipped: 0, passRate: 100 },
        findings: { critical: 1, high: 0, medium: 0, low: 0, total: 1 },
        blockingIssues: [],
      };
      
      const decision = makeDecision(aggregation, DEFAULT_THRESHOLDS);
      
      expect(decision.verdict).toBe('NO_SHIP');
      expect(decision.reasons.some(r => r.code === 'CRITICAL_FINDINGS')).toBe(true);
    });

    it('returns NO_SHIP for failed tests', () => {
      const aggregation: AggregatedSignals = {
        signals: [],
        overallScore: 90,
        tests: { total: 10, passed: 9, failed: 1, skipped: 0, passRate: 90 },
        findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        blockingIssues: [],
      };
      
      const decision = makeDecision(aggregation, DEFAULT_THRESHOLDS);
      
      expect(decision.verdict).toBe('NO_SHIP');
      expect(decision.reasons.some(r => r.code === 'TESTS_FAILED')).toBe(true);
    });

    it('returns NO_SHIP for score below threshold', () => {
      const aggregation: AggregatedSignals = {
        signals: [],
        overallScore: 79, // Below 80 threshold
        tests: { total: 10, passed: 10, failed: 0, skipped: 0, passRate: 100 },
        findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        blockingIssues: [],
      };
      
      const decision = makeDecision(aggregation, DEFAULT_THRESHOLDS);
      
      expect(decision.verdict).toBe('NO_SHIP');
      expect(decision.reasons.some(r => r.code === 'SCORE_BELOW_THRESHOLD')).toBe(true);
    });

    it('returns NO_SHIP for skipped tests when not allowed', () => {
      const aggregation: AggregatedSignals = {
        signals: [],
        overallScore: 90,
        tests: { total: 10, passed: 9, failed: 0, skipped: 1, passRate: 90 },
        findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        blockingIssues: [],
      };
      
      const thresholds: ThresholdConfig = { ...DEFAULT_THRESHOLDS, allowSkipped: false };
      const decision = makeDecision(aggregation, thresholds);
      
      expect(decision.verdict).toBe('NO_SHIP');
      expect(decision.reasons.some(r => r.code === 'TESTS_SKIPPED')).toBe(true);
    });

    it('returns NO_SHIP for too many high findings', () => {
      const aggregation: AggregatedSignals = {
        signals: [],
        overallScore: 90,
        tests: { total: 10, passed: 10, failed: 0, skipped: 0, passRate: 100 },
        findings: { critical: 0, high: 3, medium: 0, low: 0, total: 3 },
        blockingIssues: [],
      };
      
      const decision = makeDecision(aggregation, DEFAULT_THRESHOLDS);
      
      expect(decision.verdict).toBe('NO_SHIP');
      expect(decision.reasons.some(r => r.code === 'HIGH_FINDINGS')).toBe(true);
    });
  });

  describe('DEV_THRESHOLDS', () => {
    it('allows skipped tests with dev thresholds', () => {
      const aggregation: AggregatedSignals = {
        signals: [],
        overallScore: 70,
        tests: { total: 10, passed: 8, failed: 0, skipped: 2, passRate: 80 },
        findings: { critical: 0, high: 1, medium: 5, low: 10, total: 16 },
        blockingIssues: [],
      };
      
      const decision = makeDecision(aggregation, DEV_THRESHOLDS);
      
      expect(decision.verdict).toBe('SHIP');
    });
  });
});

// ============================================================================
// Suggestions Tests
// ============================================================================

describe('Suggestions', () => {
  it('suggests fixing blocking issues', () => {
    const aggregation: AggregatedSignals = {
      signals: [],
      overallScore: 90,
      tests: { total: 10, passed: 10, failed: 0, skipped: 0, passRate: 100 },
      findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      blockingIssues: ['issue1', 'issue2'],
    };
    
    const suggestions = getSuggestions(aggregation, DEFAULT_THRESHOLDS);
    
    expect(suggestions.some(s => s.includes('2 blocking'))).toBe(true);
  });

  it('suggests fixing failed tests', () => {
    const aggregation: AggregatedSignals = {
      signals: [],
      overallScore: 90,
      tests: { total: 10, passed: 7, failed: 3, skipped: 0, passRate: 70 },
      findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      blockingIssues: [],
    };
    
    const suggestions = getSuggestions(aggregation, DEFAULT_THRESHOLDS);
    
    expect(suggestions.some(s => s.includes('3 failing'))).toBe(true);
  });

  it('suggests improving score', () => {
    const aggregation: AggregatedSignals = {
      signals: [],
      overallScore: 60,
      tests: { total: 10, passed: 10, failed: 0, skipped: 0, passRate: 100 },
      findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      blockingIssues: [],
    };
    
    const suggestions = getSuggestions(aggregation, DEFAULT_THRESHOLDS);
    
    expect(suggestions.some(s => s.includes('20 points'))).toBe(true);
  });
});

// ============================================================================
// Hash & Fingerprint Tests
// ============================================================================

describe('Hash & Fingerprint', () => {
  it('produces deterministic hashes', () => {
    const content = 'test content';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('produces different hashes for different content', () => {
    const hash1 = hashContent('content1');
    const hash2 = hashContent('content2');
    
    expect(hash1).not.toBe(hash2);
  });

  it('produces deterministic fingerprints', () => {
    const fp1 = generateFingerprint('spec1', 'impl1', 'result1', '1.0.0');
    const fp2 = generateFingerprint('spec1', 'impl1', 'result1', '1.0.0');
    
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(16);
  });

  it('produces different fingerprints for different inputs', () => {
    const fp1 = generateFingerprint('spec1', 'impl1', 'result1', '1.0.0');
    const fp2 = generateFingerprint('spec2', 'impl1', 'result1', '1.0.0');
    
    expect(fp1).not.toBe(fp2);
  });
});

// ============================================================================
// Exit Code Tests
// ============================================================================

describe('Exit Codes', () => {
  it('SHIP exit code is 0', () => {
    expect(EXIT_CODES.SHIP).toBe(0);
  });

  it('NO_SHIP exit code is 1', () => {
    expect(EXIT_CODES.NO_SHIP).toBe(1);
  });
});

// ============================================================================
// Threshold Tests
// ============================================================================

describe('Thresholds', () => {
  it('DEFAULT_THRESHOLDS are strict', () => {
    expect(DEFAULT_THRESHOLDS.minScore).toBe(80);
    expect(DEFAULT_THRESHOLDS.minTestPassRate).toBe(100);
    expect(DEFAULT_THRESHOLDS.maxCriticalFindings).toBe(0);
    expect(DEFAULT_THRESHOLDS.maxHighFindings).toBe(0);
    expect(DEFAULT_THRESHOLDS.allowSkipped).toBe(false);
  });

  it('DEV_THRESHOLDS are relaxed', () => {
    expect(DEV_THRESHOLDS.minScore).toBe(60);
    expect(DEV_THRESHOLDS.minTestPassRate).toBe(80);
    expect(DEV_THRESHOLDS.maxHighFindings).toBe(2);
    expect(DEV_THRESHOLDS.allowSkipped).toBe(true);
  });
});
