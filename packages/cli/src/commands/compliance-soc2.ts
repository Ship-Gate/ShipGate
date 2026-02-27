/**
 * ShipGate Compliance SOC2 Command
 *
 * Outputs SOC2 control status (pass/warn/fail) with contributing checks
 * and evidence refs for auditor consumption.
 *
 * Usage:
 *   shipgate compliance soc2 --bundle <path>
 *   shipgate compliance soc2 --evidence <dir>
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import {
  evaluateSOC2,
  type SOC2ControlMapping,
  type SOC2EvaluationResult,
} from '@isl-lang/shipgate-compliance';
import type { ProofBundleV1 } from '@isl-lang/proof';
import { isJsonOutput } from '../output.js';
import { ExitCode } from '../exit-codes.js';
// Missing compliance modules - stub
// import { SOC2Mapper } from '@isl-lang/compliance/dist/frameworks/soc2.js';
// import type { SOC2Control, SOC2Category } from '@isl-lang/compliance/dist/frameworks/soc2.js';
// import { AuditTrailGenerator } from '@isl-lang/compliance/dist/audit-trail.js';
const SOC2Mapper = null as any;
const AuditTrailGenerator = null as any;
import { createHash } from 'crypto';
import { parse as parseISL } from '@isl-lang/parser';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplianceSOC2Options {
  /** ISL spec file to analyze directly */
  spec?: string;
  /** Proof bundle path (proof-bundle.json or directory containing it) */
  bundle?: string;
  /** Evidence directory (results.json, manifest.json) */
  evidence?: string;
  /** Output directory for compliance report */
  output?: string;
  /** Output format */
  format?: 'pretty' | 'json';
}

