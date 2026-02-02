/**
 * ISL Adapters - CLI Gate Command
 * 
 * Command-line interface for running the ISL Gate.
 * 
 * @module @isl-lang/adapters/cli
 */

import * as path from 'path';
import { runGate, quickCheck, type GateResult, type Finding, type GateInput } from '@isl-lang/gate';
import { writeEvidenceBundle } from '@isl-lang/evidence';

/**
 * CLI gate command options
 */
export interface GateCommandOptions {
  /** Project root directory */
  projectRoot?: string;
  /** ISL spec pattern */
  specPattern?: string;
  /** Only check changed files */
  changedOnly?: boolean;
  /** Base branch for diff */
  baseBranch?: string;
  /** Output format */
  output?: 'text' | 'json' | 'sarif';
  /** Verbose output */
  verbose?: boolean;
  /** Exit with error on NO_SHIP */
  strict?: boolean;
  /** Evidence output path */
  evidencePath?: string;
}

/**
 * CLI gate command result
 */
export interface GateCommandResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  exitCode: number;
  output: string;
  evidencePath: string;
}

/**
 * Run the gate command
 */
export async function runGateCommand(options: GateCommandOptions = {}): Promise<GateCommandResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const evidencePath = options.evidencePath ?? path.join(projectRoot, '.isl-gate', 'evidence');

  // In real implementation, would:
  // 1. Discover ISL spec files
  // 2. Run ISL parser/verifier
  // 3. Collect findings from verification

  // For now, create minimal input
  const input: GateInput = {
    findings: [],
    filesConsidered: 0,
    filesScanned: 0,
  };

  // Run gate
  const result = await runGate(input, {
    projectRoot,
    specPattern: options.specPattern,
    changedOnly: options.changedOnly,
    baseBranch: options.baseBranch,
    evidencePath,
    deterministic: false,
  });

  // Write evidence
  await writeEvidenceBundle(result, input.findings, {
    outputDir: evidencePath,
    projectRoot,
    includeHtmlReport: true,
  });

  // Format output
  const output = formatOutput(result, options.output ?? 'text', options.verbose ?? false);

  // Determine exit code
  const exitCode = result.verdict === 'NO_SHIP' && options.strict ? 1 : 0;

  return {
    verdict: result.verdict,
    score: result.score,
    exitCode,
    output,
    evidencePath,
  };
}

/**
 * Quick gate check (no evidence)
 */
export async function runQuickCheck(options: GateCommandOptions = {}): Promise<{
  verdict: 'SHIP' | 'NO_SHIP';
  exitCode: number;
}> {
  const input: GateInput = {
    findings: [],
    filesConsidered: 0,
    filesScanned: 0,
  };

  const verdict = quickCheck(input);
  const exitCode = verdict === 'NO_SHIP' && options.strict ? 1 : 0;

  return { verdict, exitCode };
}

/**
 * Format gate output
 */
function formatOutput(
  result: GateResult,
  format: 'text' | 'json' | 'sarif',
  verbose: boolean
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);
    
    case 'sarif':
      return JSON.stringify(formatAsSARIF(result), null, 2);
    
    case 'text':
    default:
      return formatAsText(result, verbose);
  }
}

/**
 * Format as human-readable text
 */
function formatAsText(result: GateResult, verbose: boolean): string {
  const lines: string[] = [];
  
  // Header
  const emoji = result.verdict === 'SHIP' ? '✅' : '🛑';
  lines.push('');
  lines.push(`  ${emoji} ISL Gate: ${result.verdict}`);
  lines.push(`  Score: ${result.score}/100`);
  lines.push('');

  // Reasons
  if (result.reasons.length > 0) {
    lines.push('  Issues:');
    for (const reason of result.reasons.slice(0, verbose ? 100 : 10)) {
      const icon = getSeverityIcon(reason.severity);
      lines.push(`    ${icon} [${reason.code}] ${reason.message}`);
    }
    if (result.reasons.length > 10 && !verbose) {
      lines.push(`    ... and ${result.reasons.length - 10} more`);
    }
    lines.push('');
  }

  // Footer
  lines.push(`  Evidence: ${result.evidencePath}`);
  lines.push(`  Fingerprint: ${result.fingerprint}`);
  lines.push(`  Duration: ${result.durationMs}ms`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format as SARIF
 */
function formatAsSARIF(result: GateResult): object {
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'ISL Gate',
          version: '0.1.0',
          informationUri: 'https://github.com/isl-lang/isl',
        },
      },
      results: result.reasons.map(r => ({
        ruleId: r.code,
        message: { text: r.message },
        level: mapSeverity(r.severity),
        locations: r.files.map(f => ({
          physicalLocation: {
            artifactLocation: { uri: f },
          },
        })),
      })),
    }],
  };
}

function getSeverityIcon(severity?: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

function mapSeverity(severity?: string): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    default:
      return 'note';
  }
}
