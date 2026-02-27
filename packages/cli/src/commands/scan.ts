/**

 * Scan Command - Host and Reality-Gap Scanners

 *

 * Exposes hallucination scanners directly via CLI:

 * - Host: ShipGate truthpack validation (routes, env, imports, files)

 * - Reality-Gap: ShipGate policy packs (auth, pii, payments, rate-limit, intent)

 */



import { relative, resolve as resolvePath, join as joinPath, extname, basename } from 'path';
import { readFile as readFileAsync, writeFile as writeFileAsync, mkdir as mkdirAsync, readdir as readdirAsync, stat as statAsync } from 'fs/promises';

import type {

  HostScanResult,

  RealityGapScanResult,

  ScannerOptions,

} from '@isl-lang/isl-firewall';

import type { SpecAssistResponse } from '@isl-lang/spec-assist';
import type { GateVerdict } from '../types/verdict.js';



export type ScanType = 'host' | 'reality-gap';



export interface ScanCommandOptions {

  projectRoot?: string;

  truthpackPath?: string;

  config?: string;

  format?: 'pretty' | 'json' | 'sarif';

  ci?: boolean;

  changedOnly?: boolean;

  explain?: boolean;

}



export interface ScanCommandResult {

  success: boolean;

  exitCode: number;

  scanner: ScanType;

  verdict: 'SHIP' | 'NO_SHIP';

  score: number;

  filesChecked: number;

  violations: number;

  results: Array<{

    file: string;

    verdict: 'SHIP' | 'NO_SHIP';

    violations: Array<{

      rule: string;

      message: string;

      line?: number;

      severity: string;

      tier: string;

      suggestion?: string;

    }>;

  }>;

}



function toOutputResult(

  result: HostScanResult | RealityGapScanResult

): ScanCommandResult {

  return {

    success: result.verdict === 'SHIP',

    exitCode: result.verdict === 'SHIP' ? 0 : 1,

    scanner: result.scanner,

    verdict: result.verdict,

    score: result.score,

    filesChecked: result.filesChecked,

    violations: result.violations,

    results: result.results.map((r) => ({

      file: r.file,

      verdict: r.verdict,

      violations: r.violations,

    })),

  };

}



/**

 * Run Host scanner

 */

export async function runHostScanCommand(

  files: string[],

  options: ScanCommandOptions = {}

): Promise<ScanCommandResult> {

  const { runHostScan } = await import('@isl-lang/isl-firewall');

  const result = await runHostScan(files, {

    projectRoot: options.projectRoot ?? process.cwd(),

    truthpackPath: options.truthpackPath,

    config: options.config,

  });

  return toOutputResult(result);

}



/**

 * Run Reality-Gap scanner

 */

export async function runRealityGapScanCommand(

  files: string[],

  options: ScanCommandOptions = {}

): Promise<ScanCommandResult> {

  const { runRealityGapScan } = await import('@isl-lang/isl-firewall');

  const result = await runRealityGapScan(files, {

    projectRoot: options.projectRoot ?? process.cwd(),

    truthpackPath: options.truthpackPath,

    config: options.config,

  });

  return toOutputResult(result);

}



/**

 * Format scan result for console output

 */

export function formatScanResultForConsole(

  result: ScanCommandResult,

  options: { explain?: boolean }

): string {

  const lines: string[] = [];

  const scannerName =

    result.scanner === 'host' ? 'Host Scanner' : 'Reality-Gap Scanner';



  lines.push('');

  lines.push(`┌${'─'.repeat(50)}┐`);

  lines.push(`│ ${scannerName}${' '.repeat(50 - scannerName.length - 2)}│`);

  lines.push(`├${'─'.repeat(50)}┤`);

  lines.push(

    `│ Verdict: ${result.verdict === 'SHIP' ? '✓ SHIP' : '✗ NO_SHIP'}${' '.repeat(result.verdict === 'SHIP' ? 32 : 30)}│`

  );

  lines.push(`│ Score:   ${result.score}/100${' '.repeat(36)}│`);

  lines.push(

    `│ Files:   ${result.filesChecked}${' '.repeat(40 - String(result.filesChecked).length)}│`

  );

  lines.push(`└${'─'.repeat(50)}┘`);

  lines.push('');



  if (result.violations > 0) {

    lines.push(`Found ${result.violations} violation(s):`);

    lines.push('');



    for (const fileResult of result.results) {

      if (fileResult.violations.length === 0) continue;



      const relPath = relative(process.cwd(), fileResult.file);

      lines.push(`  ${relPath}`);

      for (const v of fileResult.violations) {

        const icon =

          v.tier === 'hard_block'

            ? '✗'

            : v.tier === 'soft_block'

              ? '!'

              : '○';

        lines.push(`    ${icon} [${v.rule}] ${v.message}`);

        if (options.explain && v.suggestion) {

          lines.push(`      └─ Fix: ${v.suggestion}`);

        }

      }

      lines.push('');

    }

  } else {

    lines.push('  All checks passed! ✓');

    lines.push('');

  }



  return lines.join('\n');

}



