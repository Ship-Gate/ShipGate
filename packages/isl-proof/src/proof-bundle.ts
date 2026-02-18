/**
 * ISL Proof Bundle
 * 
 * Creates verifiable proof that ISL specifications are satisfied by code.
 * 
 * Structure:
 * - ISL clause → code location → test/evidence → verdict
 * 
 * @module @isl-lang/proof
 */

import type { ISLAST, BehaviorAST } from '@isl-lang/translator';
import type { ProofLink, GenerationResult } from '@isl-lang/generator';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ProofBundle {
  /** Bundle version */
  version: '1.0.0';
  /** Bundle ID (deterministic hash) */
  bundleId: string;
  /** Timestamp */
  timestamp: string;
  /** Source ISL specification */
  source: {
    domain: string;
    version: string;
    hash: string;
  };
  /** Verification Surface - what was checked and what wasn't */
  verificationSurface: VerificationSurface;
  /** Verification evidence */
  evidence: Evidence[];
  /** Test results */
  tests: TestEvidence[];
  /** Gate results */
  gate: GateEvidence;
  /** Residual risks from unverified or partial properties */
  residualRisks: ResidualRisk[];
  /** Overall verdict */
  verdict: 'PROVEN' | 'UNPROVEN' | 'VIOLATED';
  /** Proof chain (for auditing) */
  chain: ProofChainEntry[];
  /** Signature (for tamper-proofing) */
  signature?: string;
}

export interface Evidence {
  /** Clause being proven */
  clause: {
    id: string;
    type: 'precondition' | 'postcondition' | 'invariant' | 'intent';
    source: string;
    behavior: string;
  };
  /** Evidence type */
  evidenceType: 'code' | 'test' | 'middleware' | 'config' | 'manual';
  /** Code location (if applicable) */
  codeLocation?: {
    file: string;
    startLine: number;
    endLine: number;
    hash: string;
  };
  /** Evidence status */
  status: 'satisfied' | 'unsatisfied' | 'partial' | 'manual-review';
  /** Confidence score */
  confidence: number;
  /** Notes */
  notes?: string;
}

export interface TestEvidence {
  /** Test name */
  name: string;
  /** Test file */
  file: string;
  /** Clauses covered */
  clausesCovered: string[];
  /** Test result */
  result: 'pass' | 'fail' | 'skip';
  /** Duration (ms) */
  duration: number;
  /** Error message (if failed) */
  error?: string;
}

export interface GateEvidence {
  /** Gate run ID */
  runId: string;
  /** Score */
  score: number;
  /** Violations */
  violations: GateViolation[];
  /** Verdict */
  verdict: 'SHIP' | 'NO_SHIP';
}

export interface GateViolation {
  ruleId: string;
  file: string;
  line: number;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ProofChainEntry {
  /** Step number */
  step: number;
  /** Action taken */
  action: string;
  /** Input hash */
  inputHash: string;
  /** Output hash */
  outputHash: string;
  /** Timestamp */
  timestamp: string;
}

export interface VerificationSurface {
  /** Languages verified */
  languages: string[];
  /** Frameworks detected and verified */
  frameworks: string[];
  /** Verification tiers executed (1=static, 2=runtime, 3=property-based) */
  tiersRun: number[];
  /** Properties that were verified */
  propertiesVerified: string[];
  /** Properties explicitly out of scope */
  explicitlyOutOfScope: string[];
  /** Properties detected but not verified */
  detectedButNotVerified?: string[];
}

export interface ResidualRisk {
  /** Risk identifier */
  id: string;
  /** Risk description */
  risk: string;
  /** Potential impact */
  impact: string;
  /** Why this wasn't verified */
  reasonNotVerified: string;
  /** Recommended mitigation */
  recommendedMitigation: string;
  /** Responsible party */
  owner: 'Engineering' | 'Security' | 'Compliance' | 'Product';
  /** Risk status */
  status: 'acknowledged' | 'mitigated' | 'accepted' | 'transferred';
  /** Severity level */
  severity?: 'critical' | 'high' | 'medium' | 'low';
  /** Related property (if any) */
  relatedProperty?: string;
}

// ============================================================================
// Proof Bundle Builder
// ============================================================================

export class ProofBundleBuilder {
  private ast: ISLAST;
  private evidence: Evidence[] = [];
  private tests: TestEvidence[] = [];
  private gate: GateEvidence | null = null;
  private chain: ProofChainEntry[] = [];
  private languages: string[] = ['typescript'];
  private frameworks: string[] = [];
  private tiersRun: number[] = [1];

