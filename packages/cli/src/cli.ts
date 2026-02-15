/**
 * CLI Command Definitions
 *
 * ShipGate CLI — primary command: shipgate. Alias: isl.
 *
 * Commands:
 *   shipgate parse <file>      # Parse and show AST
 *   shipgate check <file>      # Type check
 *   shipgate gen <target> <file>  # Generate code (ts, rust, go, openapi)
 *   shipgate verify <file>     # Verify spec against target
 *   shipgate repl             # Start REPL
 *   shipgate init             # Create .isl config and example spec
 *   shipgate fmt <file>       # Format ISL file
 *   shipgate lint <file>      # Lint ISL file for best practices
 */

/** Injected at build time from package.json */
declare const __SHIPGATE_CLI_VERSION__: string | undefined;

import { Command, InvalidArgumentError } from 'commander';
import chalk from 'chalk';
import path from 'path';
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
  genAI,
  configSet, configGet, configList, configPath, printConfigResult, getConfigExitCode,
  repl,
  fmt, printFmtResult, getFmtExitCode,
  lint, printLintResult, getLintExitCode,
  gate, printGateResult, getGateExitCode,
  trustScore, printTrustScoreResult, printTrustScoreHistory, getTrustScoreExitCode,
  trustScoreExplain, printTrustScoreExplain,
  heal, aiHeal, printHealResult, getHealExitCode,
  verifyProof, printProofVerifyResult, getProofVerifyExitCode,
  proofPack, printProofPackResult, getProofPackExitCode,
  generateBadge, printBadgeResult, getBadgeExitCode,
  generateAttestation, printAttestationResult, getAttestationExitCode,
  generatePRComment, printCommentResult, getCommentExitCode,
  createPolicyBundle, printCreateBundleResult, getCreateBundleExitCode,
  verifyPolicyBundle, printVerifyBundleResult, getVerifyBundleExitCode,
  watch,
  pbt, printPBTResult, getPBTExitCode,
  chaos, printChaosResult, getChaosExitCode,
  islGenerate, printIslGenerateResult, getIslGenerateExitCode,
  specQuality, printSpecQualityResult, getSpecQualityExitCode,
  securityReport, printSecurityReportResult, getSecurityReportExitCode,
  policyCheck, printPolicyCheckResult, getPolicyCheckExitCode,
  policyInit, printPolicyInitResult,
  shipgateChaosRun, printShipGateChaosResult, getShipGateChaosExitCode,
  verifyEvolution, printEvolutionResult, getEvolutionExitCode,
  simulateCommand, printSimulateResult, getSimulateExitCode,
  verifyRuntime, printVerifyRuntimeResult, getVerifyRuntimeExitCode,
  policyEngineCheck, printPolicyEngineResult, getPolicyEngineExitCode,
  detectDrift, printDriftResult, getDriftExitCode,
  installPack, listPacks, verifyPackInstall, printInstallResult, printListResult, printPackVerifyResult, getInstallExitCode, getPackVerifyExitCode,
  domainInit, printDomainInitResult,
  domainValidate, printDomainValidateResult, getDomainValidateExitCode,
  coverage, printCoverageResult, getCoverageExitCode,
  complianceSOC2, printComplianceSOC2Result, getComplianceSOC2ExitCode,
  demo, printDemoResult, getDemoExitCode,
  migrate, printMigrateResult, getMigrateExitCode,
  bind, printBindResult, getBindExitCode,
  truthpackBuild, printTruthpackBuildResult, getTruthpackBuildExitCode,
  truthpackDiff, printTruthpackDiffResult, getTruthpackDiffExitCode,
  provenanceInit, printProvenanceInitResult,
  shipCommand,
  vibe, printVibeResult, getVibeExitCode,
  verifyCert, printVerifyCertResult, getVerifyCertExitCode,
  seedGenerate, seedRun, seedReset,
  printSeedGenerateResult, printSeedRunResult, printSeedResetResult,
  getSeedGenerateExitCode, getSeedRunExitCode, getSeedResetExitCode,
  openapiGenerate, openapiValidate,
  printOpenAPIGenerateResult, printOpenAPIValidateResult,
  getOpenAPIGenerateExitCode, getOpenAPIValidateExitCode,
  diffOpenAPI, printDiffOpenAPIResult, getDiffOpenAPIExitCode,
} from './commands/index.js';
import type { FailOnLevel } from './commands/verify.js';
import { TeamConfigError } from '@isl-lang/core';
import { initTracing, shutdownTracing, getCurrentTraceId, withSpan, ISL_ATTR, type TracedSpan } from '@isl-lang/observability';

// ─────────────────────────────────────────────────────────────────────────────
// Version (injected at build time from package.json)
// ─────────────────────────────────────────────────────────────────────────────

const VERSION = typeof __SHIPGATE_CLI_VERSION__ !== 'undefined' ? __SHIPGATE_CLI_VERSION__ : '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// Available Commands (for suggestions)
// ─────────────────────────────────────────────────────────────────────────────

const COMMANDS = [
  'parse', 'check', 'gen', 'verify', 'repl', 'init', 'fmt', 'lint',
  'generate', 'build', // aliases
  'gate', // SHIP/NO-SHIP gate
  'verify-cert', // Verify ISL certificate integrity
  'gate:trust-score', 'trust-score', // Trust score engine
  'heal', // Auto-fix violations
  'proof', // Proof verification
  'watch', // Watch mode
  'pbt', // Property-based testing
  'chaos', // Chaos testing
  'isl-generate', // Generate ISL specs from source code
  'spec-quality', // Score ISL spec quality
  'security-report', // Standalone security scan
  'shipgate', // ShipGate config management
  'shipgate truthpack build', 'shipgate truthpack diff', // Truthpack v2
  'shipgate simulate', // Behavior simulation
  'shipgate verify runtime', // Runtime probe verification
  'shipgate domain init', 'shipgate domain validate', // Domain pack management
  'policy', 'policy check', 'policy team-init', // Team policy enforcement
  'verify evolution', // API evolution verification
  'drift', // Drift detection between code and specs
  'vibe', // Safe Vibe Coding: NL → ISL → codegen → verify → SHIP
  'seed generate', 'seed run', 'seed reset', // Prisma seed from ISL
];


// ─────────────────────────────────────────────────────────────────────────────
// CLI Setup
// ─────────────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('shipgate')
  .description(chalk.bold('ShipGate CLI') + '\n' +
    chalk.gray('Define what your code should do. We enforce it.') + '\n' +
    chalk.gray("('isl' is an alias — use 'shipgate' for the canonical CLI.)"))
  .version(VERSION, '-V, --version', 'Show version number')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--no-color', 'Disable colored output')
  .option('-f, --format <format>', 'Output format: pretty, json, quiet', 'pretty')
  .option('-c, --config <path>', 'Path to config file')
  .hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    
    // Initialize tracing if enabled
    initTracing({
      enabled: process.env['ISL_TRACE'] === '1' || process.env['SHIPGATE_TRACE'] === '1',
      serviceName: 'shipgate-cli',
      exporter: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ? {
        type: 'otlp',
        endpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
        headers: process.env['OTEL_EXPORTER_OTLP_HEADERS'] ? 
          Object.fromEntries(
            process.env['OTEL_EXPORTER_OTLP_HEADERS'].split(',').map(h => {
              const [k, v] = h.split('=');
              return [k.trim(), v.trim()];
            })
          ) : undefined,
      } : undefined,
    });
    
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
  
  // Shutdown tracing on exit
  process.on('SIGINT', async () => {
    await shutdownTracing();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await shutdownTracing();
    process.exit(0);
  });
  
  process.on('beforeExit', async () => {
    await shutdownTracing();
  });