/**

 * Generate SARIF output for scan result

 */

export function formatScanResultAsSarif(result: ScanCommandResult): object {

  const rules = Array.from(

    new Set(result.results.flatMap((r) => r.violations.map((v) => v.rule)))

  ).map((id) => ({

    id,

    shortDescription: { text: id },

  }));



  return {

    $schema:

      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',

    version: '2.1.0',

    runs: [

      {

        tool: {

          driver: {

            name: result.scanner === 'host' ? 'Host Scanner' : 'Reality-Gap Scanner',

            version: '0.2.0',

            informationUri: 'https://shipgate.dev',

            rules,

          },

        },

        results: result.results.flatMap((fileResult) =>

          fileResult.violations.map((v) => ({

            ruleId: v.rule,

            message: { text: v.message },

            level:

              v.tier === 'hard_block'

                ? 'error'

                : v.tier === 'soft_block'

                  ? 'warning'

                  : 'note',

            locations: [

              {

                physicalLocation: {

                  artifactLocation: {

                    uri: relative(process.cwd(), fileResult.file),

                  },

                  region: v.line ? { startLine: v.line } : undefined,

                },

              },

            ],

          }))

        ),

      },

    ],

  };

}



/**

 * Get exit code from scan result

 */

export function getScanExitCode(result: ScanCommandResult): number {

  return result.exitCode;

}


// ─────────────────────────────────────────────────────────────────────────────
// Project Scan — "Scan Any Project" pipeline
// Walks a codebase, generates ISL specs per module, merges, runs truthpack,
// cross-references coverage, gates.
// ─────────────────────────────────────────────────────────────────────────────


const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx'],
  python: ['.py'],
  go: ['.go'],
  rust: ['.rs'],
};

export interface ProjectScanOptions {
  /** Glob patterns for file inclusion (default: all supported languages) */
  include?: string[];
  /** Minimum spec coverage (0-100) to pass. Fails (NO_SHIP) if below. */
  minCoverage?: number;
  /** AI provider for spec generation */
  provider?: 'anthropic' | 'openai';
  /** AI model override */
  model?: string;
  /** Output format */
  format?: 'pretty' | 'json';
  /** Verbose */
  verbose?: boolean;
}

export interface ProjectScanResult {
  success: boolean;
  verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
  filesScanned: number;
  specsGenerated: number;
  mergedSpecPath: string | null;
  truthpackUpdated: boolean;
  coverage: {
    total: number;
    covered: number;
    percent: number;
    gaps: string[];
  };
  gateResult: {
    verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
    score: number;
    violations: string[];
  } | null;
  duration: number;
  errors: string[];
}

function detectLanguage(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (exts.includes(ext)) return lang;
  }
  return null;
}

