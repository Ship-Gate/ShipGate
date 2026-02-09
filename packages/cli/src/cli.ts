/**
 * CLI Command Definitions
 * 
 * Defines all ISL CLI commands using commander.
 * 
 * Commands:
 *   isl parse <file>           # Parse and show AST
 *   isl check <file>           # Type check
 *   isl gen <target> <file>    # Generate code (ts, rust, go, openapi)
 *   isl verify <file>          # Verify spec against target
 *   isl repl                   # Start REPL
 *   isl init                   # Create .isl config and example spec
 *   isl fmt <file>             # Format ISL file
 *   isl lint <file>            # Lint ISL file for best practices
 */

import { Command, InvalidArgumentError } from 'commander';
import chalk from 'chalk';
import { output, type OutputFormat } from './output.js';
import { ExitCode } from './exit-codes.js';
import { findClosestMatch, isCI, isTTY } from './utils.js';
import { loadConfig, loadConfigFromFile } from './config.js';
import {
  loadShipGateConfig,
  ShipGateConfigError,
  shouldVerify as shouldVerifyFile,
  findMissingRequiredSpecs,
  generateStarterConfig,
} from './config/index.js';
import type { ShipGateConfig } from './config/index.js';
import {
  // Commands
  check, printCheckResult,
  generate, printGenerateResult,
  verify, printVerifyResult,
  unifiedVerify, printUnifiedVerifyResult, getUnifiedExitCode,
  init, printInitResult,
  interactiveInit, printInteractiveInitResult,
  parse, printParseResult, getParseExitCode,
  gen, printGenResult, getGenExitCode, VALID_TARGETS,
  repl,
  fmt, printFmtResult, getFmtExitCode,
  lint, printLintResult, getLintExitCode,
  gate, printGateResult, getGateExitCode,
  trustScore, printTrustScoreResult, printTrustScoreHistory, getTrustScoreExitCode,
  heal, printHealResult, getHealExitCode,
  verifyProof, printProofVerifyResult, getProofVerifyExitCode,
  proofPack, printProofPackResult, getProofPackExitCode,
  createPolicyBundle, printCreateBundleResult, getCreateBundleExitCode,
  verifyPolicyBundle, printVerifyBundleResult, getVerifyBundleExitCode,
  watch,
  pbt, printPBTResult, getPBTExitCode,
  chaos, printChaosResult, getChaosExitCode,
  islGenerate, printIslGenerateResult, getIslGenerateExitCode,
  specQuality, printSpecQualityResult, getSpecQualityExitCode,
  policyCheck, printPolicyCheckResult, getPolicyCheckExitCode,
  policyInit, printPolicyInitResult,
  shipgateChaosRun, printShipGateChaosResult, getShipGateChaosExitCode,
  verifyEvolution, printEvolutionResult, getEvolutionExitCode,
  simulateCommand, printSimulateResult, getSimulateExitCode,
  verifyRuntime, printVerifyRuntimeResult, getVerifyRuntimeExitCode,
  policyEngineCheck, printPolicyEngineResult, getPolicyEngineExitCode,
} from './commands/index.js';
import type { FailOnLevel } from './commands/verify.js';
import { TeamConfigError } from '@isl-lang/core';
import { withSpan, ISL_ATTR } from '@isl-lang/observability';

// ─────────────────────────────────────────────────────────────────────────────
// Version
// ─────────────────────────────────────────────────────────────────────────────

const VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// Available Commands (for suggestions)
// ─────────────────────────────────────────────────────────────────────────────

const COMMANDS = [
  'parse', 'check', 'gen', 'verify', 'repl', 'init', 'fmt', 'lint',
  'generate', 'build', // aliases
  'gate', // SHIP/NO-SHIP gate
  'gate:trust-score', 'trust-score', // Trust score engine
  'heal', // Auto-fix violations
  'proof', // Proof verification
  'watch', // Watch mode
  'pbt', // Property-based testing
  'chaos', // Chaos testing
  'isl-generate', // Generate ISL specs from source code
  'spec-quality', // Score ISL spec quality
  'shipgate', // ShipGate config management
  'shipgate truthpack build', 'shipgate truthpack diff', // Truthpack v2
  'shipgate simulate', // Behavior simulation
  'shipgate verify runtime', // Runtime probe verification
  'policy', 'policy check', 'policy team-init', // Team policy enforcement
  'verify evolution', // API evolution verification
];