export interface ComplianceSOC2Result {
  success: boolean;
  controls: SOC2ControlMapping[];
  summary: SOC2EvaluationResult['summary'];
  bundleHash?: string;
  errors?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

export async function complianceSOC2(
  options: ComplianceSOC2Options
): Promise<ComplianceSOC2Result> {
  const errors: string[] = [];

  if (!options.bundle && !options.evidence && !options.spec) {
    return {
      success: false,
      controls: [],
      summary: { total: 0, pass: 0, warn: 0, fail: 0 },
      errors: ['Specify --spec, --bundle, or --evidence'],
    };
  }

  // Handle ISL spec directly
  if (options.spec) {
    return analyzeISLSpec(options);
  }

  let verdicts: Array<{ phase: string; verdict: string; score?: number; details?: Record<string, unknown>; timestamp?: string }> = [];
  let violations: Array<{ policyId?: string; ruleId?: string; message?: string }> = [];
  let violatedRuleIds: string[] = [];
  let bundleHash: string | undefined;

  // Load from proof bundle
  if (options.bundle) {
    const result = loadFromBundle(options.bundle);
    if (result.errors.length > 0) {
      return {
        success: false,
        controls: [],
        summary: { total: 0, pass: 0, warn: 0, fail: 0 },
        errors: result.errors,
      };
    }
    verdicts = result.verdicts;
    violations = result.violations;
    violatedRuleIds = result.violatedRuleIds;
    bundleHash = result.bundleHash;
  }

  // Load from evidence directory
  if (options.evidence) {
    const result = loadFromEvidence(options.evidence);
    violations = result.violations;
    violatedRuleIds = result.violatedRuleIds;
    if (result.verdicts.length > 0) verdicts = result.verdicts;
    if (result.errors.length > 0) errors.push(...result.errors);
  }

  const evaluation = evaluateSOC2({
    bundleHash,
    bundlePath: options.bundle ? resolve(options.bundle) : undefined,
    verdicts,
    violations,
    violatedRuleIds: violatedRuleIds.length > 0 ? violatedRuleIds : undefined,
  });

  return {
    success: true,
    controls: evaluation.controls,
    summary: evaluation.summary,
    bundleHash,
    errors: errors.length > 0 ? errors : undefined,
  };
}

function loadFromBundle(bundlePath: string): {
  verdicts: Array<{ phase: string; verdict: string; score?: number; details?: Record<string, unknown>; timestamp?: string }>;
  violations: Array<{ policyId?: string; ruleId?: string }>;
  violatedRuleIds: string[];
  bundleHash?: string;
  errors: string[];
} {
  const errors: string[] = [];
  const resolved = resolve(bundlePath);

  let jsonPath = resolved;
  if (existsSync(resolved) && !resolved.endsWith('.json')) {
    jsonPath = resolve(resolved, 'proof-bundle.json');
  }

  if (!existsSync(jsonPath)) {
    errors.push(`Proof bundle not found: ${bundlePath}`);
    return { verdicts: [], violations: [], violatedRuleIds: [], errors };
  }

  try {
    const raw = readFileSync(jsonPath, 'utf-8');
    const bundle = JSON.parse(raw) as ProofBundleV1;

    const verdicts = (bundle.verdicts ?? []).map((v) => ({
      phase: v.phase,
      verdict: v.verdict,
      score: v.score,
      details: v.details as Record<string, unknown> | undefined,
      timestamp: v.timestamp,
    }));

    const violations: Array<{ policyId?: string; ruleId?: string }> = [];
    const violatedRuleIds: string[] = [];

    for (const v of verdicts) {
      const details = v.details ?? {};
      const blockers = (details.blockers as string[] | undefined) ?? [];
      const viols = (details.violations as Array<{ policyId?: string; ruleId?: string }> | undefined) ?? [];
      for (const b of blockers) {
        violatedRuleIds.push(b);
      }
      for (const vv of viols) {
        violations.push(vv);
        if (vv.policyId) violatedRuleIds.push(vv.policyId);
        if (vv.ruleId) violatedRuleIds.push(vv.ruleId);
      }
    }

    // Check for soc2Controls in bundle (optional section)
    const soc2FromBundle = (bundle as ProofBundleV1 & { soc2Controls?: SOC2ControlMapping[] }).soc2Controls;
    if (soc2FromBundle && Array.isArray(soc2FromBundle)) {
      // Bundle already has SOC2 section - we could return it, but we recompute for consistency
    }

    return {
      verdicts,
      violations,
      violatedRuleIds: [...new Set(violatedRuleIds)],
      bundleHash: bundle.bundleHash,
      errors,
    };
  } catch (err) {
    errors.push(`Failed to load bundle: ${err instanceof Error ? err.message : String(err)}`);
    return { verdicts: [], violations: [], violatedRuleIds: [], errors };
  }
}

function loadFromEvidence(evidenceDir: string): {
  verdicts: Array<{ phase: string; verdict: string; score?: number; details?: Record<string, unknown>; timestamp?: string }>;
  violations: Array<{ policyId?: string; ruleId?: string }>;
  violatedRuleIds: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const resolved = resolve(evidenceDir);

  const verdicts: Array<{ phase: string; verdict: string; score?: number; details?: Record<string, unknown>; timestamp?: string }> = [];
  const violations: Array<{ policyId?: string; ruleId?: string }> = [];
  const violatedRuleIds: string[] = [];

  const resultsPath = resolve(resolved, 'results.json');
  if (existsSync(resultsPath)) {
    try {
      const results = JSON.parse(readFileSync(resultsPath, 'utf-8'));
      verdicts.push({
        phase: 'gate',
        verdict: results.decision === 'SHIP' ? 'SHIP' : 'NO_SHIP',
        score: results.trustScore ?? 0,
        details: {
          blockers: results.blockers ?? [],
          violations: results.violations ?? [],
        },
        timestamp: results.timestamp,
      });

      const blockers = (results.blockers as string[] | undefined) ?? [];
      const viols = (results.violations as Array<{ policyId?: string; ruleId?: string }> | undefined) ?? [];
      for (const b of blockers) violatedRuleIds.push(b);
      for (const v of viols) {
        violations.push(v);
        if (v.policyId) violatedRuleIds.push(v.policyId);
        if (v.ruleId) violatedRuleIds.push(v.ruleId);
      }
    } catch (err) {
      errors.push(`Failed to load results.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const manifestPath = resolve(resolved, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      if (manifest.gateResult) {
        const gr = manifest.gateResult;
        const viols = (gr.violations as Array<{ policyId?: string; ruleId?: string }> | undefined) ?? [];
        for (const v of viols) {
          violations.push(v);
          if (v.policyId) violatedRuleIds.push(v.policyId);
          if (v.ruleId) violatedRuleIds.push(v.ruleId);
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return {
    verdicts,
    violations,
    violatedRuleIds: [...new Set(violatedRuleIds)],
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Print
// ─────────────────────────────────────────────────────────────────────────────

export function printComplianceSOC2Result(
  result: ComplianceSOC2Result,
  options: { format?: 'pretty' | 'json' } = {}
): void {
  const isJson = options.format === 'json' || isJsonOutput();

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          summary: result.summary,
          controls: result.controls,
          bundleHash: result.bundleHash,
          errors: result.errors,
        },
        null,
        2
      )
    );
    return;
  }

  console.log('');
  console.log(chalk.bold('  SOC 2 Control Mapping'));
  console.log('  ' + '─'.repeat(60));
  console.log(chalk.gray('  Proof bundle evidence → SOC2 Trust Services Criteria'));
  console.log('');

  if (!result.success) {
    console.log(chalk.red('  ✗ Failed to evaluate'));
    for (const err of result.errors ?? []) {
      console.log(chalk.red(`    • ${err}`));
    }
    console.log('');
    return;
  }

  const { summary, controls } = result;
  console.log(`  ${chalk.gray('Summary:')} ${chalk.green(`pass ${summary.pass}`)} | ${chalk.yellow(`warn ${summary.warn}`)} | ${chalk.red(`fail ${summary.fail}`)} (of ${summary.total} controls)`);
  if (result.bundleHash) {
    console.log(`  ${chalk.gray('Bundle:')}  ${result.bundleHash.slice(0, 16)}...`);
  }
  console.log('');

  for (const c of controls) {
    const statusColor =
      c.status === 'pass' ? chalk.green : c.status === 'warn' ? chalk.yellow : chalk.red;
    const statusSym = c.status === 'pass' ? '✓' : c.status === 'warn' ? '◐' : '✗';
    console.log(`  ${statusColor(statusSym)} ${c.controlId} ${chalk.gray('—')} ${c.controlName}`);
    console.log(`      ${chalk.gray(c.description)}`);
    if (c.contributingChecks.length > 0) {
      for (const ch of c.contributingChecks) {
        const chColor = ch.passed ? chalk.green : chalk.red;
        console.log(`      ${chColor('•')} ${ch.checkId}: ${ch.passed ? 'passed' : 'failed'}`);
      }
    }
    if (c.evidenceRefs.length > 0) {
      for (const ref of c.evidenceRefs.slice(0, 2)) {
        console.log(`      ${chalk.gray('↳')} ${ref.type}: ${ref.ref.slice(0, 40)}${ref.ref.length > 40 ? '...' : ''}`);
      }
    }
    console.log('');
  }

  console.log(chalk.gray('  A non-technical auditor can use this report to see which'));
  console.log(chalk.gray('  controls are satisfied and which evidence supports them.'));
  console.log('');
}

export function getComplianceSOC2ExitCode(result: ComplianceSOC2Result): number {
  if (!result.success) return ExitCode.ISL_ERROR;
  const { summary } = result;
  if (summary.fail > 0) return ExitCode.ISL_ERROR;
  return ExitCode.SUCCESS;
}

// ─────────────────────────────────────────────────────────────────────────────
// ISL Spec Analysis
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeISLSpec(options: ComplianceSOC2Options): Promise<ComplianceSOC2Result> {
  const errors: string[] = [];
  
  if (!options.spec) {
    return {
      success: false,
      controls: [],
      summary: { total: 0, pass: 0, warn: 0, fail: 0 },
      errors: ['No spec file provided'],
    };
  }

  const specPath = resolve(options.spec);
  if (!existsSync(specPath)) {
    return {
      success: false,
      controls: [],
      summary: { total: 0, pass: 0, warn: 0, fail: 0 },
      errors: [`ISL spec not found: ${options.spec}`],
    };
  }

  try {
    // Parse ISL spec
    const specContent = readFileSync(specPath, 'utf-8');
    const parseResult = parseISL(specContent);
    
    if (parseResult.errors.length > 0) {
      return {
        success: false,
        controls: [],
        summary: { total: 0, pass: 0, warn: 0, fail: 0 },
        errors: parseResult.errors.map(e => `Parse error: ${e.message}`),
      };
    }

    // Map to SOC2 controls (stubbed - full implementation in @isl-lang/shipgate-compliance)
    const soc2Framework = SOC2Mapper ? new SOC2Mapper() : null;
    if (!soc2Framework) {
      return {
        success: false,
        controls: [],
        summary: { total: 0, pass: 0, warn: 0, fail: 0 },
        errors: ['SOC2 mapper not available'],
      };
    }
    const controlMappings = soc2Framework.mapDomain(parseResult.domain);

    // Convert to SOC2ControlMapping format
    const controls: SOC2ControlMapping[] = controlMappings.map((mapping: any) => ({
      controlId: mapping.controlId,
      controlName: mapping.controlName,
      description: mapping.description,
      status: mapping.status === 'implemented' ? 'pass' : mapping.status === 'partial' ? 'warn' : 'fail',
      contributingChecks: mapping.evidence.map((e: any, i: number) => ({
        checkId: `evidence-${i}`,
        passed: true,
        description: e.source || e.content || 'ISL construct found',
      })),
      evidenceRefs: mapping.evidence.map((e: any, i: number) => ({
        type: e.type || 'isl_spec',
        ref: e.source || String(e.content || '').slice(0, 50),
      })),
    }));

    const summary = {
      total: controls.length,
      pass: controls.filter(c => c.status === 'pass').length,
      warn: controls.filter(c => c.status === 'warn').length,
      fail: controls.filter(c => c.status === 'fail').length,
    };

    // Save report if output specified
    if (options.output) {
      const outputDir = resolve(options.output);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      
      // Generate spec hash
      const specHash = createHash('sha256').update(specContent).digest('hex');
      
      const report = {
        framework: 'SOC2',
        timestamp: new Date().toISOString(),
        spec: options.spec,
        specHash,
        summary,
        controls,
      };
      
      writeFileSync(
        resolve(outputDir, 'soc2-compliance-report.json'),
        JSON.stringify(report, null, 2)
      );

      // Generate audit trail
      const auditGenerator = new AuditTrailGenerator();
      
      // Build compliance report for audit trail
      const complianceReport = {
        framework: 'SOC2',
        controlMappings: controlMappings.map((mapping: any) => ({
          controlId: mapping.controlId,
          controlName: mapping.controlName,
          category: mapping.category || 'Security',
          description: mapping.description,
          status: mapping.status,
          risk: mapping.status === 'not_implemented' ? 'high' : mapping.status === 'partial' ? 'medium' : 'low',
          evidence: mapping.evidence.map((e: any) => ({
            type: e.type,
            source: e.source || String(e.content || '').slice(0, 100),
            description: e.content || e.source || '',
            confidence: 0.8
          }))
        }))
      };

      const auditTrail = auditGenerator.generateAuditTrail(
        parseResult.domain,
        complianceReport,
        {
          organization: 'Demo Organization',
          system: parseResult.domain.name || 'ISL-Spec-System',
          version: '1.0.0',
          verifiedBy: 'ShipGate CLI'
        }
      );

      // Save audit trail as JSON
      writeFileSync(
        resolve(outputDir, 'soc2-audit-trail.json'),
        JSON.stringify(auditTrail, null, 2)
      );

      // Save CISO-friendly markdown report
      writeFileSync(
        resolve(outputDir, 'soc2-ciso-report.md'),
        auditGenerator.exportCISOReport(auditTrail)
      );
    }

    return {
      success: true,
      controls,
      summary,
    };

  } catch (err) {
    return {
      success: false,
      controls: [],
      summary: { total: 0, pass: 0, warn: 0, fail: 0 },
      errors: [`Failed to analyze ISL spec: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}