async function collectSourceFiles(
  dir: string,
  include?: string[],
): Promise<Array<{ path: string; language: string }>> {
  const results: Array<{ path: string; language: string }> = [];
  const allowedExts = new Set<string>();

  if (include && include.length > 0) {
    for (const pattern of include) {
      const ext = pattern.startsWith('.') ? pattern : `.${pattern}`;
      allowedExts.add(ext);
    }
  } else {
    for (const exts of Object.values(LANGUAGE_EXTENSIONS)) {
      for (const ext of exts) allowedExts.add(ext);
    }
  }

  async function walk(currentDir: string): Promise<void> {
    let entries;
    try {
      entries = await readdirAsync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' ||
          entry === 'build' || entry === '__pycache__' || entry === 'target' ||
          entry === 'vendor' || entry === '.git') {
        continue;
      }

      const fullPath = joinPath(currentDir, entry);
      let stats;
      try {
        stats = await statAsync(fullPath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        await walk(fullPath);
      } else if (stats.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (allowedExts.has(ext)) {
          const language = detectLanguage(entry);
          if (language) {
            results.push({ path: fullPath, language });
          }
        }
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Run the "scan any project" pipeline.
 *
 * 1. Walk directory, collect source files
 * 2. Generate ISL specs per module via spec-assist
 * 3. Merge into unified ISL document
 * 4. Run truthpack-v2 extraction
 * 5. Cross-reference coverage
 * 6. Run gate
 * 7. Output results
 */
export async function runProjectScan(
  targetPath: string,
  options: ProjectScanOptions = {},
): Promise<ProjectScanResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const resolvedPath = resolvePath(targetPath);

  // Step 1: Collect source files
  const sourceFiles = await collectSourceFiles(resolvedPath, options.include);

  if (sourceFiles.length === 0) {
    return {
      success: false,
      verdict: 'NO_SHIP',
      filesScanned: 0,
      specsGenerated: 0,
      mergedSpecPath: null,
      truthpackUpdated: false,
      coverage: { total: 0, covered: 0, percent: 0, gaps: [] },
      gateResult: null,
      duration: Date.now() - startTime,
      errors: ['No source files found in the target path'],
    };
  }

  // Step 2: Generate ISL specs per file/module via spec-assist
  const specFragments: string[] = [];
  const entityNames = new Set<string>();
  const behaviorNames = new Set<string>();

  type SpecAssistGenerateFn = (
    code: string,
    language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java',
    options?: { signature?: string; hints?: string[]; config?: Record<string, unknown> },
  ) => Promise<SpecAssistResponse>;

  let specGenFn: SpecAssistGenerateFn | null = null;

  try {
    const specAssist = await import('@isl-lang/spec-assist');
    if (specAssist.generateSpecFromCode) {
      specGenFn = specAssist.generateSpecFromCode as SpecAssistGenerateFn;
    }
  } catch {
    errors.push('spec-assist not available; skipping AI spec generation');
  }

  if (specGenFn) {
    const batchSize = 10;
    for (let i = 0; i < sourceFiles.length; i += batchSize) {
      const batch = sourceFiles.slice(i, i + batchSize);
      const batchPromises = batch.map(async (file) => {
        try {
          const content = await readFileAsync(file.path, 'utf-8');
          if (content.trim().length < 20) return null;

          const lang = file.language as 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java';
          const result = await specGenFn!(content, lang, {
            hints: [`File: ${relative(resolvedPath, file.path)}`],
            config: {
              provider: options.provider ?? (process.env['ANTHROPIC_API_KEY'] ? 'anthropic' : process.env['OPENAI_API_KEY'] ? 'openai' : 'stub'),
              model: options.model,
            },
          });

          if (result.success && result.isl) {
            return result.isl;
          }
        } catch (err) {
          errors.push(`spec-assist failed for ${relative(resolvedPath, file.path)}: ${err instanceof Error ? err.message : String(err)}`);
        }
        return null;
      });

      const results = await Promise.all(batchPromises);
      for (const spec of results) {
        if (spec) specFragments.push(spec);
      }
    }
  }

  // Step 3: Merge specs into unified ISL document
  const domainName = basename(resolvedPath).replace(/[^a-zA-Z0-9]/g, '');
  let mergedSpec = `domain ${domainName || 'ScannedProject'} {\n`;

  for (const fragment of specFragments) {
    const entityMatches = fragment.matchAll(/entity\s+(\w+)\s*\{/g);
    for (const match of entityMatches) {
      if (!entityNames.has(match[1]!)) {
        entityNames.add(match[1]!);
        const entityBlock = extractBlock(fragment, match.index!);
        if (entityBlock) mergedSpec += `  ${entityBlock}\n\n`;
      }
    }

    const behaviorMatches = fragment.matchAll(/behavior\s+(\w+)\s*\{/g);
    for (const match of behaviorMatches) {
      if (!behaviorNames.has(match[1]!)) {
        behaviorNames.add(match[1]!);
        const behaviorBlock = extractBlock(fragment, match.index!);
        if (behaviorBlock) mergedSpec += `  ${behaviorBlock}\n\n`;
      }
    }
  }

  mergedSpec += '}\n';

  // Write merged spec
  const shipgateDir = joinPath(resolvedPath, '.shipgate', 'specs');
  await mkdirAsync(shipgateDir, { recursive: true });
  const mergedSpecPath = joinPath(shipgateDir, 'auto-generated.isl');
  await writeFileAsync(mergedSpecPath, mergedSpec, 'utf-8');

  // Step 4: Run truthpack-v2 extraction
  let truthpackUpdated = false;
  let truthpackRoutes: string[] = [];
  let truthpackEnvVars: string[] = [];

  try {
    const { buildTruthpackSmart } = await import('@isl-lang/truthpack-v2');
    const tpResult = await buildTruthpackSmart({
      repoRoot: resolvedPath,
      outputDir: joinPath(resolvedPath, '.shipgate', 'truthpack'),
    });
    truthpackUpdated = tpResult.success;
    truthpackRoutes = (tpResult as Record<string, unknown>).routes as string[] ?? [];
    truthpackEnvVars = (tpResult as Record<string, unknown>).envVars as string[] ?? [];
  } catch {
    errors.push('truthpack-v2 not available; skipping truthpack extraction');
  }

  // Step 5: Cross-reference coverage
  const totalArtifacts = truthpackRoutes.length + truthpackEnvVars.length + sourceFiles.length;
  const coveredArtifacts = specFragments.length;
  const coveragePercent = totalArtifacts > 0
    ? Math.round((coveredArtifacts / totalArtifacts) * 100)
    : (specFragments.length > 0 ? 50 : 0);

  const coverageGaps: string[] = [];
  for (const route of truthpackRoutes) {
    const routeName = typeof route === 'string' ? route : String(route);
    if (!mergedSpec.includes(routeName)) {
      coverageGaps.push(`Route not covered by spec: ${routeName}`);
    }
  }

  // Step 6: Run gate (if available)
  let gateResult: ProjectScanResult['gateResult'] = null;
  try {
    const { gate: gateCmd } = await import('./gate.js');
    if (gateCmd) {
      const gResult: GateVerdict = await gateCmd(mergedSpecPath, {
        impl: resolvedPath,
        format: 'json',
      });
      const gateDecision = gResult.decision === 'NO-SHIP' ? 'NO_SHIP' : 'SHIP';
      gateResult = {
        verdict: gateDecision as 'SHIP' | 'NO_SHIP' | 'WARN',
        score: gResult.trustScore ?? 0,
        violations: gResult.results?.blockers?.map(b => `${b.clause}: ${b.reason}`) ?? [],
      };
    }
  } catch {
    errors.push('Gate command not available; skipping gate verification');
  }

  // Step 7: Determine final verdict
  const minCoverage = options.minCoverage ?? 0;
  let verdict: 'SHIP' | 'NO_SHIP' | 'WARN' = 'WARN';

  if (gateResult) {
    verdict = gateResult.verdict;
  }

  if (minCoverage > 0 && coveragePercent < minCoverage) {
    verdict = 'NO_SHIP';
    errors.push(`Spec coverage ${coveragePercent}% below minimum ${minCoverage}%`);
  }

  if (verdict === 'WARN' && specFragments.length > 0 && errors.length === 0) {
    verdict = 'SHIP';
  }

  return {
    success: verdict !== 'NO_SHIP',
    verdict,
    filesScanned: sourceFiles.length,
    specsGenerated: specFragments.length,
    mergedSpecPath,
    truthpackUpdated,
    coverage: {
      total: totalArtifacts,
      covered: coveredArtifacts,
      percent: coveragePercent,
      gaps: coverageGaps,
    },
    gateResult,
    duration: Date.now() - startTime,
    errors,
  };
}

function extractBlock(source: string, startIndex: number): string | null {
  let depth = 0;
  let started = false;
  let result = '';

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i]!;
    if (ch === '{') {
      depth++;
      started = true;
    }
    if (ch === '}') {
      depth--;
    }
    result += ch;
    if (started && depth === 0) {
      return result;
    }
  }
  return null;
}

export function formatProjectScanResult(result: ProjectScanResult): string {
  const lines: string[] = [];
  const verdictIcon = result.verdict === 'SHIP' ? '✓' : result.verdict === 'WARN' ? '!' : '✗';
  const coveragePct = result.coverage.percent;
  const coverageBar = renderProgressBar(coveragePct, 20);

  lines.push('');
  lines.push('┌──────────────────────────────────────────────────────┐');
  lines.push('│                  ShipGate Project Scan               │');
  lines.push('├──────────────────────────────────────────────────────┤');
  lines.push(`│  ${verdictIcon} Verdict:   ${padEnd(result.verdict, 40)}│`);
  lines.push(`│    Score:     ${padEnd(result.gateResult ? `${result.gateResult.score}/100` : 'N/A', 39)}│`);
  lines.push(`│    Duration:  ${padEnd(`${(result.duration / 1000).toFixed(1)}s`, 39)}│`);
  lines.push('├──────────────────────────────────────────────────────┤');
  lines.push(`│  Files scanned:   ${padEnd(String(result.filesScanned), 34)}│`);
  lines.push(`│  Specs generated: ${padEnd(String(result.specsGenerated), 34)}│`);
  lines.push(`│  Coverage:        ${padEnd(`${coverageBar} ${coveragePct}%`, 34)}│`);
  lines.push('└──────────────────────────────────────────────────────┘');

  if (result.mergedSpecPath) {
    lines.push('');
    lines.push(`  Merged ISL spec: ${relative(process.cwd(), result.mergedSpecPath)}`);
  }

  if (result.truthpackUpdated) {
    lines.push('  Truthpack:       updated');
  }

  if (result.gateResult && result.gateResult.violations.length > 0) {
    lines.push('');
    lines.push(`  Violations (${result.gateResult.violations.length}):`);
    for (const v of result.gateResult.violations.slice(0, 10)) {
      lines.push(`    ✗ ${v}`);
    }
    if (result.gateResult.violations.length > 10) {
      lines.push(`    ... and ${result.gateResult.violations.length - 10} more`);
    }
  }

  if (result.coverage.gaps.length > 0) {
    lines.push('');
    lines.push(`  Coverage gaps (${result.coverage.gaps.length}):`);
    for (const gap of result.coverage.gaps.slice(0, 10)) {
      lines.push(`    • ${gap}`);
    }
    if (result.coverage.gaps.length > 10) {
      lines.push(`    ... and ${result.coverage.gaps.length - 10} more`);
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('  Issues:');
    for (const err of result.errors) {
      lines.push(`    • ${err}`);
    }
  }

  lines.push('');
  lines.push('  Next steps:');
  if (result.verdict === 'SHIP') {
    lines.push('    Your project is safe to ship.');
    if (result.mergedSpecPath) {
      lines.push(`    $ shipgate verify ${relative(process.cwd(), result.mergedSpecPath)}   # Re-verify anytime`);
    }
    lines.push('    $ shipgate gate --ci                                    # Add to CI pipeline');
  } else if (result.verdict === 'WARN') {
    lines.push('    Review the generated specs and coverage gaps.');
    if (result.mergedSpecPath) {
      lines.push(`    $ cat ${relative(process.cwd(), result.mergedSpecPath)}              # Review generated ISL`);
      lines.push(`    $ shipgate verify ${relative(process.cwd(), result.mergedSpecPath)}   # Re-verify after fixes`);
    }
  } else {
    lines.push('    Fix violations, then re-scan:');
    lines.push('    $ shipgate scan .                                       # Re-scan project');
    if (result.mergedSpecPath) {
      lines.push(`    $ shipgate heal ${relative(process.cwd(), result.mergedSpecPath)}     # Auto-fix with AI`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function renderProgressBar(percent: number, width: number): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

function padEnd(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