// ─────────────────────────────────────────────────────────────────────────────
// Parse Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('parse <file>')
  .description('Parse an ISL file and display the AST')
  .option('--fuzzy', 'Use fuzzy parser mode (normalizes AI-generated patterns, error recovery)')
  .action(async (file: string, options: { fuzzy?: boolean }) => {
    const opts = program.opts();
    const result = await parse(file, {
      verbose: opts.verbose,
      format: opts.format,
      fuzzy: options.fuzzy,
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
  .description(`Generate code from ISL spec\n  Targets: ${VALID_TARGETS.join(', ')}\n  Examples:\n    shipgate gen python auth.isl    # Generate Python Pydantic models\n    shipgate gen graphql api.isl    # Generate GraphQL schema and resolvers\n    shipgate gen ts auth.isl --ai   # AI-powered implementation generation`)
  .option('-o, --output <dir>', 'Output directory')
  .option('--force', 'Overwrite existing files')
  .option('--ai', 'Use AI (LLM) to generate real implementations instead of type stubs')
  .option('--provider <provider>', 'AI provider: anthropic or openai (default: anthropic)')
  .option('--model <model>', 'AI model override')
  .option('--include-tests', 'Include tests in AI-generated output')
  .option('--include-validation', 'Include validation logic in AI-generated output')
  .option('--style <style>', 'Code style: functional, oop, or hybrid (default: hybrid)')
  .action(async (target: string, file: string, options) => {
    await withSpan('cli.gen', { attributes: { [ISL_ATTR.COMMAND]: 'gen', [ISL_ATTR.CODEGEN_TARGET]: target, [ISL_ATTR.CODEGEN_SOURCE]: file } }, async (genSpan: TracedSpan) => {
    const opts = program.opts();

    // AI-powered generation
    if (options.ai) {
      const result = await genAI(target, file, {
        output: options.output,
        force: options.force,
        verbose: opts.verbose,
        format: opts.format,
        provider: options.provider,
        model: options.model,
        includeTests: options.includeTests,
        includeValidation: options.includeValidation,
        style: options.style,
      });

      genSpan.setAttribute('isl.ai.enabled', true);
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
      return;
    }

    // Template-based generation (default)
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
// Config Command (API keys, AI settings)
// ─────────────────────────────────────────────────────────────────────────────

const configCmd = program
  .command('config')
  .description('Manage ShipGate CLI configuration (API keys, AI settings)\n  Examples:\n    shipgate config set ai.provider anthropic\n    shipgate config set ai.apiKey ${ANTHROPIC_API_KEY}\n    shipgate config list');

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key: string, value: string) => {
    const opts = program.opts();
    const result = await configSet(key, value);
    printConfigResult(result, { format: opts.format });
    process.exit(getConfigExitCode(result));
  });

configCmd
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key: string) => {
    const opts = program.opts();
    const result = await configGet(key);
    printConfigResult(result, { format: opts.format });
    process.exit(getConfigExitCode(result));
  });

configCmd
  .command('list')
  .description('List all configuration values')
  .action(async () => {
    const opts = program.opts();
    const result = await configList();
    printConfigResult(result, { format: opts.format });
    process.exit(getConfigExitCode(result));
  });

configCmd
  .command('path')
  .description('Show config file path')
  .action(async () => {
    const opts = program.opts();
    const result = await configPath();
    printConfigResult(result, { format: opts.format });
    process.exit(getConfigExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// OpenAPI Command (generate, validate, diff)
// ─────────────────────────────────────────────────────────────────────────────

const openapiCmd = program
  .command('openapi')
  .description('OpenAPI spec generation and validation');

openapiCmd
  .command('generate <file>')
  .description('Generate OpenAPI 3.1 spec from ISL file')
  .option('-o, --output <path>', 'Output path (default: openapi.json)')
  .option('-f, --format <format>', 'Output format: json or yaml', 'json')
  .action(async (file: string, options) => {
    const opts = program.opts();
    const result = await openapiGenerate(file, {
      output: options.output,
      format: options.format === 'yaml' ? 'yaml' : 'json',
    });
    printOpenAPIGenerateResult(result, { format: opts.format });
    process.exit(getOpenAPIGenerateExitCode(result));
  });

openapiCmd
  .command('validate <file>')
  .description('Validate OpenAPI spec with @apidevtools/swagger-parser')
  .action(async (file: string) => {
    const opts = program.opts();
    const result = await openapiValidate(file);
    printOpenAPIValidateResult(result, { format: opts.format });
    process.exit(getOpenAPIValidateExitCode(result));
  });

openapiCmd
  .command('diff <old> <new>')
  .description('Show changes between two OpenAPI specs')
  .option('--breaking-only', 'Show only breaking changes')
  .action(async (oldFile: string, newFile: string, options) => {
    const opts = program.opts();
    const result = await diffOpenAPI(oldFile, newFile, {
      format: opts.format,
      breakingOnly: options.breakingOnly,
    });
    printDiffOpenAPIResult(result, { format: opts.format });
    process.exit(getDiffOpenAPIExitCode(result));
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
  .option('--smt-solver <solver>', 'SMT solver to use: builtin, z3, cvc5, or auto (default: auto)', 'auto')
  .option('--pbt', 'Enable property-based testing')
  .option('--pbt-tests <num>', 'Number of PBT test iterations', '100')
  .option('--pbt-seed <seed>', 'PBT random seed for reproducibility')
  .option('--pbt-max-shrinks <num>', 'Maximum PBT shrinking iterations', '100')
  .option('--temporal', 'Enable temporal verification (latency SLAs)')
  .option('--temporal-min-samples <num>', 'Minimum samples for temporal verification', '10')
  .option('--reality', 'Enable reality probe (route and env var verification)')
  .option('--reality-base-url <url>', 'Base URL for reality probe (e.g., http://localhost:3000)')
  .option('--reality-route-map <path>', 'Path to route map or OpenAPI spec (default: .shipgate/truthpack/routes.json)')
  .option('--reality-env-vars <path>', 'Path to env vars JSON (default: .shipgate/truthpack/env.json)')
  .option('--all', 'Enable all verification modes (SMT + PBT + Temporal + Reality)')
  .option('--sandbox <mode>', 'Sandbox execution mode: auto (default), worker, docker, or off (no sandbox)', 'auto')
  .option('--sandbox-timeout <ms>', 'Sandbox execution timeout in milliseconds', '30000')
  .option('--sandbox-memory <mb>', 'Maximum memory limit in MB for sandbox execution', '128')
  .option('--sandbox-env <vars>', 'Comma-separated list of allowed environment variables (default: NODE_ENV,PATH)', 'NODE_ENV,PATH')
  .option('-r, --report <format>', 'Generate formatted report: md, pdf, json, html (or legacy: path to write evidence report)')
  .option('-o, --report-output <path>', 'Output path for formatted report file (default: stdout for text formats)')
  .option('--explain', 'Generate detailed explanation reports (verdict-explain.json and .md)')
  .option('--spec-coverage', 'Report spec coverage: files with specs, auto-specced, unspecced')
  .option('--tiered-scoring', 'Use tiered trust score (Tier 1=3x, Tier 2=2x, Tier 3=1x)')
  .action(async (path: string | undefined, options) => {
    await withSpan('cli.verify', { attributes: { [ISL_ATTR.COMMAND]: 'verify' } }, async (cliSpan: TracedSpan) => {
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
    let vibeConfigPath: string | null = null;
    try {
      const vcResult = await loadShipGateConfig(path ?? '.');
      vibeConfig = vcResult.config;
      vibeConfigPath = vcResult.configPath ?? null;
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
        smtSolver: options.smtSolver as 'builtin' | 'z3' | 'cvc5' | 'auto' | undefined,
        pbt: enableAll || options.pbt,
        pbtTests: options.pbtTests ? parseInt(options.pbtTests) : undefined,
        pbtSeed: options.pbtSeed ? parseInt(options.pbtSeed) : undefined,
        pbtMaxShrinks: options.pbtMaxShrinks ? parseInt(options.pbtMaxShrinks) : undefined,
        temporal: enableAll || options.temporal,
        temporalMinSamples: options.temporalMinSamples
          ? parseInt(options.temporalMinSamples)
          : undefined,
        temporalTraceFiles: options.temporalTraceFiles
          ? options.temporalTraceFiles.split(',').map((f: string) => f.trim())
          : undefined,
        temporalTraceDir: options.temporalTraceDir,
        reality: enableAll || options.reality,
        realityBaseUrl: options.realityBaseUrl,
        realityRouteMap: options.realityRouteMap,
        realityEnvVars: options.realityEnvVars,
      });

      if (isCiMode) {
        await printVerifyResult(singleResult, { json: true });
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
        await printVerifyResult(singleResult, {
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
      quiet: isJsonMode,
      failOn,
      shipgateConfig: vibeConfig,
      guardrails: vibeConfig?.guardrails,
      guardrailConfigSource: vibeConfigPath,
      verbose: opts.verbose,
      minScore: parseInt(options.minScore),
      detailed: options.detailed,
      report: options.report,
      timeout: parseInt(options.timeout),
      explain: options.explain,
      specCoverage: options.specCoverage,
      useTieredScoring: options.tieredScoring,
    });

    // ── Apply ShipGate config enforcement ───────────────────────────────
    if (vibeConfig) {
      // Filter out ignored files from the result
      const ignorePatterns = vibeConfig.ci?.ignore ?? [];
      if (ignorePatterns.length > 0) {
        result.files = result.files.filter((f: { file: string }) => {
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
  .option('--smt-solver <solver>', 'SMT solver to use: builtin, z3, cvc5, or auto (default: auto)', 'auto')
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

const chaosCommandGroup = program
  .command('chaos')
  .description('Chaos testing commands');

chaosCommandGroup
  .command('run <spec>')
  .description('Run chaos tests with scenario selection, N trials, and metrics output')
  .requiredOption('-i, --impl <file>', 'Implementation file to verify')
  .option('-s, --scenario <name>', 'Select specific scenario by name (can be used multiple times)', (val: string, prev: string[] | undefined) => {
    if (prev) return [...prev, val];
    return [val];
  }, [] as string[])
  .option('-n, --trials <num>', 'Number of trials to run', '1')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('--seed <seed>', 'Random seed for reproducibility')
  .option('--continue-on-failure', 'Continue running scenarios after failure')
  .option('-d, --detailed', 'Show detailed breakdown')
  .option('--metrics', 'Show detailed metrics output')
  .option('--smt', 'Enable SMT verification for preconditions/postconditions')
  .option('--smt-timeout <ms>', 'SMT solver timeout in milliseconds', '5000')
  .option('--smt-solver <solver>', 'SMT solver to use: builtin, z3, cvc5, or auto (default: auto)', 'auto')
  .option('--temporal', 'Enable temporal verification')
  .option('--temporal-min-samples <num>', 'Minimum samples for temporal verification', '10')
  .action(async (spec: string, options: { impl: string; scenario?: string[]; trials: string; timeout: string; seed?: string; continueOnFailure?: boolean; detailed?: boolean; metrics?: boolean; smt?: boolean; smtTimeout?: string; smtSolver?: string; temporal?: boolean; temporalMinSamples?: string }) => {
    const opts = program.opts();
    
    const result = await chaos(spec, {
      impl: options.impl,
      scenario: options.scenario && options.scenario.length > 0 ? options.scenario : undefined,
      trials: parseInt(options.trials),
      timeout: parseInt(options.timeout),
      seed: options.seed ? parseInt(options.seed) : undefined,
      continueOnFailure: options.continueOnFailure,
      verbose: opts.verbose,
      format: opts.format === 'json' ? 'json' : 'text',
      metrics: options.metrics,
      smt: options.smt,
      smtTimeout: options.smtTimeout ? parseInt(options.smtTimeout) : undefined,
      temporal: options.temporal,
      temporalMinSamples: options.temporalMinSamples ? parseInt(options.temporalMinSamples) : undefined,
    });
    
    printChaosResult(result, {
      detailed: options.detailed,
      format: opts.format === 'json' ? 'json' : 'text',
      metrics: options.metrics,
    });
    
    process.exit(getChaosExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Init Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('init [name]')
  .description('Set up ShipGate for your project. No args: init in current dir. With name: create ./name and init.')
  .option('-t, --template <template>', 'Project template (minimal, full, api)', 'minimal')
  .option('-d, --directory <dir>', 'Target directory')
  .option('--force', 'Overwrite existing ShipGate files (isl.config.json, .shipgate.yml)')
  .option('-y, --yes', 'Skip prompts (use defaults)')
  .option('--no-git', 'Skip git initialization')
  .option('-e, --examples', 'Include example files')
  .option('--interactive', 'Run interactive setup (default when no name provided and TTY available)')
  .option('--from-code <path>', 'Generate ISL spec from existing source code (file or directory)')
  .option('--from-prompt <text>', 'Generate ISL spec from natural language prompt')
  .option('--ai', 'Use AI for spec generation (requires ANTHROPIC_API_KEY for best results)')
  .option('--api-key <key>', 'API key for AI provider (or use ANTHROPIC_API_KEY env)')
  .action(async (name: string | undefined, options) => {
    const opts = program.opts();

    // When called without a name or with ".": init in current directory
    const isInPlace = !name || name === '.';
    if (isInPlace && !options.fromCode && !options.fromPrompt) {
      // Use interactive mode only if explicitly requested or TTY is available (unless --yes)
      // In CI/non-TTY: use simple in-place init (no prompts)
      const shouldUseInteractive = options.yes ? false : (options.interactive || (isTTY() && !isCI()));
      
      if (shouldUseInteractive) {
        const result = await interactiveInit({
          root: options.directory ?? process.cwd(),
          force: options.force,
          yes: options.yes,
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
      
      // Non-interactive: create minimal project in current directory
      const targetDir = options.directory ? path.resolve(options.directory) : process.cwd();
      const projectName = path.basename(targetDir) || 'my-project';
      const result = await init(projectName, {
        template: 'minimal',
        directory: targetDir,
        force: options.force,
        yes: options.yes,
        skipGit: !options.git,
        examples: options.examples,
        inPlace: true,
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
      return;
    }

    // When called with a name (not "."): create ./name and init inside it
    const projectName = name === '.' ? path.basename(process.cwd()) || 'my-project' : (name ?? 'my-isl-project');
    const targetDir = name === '.' ? process.cwd() : (options.directory ? path.resolve(options.directory) : undefined);

    const result = await init(projectName, {
      template: options.template as 'minimal' | 'full' | 'api',
      directory: targetDir,
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
  .command('security-report [path]')
  .description('Run security scan on a project (SQL injection, auth bypass, secrets, XSS, SSRF, deps, OWASP headers)')
  .option('--include-audit', 'Include npm audit (can be slow)')
  .option('--spec <file>', 'ISL spec path for auth-bypass check')
  .action(async (path?: string, options) => {
    const opts = program.opts();
    const result = await securityReport(path, {
      format: opts.format,
      includeAudit: options.includeAudit,
      spec: options.spec,
      verbose: opts.verbose,
    });
    printSecurityReportResult(result, {
      format: opts.format,
      verbose: opts.verbose,
    });
    process.exit(getSecurityReportExitCode(result));
  });

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
  .option('-t, --target <target>', 'Code generation target (typescript, openapi)', 'typescript')
  .option('--api-only', 'Generate OpenAPI spec + backend only, no frontend')
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
        console.log(chalk.gray('Try: shipgate build specs/**/*.isl'));
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
          target: (options.apiOnly ? 'openapi' : options.target) as 'typescript' | 'openapi',
          testFramework: options.testFramework as 'vitest' | 'jest',
          verify: options.verify,
          htmlReport: options.html,
          includeChaosTests: options.chaos,
          includeHelpers: options.helpers,
          apiOnly: options.apiOnly,
          generateFrontend: options.apiOnly ? false : undefined,
        });
        
        results.push({ spec, result });
        if (!result.success) {
          allSuccess = false;
        }
      } catch (error) {
        allSuccess = false;
        const message = error instanceof Error ? error.message : String(error);
        results.push({ spec, result: { success: false, errors: [{ message, stage: 'build', code: 'BUILD_ERROR' }] } });
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
            const errorFile = typeof error === 'object' && error !== null && 'file' in error ? String(error.file) : undefined;
            const errorLine = typeof error === 'object' && error !== null && 'line' in error && typeof error.line === 'number' ? error.line : undefined;
            const errorStage = typeof error === 'object' && error !== null && 'stage' in error ? String(error.stage) : 'unknown';
            const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
            const location = errorFile ? `${errorFile}${errorLine ? `:${errorLine}` : ''}` : '';
            console.log(chalk.red(`  [${errorStage}] ${errorMessage}${location ? ` at ${location}` : ''}`));
          }
        } else {
          console.log(JSON.stringify({
            success: false,
            errors: result.errors,
          }, null, 2));
        }
        process.exit(ExitCode.ISL_ERROR);
        return;
      }

      // Type guard: result.success is true, so result is BuildResult
      if ('files' in result && 'outDir' in result) {
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
          if (result.timing) {
            console.log(chalk.gray(`  Total time: ${result.timing.total.toFixed(0)}ms`));
          }
          console.log('');
          
          // Show file breakdown
          if (result.manifest) {
            const counts = result.manifest.counts;
            console.log(chalk.gray('  Output breakdown:'));
            if (counts.types > 0) console.log(chalk.gray(`    Types: ${counts.types} files`));
            if (counts.test > 0) console.log(chalk.gray(`    Tests: ${counts.test} files`));
            if (counts.helper > 0) console.log(chalk.gray(`    Helpers: ${counts.helper} files`));
            if (counts.evidence > 0) console.log(chalk.gray(`    Evidence: ${counts.evidence} files`));
            if (counts.report > 0) console.log(chalk.gray(`    Reports: ${counts.report} files`));
          }
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
            manifest: result.manifest ? result.manifest.counts : undefined,
          }, null, 2));
        }
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
              const errorFile = typeof error === 'object' && error !== null && 'file' in error ? String(error.file) : undefined;
              const errorLine = typeof error === 'object' && error !== null && 'line' in error && typeof error.line === 'number' ? error.line : undefined;
              const errorStage = typeof error === 'object' && error !== null && 'stage' in error ? String(error.stage) : 'unknown';
              const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
              const location = errorFile ? `${errorFile}${errorLine ? `:${errorLine}` : ''}` : '';
              console.log(chalk.red(`    [${errorStage}] ${errorMessage}${location ? ` at ${location}` : ''}`));
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
            files: ('files' in result && Array.isArray(result.files)) ? result.files.length : 0,
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
    } catch (err: unknown) {
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
  .option('--proof-output <path>', 'Write proof bundle to path (e.g. .shipgate/proof.json). Deterministic, optionally signed via SHIPGATE_SIGNING_KEY.')
  .option('--proof-format <fmt>', 'Proof bundle format when --proof-output is set: json or md', 'json')
  .option('--ci', 'CI mode: minimal output, just the decision')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';
    const isCi = options.ci || isCI();
    
    if (!isCi && !isJson) {
      console.log('');
      console.log(chalk.bold.cyan('ShipGate'));
      console.log(chalk.gray(`   Spec: ${spec}`));
      console.log(chalk.gray(`   Impl: ${options.impl}`));
      console.log(chalk.gray(`   Threshold: ${options.threshold}%`));
      console.log('');
    }

    const result = await gate(spec, {
      impl: options.impl,
      threshold: parseInt(options.threshold),
      output: options.output ?? process.cwd(),
      proofOutput: options.proofOutput,
      proofFormat: options.proofFormat === 'md' ? 'md' : 'json',
      toolVersion: VERSION,
      verbose: opts.verbose,
      format: opts.format,
      ci: isCi,
      skipPolicy: options.skipPolicy,
      policyFile: options.policyFile,
      policyProfile: options.policyProfile as 'strict' | 'standard' | 'lenient' | undefined,
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
// Trust Score Explain Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('trust-score explain <spec>')
  .description('Explain trust score with evidence breakdown and history analysis')
  .requiredOption('-i, --impl <file>', 'Implementation file or directory to verify')
  .option('-t, --threshold <score>', 'Minimum trust score to SHIP (default: 80)', '80')
  .option('-w, --weights <weights>', 'Custom weights (e.g. "preconditions=30,postconditions=25,invariants=20,temporal=10,chaos=5,coverage=10")')
  .option('--unknown-penalty <penalty>', 'Penalty for unknown/uncovered categories 0.0-1.0 (default: 0.5)', '0.5')
  .option('--history <count>', 'Number of history entries to show (default: 10)', '10')
  .option('--history-path <path>', 'Custom history file path (default: .isl-gate/trust-history.json)')
  .option('--commit-hash <hash>', 'Git commit hash to tag this evaluation')
  .option('--project-root <path>', 'Project root directory for fingerprinting')
  .option('--json', 'Output as JSON')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const isJson = options.json || opts.format === 'json';

    if (!isJson) {
      console.log('');
      console.log(chalk.bold.cyan('  Trust Score Explanation'));
      console.log(chalk.gray(`  Spec:      ${spec}`));
      console.log(chalk.gray(`  Impl:      ${options.impl}`));
      console.log('');
    }

    const result = await trustScoreExplain(spec, {
      impl: options.impl,
      threshold: parseInt(options.threshold),
      weights: options.weights,
      unknownPenalty: parseFloat(options.unknownPenalty),
      historyCount: parseInt(options.history),
      json: isJson,
      verbose: opts.verbose,
      historyPath: options.historyPath,
      commitHash: options.commitHash,
      projectRoot: options.projectRoot,
    });

    printTrustScoreExplain(result, {
      json: isJson,
      verbose: opts.verbose,
    });

    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Verify Certificate Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('verify-cert')
  .description('Verify ISL certificate integrity: re-hash files, verify signature, print report')
  .option('-c, --cert <path>', `Certificate file path (default: .isl-certificate.json)`)
  .option('-p, --project-root <path>', 'Project root for resolving file paths (default: cwd)')
  .option('--api-key <key>', 'API key for signature verification (or ISL_API_KEY env)')
  .action(async (options) => {
    const opts = program.opts();
    const result = await verifyCert({
      cert: options.cert,
      projectRoot: options.projectRoot,
      apiKey: options.apiKey,
      format: opts.format,
    });

    printVerifyCertResult(result, { format: opts.format });
    process.exit(getVerifyCertExitCode(result));
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
  .option('--dry-run', 'Preview patches without applying them')
  .option('--interactive', 'Ask for confirmation before applying each patch')
  .option('-o, --output <dir>', 'Output directory for dry-run patches (default: .isl-heal-patches)')
  .option('--ai', 'Use AI (LLM) to generate fixes — verify→fix→re-verify loop')
  .option('--provider <provider>', 'AI provider: anthropic or openai')
  .option('--model <model>', 'AI model override')
  .action(async (pattern: string, options) => {
    const opts = program.opts();

    if (options.ai) {
      // AI-powered heal: verify → AI fix → re-verify loop
      const result = await aiHeal(pattern, {
        maxIterations: parseInt(options.maxIterations),
        format: opts.format,
        verbose: opts.verbose,
        dryRun: options.dryRun,
        ai: true,
        provider: options.provider,
        model: options.model,
      });
      printHealResult(result, { format: opts.format });
      process.exit(getHealExitCode(result));
    } else {
      // Pattern-based semantic heal
      const result = await heal(pattern, {
        spec: options.spec,
        maxIterations: parseInt(options.maxIterations),
        stopOnRepeat: parseInt(options.stopOnRepeat),
        format: opts.format,
        verbose: opts.verbose,
        dryRun: options.dryRun,
        interactive: options.interactive,
        outputDir: options.output,
      });
      printHealResult(result, { format: opts.format });
      process.exit(getHealExitCode(result));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Vibe Command (Safe Vibe Coding)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('vibe [prompt]')
  .description('Safe Vibe Coding: describe what you want → get verified code\n  Examples:\n    shipgate vibe "Build me a todo app with auth"\n    shipgate vibe "REST API for blog posts" --framework express\n    shipgate vibe --from-spec specs/auth.isl')
  .option('-o, --output <dir>', 'Output directory for generated project')
  .option('--framework <fw>', 'Backend framework: nextjs, express, fastify (default: nextjs)')
  .option('--db <db>', 'Database: postgres, sqlite, none (default: sqlite)')
  .option('--database <db>', 'Database: postgres, sqlite, none (default: sqlite)')
  .option('--db-url <url>', 'Override DATABASE_URL connection string')
  .option('--provider <provider>', 'AI provider: anthropic or openai')
  .option('--model <model>', 'AI model override')
  .option('--from-spec <file>', 'Skip NL→ISL — use existing spec file')
  .option('--max-iterations <n>', 'Max heal iterations if code fails verification (default: 3)', '3')
  .option('--dry-run', 'Generate plan and spec without writing project files')
  .option('--no-frontend', 'Skip frontend generation')
  .option('--no-tests', 'Skip test generation')
  .option('--no-cache', 'Force fresh generation, skip cache lookup')
  .option('--clear-cache', 'Wipe .isl-cache/ and exit')
  .option('--max-tokens <n>', 'Max token budget (default: 100k). At 80% warns; at 95% skips heal loop', '100000')
  .option('--resume', 'Resume from last successful stage (uses checkpoint in output dir)')
  .option('--no-parallel', 'Disable parallel codegen, use sequential (default: parallel enabled)')
  .option('--max-concurrent <n>', 'Max concurrent AI calls for parallel codegen (default: 3)', '3')
  .action(async (prompt: string | undefined, options) => {
    const opts = program.opts();

    if (options.clearCache) {
      const { CacheManager } = await import('@isl-lang/isl-cache');
      const cache = new CacheManager({ projectRoot: process.cwd() });
      await cache.clearCache();
      console.log(chalk.green('Cache cleared: .isl-cache/ removed'));
      process.exit(0);
    }

    if (!prompt && !options.fromSpec) {
      console.error(chalk.red('Error: provide a prompt or --from-spec'));
      console.error(chalk.gray('  Example: shipgate vibe "Build me a todo app with auth"'));
      process.exit(ExitCode.USAGE_ERROR);
    }

    const result = await vibe(prompt ?? '', {
      output: options.output,
      framework: options.framework,
      database: (options.db ?? options.database) as 'postgres' | 'sqlite' | 'none' | undefined,
      dbUrl: options.dbUrl,
      provider: options.provider,
      model: options.model,
      fromSpec: options.fromSpec,
      maxIterations: parseInt(options.maxIterations),
      dryRun: options.dryRun,
      verbose: opts.verbose,
      format: opts.format,
      frontend: options.frontend,
      tests: options.tests,
      noCache: options.noCache,
      maxTokens: parseInt(options.maxTokens),
      resume: options.resume,
      parallel: options.parallel,
      maxConcurrent: parseInt(options.maxConcurrent ?? '3'),
    });

    printVibeResult(result, { format: opts.format });
    process.exit(getVibeExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Proof Commands
// ─────────────────────────────────────────────────────────────────────────────

const proofCommand = program
  .command('proof')
  .description('Proof bundle management');

proofCommand
  .command('verify <bundle-path>')
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

proofCommand
  .command('pack')
  .description('Pack artifacts into a deterministic, hashable, verifiable proof bundle')
  .requiredOption('--spec <file>', 'ISL spec file')
  .option('--evidence <dir>', 'Evidence directory (contains results.json, traces, etc.)')
  .option('-o, --output <dir>', 'Output directory for the proof bundle', '.proof-bundle')
  .option('--sign-secret <secret>', 'HMAC secret for signing the bundle')
  .option('--timestamp <iso>', 'Fixed ISO 8601 timestamp (for deterministic builds)')
  .option('--include-soc2', 'Include SOC2 CC-series control mapping for auditors')
  .action(async (options) => {
    const opts = program.opts();
    const result = await proofPack({
      spec: options.spec,
      evidence: options.evidence,
      output: options.output,
      signSecret: options.signSecret,
      timestamp: options.timestamp,
      includeSoc2: options.includeSoc2,
      format: opts.format,
      verbose: opts.verbose,
    });
    
    printProofPackResult(result, { format: opts.format });
    process.exit(getProofPackExitCode(result));
  });

proofCommand
  .command('badge <bundle-path>')
  .description('Generate a badge (SVG or URL) from a proof bundle')
  .option('-f, --format <format>', 'Output format: svg or url (default: svg)', 'svg')
  .option('-o, --output <file>', 'Output file path (for SVG format)')
  .option('--badge-url-base <url>', 'Badge service URL base (for URL format)')
  .option('--bundle-url <url>', 'Bundle URL (for linking from badge)')
  .action(async (bundlePath: string, options) => {
    const opts = program.opts();
    const result = await generateBadge(bundlePath, {
      format: options.format === 'url' ? 'url' : 'svg',
      output: options.output,
      badgeUrlBase: options.badgeUrlBase,
      bundleUrl: options.bundleUrl,
      outputFormat: opts.format,
      verbose: opts.verbose,
    });
    
    printBadgeResult(result, { format: opts.format });
    process.exit(getBadgeExitCode(result));
  });

proofCommand
  .command('attest <bundle-path>')
  .description('Generate SLSA-style attestation JSON from a proof bundle')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('--include-manifest', 'Include full manifest in attestation')
  .action(async (bundlePath: string, options) => {
    const opts = program.opts();
    const result = await generateAttestation(bundlePath, {
      output: options.output,
      includeManifest: options.includeManifest,
      outputFormat: opts.format,
      verbose: opts.verbose,
    });
    
    printAttestationResult(result, { format: opts.format });
    process.exit(getAttestationExitCode(result));
  });

proofCommand
  .command('comment <bundle-path>')
  .description('Generate GitHub PR comment from a proof bundle')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .action(async (bundlePath: string, options) => {
    const opts = program.opts();
    const result = await generatePRComment(bundlePath, {
      output: options.output,
      outputFormat: opts.format,
      verbose: opts.verbose,
    });
    
    printCommentResult(result, { format: opts.format });
    process.exit(getCommentExitCode(result));
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
// ISL Bind Command (Automatic implementation discovery)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('bind <spec>')
  .alias('link')
  .description(
    'Discover and bind ISL specifications to implementation code\n\n' +
    '  Automatically maps ISL behaviors/entities to code functions/routes\n' +
    '  using filesystem heuristics, AST scanning, and naming conventions.\n' +
    '  Generates .shipgate.bindings.json with confidence scores.',
  )
  .option('-s, --spec <file>', 'ISL spec file(s) (comma-separated or multiple)', (val: string, prev: string[] | undefined) => {
    if (prev) return [...prev, val];
    return [val];
  })
  .option('-i, --impl <dir>', 'Implementation directory (default: current directory)', '.')
  .option('-o, --output <file>', 'Output bindings file (default: .shipgate.bindings.json)')
  .option('--min-confidence <threshold>', 'Minimum confidence threshold (0-1)', '0.3')
  .option('--code-dirs <dirs>', 'Code directories to search (comma-separated)')
  .option('--include <patterns>', 'Include file patterns (comma-separated globs)')
  .option('--exclude <patterns>', 'Exclude file patterns (comma-separated globs)')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    if (!isJson) {
      console.log('');
      console.log(chalk.bold.cyan('🔗 ISL Bind - Discovery Engine'));
      console.log('');
    }

    const specFiles = options.spec && Array.isArray(options.spec) ? options.spec : [spec];

    const result = await bind({
      spec: specFiles,
      impl: options.impl,
      output: options.output,
      minConfidence: parseFloat(options.minConfidence || '0.3'),
      codeDirs: options.codeDirs?.split(',').map((d: string) => d.trim()),
      include: options.include?.split(',').map((p: string) => p.trim()),
      exclude: options.exclude?.split(',').map((p: string) => p.trim()),
      verbose: opts.verbose,
      format: opts.format,
    });

    if (!isJson) {
      printBindResult(result, { verbose: opts.verbose });
    }

    process.exit(getBindExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// ShipGate Command Group
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Demo Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('demo')
  .description('One-command demo that proves ShipGate value immediately\n\n' +
    '  Scaffolds a sample app with a deliberate ghost feature,\n' +
    '  runs verify + gate (shows NO_SHIP), outputs proof bundle.\n\n' +
    '  Use --fix to apply the fix and re-run gate -> SHIP.')
  .option('--fix', 'Apply the fix and re-run gate')
  .option('-o, --output <dir>', 'Output directory for demo (default: ./shipgate-demo)', './shipgate-demo')
  .option('--keep', 'Keep demo files after completion')
  .action(async (options) => {
    const opts = program.opts();
    const result = await demo({
      fix: options.fix,
      output: options.output,
      keep: options.keep,
      verbose: opts.verbose,
    });
    
    printDemoResult(result, { verbose: opts.verbose });
    process.exit(getDemoExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Ship Command — Full-stack app generation
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('ship')
  .description('Generate a complete, runnable full-stack application from an ISL spec\n\n' +
    '  One spec → one command → running app.\n' +
    '  Generates API routes, Prisma schema, runtime contracts, Docker, and more.\n\n' +
    '  Example: shipgate ship specs/fullstack-example.isl --stack express+prisma+postgres')
  .argument('<file>', 'ISL specification file')
  .option('-o, --output <dir>', 'Output directory')
  .option('-s, --stack <stack>', 'Technology stack (e.g. express+prisma+postgres)', 'express+prisma+postgres')
  .option('--db <db>', 'Database: sqlite, postgres, mysql, mongodb (default from stack)')
  .option('--db-url <url>', 'Override DATABASE_URL connection string')
  .option('-n, --name <name>', 'Project name (default: domain name)')
  .option('--deploy <platform>', 'Add deployment config (vercel, docker, railway, fly)')
  .option('--force', 'Overwrite existing files')
  .option('--no-docker', 'Skip Docker file generation')
  .option('--no-contracts', 'Skip runtime contract enforcement')
  .action(async (file: string, options: Record<string, unknown>) => {
    const opts = program.opts();
    const result = await shipCommand(file, {
      output: options.output as string | undefined,
      stack: options.stack as string | undefined,
      db: options.db as string | undefined,
      dbUrl: options.dbUrl as string | undefined,
      deploy: options.deploy as string | undefined,
      name: options.name as string | undefined,
      force: options.force as boolean | undefined,
      noDocker: options.docker === false,
      noContracts: options.contracts === false,
      verbose: opts.verbose as boolean | undefined,
      format: opts.format as 'pretty' | 'json' | 'quiet' | undefined,
    });
    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Seed Command — Generate and run Prisma seed from ISL
// ─────────────────────────────────────────────────────────────────────────────

const seedCommand = program
  .command('seed')
  .description('Generate and run Prisma seed from ISL spec');

seedCommand
  .command('generate <spec>')
  .description('Generate prisma/seed.ts from ISL entities and scenarios')
  .option('-o, --output <dir>', 'Output directory (default: cwd)')
  .option('--records <n>', 'Records per entity (default: 10)', '10')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const result = await seedGenerate(spec, {
      output: options.output,
      recordsPerEntity: parseInt(options.records || '10', 10),
      format: opts.format,
    });
    printSeedGenerateResult(result, opts.format);
    process.exit(getSeedGenerateExitCode(result));
  });

seedCommand
  .command('run')
  .description('Execute seed (prisma db seed)')
  .option('-C, --cwd <dir>', 'Working directory (default: cwd)')
  .action(async (options) => {
    const opts = program.opts();
    const result = await seedRun({ cwd: options.cwd, format: opts.format });
    printSeedRunResult(result, opts.format);
    process.exit(getSeedRunExitCode(result));
  });

seedCommand
  .command('reset')
  .description('Wipe DB and re-seed (prisma migrate reset --force)')
  .option('-C, --cwd <dir>', 'Working directory (default: cwd)')
  .action(async (options) => {
    const opts = program.opts();
    const result = await seedReset({ cwd: options.cwd, format: opts.format });
    printSeedResetResult(result, opts.format);
    process.exit(getSeedResetExitCode(result));
  });

const shipgateCommand = program
  .command('shipgate')
  .description('ShipGate configuration management');

shipgateCommand
  .command('init')
  .description('Interactive project setup — generates .shipgate.yml, ISL specs, and CI workflow')
  .option('--force', 'Overwrite existing ShipGate files')
  .option('-y, --yes', 'Skip prompts (use defaults)')
  .option('-d, --directory <dir>', 'Project root directory (default: cwd)')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    const result = await interactiveInit({
      root: options.directory,
      force: options.force,
      yes: options.yes,
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

const provenanceCommand = shipgateCommand
  .command('provenance')
  .description('AI provenance metadata for proof bundles (vendor-agnostic)');

provenanceCommand
  .command('init')
  .description('Create .shipgate/provenance.json template')
  .option('-d, --directory <dir>', 'Project root (default: cwd)')
  .option('--force', 'Overwrite existing provenance.json')
  .action(async (options) => {
    const opts = program.opts();
    const result = await provenanceInit({
      directory: options.directory,
      force: options.force,
    });
    printProvenanceInitResult(result, { format: opts.format });
    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

const truthpackCommand = shipgateCommand
  .command('truthpack')
  .description('Truthpack v2 - canonical project reality snapshot');

truthpackCommand
  .command('build')
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

truthpackCommand
  .command('diff')
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

const complianceCommand = shipgateCommand
  .command('compliance')
  .description('Compliance mapping — translate proof bundles to auditor-friendly controls');

complianceCommand
  .command('soc2')
  .description('SOC2 CC-series mapping: control → pass/warn/fail, contributing checks, evidence refs')
  .option('-b, --bundle <path>', 'Proof bundle path (proof-bundle.json or directory)')
  .option('-e, --evidence <dir>', 'Evidence directory (results.json, manifest.json)')
  .option('-f, --format <format>', 'Output format: pretty | json', 'pretty')
  .action(async (options) => {
    const opts = program.opts();
    const result = await complianceSOC2({
      bundle: options.bundle,
      evidence: options.evidence,
      format: options.format || opts.format,
    });

    printComplianceSOC2Result(result, { format: opts.format || options.format });
    process.exit(getComplianceSOC2ExitCode(result));
  });

shipgateCommand
  .command('migrate <file>')
  .description('Migrate ISL spec to newer version')
  .option('-o, --output <file>', 'Output file (default: overwrites input)')
  .option('-t, --target <version>', 'Target ISL version (default: 0.2)')
  .option('--dry-run', 'Preview migration without writing files')
  .option('-v, --verbose', 'Show detailed warnings')
  .action(async (file: string, options) => {
    const opts = program.opts();
    const parserModule = await import('@isl-lang/parser');
    const CURRENT_ISL_VERSION = (parserModule as { CURRENT_ISL_VERSION?: string }).CURRENT_ISL_VERSION || '0.2';
    
    const result = await migrate({
      input: file,
      output: options.output,
      targetVersion: (options.target || CURRENT_ISL_VERSION) as '0.1' | '0.2',
      dryRun: options.dryRun,
      verbose: options.verbose || opts.verbose,
    });

    if (opts.format === 'json') {
      console.log(JSON.stringify({
        success: result.success,
        inputFile: result.inputFile,
        outputFile: result.outputFile,
        sourceVersion: result.sourceVersion,
        targetVersion: result.targetVersion,
        migrated: result.migrated,
        appliedRules: result.appliedRules,
        warnings: result.warnings,
        errors: result.errors,
      }, null, 2));
    } else {
      printMigrateResult(result);
    }

    process.exit(getMigrateExitCode(result));
  });

shipgateCommand
  .command('fix')
  .description('Auto-fix ShipGate findings with safe, minimal diffs')
  .option('--dry-run', 'Preview fixes without applying (default)')
  .option('--apply', 'Apply fixes to files')
  .option('--only <rule>', 'Only apply fixes for specific rule (can be used multiple times)', (val: string, prev: string[] | undefined) => {
    if (prev) return [...prev, val];
    return [val];
  }, [] as string[])
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

// ── Packs Subcommand ────────────────────────────────────────────────────────

const packsCommand = shipgateCommand
  .command('packs')
  .description('ISL pack marketplace - browse and install domain/spec packs');

packsCommand
  .command('install <name>')
  .description('Install an ISL pack from the registry')
  .option('-v, --version <version>', 'Pack version (default: latest)')
  .option('-d, --dir <dir>', 'Install directory (default: ./shipgate/packs/<name>)')
  .option('--skip-verify', 'Skip integrity verification')
  .action(async (name: string, options) => {
    const opts = program.opts();
    const result = await installPack({
      name,
      version: options.version,
      targetDir: options.dir,
      skipVerify: options.skipVerify,
      verbose: opts.verbose,
      format: opts.format,
    });
    
    printInstallResult(result, { format: opts.format });
    process.exit(getInstallExitCode(result));
  });

packsCommand
  .command('list')
  .description('List installed packs')
  .action(async () => {
    const opts = program.opts();
    const result = await listPacks();
    
    printListResult(result, { format: opts.format });
    process.exit(ExitCode.SUCCESS);
  });

packsCommand
  .command('verify <name>')
  .description('Verify pack integrity')
  .action(async (name: string) => {
    const opts = program.opts();
    const result = await verifyPackInstall(name);
    
    printPackVerifyResult(result, { format: opts.format });
    process.exit(getPackVerifyExitCode(result));
  });

// ── Domain Pack Subcommand ──────────────────────────────────────────────────

const domainCommand = shipgateCommand
  .command('domain')
  .description('Domain pack management - create, validate, and publish domain packs');

domainCommand
  .command('init')
  .description('Initialize a new domain pack with specs, tests, and publish workflow')
  .option('-n, --name <name>', 'Pack name (default: current directory name)')
  .option('-d, --directory <dir>', 'Target directory (default: current directory)')
  .option('--force', 'Overwrite existing files')
  .option('--no-examples', 'Skip example spec file')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    const result = await domainInit({
      name: options.name,
      directory: options.directory,
      force: options.force,
      examples: options.examples !== false,
    });

    if (isJson) {
      console.log(JSON.stringify({
        success: result.success,
        packPath: result.packPath,
        files: result.files,
        errors: result.errors,
      }, null, 2));
    } else {
      printDomainInitResult(result);
    }

    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

domainCommand
  .command('validate')
  .description('Validate a domain pack structure and specs')
  .option('-d, --directory <dir>', 'Pack directory (default: current directory)')
  .option('-t, --test', 'Run pack unit tests')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';

    const result = await domainValidate({
      directory: options.directory,
      test: options.test,
      verbose: opts.verbose,
    });

    if (isJson) {
      console.log(JSON.stringify({
        success: result.success,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        testResults: result.testResults,
      }, null, 2));
    } else {
      printDomainValidateResult(result, { verbose: opts.verbose });
    }

    process.exit(getDomainValidateExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Command
// ─────────────────────────────────────────────────────────────────────────────

shipgateCommand
  .command('coverage')
  .description('Generate coverage report for ISL specifications\n' +
    '  Shows which behaviors have implementations bound,\n' +
    '  which specs are exercised in runtime verification,\n' +
    '  and which constraints are always "unknown".')
  .option('-s, --specs <patterns...>', 'ISL spec file patterns (default: **/*.isl)', (val: string, prev: string[] | undefined) => {
    if (prev) return [...prev, val];
    return [val];
  }, [] as string[])
  .option('-b, --bindings <file>', 'Bindings file path (default: .shipgate.bindings.json)')
  .option('-t, --traces <dir>', 'Verification traces directory')
  .option('-d, --detailed', 'Show detailed constraint breakdown')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const opts = program.opts();
    const isJson = options.json || opts.format === 'json';

    const specs = options.specs && options.specs.length > 0
      ? options.specs
      : ['**/*.isl'];

    const result = await coverage({
      specs,
      bindingsFile: options.bindings,
      tracesDir: options.traces,
      format: isJson ? 'json' : 'text',
      verbose: opts.verbose,
      detailed: options.detailed,
    });

    printCoverageResult(result, {
      format: isJson ? 'json' : 'text',
      verbose: opts.verbose,
    });

    process.exit(getCoverageExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Unknown Command Handler
// ─────────────────────────────────────────────────────────────────────────────

program.on('command:*', ([cmd]) => {
  const suggestion = findClosestMatch(cmd, COMMANDS);
  
  console.error(chalk.red(`Unknown command: ${cmd}`));
  
  if (suggestion) {
    console.error(chalk.gray(`Did you mean: shipgate ${suggestion}?`));
  }
  
  console.error('');
  console.error(chalk.gray('Run `shipgate --help` to see available commands.'));
  process.exit(ExitCode.USAGE_ERROR);
});

// ─────────────────────────────────────────────────────────────────────────────
// Help Enhancement
// ─────────────────────────────────────────────────────────────────────────────

program.addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.gray('# Initialize a new ShipGate project')}
  $ shipgate init

  ${chalk.gray('# Build ISL spec (parse → check → codegen → verify)')}
  $ shipgate build specs/**/*.isl

  ${chalk.gray('# Heal code to fix violations automatically')}
  $ shipgate heal src/**/*.ts

  ${chalk.gray('# Verify a directory (auto-detect mode)')}
  $ shipgate verify src/

  ${chalk.gray('# Verify with JSON output for CI')}
  $ shipgate verify src/ --json

  ${chalk.gray('# Verify with strictness control')}
  $ shipgate verify src/ --fail-on unspecced

  ${chalk.gray('# Verify implementation against specific spec (legacy)')}
  $ shipgate verify src/auth.isl --impl src/auth.ts

  ${chalk.gray('# Verify with --spec and --impl flags')}
  $ shipgate verify --spec src/auth.isl --impl src/auth.ts

  ${chalk.gray('# Verify proof bundle')}
  $ shipgate proof verify ./proof-bundles/auth-bundle

  ${chalk.gray('# SHIP/NO-SHIP gate (the main workflow)')}
  $ shipgate gate src/auth.isl --impl src/auth.ts

  ${chalk.gray('# Verify ISL certificate integrity')}
  $ shipgate verify-cert

  ${chalk.gray('# Parse and show AST')}
  $ shipgate parse src/auth.isl

  ${chalk.gray('# Check all ISL files')}
  $ shipgate check

  ${chalk.gray('# Generate TypeScript code')}
  $ shipgate gen ts src/auth.isl

  ${chalk.gray('# Format ISL file')}
  $ shipgate fmt src/auth.isl

  ${chalk.gray('# Start REPL')}
  $ shipgate repl

  ${chalk.gray('# Watch ISL files for changes')}
  $ shipgate watch

  ${chalk.gray('# Watch with gate on changes')}
  $ shipgate watch --gate --impl src/

  ${chalk.gray('# Watch only changed files')}
  $ shipgate watch --changed-only

  ${chalk.gray('# Safe Vibe Coding: describe what you want, get verified code')}
  $ shipgate vibe "Build me a todo app with auth"

  ${chalk.gray('# Vibe with framework + database options')}
  $ shipgate vibe "REST API for blog posts" --framework express --database postgres

  ${chalk.gray('# Vibe from an existing ISL spec (skip NL→ISL)')}
  $ shipgate vibe --from-spec specs/auth.isl

  ${chalk.gray('# Generate ISL specs from existing source code')}
  $ shipgate isl-generate src/auth/

  ${chalk.gray('# Dry-run: preview specs without writing files')}
  $ shipgate isl-generate src/ --dry-run

  ${chalk.gray('# Generate with interactive confirmation')}
  $ shipgate isl-generate src/ --interactive

${chalk.bold('JSON Output:')}
  All commands support --json or --format json for machine-readable output:
  $ shipgate build specs/**/*.isl --json
  $ shipgate heal src/**/*.ts --json
  $ shipgate verify src/auth.isl --impl src/auth.ts --json

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