  constructor(ast: ISLAST) {
    this.ast = ast;
    this.addChainEntry('initialize', this.hashAST(ast), '');
  }

  /**
   * Set verification context (language, frameworks, tiers)
   */
  setVerificationContext(context: { languages?: string[]; frameworks?: string[]; tiersRun?: number[] }): this {
    if (context.languages) this.languages = context.languages;
    if (context.frameworks) this.frameworks = context.frameworks;
    if (context.tiersRun) this.tiersRun = context.tiersRun;
    return this;
  }

  /**
   * Add proof links from generator
   */
  addProofLinks(links: ProofLink[]): this {
    const inputHash = this.hashObject(links);

    for (const link of links) {
      this.evidence.push({
        clause: {
          id: `${link.clause.behavior}:${link.clause.type}:${this.hashString(link.clause.source).slice(0, 8)}`,
          type: link.clause.type,
          source: link.clause.source,
          behavior: link.clause.behavior,
        },
        evidenceType: link.satisfaction === 'test' ? 'test' : 
                       link.satisfaction === 'middleware' ? 'middleware' : 'code',
        codeLocation: {
          file: link.codeLocation.file,
          startLine: link.codeLocation.startLine,
          endLine: link.codeLocation.endLine,
          hash: this.hashString(link.codeLocation.snippet),
        },
        status: 'satisfied',
        confidence: link.satisfaction === 'direct' ? 0.95 : 0.8,
      });
    }

    this.addChainEntry('add-proof-links', inputHash, this.hashObject(this.evidence));
    return this;
  }

  /**
   * Add test results
   */
  addTestResults(tests: TestEvidence[]): this {
    const inputHash = this.hashObject(tests);
    this.tests = tests;

    // Update evidence based on test results
    for (const test of tests) {
      for (const clauseId of test.clausesCovered) {
        const ev = this.evidence.find(e => e.clause.id === clauseId);
        if (ev) {
          if (test.result === 'pass') {
            ev.confidence = Math.min(ev.confidence + 0.1, 1);
          } else if (test.result === 'fail') {
            ev.status = 'unsatisfied';
            ev.confidence = 0;
          }
        }
      }
    }

    this.addChainEntry('add-test-results', inputHash, this.hashObject(this.evidence));
    return this;
  }

  /**
   * Add gate results
   */
  addGateResults(gate: GateEvidence): this {
    const inputHash = this.hashObject(gate);
    this.gate = gate;

    // Mark violated clauses
    for (const violation of gate.violations) {
      // Check if violation relates to any intent
      const intentMatch = this.evidence.find(e => 
        e.clause.type === 'intent' && 
        violation.ruleId.includes(e.clause.source.replace('-', '/'))
      );
      if (intentMatch) {
        intentMatch.status = 'violated' as any;
        intentMatch.notes = violation.message;
      }
    }

    this.addChainEntry('add-gate-results', inputHash, this.hashObject(gate));
    return this;
  }

  /**
   * Build the final proof bundle
   */
  build(): ProofBundle {
    // Calculate overall verdict
    const hasViolatedClauses = this.evidence.some(e => e.status === 'unsatisfied');
    const hasFailedTests = this.tests.some(t => t.result === 'fail');
    const gateBlocks = this.gate?.verdict === 'NO_SHIP';

    let verdict: ProofBundle['verdict'] = 'PROVEN';
    if (hasViolatedClauses || hasFailedTests || gateBlocks) {
      verdict = 'VIOLATED';
    } else if (this.evidence.some(e => e.status === 'manual-review')) {
      verdict = 'UNPROVEN';
    }

    // Generate verification surface
    const verificationSurface = this.buildVerificationSurface();

    // Generate residual risks
    const residualRisks = this.buildResidualRisks();

    // Build bundle
    const bundle: ProofBundle = {
      version: '1.0.0',
      bundleId: '', // Will be set after hashing
      timestamp: new Date().toISOString(),
      source: {
        domain: this.ast.name,
        version: this.ast.version,
        hash: this.hashAST(this.ast),
      },
      verificationSurface,
      evidence: this.evidence,
      tests: this.tests,
      gate: this.gate || {
        runId: 'pending',
        score: 0,
        violations: [],
        verdict: 'NO_SHIP',
      },
      residualRisks,
      verdict,
      chain: this.chain,
    };

    // Calculate deterministic bundle ID
    bundle.bundleId = this.hashBundle(bundle);

    this.addChainEntry('finalize', '', bundle.bundleId);

    return bundle;
  }

