/**
 * Gate runner - executes ISL gate checks
 */

import { resolve, relative } from 'path';
import { info, warning, error } from '@actions/core';
import { 
  runAuthoritativeGate, 
  AuthoritativeGateResult,
  VerificationSignal,
  SignalFinding
} from '@isl-lang/gate';
import { GateRunnerOptions, GateRunnerResult, ProcessedFinding } from './types.js';
import { loadGateConfig, validateGateConfig } from './config.js';

/**
 * Run the ISL gate with given options
 */
export async function runGate(options: GateRunnerOptions): Promise<GateRunnerResult> {
  const startTime = Date.now();
  
  try {
    info(`Running ISL gate for project: ${options.projectRoot}`);
    info(`Implementation: ${options.implementation}`);
    if (options.spec) {
      info(`Spec: ${options.spec}`);
    }
    if (options.files) {
      info(`Files to check: ${options.files.length}`);
    }

    // Load and validate configuration
    const config = loadGateConfig(options.configPath || '.shipgate/config.json', options.projectRoot);
    validateGateConfig(config);

    // Prepare gate input
    const gateInput = {
      projectRoot: options.projectRoot,
      spec: options.spec,
      implementation: options.implementation,
      threshold: options.threshold,
      files: options.files,
      config: {
        thresholds: config.thresholds,
        checks: config.checks,
      }
    };

    // Run the gate
    const result: AuthoritativeGateResult = await runAuthoritativeGate(gateInput);
    
    // Process findings
    const findings = processFindings(result.signals || [], options.projectRoot);
    
    // Calculate metrics
    const duration = Date.now() - startTime;
    const metrics = {
      durationMs: duration,
      filesScanned: options.files?.length || 0,
      signalsProcessed: result.signals?.length || 0,
    };

    info(`Gate completed in ${duration}ms`);
    info(`Verdict: ${result.verdict}`);
    info(`Score: ${result.score || 0}/100`);
    info(`Findings: ${findings.length}`);

    return {
      result,
      findings,
      metrics,
    };
  } catch (err) {
    error(`Gate execution failed: ${err}`);
    throw err;
  }
}

/**
 * Process signal findings into a standardized format
 */
function processFindings(
  signals: VerificationSignal[],
  projectRoot: string
): ProcessedFinding[] {
  const findings: ProcessedFinding[] = [];

  for (const signal of signals) {
    if (!signal.findings) continue;

    for (const finding of signal.findings) {
      // Convert severity
      let severity: 'critical' | 'high' | 'medium' | 'low';
      switch (finding.severity) {
        case 'critical':
          severity = 'critical';
          break;
        case 'high':
          severity = 'high';
          break;
        case 'medium':
          severity = 'medium';
          break;
        case 'low':
          severity = 'low';
          break;
        default:
          severity = 'medium';
      }

      // Make file path relative to project root
      let filePath = finding.file;
      if (filePath && filePath.startsWith(projectRoot)) {
        filePath = relative(projectRoot, filePath);
      }

      findings.push({
        id: finding.id,
        severity,
        ruleId: `${signal.source}:${finding.id}`,
        message: finding.message,
        filePath,
        line: finding.line,
        column: finding.column,
        blocking: finding.blocking,
        source: signal.source,
        original: finding,
      });
    }
  }

  return findings;
}

/**
 * Determine if the gate should fail based on findings and configuration
 */
export function shouldFail(
  result: AuthoritativeGateResult,
  findings: ProcessedFinding[],
  failOn: 'any' | 'blocker' | 'none'
): boolean {
  if (failOn === 'none') {
    return false;
  }

  if (failOn === 'any' && findings.length > 0) {
    return true;
  }

  if (failOn === 'blocker') {
    return findings.some(f => f.blocking || f.severity === 'critical');
  }

  return result.verdict === 'NO_SHIP';
}

/**
 * Get summary statistics for findings
 */
export function getFindingsSummary(findings: ProcessedFinding[]) {
  const summary = {
    total: findings.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    blockers: 0,
  };

  for (const finding of findings) {
    summary[finding.severity]++;
    if (finding.blocking) {
      summary.blockers++;
    }
  }

  return summary;
}