// ─────────────────────────────────────────────────────────────────────────────
// CLI Setup
// ─────────────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('isl')
  .description(chalk.bold('Shipgate CLI') + '\n' + 
    chalk.gray('Define what your code should do. We enforce it.'))
  .version(VERSION, '-V, --version', 'Show version number')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--no-color', 'Disable colored output')
  .option('-f, --format <format>', 'Output format: pretty, json, quiet', 'pretty')
  .option('-c, --config <path>', 'Path to config file')
  .hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    
    // Determine format
    let format: OutputFormat = 'pretty';
    if (opts.format === 'json') format = 'json';
    else if (opts.format === 'quiet' || opts.quiet) format = 'quiet';
    
    // Auto-detect CI environment
    const noColor = !opts.color || isCI() || !isTTY();
    
    output.configure({
      verbose: opts.verbose ?? false,
      quiet: opts.quiet ?? false,
      noColor,
      format,
    });
    
    // Load custom config if specified
    if (opts.config) {
      const { config, error } = await loadConfigFromFile(opts.config);
      if (error) {
        console.error(chalk.red(`Error loading config: ${error}`));
        process.exit(ExitCode.USAGE_ERROR);
      }
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Parse Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('parse <file>')
  .description('Parse an ISL file and display the AST')
  .action(async (file: string) => {
    const opts = program.opts();
    const result = await parse(file, { 
      verbose: opts.verbose,
      format: opts.format,
    });
    
    printParseResult(result, { format: opts.format });
    process.exit(getParseExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Check Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('check [files...]')
  .description('Parse and type check ISL files')
  .option('-w, --watch', 'Watch for changes')
  .option('--debug', 'Print resolved imports debug info')
  .action(async (files: string[], options) => {
    const opts = program.opts();
    const result = await check(files, {
      verbose: opts.verbose,
      quiet: opts.format === 'quiet',
      watch: options.watch,
      config: opts.config,
      debug: options.debug,
    });
    
    if (opts.format === 'json') {
      console.log(JSON.stringify({
        success: result.success,
        files: result.files.map(f => ({
          file: f.file,
          valid: f.valid,
          errors: f.errors,
          warnings: f.warnings,
          stats: f.stats,
          imports: f.imports,
        })),
        totalErrors: result.totalErrors,
        totalWarnings: result.totalWarnings,
        duration: result.duration,
      }, null, 2));
    } else {
      printCheckResult(result);
    }
    
    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Gen Command (Code Generation)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('gen <target> <file>')
  .description(`Generate code from ISL spec\n  Targets: ${VALID_TARGETS.join(', ')}`)
  .option('-o, --output <dir>', 'Output directory')
  .option('--force', 'Overwrite existing files')
  .action(async (target: string, file: string, options) => {
    await withSpan('cli.gen', { attributes: { [ISL_ATTR.COMMAND]: 'gen', [ISL_ATTR.CODEGEN_TARGET]: target, [ISL_ATTR.CODEGEN_SOURCE]: file } }, async (genSpan) => {
    const opts = program.opts();
    const result = await gen(target, file, {
      output: options.output,
      force: options.force,
      verbose: opts.verbose,
      format: opts.format,
    });
    
    genSpan.setAttribute(ISL_ATTR.DURATION_MS, result.duration);
    genSpan.setAttribute(ISL_ATTR.EXIT_CODE, getGenExitCode(result));
    if (result.files.length > 0) {
      genSpan.setAttribute(ISL_ATTR.CODEGEN_OUTPUT, result.files.map(f => f.path).join(','));
    }
    if (!result.success) {
      genSpan.setError(result.errors.join('; '));
    }

    printGenResult(result, { format: opts.format });
    process.exit(getGenExitCode(result));
    }); // end withSpan('cli.gen')
  });

// ─────────────────────────────────────────────────────────────────────────────
// Generate Command (Legacy - types/tests/docs)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('generate [files...]')
  .description('Generate types, tests, and documentation from ISL files')
  .option('-t, --types', 'Generate TypeScript types')
  .option('-T, --tests', 'Generate test files')
  .option('-d, --docs', 'Generate documentation')
  .option('-o, --output <dir>', 'Output directory')
  .option('-w, --watch', 'Watch for changes')
  .option('--force', 'Overwrite existing files')
  .action(async (files: string[], options) => {
    const opts = program.opts();
    const hasSpecificFlag = options.types || options.tests || options.docs;
    
    const result = await generate(files, {
      types: hasSpecificFlag ? options.types : undefined,
      tests: hasSpecificFlag ? options.tests : undefined,
      docs: hasSpecificFlag ? options.docs : undefined,
      output: options.output,
      config: opts.config,
      watch: options.watch,
      force: options.force,
      verbose: opts.verbose,
    });
    
    if (opts.format === 'json') {
      console.log(JSON.stringify({
        success: result.success,
        files: result.files.map(f => ({ path: f.path, type: f.type })),
        errors: result.errors,
        duration: result.duration,
      }, null, 2));
    } else {
      printGenerateResult(result);
    }
    
    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Verify Command (Unified — auto-detects ISL, specless, or mixed mode)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('verify [path]')
  .description(
    'Verify code against ISL specifications (auto-detects mode)\n\n' +
    '  Modes:\n' +
    '    ISL       — path contains .isl specs for all code files\n' +
    '    Specless  — path has code but no .isl specs\n' +
    '    Mixed     — ISL where specs exist, specless elsewhere\n\n' +
    '  Legacy:\n' +
    '    --spec <file> --impl <file>  — verify one spec against one impl'
  )
  .option('--spec <file>', 'ISL spec file (legacy: verify this spec against --impl)')
  .option('-i, --impl <file>', 'Implementation file (used with --spec or as target)')
  .option('--proof <bundleDir>', 'Verify using proof bundle (instead of path)')
  .option('--json', 'Output structured JSON to stdout')
  .option('--ci', 'CI mode: JSON stdout, GitHub Actions annotations, no color')
  .option('--format <format>', 'Output format: json, text, gitlab, junit, github', 'text')
  .option('--fail-on <level>', 'Strictness: error (default), warning, unspecced', 'error')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('-s, --min-score <score>', 'Minimum trust score to pass', '70')
  .option('-d, --detailed', 'Show detailed breakdown')
  .option('--smt', 'Enable SMT verification for preconditions/postconditions')
  .option('--smt-timeout <ms>', 'SMT solver timeout in milliseconds', '5000')
  .option('--pbt', 'Enable property-based testing')
  .option('--pbt-tests <num>', 'Number of PBT test iterations', '100')
  .option('--pbt-seed <seed>', 'PBT random seed for reproducibility')
  .option('--pbt-max-shrinks <num>', 'Maximum PBT shrinking iterations', '100')
  .option('--temporal', 'Enable temporal verification (latency SLAs)')
  .option('--temporal-min-samples <num>', 'Minimum samples for temporal verification', '10')
  .option('--all', 'Enable all verification modes (SMT + PBT + Temporal)')
  .option('-r, --report <format>', 'Generate formatted report: md, pdf, json, html (or legacy: path to write evidence report)')
  .option('-o, --report-output <path>', 'Output path for formatted report file (default: stdout for text formats)')
  .option('--explain', 'Generate detailed explanation reports (verdict-explain.json and .md)')
  .action(async (path: string | undefined, options) => {
    await withSpan('cli.verify', { attributes: { [ISL_ATTR.COMMAND]: 'verify' } }, async (cliSpan) => {
    const opts = program.opts();

    // ── Proof bundle mode ────────────────────────────────────────────────
    if (options.proof) {
      try {
        const { verifyProof: vp, formatProofVerificationResult } = await import('@isl-lang/proof');
        cliSpan.addEvent('verify.proof_bundle', { path: options.proof });
        const proofResult = await vp(options.proof, {
          bundleDir: options.proof,
          verbose: opts.verbose,
          format: opts.format === 'json' ? 'json' : 'pretty',
        });

        const formatted = formatProofVerificationResult(proofResult, {
          format: opts.format === 'json' ? 'json' : 'pretty',
        });
        console.log(formatted);

        cliSpan.setAttribute(ISL_ATTR.EXIT_CODE, proofResult.success ? 0 : 1);
        process.exit(proofResult.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
        return;
      } catch (error) {
        console.error(
          chalk.red(
            `Error verifying proof bundle: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
        cliSpan.setError((error instanceof Error ? error.message : String(error)));
        process.exit(ExitCode.ISL_ERROR);
        return;
      }
    }

    // ── Load ShipGate config ─────────────────────────────────────────
    let vibeConfig: ShipGateConfig | undefined;
    try {
      const vcResult = await loadShipGateConfig(path ?? '.');
      vibeConfig = vcResult.config;
      if (opts.verbose && vcResult.source === 'file') {
        console.error(chalk.gray(`[shipgate] Loaded config from ${vcResult.configPath}`));
      }
    } catch (err) {
      if (err instanceof ShipGateConfigError) {
        console.error(chalk.red(err.message));
        process.exit(ExitCode.USAGE_ERROR);
        return;
      }
      // Non-fatal: proceed with defaults
      if (opts.verbose) {
        console.error(chalk.gray(`[shipgate] Config load warning: ${err instanceof Error ? err.message : String(err)}`));
      }
    }

    // ── Determine mode ──────────────────────────────────────────────────
    const isCiMode = options.ci || isCI();
    const outputFormat = options.format || opts.format || (options.json ? 'json' : undefined) || (isCiMode ? 'github' : 'text');
    const isJsonMode = options.json || outputFormat === 'json' || isCiMode;
    // CLI --fail-on takes precedence, then config, then default 'error'
    const failOn = (
      options.failOn !== 'error' ? options.failOn
        : vibeConfig?.ci?.failOn
          ?? 'error'
    ) as FailOnLevel;

    // Legacy: --spec + --impl → single-file ISL verification
    // Also legacy: path ends in .isl and --impl provided
    const isLegacySingleSpec =
      (options.spec && options.impl) ||
      (path && path.endsWith('.isl') && options.impl);

    if (isLegacySingleSpec) {
      const specFile = options.spec ?? path!;
      const enableAll = options.all;

      const singleResult = await verify(specFile, {
        impl: options.impl,
        timeout: parseInt(options.timeout),
        minScore: parseInt(options.minScore),
        detailed: options.detailed,
        report: options.report,
        format: isJsonMode ? 'json' : 'text',
        verbose: opts.verbose,
        json: isJsonMode,
        smt: enableAll || options.smt,
        smtTimeout: options.smtTimeout ? parseInt(options.smtTimeout) : undefined,
        pbt: enableAll || options.pbt,
        pbtTests: options.pbtTests ? parseInt(options.pbtTests) : undefined,
        pbtSeed: options.pbtSeed ? parseInt(options.pbtSeed) : undefined,
        pbtMaxShrinks: options.pbtMaxShrinks ? parseInt(options.pbtMaxShrinks) : undefined,
        temporal: enableAll || options.temporal,
        temporalMinSamples: options.temporalMinSamples
          ? parseInt(options.temporalMinSamples)
          : undefined,
      });

      if (isCiMode) {
        printVerifyResult(singleResult, { json: true });
        const score = singleResult.evidenceScore?.overall ?? singleResult.trustScore ?? 0;
        const failCount = singleResult.evidenceScore?.failedChecks ?? 0;
        if (singleResult.success) {
          process.stderr.write(`ShipGate: SHIP (score: ${score}/100)\n`);
        } else {
          process.stderr.write(
            `ShipGate: NO_SHIP (score: ${score}/100, ${failCount} failures)\n`,
          );
        }
      } else {
        printVerifyResult(singleResult, {
          detailed: options.detailed,
          format: isJsonMode ? 'json' : 'text',
        });
      }

      process.exit(singleResult.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
      return;
    }

    // ── Unified auto-detect mode ─────────────────────────────────────────
    const targetPath = path ?? options.impl ?? '.';

    const result = await unifiedVerify(targetPath, {
      spec: options.spec,
      impl: options.impl,
      json: isJsonMode,
      ci: isCiMode,
      format: outputFormat as 'json' | 'text' | 'gitlab' | 'junit' | 'github',
      failOn,
      verbose: opts.verbose,
      minScore: parseInt(options.minScore),
      detailed: options.detailed,
      report: options.report,
      timeout: parseInt(options.timeout),
      explain: options.explain,
    });

    // ── Apply ShipGate config enforcement ───────────────────────────────
    if (vibeConfig) {
      // Filter out ignored files from the result
      const ignorePatterns = vibeConfig.ci?.ignore ?? [];
      if (ignorePatterns.length > 0) {
        result.files = result.files.filter(f => {
          const sv = shouldVerifyFile(f.file, vibeConfig!);
          return sv.verify;
        });
      }

      // Check requireIsl enforcement
      const requireIslPatterns = vibeConfig.ci?.requireIsl ?? [];
      if (requireIslPatterns.length > 0) {
        const specMap = new Map<string, string>();
        for (const f of result.files) {
          if (f.specFile) {
            specMap.set(f.file, f.specFile);
          }
        }
        const missingSpecs = findMissingRequiredSpecs(
          result.files.map(f => f.file),
          specMap,
          vibeConfig,
        );
        if (missingSpecs.length > 0) {
          for (const fp of missingSpecs) {
            result.blockers.push(`${fp}: ISL spec required by ci.require_isl but missing`);
          }
          if (result.verdict !== 'NO_SHIP') {
            result.verdict = 'NO_SHIP';
            result.exitCode = 1;
          }
        }
      }
    }

    printUnifiedVerifyResult(result, {
      json: isJsonMode,
      ci: isCiMode,
      format: outputFormat as 'json' | 'text' | 'gitlab' | 'junit' | 'github',
      verbose: opts.verbose,
      detailed: options.detailed,
    });

    // ── Report generation (--report <format> [-o <path>]) ──────────────
    if (options.report) {
      const KNOWN_FORMATS: Record<string, 'markdown' | 'pdf' | 'json' | 'html'> = {
        md: 'markdown',
        markdown: 'markdown',
        pdf: 'pdf',
        json: 'json',
        html: 'html',
      };

      const formatKey = options.report.toLowerCase();
      if (KNOWN_FORMATS[formatKey]) {
        try {
          const { generateReport, buildReportData } = await import('@isl-lang/core/reporting');
          const gitInfo = await getGitInfo(targetPath);

          const reportData = buildReportData(result, {
            repository: gitInfo.repository,
            branch: gitInfo.branch,
            commit: gitInfo.commit,
          });

          const reportFormat = KNOWN_FORMATS[formatKey]!;
          const reportOutput = options.reportOutput ?? '-';

          const reportResult = await generateReport(reportData, {
            format: reportFormat,
            scope: 'full',
            includeRecommendations: true,
            includeTrends: false,
            outputPath: reportOutput,
          });

          if (reportResult.success) {
            if (reportOutput === '-' && reportResult.content) {
              // stdout mode — content already written by generateReport
              process.stdout.write(reportResult.content);
            } else if (reportResult.outputPath) {
              console.error(chalk.gray(`\nReport written to: ${reportResult.outputPath}`));
            }
          } else {
            console.error(chalk.yellow(`Warning: Report generation failed: ${reportResult.error}`));
          }
        } catch (err) {
          console.error(chalk.yellow(`Warning: Report generation failed: ${err instanceof Error ? err.message : String(err)}`));
        }
      }
      // Legacy behavior: if --report value is a file path, it was already
      // handled by the verify internals (options.report passed through).
    }

    cliSpan.setAttribute(ISL_ATTR.VERIFY_VERDICT, result.verdict);
    cliSpan.setAttribute(ISL_ATTR.VERIFY_SCORE, result.score);
    cliSpan.setAttribute(ISL_ATTR.VERIFY_MODE, result.mode);
    cliSpan.setAttribute(ISL_ATTR.FILE_COUNT, result.files.length);
    cliSpan.setAttribute(ISL_ATTR.DURATION_MS, result.duration);
    cliSpan.setAttribute(ISL_ATTR.EXIT_CODE, getUnifiedExitCode(result));

    process.exit(getUnifiedExitCode(result));
    }); // end withSpan('cli.verify')
  });

// ─────────────────────────────────────────────────────────────────────────────
// Git Info Helper (for report headers)
// ─────────────────────────────────────────────────────────────────────────────

async function getGitInfo(cwd: string): Promise<{
  repository: string;
  branch: string;
  commit?: string;
}> {
  const { execSync } = await import('child_process');
  const defaults = { repository: 'unknown', branch: 'unknown', commit: undefined };

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
    const commit = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf-8' }).trim();
    let repository = 'unknown';
    try {
      const remote = execSync('git remote get-url origin', { cwd, encoding: 'utf-8' }).trim();
      repository = remote
        .replace(/^(https?:\/\/|git@)/, '')
        .replace(/\.git$/, '')
        .replace(':', '/');
    } catch {
      // No remote configured
    }
    return { repository, branch, commit };
  } catch {
    return defaults;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PBT Command (Property-Based Testing)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('pbt <spec>')
  .description('Run property-based testing pipeline against an ISL specification')
  .option('-i, --impl <file>', 'Implementation file to verify')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('--tests <num>', 'Number of PBT test iterations', '100')
  .option('--seed <seed>', 'PBT random seed for reproducibility')
  .option('--max-shrinks <num>', 'Maximum PBT shrinking iterations', '100')
  .option('-d, --detailed', 'Show detailed breakdown')
  .option('--smt', 'Enable SMT verification for preconditions/postconditions')
  .option('--smt-timeout <ms>', 'SMT solver timeout in milliseconds', '5000')
  .option('--temporal', 'Enable temporal verification')
  .option('--temporal-min-samples <num>', 'Minimum samples for temporal verification', '10')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    
    if (!options.impl) {
      console.error(chalk.red('Error: --impl is required'));
      process.exit(ExitCode.USAGE_ERROR);
      return;
    }

    const result = await pbt(spec, {
      impl: options.impl,
      timeout: parseInt(options.timeout),
      tests: options.tests ? parseInt(options.tests) : undefined,
      seed: options.seed ? parseInt(options.seed) : undefined,
      maxShrinks: options.maxShrinks ? parseInt(options.maxShrinks) : undefined,
      verbose: opts.verbose,
      format: opts.format === 'json' ? 'json' : 'text',
      smt: options.smt,
      smtTimeout: options.smtTimeout ? parseInt(options.smtTimeout) : undefined,
      temporal: options.temporal,
      temporalMinSamples: options.temporalMinSamples ? parseInt(options.temporalMinSamples) : undefined,
    });
    
    printPBTResult(result, {
      detailed: options.detailed,
      format: opts.format === 'json' ? 'json' : 'text',
    });
    
    process.exit(getPBTExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Chaos Command (Chaos Testing)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('chaos <spec>')
  .description('Run chaos testing pipeline against an ISL specification (fault injection)')
  .option('-i, --impl <file>', 'Implementation file to verify')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('--seed <seed>', 'Random seed for reproducibility')
  .option('--continue-on-failure', 'Continue running scenarios after failure')
  .option('-d, --detailed', 'Show detailed breakdown')
  .option('--smt', 'Enable SMT verification for preconditions/postconditions')
  .option('--smt-timeout <ms>', 'SMT solver timeout in milliseconds', '5000')
  .option('--temporal', 'Enable temporal verification')
  .option('--temporal-min-samples <num>', 'Minimum samples for temporal verification', '10')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    
    if (!options.impl) {
      console.error(chalk.red('Error: --impl is required'));
      process.exit(ExitCode.USAGE_ERROR);
      return;
    }

    const result = await chaos(spec, {
      impl: options.impl,
      timeout: parseInt(options.timeout),
      seed: options.seed ? parseInt(options.seed) : undefined,
      continueOnFailure: options.continueOnFailure,
      verbose: opts.verbose,
      format: opts.format === 'json' ? 'json' : 'text',
      smt: options.smt,
      smtTimeout: options.smtTimeout ? parseInt(options.smtTimeout) : undefined,
      temporal: options.temporal,
      temporalMinSamples: options.temporalMinSamples ? parseInt(options.temporalMinSamples) : undefined,
    });
    
    printChaosResult(result, {
      detailed: options.detailed,
      format: opts.format === 'json' ? 'json' : 'text',
    });
    
    process.exit(getChaosExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Init Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('init [name]')
  .description('Set up ShipGate for your project (interactive), or create a new ISL project')
  .option('-t, --template <template>', 'Project template (minimal, full, api)', 'minimal')
  .option('-d, --directory <dir>', 'Target directory')
  .option('--force', 'Overwrite existing files')
  .option('--no-git', 'Skip git initialization')
  .option('-e, --examples', 'Include example files')
  .option('--from-code <path>', 'Generate ISL spec from existing source code (file or directory)')
  .option('--from-prompt <text>', 'Generate ISL spec from natural language prompt')
  .option('--ai', 'Use AI for spec generation (requires ANTHROPIC_API_KEY for best results)')
  .option('--api-key <key>', 'API key for AI provider (or use ANTHROPIC_API_KEY env)')
  .action(async (name: string | undefined, options) => {
    const opts = program.opts();

    // When called without a name: run interactive onboarding in the current directory
    if (!name && !options.fromCode && !options.fromPrompt) {
      const result = await interactiveInit({
        root: options.directory,
        force: options.force,
        format: opts.format,
      });

      if (opts.format === 'json') {
        console.log(JSON.stringify({
          success: result.success,
          profile: result.profile,
          configPath: result.configPath,
          workflowPath: result.workflowPath,
          islFiles: result.islFiles,
          errors: result.errors,
        }, null, 2));
      } else {
        printInteractiveInitResult(result);
      }

      process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
      return;
    }

    // When called with a name: create a new ISL project (original behavior)
    const projectName = name ?? 'my-isl-project';

    const result = await init(projectName, {
      template: options.template as 'minimal' | 'full' | 'api',
      directory: options.directory,
      force: options.force,
      skipGit: !options.git,
      examples: options.examples,
      fromCode: options.fromCode,
      fromPrompt: options.fromPrompt,
      ai: options.ai,
      apiKey: options.apiKey,
    });
    
    if (opts.format === 'json') {
      console.log(JSON.stringify({
        success: result.success,
        projectPath: result.projectPath,
        files: result.files,
        errors: result.errors,
      }, null, 2));
    } else {
      printInitResult(result);
    }
    
    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

// ─────────────────────────────────────────────────────────────────────────────
// REPL Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('repl')
  .description('Start interactive ISL REPL')
  .option('--load <file>', 'Load an ISL file on start')
  .option('--context <json>', 'Set initial evaluation context')
  .option('--parse', 'Parse mode (non-interactive, for piped input)')
  .option('--eval <commands>', 'Non-interactive mode: execute commands separated by semicolons and exit')
  .option('--timeout <ms>', 'Command timeout in milliseconds', '30000')
  .option('--allow-writes', 'Allow filesystem writes (default: false)')
  .action(async (options) => {
    const opts = program.opts();
    await repl({
      verbose: opts.verbose,
      load: options.load,
      context: options.context,
      parse: options.parse,
      eval: options.eval,
      timeout: parseInt(options.timeout),
      allowWrites: options.allowWrites,
    });
  });

// ─────────────────────────────────────────────────────────────────────────────
// Fmt Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('fmt <file>')
  .description('Format an ISL file')
  .option('--check', 'Check formatting without writing')
  .option('--no-write', 'Print formatted output instead of writing')
  .action(async (file: string, options) => {
    const opts = program.opts();
    const result = await fmt(file, {
      write: options.write,
      check: options.check,
      verbose: opts.verbose,
      format: opts.format,
    });
    
    printFmtResult(result, { verbose: opts.verbose, format: opts.format });
    process.exit(getFmtExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Lint Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('lint <file>')
  .description('Lint an ISL file for best practices')
  .option('--strict', 'Treat warnings as errors')
  .action(async (file: string, options) => {
    const opts = program.opts();
    const result = await lint(file, {
      verbose: opts.verbose,
      format: opts.format,
      strict: options.strict,
    });
    
    printLintResult(result, { verbose: opts.verbose, format: opts.format });
    process.exit(getLintExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Spec Quality Command (Score ISL specs on 5 dimensions)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('spec-quality <file>')
  .description('Score an ISL spec on quality dimensions (completeness, specificity, security, testability, consistency)')
  .option('-s, --min-score <score>', 'Minimum score to pass (fail if below)', '0')
  .option('--fix', 'Show detailed fix suggestions with ISL examples')
  .action(async (file: string, options) => {
    const opts = program.opts();
    const result = await specQuality(file, {
      verbose: opts.verbose,
      format: opts.format,
      minScore: parseInt(options.minScore),
      fix: options.fix,
    });

    printSpecQualityResult(result, {
      verbose: opts.verbose,
      format: opts.format,
      minScore: parseInt(options.minScore),
      fix: options.fix,
    });

    process.exit(getSpecQualityExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Build Command (Full Pipeline via Build Runner)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('build <pattern>')
  .description('Full ISL build pipeline: parse → check → codegen → testgen → verify → evidence\n  Supports glob patterns: specs/**/*.isl')
  .option('-o, --output <dir>', 'Output directory', './generated')
  .option('-t, --target <target>', 'Code generation target (typescript)', 'typescript')
  .option('--test-framework <framework>', 'Test framework (vitest, jest)', 'vitest')
  .option('--no-verify', 'Skip verification stage')
  .option('--no-html', 'Skip HTML report generation')
  .option('--no-chaos', 'Skip chaos test generation')
  .option('--no-helpers', 'Skip helper file generation')
  .action(async (pattern: string, options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';
    
    // Resolve pattern to files
    const { glob } = await import('glob');
    const specFiles = await glob(pattern, { ignore: ['node_modules/**', '.git/**'] });
    
    if (specFiles.length === 0) {
      const error = `No ISL files found matching pattern: ${pattern}`;
      if (!isJson) {
        console.error(chalk.red(`Error: ${error}`));
        console.log(chalk.gray('Try: isl build specs/**/*.isl'));
      } else {
        console.log(JSON.stringify({ success: false, error }, null, 2));
      }
      process.exit(ExitCode.USAGE_ERROR);
      return;
    }
    
    // Dynamically import build-runner to avoid startup cost when not used
    let buildRunner: typeof import('@isl-lang/build-runner');
    try {
      buildRunner = await import('@isl-lang/build-runner');
    } catch (error) {
      if (!isJson) {
        console.error(chalk.red('Error: Build runner not available'));
        console.log(chalk.gray('Install with: pnpm add @isl-lang/build-runner'));
      } else {
        console.log(JSON.stringify({ success: false, error: 'Build runner not available' }, null, 2));
      }
      process.exit(ExitCode.ISL_ERROR);
      return;
    }
    
    if (!isJson) {
      console.log('');
      console.log(chalk.bold.cyan('🔧 ISL Build Pipeline'));
      console.log(chalk.gray(`  Pattern: ${pattern}`));
      console.log(chalk.gray(`  Files: ${specFiles.length}`));
      console.log(chalk.gray(`  Output: ${options.output}`));
      console.log('');
    }

    // Build each spec file
    const results = [];
    let allSuccess = true;
    
    for (const spec of specFiles) {
      try {
        if (!isJson && specFiles.length > 1) {
          console.log(chalk.gray(`Building ${spec}...`));
        }
        
        const result = await buildRunner.run({
          specPath: spec,
          outDir: options.output,
          target: options.target as 'typescript',
          testFramework: options.testFramework as 'vitest' | 'jest',
          verify: options.verify,
          htmlReport: options.html,
          includeChaosTests: options.chaos,
          includeHelpers: options.helpers,
        });
        
        results.push({ spec, result });
        if (!result.success) {
          allSuccess = false;
        }
      } catch (error) {
        allSuccess = false;
        const message = error instanceof Error ? error.message : String(error);
        results.push({ spec, result: { success: false, errors: [{ message, stage: 'build' }] } });
      }
    }

    // Aggregate results
    if (specFiles.length === 1) {
      const { result } = results[0]!;

      if (!result.success) {
        if (!isJson) {
          console.log(chalk.red('✗ Build failed'));
          console.log('');
          for (const error of result.errors) {
            const location = error.file ? `${error.file}${error.line ? `:${error.line}` : ''}` : '';
            console.log(chalk.red(`  [${error.stage}] ${error.message}${location ? ` at ${location}` : ''}`));
          }
        } else {
          console.log(JSON.stringify({
            success: false,
            errors: result.errors,
            timing: result.timing,
          }, null, 2));
        }
        process.exit(ExitCode.ISL_ERROR);
        return;
      }

      if (!isJson) {
        console.log(chalk.bold.green('✓ Build complete!'));
        console.log('');
        
        // Show summary
        console.log(chalk.gray(`  Files generated: ${result.files.length}`));
        console.log(chalk.gray(`  Output directory: ${result.outDir}`));
        
        if (result.evidence) {
          const { summary } = result.evidence;
          const verdictColor = summary.verdict === 'verified' ? chalk.green : 
                              summary.verdict === 'risky' ? chalk.yellow : chalk.red;
          console.log('');
          console.log(chalk.bold('  Verification:'));
          console.log(`    Score: ${verdictColor(`${summary.overallScore}/100`)}`);
          console.log(`    Verdict: ${verdictColor(summary.verdict.toUpperCase())}`);
          console.log(`    Behaviors: ${summary.passedBehaviors}/${summary.totalBehaviors} passed`);
          console.log(`    Checks: ${summary.passedChecks}/${summary.totalChecks} passed`);
        }
        
        console.log('');
        console.log(chalk.gray(`  Total time: ${result.timing.total.toFixed(0)}ms`));
        console.log('');
        
        // Show file breakdown
        const counts = result.manifest.counts;
        console.log(chalk.gray('  Output breakdown:'));
        if (counts.types > 0) console.log(chalk.gray(`    Types: ${counts.types} files`));
        if (counts.test > 0) console.log(chalk.gray(`    Tests: ${counts.test} files`));
        if (counts.helper > 0) console.log(chalk.gray(`    Helpers: ${counts.helper} files`));
        if (counts.evidence > 0) console.log(chalk.gray(`    Evidence: ${counts.evidence} files`));
        if (counts.report > 0) console.log(chalk.gray(`    Reports: ${counts.report} files`));
        console.log('');
      } else {
        console.log(JSON.stringify({
          success: true,
          files: result.files.length,
          outDir: result.outDir,
          evidence: result.evidence ? {
            verdict: result.evidence.summary.verdict,
            score: result.evidence.summary.overallScore,
            behaviors: {
              total: result.evidence.summary.totalBehaviors,
              passed: result.evidence.summary.passedBehaviors,
            },
            checks: {
              total: result.evidence.summary.totalChecks,
              passed: result.evidence.summary.passedChecks,
            },
          } : null,
          timing: result.timing,
          manifest: result.manifest.counts,
        }, null, 2));
      }

      process.exit(ExitCode.SUCCESS);
    } else {
      // Multiple files - show summary
      if (!isJson) {
        const successCount = results.filter(r => r.result.success).length;
        console.log('');
        console.log(chalk.bold(allSuccess ? '✓ All builds complete!' : '✗ Some builds failed'));
        console.log(chalk.gray(`  Success: ${successCount}/${specFiles.length}`));
        console.log('');
        
        for (const { spec, result } of results) {
          if (!result.success) {
            console.log(chalk.red(`  ✗ ${spec}`));
            for (const error of result.errors || []) {
              const location = error.file ? `${error.file}${error.line ? `:${error.line}` : ''}` : '';
              console.log(chalk.red(`    [${error.stage}] ${error.message}${location ? ` at ${location}` : ''}`));
            }
          } else {
            console.log(chalk.green(`  ✓ ${spec}`));
          }
        }
        console.log('');
      } else {
        console.log(JSON.stringify({
          success: allSuccess,
          results: results.map(({ spec, result }) => ({
            spec,
            success: result.success,
            files: result.files?.length || 0,
            errors: result.errors || [],
          })),
        }, null, 2));
      }
      
      process.exit(allSuccess ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Policy Bundle Commands
// ─────────────────────────────────────────────────────────────────────────────

const policyCommand = program
  .command('policy')
  .description('Policy pack and bundle management');

const bundleCommand = policyCommand
  .command('bundle')
  .description('Policy bundle operations');

bundleCommand
  .command('create')
  .description('Create a policy bundle from current pack registry')
  .option('-o, --output <file>', 'Output bundle file path (default: stdout)')
  .option('-d, --description <text>', 'Bundle description')
  .option('--min-severity <level>', 'Minimum severity to include (error, warning, info)', 'error')
  .option('-c, --config <file>', 'Pack configuration file (JSON)')
  .action(async (options) => {
    const opts = program.opts();
    const result = await createPolicyBundle({
      output: options.output,
      description: options.description,
      minSeverity: options.minSeverity as 'error' | 'warning' | 'info',
      config: options.config,
      verbose: opts.verbose,
    });
    
    printCreateBundleResult(result, { verbose: opts.verbose });
    process.exit(getCreateBundleExitCode(result));
  });

bundleCommand
  .command('verify <bundle>')
  .description('Verify a policy bundle against current packs')
  .option('--no-compatibility', 'Skip compatibility checks')
  .action(async (bundle: string, options) => {
    const opts = program.opts();
    const result = await verifyPolicyBundle({
      bundle,
      checkCompatibility: options.compatibility !== false,
      verbose: opts.verbose,
    });
    
    printVerifyBundleResult(result, { verbose: opts.verbose });
    process.exit(getVerifyBundleExitCode(result));
  });

// ─── Team Policy Sub-commands ────────────────────────────────────────────────

policyCommand
  .command('check')
  .description('Validate current repo against team policies (.shipgate-team.yml)')
  .option('--team-config <path>', 'Path to team config file (default: auto-detect)')
  .option('-d, --directory <dir>', 'Repository root directory (default: cwd)')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    try {
      const result = await policyCheck({
        teamConfig: options.teamConfig,
        directory: options.directory,
        json: isJson,
        verbose: opts.verbose,
      });

      if (isJson) {
        console.log(JSON.stringify({
          passed: result.passed,
          team: result.config.team,
          violations: result.policyResult.violations,
          summary: result.policyResult.summary,
          source: result.config.source,
        }, null, 2));
      } else {
        printPolicyCheckResult(result, { verbose: opts.verbose });
      }

      process.exit(getPolicyCheckExitCode(result));
    } catch (err) {
      if (err instanceof TeamConfigError) {
        if (isJson) {
          console.log(JSON.stringify({ error: err.message, validationErrors: err.validationErrors }, null, 2));
        } else {
          console.error(chalk.red(err.message));
        }
        process.exit(ExitCode.USAGE_ERROR);
      }
      throw err;
    }
  });

policyCommand
  .command('team-init')
  .description('Generate a .shipgate-team.yml team config template')
  .option('-t, --team <name>', 'Team name (default: "my-team")')
  .option('-d, --directory <dir>', 'Directory to write the file (default: cwd)')
  .option('--force', 'Overwrite existing file')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    const result = await policyInit({
      team: options.team,
      directory: options.directory,
      force: options.force,
    });

    if (isJson) {
      console.log(JSON.stringify({
        success: result.success,
        filePath: result.filePath,
        error: result.error,
      }, null, 2));
    } else {
      printPolicyInitResult(result);
    }

    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

policyCommand
  .command('engine-check [directory]')
  .description('Run the DSL-based policy engine against a project directory')
  .option('--pack <packs...>', 'Only run specific pack IDs (e.g. starter)')
  .option('--ci', 'CI mode: JSON to stdout, one-line summary to stderr')
  .action(async (directory: string | undefined, options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';
    const isCi = options.ci || isCI();

    const result = await policyEngineCheck({
      directory,
      packs: options.pack,
      format: isJson ? 'json' : isCi ? 'json' : 'pretty',
      ci: isCi,
      verbose: opts.verbose,
    });

    if (isJson || isCi) {
      printPolicyEngineResult(result, { format: 'json', ci: isCi });
    } else {
      printPolicyEngineResult(result, { verbose: opts.verbose });
    }

    process.exit(getPolicyEngineExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Gate Command (SHIP/NO-SHIP)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('gate <spec>')
  .description('SHIP/NO-SHIP gate for AI-generated code. Verifies implementation against spec and returns a decision with evidence bundle.')
  .requiredOption('-i, --impl <file>', 'Implementation file or directory to verify')
  .option('-t, --threshold <score>', 'Minimum trust score to SHIP (default: 95)', '95')
  .option('-o, --output <dir>', 'Output directory for evidence bundle')
  .option('--ci', 'CI mode: minimal output, just the decision')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';
    const isCi = options.ci || isCI();
    
    if (!isCi && !isJson) {
      console.log('');
      console.log(chalk.bold.cyan('Shipgate'));
      console.log(chalk.gray(`   Spec: ${spec}`));
      console.log(chalk.gray(`   Impl: ${options.impl}`));
      console.log(chalk.gray(`   Threshold: ${options.threshold}%`));
      console.log('');
    }

    const result = await gate(spec, {
      impl: options.impl,
      threshold: parseInt(options.threshold),
      output: options.output ?? process.cwd(),
      verbose: opts.verbose,
      format: opts.format,
      ci: isCi,
    });

    printGateResult(result, {
      format: isJson ? 'json' : 'pretty',
      verbose: opts.verbose,
      ci: isCi,
    });

    process.exit(getGateExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Gate Trust-Score Subcommand
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('gate:trust-score <spec>')
  .alias('trust-score')
  .description('Compute a defensible 0-100 trust score from ISL verification results with per-category breakdown, history tracking, and gate enforcement.')
  .requiredOption('-i, --impl <file>', 'Implementation file or directory to verify')
  .option('-t, --threshold <score>', 'Minimum trust score to SHIP (default: 80)', '80')
  .option('-w, --weights <weights>', 'Custom weights (e.g. "preconditions=30,postconditions=25,invariants=20,temporal=10,chaos=5,coverage=10")')
  .option('--unknown-penalty <penalty>', 'Penalty for unknown/uncovered categories 0.0-1.0 (default: 0.5)', '0.5')
  .option('--history', 'Show trust score history instead of running evaluation')
  .option('--history-path <path>', 'Custom history file path (default: .isl-gate/trust-history.json)')
  .option('--commit-hash <hash>', 'Git commit hash to tag this evaluation')
  .option('--no-persist', 'Do not persist results to history')
  .option('--json', 'Output as JSON')
  .option('--ci', 'CI mode: minimal output')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const isJson = options.json || opts.format === 'json';
    const isCi = options.ci || isCI();

    // History mode
    if (options.history) {
      await printTrustScoreHistory(options.historyPath);
      process.exit(0);
    }

    if (!isCi && !isJson) {
      console.log('');
      console.log(chalk.bold.cyan('  Trust Score Engine'));
      console.log(chalk.gray(`  Spec:      ${spec}`));
      console.log(chalk.gray(`  Impl:      ${options.impl}`));
      console.log(chalk.gray(`  Threshold: ${options.threshold}`));
      if (options.weights) {
        console.log(chalk.gray(`  Weights:   ${options.weights}`));
      }
      console.log(chalk.gray(`  Unknown:   ${options.unknownPenalty} penalty`));
      console.log('');
    }

    const result = await trustScore(spec, {
      impl: options.impl,
      threshold: parseInt(options.threshold),
      weights: options.weights,
      unknownPenalty: parseFloat(options.unknownPenalty),
      history: options.history,
      json: isJson,
      ci: isCi,
      verbose: opts.verbose,
      historyPath: options.historyPath,
      commitHash: options.commitHash,
      noPersist: options.persist === false,
    });

    printTrustScoreResult(result, {
      json: isJson,
      verbose: opts.verbose,
      ci: isCi,
    });

    process.exit(getTrustScoreExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Heal Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('heal <pattern>')
  .description('Automatically fix violations in code to pass the gate')
  .option('-s, --spec <file>', 'ISL spec file (auto-discovers if not provided)')
  .option('--max-iterations <n>', 'Maximum healing iterations (default: 8)', '8')
  .option('--stop-on-repeat <n>', 'Stop after N identical fingerprints (default: 2)', '2')
  .action(async (pattern: string, options) => {
    const opts = program.opts();
    const result = await heal(pattern, {
      spec: options.spec,
      maxIterations: parseInt(options.maxIterations),
      stopOnRepeat: parseInt(options.stopOnRepeat),
      format: opts.format,
      verbose: opts.verbose,
    });
    
    printHealResult(result, { format: opts.format });
    process.exit(getHealExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Proof Verify Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('proof verify <bundle-path>')
  .description('Verify a proof bundle is valid and check its integrity')
  .option('--sign-secret <secret>', 'Secret for signature verification')
  .option('--skip-file-check', 'Skip file completeness check')
  .option('--skip-signature-check', 'Skip signature verification')
  .action(async (bundlePath: string, options) => {
    const opts = program.opts();
    const result = await verifyProof(bundlePath, {
      signSecret: options.signSecret,
      skipFileCheck: options.skipFileCheck,
      skipSignatureCheck: options.skipSignatureCheck,
      format: opts.format,
      verbose: opts.verbose,
    });
    
    printProofVerifyResult(result, { format: opts.format });
    process.exit(getProofVerifyExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Proof Pack Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('proof pack')
  .description('Pack artifacts into a deterministic, hashable, verifiable proof bundle')
  .requiredOption('--spec <file>', 'ISL spec file')
  .option('--evidence <dir>', 'Evidence directory (contains results.json, traces, etc.)')
  .option('-o, --output <dir>', 'Output directory for the proof bundle', '.proof-bundle')
  .option('--sign-secret <secret>', 'HMAC secret for signing the bundle')
  .option('--timestamp <iso>', 'Fixed ISO 8601 timestamp (for deterministic builds)')
  .action(async (options) => {
    const opts = program.opts();
    const result = await proofPack({
      spec: options.spec,
      evidence: options.evidence,
      output: options.output,
      signSecret: options.signSecret,
      timestamp: options.timestamp,
      format: opts.format,
      verbose: opts.verbose,
    });
    
    printProofPackResult(result, { format: opts.format });
    process.exit(getProofPackExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Watch Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('watch [files...]')
  .description('Watch ISL files and rerun parse/check + optionally gate on changes')
  .option('--gate', 'Run gate after check')
  .option('--heal', 'Run heal after check')
  .option('--changed-only', 'Only process changed files (not all files)')
  .option('-i, --impl <file>', 'Implementation path for gate (required if --gate)')
  .option('-t, --threshold <score>', 'Gate threshold (default: 95)', '95')
  .action(async (files: string[], options) => {
    const opts = program.opts();
    
    if (options.gate && !options.impl) {
      console.error(chalk.red('Error: --impl is required when using --gate'));
      process.exit(ExitCode.USAGE_ERROR);
      return;
    }

    const result = await watch(files, {
      gate: options.gate,
      heal: options.heal,
      changedOnly: options.changedOnly,
      impl: options.impl,
      threshold: parseInt(options.threshold),
      verbose: opts.verbose,
      quiet: opts.quiet || opts.format === 'quiet',
      debounceMs: 300,
    });

    if (!result.started) {
      console.error(chalk.red(`Failed to start watch: ${result.error ?? 'Unknown error'}`));
      process.exit(ExitCode.ISL_ERROR);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// ISL Generate Command (Generate ISL specs from source code)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('isl-generate <path>')
  .description(
    'Generate ISL spec files from existing source code\n\n' +
    '  Scans source files (.ts, .js, .py, .go), analyzes their structure,\n' +
    '  and produces ISL specification files for review and commit.',
  )
  .option('-o, --output <dir>', 'Output directory for .isl files (default: alongside source)')
  .option('--dry-run', 'Print specs to stdout instead of writing files')
  .option('--interactive', 'Ask for confirmation before writing each file')
  .option('--overwrite', 'Overwrite existing .isl files (default: skip)')
  .option('--force', 'Generate specs even for low-confidence files')
  .option('--confidence <threshold>', 'Minimum confidence threshold (0-1)', '0.3')
  .option('--ai', 'Use AI enhancement for spec generation')
  .action(async (path: string, options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    if (!isJson && !options.dryRun) {
      console.log('');
      console.log(chalk.bold.cyan('ShipGate ISL Generate'));
      console.log(chalk.gray(`  Path: ${path}`));
      if (options.output) {
        console.log(chalk.gray(`  Output: ${options.output}`));
      }
      console.log('');
    }

    const result = await islGenerate(path, {
      output: options.output,
      dryRun: options.dryRun,
      interactive: options.interactive,
      overwrite: options.overwrite,
      force: options.force,
      verbose: opts.verbose,
      format: opts.format,
      confidenceThreshold: parseFloat(options.confidence),
      ai: options.ai,
    });

    printIslGenerateResult(result, {
      format: opts.format,
      verbose: opts.verbose,
    });

    process.exit(getIslGenerateExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// ShipGate Command Group
// ─────────────────────────────────────────────────────────────────────────────

const shipgateCommand = program
  .command('shipgate')
  .description('ShipGate configuration management');

shipgateCommand
  .command('init')
  .description('Interactive project setup — generates .shipgate.yml, ISL specs, and CI workflow')
  .option('--force', 'Overwrite existing files')
  .option('-d, --directory <dir>', 'Project root directory (default: cwd)')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    const result = await interactiveInit({
      root: options.directory,
      force: options.force,
      format: opts.format,
    });

    if (isJson) {
      console.log(JSON.stringify({
        success: result.success,
        profile: result.profile,
        configPath: result.configPath,
        workflowPath: result.workflowPath,
        islFiles: result.islFiles,
        errors: result.errors,
      }, null, 2));
    } else {
      printInteractiveInitResult(result);
    }

    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

shipgateCommand
  .command('truthpack build')
  .description('Build truthpack v2 - canonical project reality snapshot')
  .option('-r, --repo-root <dir>', 'Repository root (default: cwd)')
  .option('-o, --output <dir>', 'Output directory (default: .shipgate/truthpack)')
  .option('--include <patterns>', 'Include file patterns (comma-separated)')
  .option('--exclude <patterns>', 'Exclude file patterns (comma-separated)')
  .option('--no-dependencies', 'Skip dependency extraction')
  .option('--no-db-schema', 'Skip DB schema detection')
  .option('--no-auth', 'Skip auth model detection')
  .option('--no-runtime-probes', 'Skip runtime probe detection')
  .action(async (options) => {
    const opts = program.opts();
    const result = await truthpackBuild({
      repoRoot: options.repoRoot,
      outputDir: options.output,
      includePatterns: options.include?.split(','),
      excludePatterns: options.exclude?.split(','),
      includeDependencies: options.dependencies !== false,
      detectDbSchema: options.dbSchema !== false,
      detectAuth: options.auth !== false,
      detectRuntimeProbes: options.runtimeProbes !== false,
    });

    printTruthpackBuildResult(result, {
      format: opts.format,
      verbose: opts.verbose,
    });

    process.exit(getTruthpackBuildExitCode(result));
  });

shipgateCommand
  .command('truthpack diff')
  .description('Compare truthpack v2 and detect drift')
  .option('-r, --repo-root <dir>', 'Repository root (default: cwd)')
  .option('--old <dir>', 'Old truthpack directory (default: .shipgate/truthpack/.previous)')
  .option('--new <dir>', 'New truthpack directory (default: .shipgate/truthpack)')
  .action(async (options) => {
    const opts = program.opts();
    const result = await truthpackDiff({
      repoRoot: options.repoRoot,
      oldDir: options.old,
      newDir: options.new,
    });

    printTruthpackDiffResult(result, {
      format: opts.format,
      verbose: opts.verbose,
    });

    process.exit(getTruthpackDiffExitCode(result));
  });

shipgateCommand
  .command('fix')
  .description('Auto-fix Shipgate findings with safe, minimal diffs')
  .option('--dry-run', 'Preview fixes without applying (default)')
  .option('--apply', 'Apply fixes to files')
  .option('--only <rule>', 'Only apply fixes for specific rule (can be used multiple times)', (val, prev) => {
    prev = prev || [];
    prev.push(val);
    return prev;
  }, [])
  .option('--evidence <path>', 'Path to evidence bundle JSON (default: auto-detect)')
  .option('--min-confidence <score>', 'Minimum confidence threshold (0-1, default: 0.6)', '0.6')
  .action(async (options) => {
    const opts = program.opts();
    const { runShipgateFix } = await import('@isl-lang/autofix');
    
    const result = await runShipgateFix({
      projectRoot: process.cwd(),
      dryRun: !options.apply,
      apply: options.apply || false,
      only: options.only || [],
      evidencePath: options.evidence,
      minConfidence: parseFloat(options.minConfidence || '0.6'),
      format: opts.format === 'json' ? 'json' : 'pretty',
    });

    process.exit(result.exitCode);
  });

shipgateCommand
  .command('simulate')
  .description('Simulate ISL behaviors against generated inputs')
  .requiredOption('-s, --spec <file>', 'ISL spec file')
  .option('-b, --behavior <name>', 'Behavior name to simulate (default: all behaviors)')
  .option('--generate', 'Generate inputs automatically')
  .option('-i, --input <file>', 'Input test data file (JSON)')
  .option('-c, --count <number>', 'Number of generated inputs (default: 5)', '5')
  .option('-t, --timeout <ms>', 'Timeout per simulation in milliseconds (default: 5000)', '5000')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    const result = await simulateCommand({
      spec: options.spec,
      behavior: options.behavior,
      generate: options.generate,
      input: options.input,
      count: parseInt(options.count),
      timeout: parseInt(options.timeout),
      verbose: opts.verbose,
      format: isJson ? 'json' : 'text',
    });

    printSimulateResult(result, {
      format: opts.format,
      verbose: opts.verbose,
    });

    process.exit(getSimulateExitCode(result));
  });

// ── Verify Runtime Subcommand ──────────────────────────────────────────────

const verifyRuntimeCommand = shipgateCommand
  .command('verify runtime')
  .description('Probe a running application against Truthpack route/env index.\n' +
    '  Checks route existence, env vars, fake-success patterns, and builds claims.')
  .requiredOption('-u, --url <baseUrl>', 'Base URL of the running application (e.g. http://localhost:3000)')
  .option('--truthpack <dir>', 'Path to truthpack directory (default: .guardrail/truthpack)')
  .option('-o, --output <dir>', 'Output directory for report artifacts')
  .option('-t, --timeout <ms>', 'Timeout per route probe in milliseconds', '10000')
  .option('--route-filter <prefixes>', 'Only probe routes with these path prefixes (comma-separated)')
  .option('--skip-auth', 'Skip routes requiring authentication')
  .option('--browser', 'Use Playwright browser probing for UI routes')
  .option('--header <key=value>', 'Extra HTTP header (repeatable)', (val: string, prev: string[]) => {
    prev = prev || [];
    prev.push(val);
    return prev;
  }, [] as string[])
  .option('--auth-token <token>', 'Bearer token for authenticated routes')
  .option('--concurrency <n>', 'Number of concurrent probes', '4')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    const result = await verifyRuntime({
      baseUrl: options.url,
      truthpackDir: options.truthpack,
      outputDir: options.output,
      timeout: options.timeout ? parseInt(options.timeout) : undefined,
      routeFilter: options.routeFilter?.split(','),
      skipAuth: options.skipAuth,
      browser: options.browser,
      headers: options.header,
      authToken: options.authToken,
      concurrency: options.concurrency ? parseInt(options.concurrency) : undefined,
      verbose: opts.verbose,
      json: isJson,
      format: isJson ? 'json' : 'text',
    });

    printVerifyRuntimeResult(result, {
      json: isJson,
      verbose: opts.verbose,
      format: opts.format,
    });

    process.exit(getVerifyRuntimeExitCode(result));
  });

const chaosCommand = shipgateCommand
  .command('chaos')
  .description('Chaos engineering commands');

chaosCommand
  .command('run')
  .description('Run chaos tests with deterministic seeds, bounded timeouts, and invariant violation claims')
  .requiredOption('--spec <file>', 'ISL spec file')
  .requiredOption('--impl <file>', 'Implementation file')
  .option('--seed <seed>', 'Deterministic seed for reproducibility (auto-generated if not provided)')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds (default: 30000, max: 300000 for CI safety)', '30000')
  .option('--continue-on-failure', 'Continue running scenarios after failure')
  .option('-d, --detailed', 'Show detailed breakdown')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';
    
    const seed = options.seed ? parseInt(options.seed) : undefined;
    const timeout = parseInt(options.timeout);

    const result = await shipgateChaosRun(options.spec, options.impl, {
      spec: options.spec,
      impl: options.impl,
      seed,
      timeout,
      continueOnFailure: options.continueOnFailure,
      verbose: opts.verbose,
      json: isJson,
      format: isJson ? 'json' : 'text',
    });

    printShipGateChaosResult(result, {
      detailed: options.detailed,
      format: opts.format,
      json: isJson,
    });

    process.exit(getShipGateChaosExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Unknown Command Handler
// ─────────────────────────────────────────────────────────────────────────────

program.on('command:*', ([cmd]) => {
  const suggestion = findClosestMatch(cmd, COMMANDS);
  
  console.error(chalk.red(`Unknown command: ${cmd}`));
  
  if (suggestion) {
    console.error(chalk.gray(`Did you mean: isl ${suggestion}?`));
  }
  
  console.error('');
  console.error(chalk.gray('Run `isl --help` to see available commands.'));
  process.exit(ExitCode.USAGE_ERROR);
});

// ─────────────────────────────────────────────────────────────────────────────
// Help Enhancement
// ─────────────────────────────────────────────────────────────────────────────

program.addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.gray('# Initialize a new ISL project')}
  $ isl init

  ${chalk.gray('# Build ISL spec (parse → check → codegen → verify)')}
  $ isl build specs/**/*.isl

  ${chalk.gray('# Heal code to fix violations automatically')}
  $ isl heal src/**/*.ts

  ${chalk.gray('# Verify a directory (auto-detect mode)')}
  $ isl verify src/

  ${chalk.gray('# Verify with JSON output for CI')}
  $ isl verify src/ --json

  ${chalk.gray('# Verify with strictness control')}
  $ isl verify src/ --fail-on unspecced

  ${chalk.gray('# Verify implementation against specific spec (legacy)')}
  $ isl verify src/auth.isl --impl src/auth.ts

  ${chalk.gray('# Verify with --spec and --impl flags')}
  $ isl verify --spec src/auth.isl --impl src/auth.ts

  ${chalk.gray('# Verify proof bundle')}
  $ isl proof verify ./proof-bundles/auth-bundle

  ${chalk.gray('# SHIP/NO-SHIP gate (the main workflow)')}
  $ isl gate src/auth.isl --impl src/auth.ts

  ${chalk.gray('# Parse and show AST')}
  $ isl parse src/auth.isl

  ${chalk.gray('# Check all ISL files')}
  $ isl check

  ${chalk.gray('# Generate TypeScript code')}
  $ isl gen ts src/auth.isl

  ${chalk.gray('# Format ISL file')}
  $ isl fmt src/auth.isl

  ${chalk.gray('# Start REPL')}
  $ isl repl

  ${chalk.gray('# Watch ISL files for changes')}
  $ isl watch

  ${chalk.gray('# Watch with gate on changes')}
  $ isl watch --gate --impl src/

  ${chalk.gray('# Watch only changed files')}
  $ isl watch --changed-only

  ${chalk.gray('# Generate ISL specs from existing source code')}
  $ isl isl-generate src/auth/

  ${chalk.gray('# Dry-run: preview specs without writing files')}
  $ isl isl-generate src/ --dry-run

  ${chalk.gray('# Generate with interactive confirmation')}
  $ isl isl-generate src/ --interactive

${chalk.bold('JSON Output:')}
  All commands support --json or --format json for machine-readable output:
  $ isl build specs/**/*.isl --json
  $ isl heal src/**/*.ts --json
  $ isl verify src/auth.isl --impl src/auth.ts --json

${chalk.bold('Exit Codes:')}
  ${chalk.gray('0')}  Success (SHIP)
  ${chalk.gray('1')}  ISL errors (NO-SHIP, parse/type/verification failures)
  ${chalk.gray('2')}  Usage errors (bad flags, missing file)
  ${chalk.gray('3')}  Internal errors

${chalk.bold('Documentation:')}
  ${chalk.cyan('https://intentos.dev/docs/cli')}
`);

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────────────────────

program.exitOverride((err: any) => {
  // Help and version display should exit with code 0
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(ExitCode.SUCCESS);
  }
  
  // Handle missing required arguments
  const errMessage = err.message || err.toString() || '';
  if (err.code === 'commander.missingArgument' || 
      errMessage.includes('missing required argument')) {
    // Error message already printed by Commander, just set exit code
    process.exit(ExitCode.USAGE_ERROR);
  }
  
  if (err.code === 'commander.unknownOption') {
    console.error(chalk.red(`Unknown option`));
    process.exit(ExitCode.USAGE_ERROR);
  }
  
  if (err.code === 'commander.invalidArgument') {
    console.error(chalk.red(`Invalid argument`));
    process.exit(ExitCode.USAGE_ERROR);
  }
  
  // For any other Commander errors, check message for usage errors
  if (errMessage.includes('missing required') ||
      errMessage.includes('unknown command') ||
      errMessage.includes('unknown option')) {
    process.exit(ExitCode.USAGE_ERROR);
  }
  
  throw err;
});

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export { program, VERSION };
export default program;