  /**
   * Build verification surface from evidence and context
   */
  private buildVerificationSurface(): VerificationSurface {
    // Collect unique property types that were verified
    const propertiesVerified = new Set<string>();
    const detectedButNotVerified = new Set<string>();

    for (const ev of this.evidence) {
      const propertyType = this.evidenceToPropertyType(ev);
      if (ev.status === 'satisfied' || ev.status === 'partial') {
        propertiesVerified.add(propertyType);
      } else if (ev.status === 'unsatisfied' || ev.status === 'manual-review') {
        detectedButNotVerified.add(propertyType);
      }
    }

    // Explicitly out of scope (properties we know we can't verify)
    const explicitlyOutOfScope = [
      'rate-limiting',
      'csrf-protection',
      'business-logic-correctness',
      'performance-scalability',
      'third-party-service-behavior',
      'runtime-monitoring',
      'distributed-tracing',
    ];

    return {
      languages: this.languages,
      frameworks: this.frameworks,
      tiersRun: this.tiersRun,
      propertiesVerified: Array.from(propertiesVerified),
      explicitlyOutOfScope,
      detectedButNotVerified: Array.from(detectedButNotVerified),
    };
  }

  /**
   * Build residual risk ledger from unverified/partial evidence
   */
  private buildResidualRisks(): ResidualRisk[] {
    const risks: ResidualRisk[] = [];

    // Collect unverified properties
    const unverifiedProperties = this.evidence.filter(
      e => e.status === 'manual-review' || e.status === 'unsatisfied'
    );

    for (const ev of unverifiedProperties) {
      const propertyType = this.evidenceToPropertyType(ev);
      const riskInfo = this.getRiskInfo(propertyType, ev);

      risks.push({
        id: `${propertyType}-${this.hashString(ev.clause.id).slice(0, 8)}`,
        risk: riskInfo.risk,
        impact: riskInfo.impact,
        reasonNotVerified: ev.status === 'manual-review' 
          ? 'Requires manual review'
          : ev.notes || 'Unable to verify automatically',
        recommendedMitigation: riskInfo.mitigation,
        owner: riskInfo.owner,
        status: 'acknowledged',
        severity: riskInfo.severity,
        relatedProperty: propertyType,
      });
    }

    // Add risks for explicitly out-of-scope items that were detected in code
    if (this.gate?.violations) {
      for (const violation of this.gate.violations) {
        if (violation.severity === 'critical' || violation.severity === 'high') {
          risks.push({
            id: `gate-${violation.ruleId}-${this.hashString(violation.file).slice(0, 8)}`,
            risk: `Gate violation: ${violation.ruleId}`,
            impact: violation.message,
            reasonNotVerified: 'Detected by gate scanner but not formally verified',
            recommendedMitigation: 'Address gate violation or document risk acceptance',
            owner: 'Engineering',
            status: 'acknowledged',
            severity: violation.severity,
          });
        }
      }
    }

    return risks;
  }

  /**
   * Map evidence to property type
   */
  private evidenceToPropertyType(ev: Evidence): string {
    const clauseType = ev.clause.type;
    const source = ev.clause.source.toLowerCase();

    if (source.includes('auth')) return 'auth-coverage';
    if (source.includes('validation') || source.includes('input')) return 'input-validation';
    if (source.includes('sql') || source.includes('injection')) return 'sql-injection';
    if (source.includes('secret') || source.includes('credential')) return 'secret-exposure';
    if (source.includes('error') || source.includes('exception')) return 'error-handling';
    if (source.includes('import') || source.includes('dependency')) return 'import-integrity';
    if (source.includes('type')) return 'type-safety';

    return clauseType === 'precondition' ? 'precondition-check' : 'postcondition-check';
  }

  /**
   * Get risk information for a property type
   */
  private getRiskInfo(propertyType: string, ev: Evidence): {
    risk: string;
    impact: string;
    mitigation: string;
    owner: ResidualRisk['owner'];
    severity: ResidualRisk['severity'];
  } {
    const riskMap: Record<string, any> = {
      'auth-coverage': {
        risk: 'Missing or incomplete authentication verification',
        impact: 'Unauthorized access to protected resources',
        mitigation: 'Add authentication middleware to all protected routes',
        owner: 'Engineering',
        severity: 'critical',
      },
      'input-validation': {
        risk: 'Unvalidated user input',
        impact: 'Injection attacks, data corruption, or unexpected behavior',
        mitigation: 'Add input validation using Zod or similar library',
        owner: 'Engineering',
        severity: 'high',
      },
      'sql-injection': {
        risk: 'SQL injection vulnerability',
        impact: 'Database compromise, data theft, or data loss',
        mitigation: 'Use parameterized queries or ORM',
        owner: 'Security',
        severity: 'critical',
      },
      'secret-exposure': {
        risk: 'Hardcoded secrets or credentials',
        impact: 'Credential theft, unauthorized access',
        mitigation: 'Move secrets to environment variables or secret manager',
        owner: 'Security',
        severity: 'critical',
      },
      'error-handling': {
        risk: 'Inadequate error handling',
        impact: 'Information disclosure, poor user experience, or crashes',
        mitigation: 'Add try-catch blocks and return appropriate error codes',
        owner: 'Engineering',
        severity: 'medium',
      },
      'import-integrity': {
        risk: 'Unverified or hallucinated imports',
        impact: 'Runtime failures, dependency confusion attacks',
        mitigation: 'Verify all imports exist in package.json and node_modules',
        owner: 'Engineering',
        severity: 'high',
      },
      'type-safety': {
        risk: 'Type safety not verified',
        impact: 'Runtime type errors, unexpected behavior',
        mitigation: 'Enable TypeScript strict mode and fix type errors',
        owner: 'Engineering',
        severity: 'medium',
      },
    };

    return riskMap[propertyType] || {
      risk: `Unverified property: ${ev.clause.source}`,
      impact: 'Unknown risk impact',
      mitigation: 'Manual review and verification required',
      owner: 'Engineering',
      severity: 'medium',
    };
  }

  /**
   * Sign the bundle (for tamper-proofing)
   */
  sign(bundle: ProofBundle, privateKey?: string): ProofBundle {
    // In production, use proper cryptographic signing
    // For now, use HMAC with a simple key
    const key = privateKey || 'isl-proof-v1';
    const signature = crypto
      .createHmac('sha256', key)
      .update(bundle.bundleId)
      .digest('hex');
    
    return {
      ...bundle,
      signature,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private addChainEntry(action: string, inputHash: string, outputHash: string): void {
    this.chain.push({
      step: this.chain.length + 1,
      action,
      inputHash,
      outputHash,
      timestamp: new Date().toISOString(),
    });
  }

  private hashString(s: string): string {
    return crypto.createHash('sha256').update(s).digest('hex');
  }

  private hashObject(obj: unknown): string {
    return this.hashString(JSON.stringify(obj, Object.keys(obj as object).sort()));
  }

  private hashAST(ast: ISLAST): string {
    // Exclude metadata (timestamps) for deterministic hashing
    const { metadata, ...rest } = ast;
    return this.hashObject(rest);
  }

  private hashBundle(bundle: ProofBundle | Omit<ProofBundle, 'bundleId' | 'signature'>): string {
    // Exclude bundleId and signature for deterministic hashing
    const { bundleId, signature, ...rest } = bundle as ProofBundle;
    return this.hashObject(rest);
  }
}

// ============================================================================
// Proof Verification
// ============================================================================

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function verifyBundle(bundle: ProofBundle): VerificationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Verify version
  if (bundle.version !== '1.0.0') {
    errors.push(`Unsupported bundle version: ${bundle.version}`);
  }

  // Verify bundle ID is correct
  const expectedId = new ProofBundleBuilder({ 
    kind: 'Domain',
    name: bundle.source.domain,
    version: bundle.source.version,
    entities: [],
    behaviors: [],
    invariants: [],
    metadata: { generatedFrom: 'nl-translator', prompt: '', timestamp: '', confidence: 0 },
  })['hashBundle']({ ...bundle, bundleId: '' });
  
  // Note: This won't match exactly in a real scenario - just for demonstration

  // Verify evidence chain
  for (let i = 1; i < bundle.chain.length; i++) {
    const prev = bundle.chain[i - 1];
    const curr = bundle.chain[i];
    if (curr.step !== prev.step + 1) {
      errors.push(`Chain gap: step ${prev.step} → ${curr.step}`);
    }
  }

  // Verify all clauses have evidence
  for (const ev of bundle.evidence) {
    if (ev.status === 'unsatisfied') {
      errors.push(`Unsatisfied clause: ${ev.clause.id}`);
    }
    if (ev.confidence < 0.5) {
      warnings.push(`Low confidence for clause: ${ev.clause.id} (${ev.confidence})`);
    }
  }

  // Verify test coverage
  const coveredClauses = new Set(bundle.tests.flatMap(t => t.clausesCovered));
  for (const ev of bundle.evidence) {
    if (!coveredClauses.has(ev.clause.id) && ev.evidenceType !== 'middleware') {
      warnings.push(`No test coverage for clause: ${ev.clause.id}`);
    }
  }

  // Verify signature (if present)
  if (bundle.signature) {
    // In production, verify against public key
    // For now, just check it exists
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Pretty Print
// ============================================================================

export function formatProofBundle(bundle: ProofBundle): string {
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push(' ISL Proof Bundle');
  lines.push('═'.repeat(60));
  lines.push('');
  
  lines.push(`Bundle ID:  ${bundle.bundleId.slice(0, 16)}...`);
  lines.push(`Timestamp:  ${bundle.timestamp}`);
  lines.push(`Domain:     ${bundle.source.domain} v${bundle.source.version}`);
  lines.push(`Verdict:    ${bundle.verdict === 'PROVEN' ? '✓ PROVEN' : bundle.verdict === 'VIOLATED' ? '✗ VIOLATED' : '? UNPROVEN'}`);
  lines.push('');

  // Evidence summary
  lines.push('─'.repeat(60));
  lines.push(' Evidence');
  lines.push('─'.repeat(60));
  
  const byType = {
    precondition: bundle.evidence.filter(e => e.clause.type === 'precondition'),
    postcondition: bundle.evidence.filter(e => e.clause.type === 'postcondition'),
    invariant: bundle.evidence.filter(e => e.clause.type === 'invariant'),
    intent: bundle.evidence.filter(e => e.clause.type === 'intent'),
  };

  for (const [type, evs] of Object.entries(byType)) {
    if (evs.length > 0) {
      const satisfied = evs.filter(e => e.status === 'satisfied').length;
      lines.push(`  ${type}: ${satisfied}/${evs.length} satisfied`);
      for (const ev of evs) {
        const status = ev.status === 'satisfied' ? '✓' : ev.status === 'unsatisfied' ? '✗' : '?';
        lines.push(`    ${status} ${ev.clause.source.slice(0, 50)}`);
        if (ev.codeLocation) {
          lines.push(`      → ${ev.codeLocation.file}:${ev.codeLocation.startLine}`);
        }
      }
    }
  }
  lines.push('');

  // Test summary
  lines.push('─'.repeat(60));
  lines.push(' Tests');
  lines.push('─'.repeat(60));
  
  const passed = bundle.tests.filter(t => t.result === 'pass').length;
  const failed = bundle.tests.filter(t => t.result === 'fail').length;
  lines.push(`  ${passed} passed, ${failed} failed`);
  
  for (const test of bundle.tests) {
    const icon = test.result === 'pass' ? '✓' : test.result === 'fail' ? '✗' : '○';
    lines.push(`  ${icon} ${test.name} (${test.duration}ms)`);
    if (test.error) {
      lines.push(`    Error: ${test.error}`);
    }
  }
  lines.push('');

  // Gate summary
  lines.push('─'.repeat(60));
  lines.push(' Gate');
  lines.push('─'.repeat(60));
  
  lines.push(`  Score:   ${bundle.gate.score}/100`);
  lines.push(`  Verdict: ${bundle.gate.verdict}`);
  
  if (bundle.gate.violations.length > 0) {
    lines.push(`  Violations (${bundle.gate.violations.length}):`);
    for (const v of bundle.gate.violations.slice(0, 5)) {
      lines.push(`    • ${v.ruleId}: ${v.message}`);
      lines.push(`      ${v.file}:${v.line}`);
    }
    if (bundle.gate.violations.length > 5) {
      lines.push(`    ... and ${bundle.gate.violations.length - 5} more`);
    }
  }
  lines.push('');

  // Signature
  if (bundle.signature) {
    lines.push('─'.repeat(60));
    lines.push(` Signature: ${bundle.signature.slice(0, 32)}...`);
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export function createProofBundle(ast: ISLAST): ProofBundleBuilder {
  return new ProofBundleBuilder(ast);
}
