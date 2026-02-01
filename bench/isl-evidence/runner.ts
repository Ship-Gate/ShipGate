#!/usr/bin/env node
/**
 * ISL Evidence Bench Harness - Runner
 * 
 * CLI-like runner that executes translate→generate→verify pipeline
 * on sample repositories and generates evidence reports.
 * 
 * Usage:
 *   npx tsx bench/isl-evidence/runner.ts [options]
 * 
 * Options:
 *   --config <path>    Path to custom config file
 *   --sample <id>      Run only a specific sample
 *   --tag <tag>        Run only samples with a specific tag
 *   --verbose          Enable verbose output
 *   --bail             Stop on first failure
 *   --output <dir>     Output directory for reports
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  loadConfig,
  loadPromptContext,
  type BenchConfig,
  type SampleConfig,
  type PromptContext,
} from './config.js';

import {
  ReportBuilder,
  writeReport,
  printReportSummary,
  generateMarkdownReport,
  type StepResult,
} from './report.js';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CLIOptions {
  config?: string;
  sample?: string;
  tag?: string;
  verbose: boolean;
  bail: boolean;
  output?: string;
  help: boolean;
}

function parseCliArgs(): CLIOptions {
  try {
    const { values } = parseArgs({
      options: {
        config: { type: 'string', short: 'c' },
        sample: { type: 'string', short: 's' },
        tag: { type: 'string', short: 't' },
        verbose: { type: 'boolean', short: 'v', default: false },
        bail: { type: 'boolean', short: 'b', default: false },
        output: { type: 'string', short: 'o' },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
    });
    return values as CLIOptions;
  } catch (error) {
    console.error('Error parsing arguments:', error);
    return { verbose: false, bail: false, help: true };
  }
}

function printHelp(): void {
  console.log(`
ISL Evidence Bench Harness

Usage:
  npx tsx bench/isl-evidence/runner.ts [options]

Options:
  -c, --config <path>    Path to custom config file
  -s, --sample <id>      Run only a specific sample
  -t, --tag <tag>        Run only samples with a specific tag
  -v, --verbose          Enable verbose output
  -b, --bail             Stop on first failure
  -o, --output <dir>     Output directory for reports
  -h, --help             Show this help message

Examples:
  # Run all samples
  npx tsx bench/isl-evidence/runner.ts

  # Run with verbose output
  npx tsx bench/isl-evidence/runner.ts --verbose

  # Run a specific sample
  npx tsx bench/isl-evidence/runner.ts --sample auth-basic

  # Run samples with a tag
  npx tsx bench/isl-evidence/runner.ts --tag payments
`);
}

// ============================================================================
// Command Execution
// ============================================================================

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Execute a shell command and return the result
 */
async function executeCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    timeout: number;
    verbose?: boolean;
  }
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    
    // Use shell on Windows for better compatibility
    const isWindows = process.platform === 'win32';
    const spawnOptions = {
      cwd: options.cwd,
      shell: isWindows,
      timeout: options.timeout,
    };

    const child: ChildProcess = spawn(command, args, spawnOptions);

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      if (options.verbose) {
        process.stdout.write(text);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      if (options.verbose) {
        process.stderr.write(text);
      }
    });

    child.on('error', (error) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + '\n' + error.message,
        durationMs: Date.now() - startTime,
      });
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
      });
    });
  });
}

// ============================================================================
// Pipeline Steps
// ============================================================================

/**
 * TODO: Integration point for ISL Translator
 * 
 * This function should call the actual ISL translator to convert
 * natural language prompts into ISL specifications.
 * 
 * Integration:
 *   import { translate } from '@isl-lang/translator';
 *   const isl = await translate(prompt, context);
 */
async function runTranslateStep(
  _promptContext: PromptContext,
  _sampleDir: string,
  _config: BenchConfig
): Promise<StepResult> {
  // TODO: Replace with actual translator integration
  // Currently returns a stub result
  
  const startTime = Date.now();
  
  // Simulate translation work
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // TODO: Actual integration point
  // const translator = await import('@isl-lang/translator');
  // const result = await translator.translate(promptContext.prompt, promptContext.context);
  
  return {
    name: 'translate',
    status: 'passed',
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    output: 'TODO: Translator integration pending - using stub',
  };
}

/**
 * TODO: Integration point for ISL Code Generator
 * 
 * This function should call the actual ISL compiler/generator to
 * produce TypeScript types and test scaffolds from ISL specs.
 * 
 * Integration:
 *   import { generate } from '@isl-lang/compiler';
 *   const output = await generate(islSpec, options);
 */
async function runGenerateStep(
  _islContent: string,
  _sampleDir: string,
  _config: BenchConfig
): Promise<StepResult> {
  // TODO: Replace with actual generator integration
  // Currently returns a stub result
  
  const startTime = Date.now();
  
  // Simulate generation work
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // TODO: Actual integration point
  // const compiler = await import('@isl-lang/isl-compiler');
  // const result = await compiler.compile(islContent, { target: 'typescript' });
  
  return {
    name: 'generate',
    status: 'passed',
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    output: 'TODO: Generator integration pending - using stub',
  };
}

/**
 * Run verification step using pnpm test and typecheck commands
 * 
 * This step executes the actual test and typecheck commands
 * via child_process to verify the generated code.
 */
async function runVerifyStep(
  sample: SampleConfig,
  sampleDir: string,
  config: BenchConfig
): Promise<StepResult> {
  const startTime = Date.now();
  const outputs: string[] = [];
  let hasFailure = false;

  // Run typecheck commands
  for (const cmd of sample.typecheckCommands) {
    const [command, ...args] = cmd.split(' ');
    if (!command) continue;
    
    if (config.verbose) {
      console.log(`  Running: ${cmd}`);
    }
    
    const result = await executeCommand(command, args, {
      cwd: sampleDir,
      timeout: config.timeouts.verify,
      verbose: config.verbose,
    });
    
    outputs.push(`$ ${cmd}\n${result.stdout}\n${result.stderr}`);
    
    if (result.exitCode !== 0) {
      hasFailure = true;
      if (config.bailOnFailure) {
        break;
      }
    }
  }

  // Run test commands
  if (!hasFailure || !config.bailOnFailure) {
    for (const cmd of sample.testCommands) {
      const [command, ...args] = cmd.split(' ');
      if (!command) continue;
      
      if (config.verbose) {
        console.log(`  Running: ${cmd}`);
      }
      
      const result = await executeCommand(command, args, {
        cwd: sampleDir,
        timeout: config.timeouts.verify,
        verbose: config.verbose,
      });
      
      outputs.push(`$ ${cmd}\n${result.stdout}\n${result.stderr}`);
      
      if (result.exitCode !== 0) {
        hasFailure = true;
        if (config.bailOnFailure) {
          break;
        }
      }
    }
  }

  return {
    name: 'verify',
    status: hasFailure ? 'failed' : 'passed',
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    output: outputs.join('\n---\n'),
    exitCode: hasFailure ? 1 : 0,
  };
}

// ============================================================================
// Main Runner
// ============================================================================

async function runSample(
  sample: SampleConfig,
  config: BenchConfig,
  reportBuilder: ReportBuilder
): Promise<boolean> {
  const sampleDir = join(config.samplesDir, sample.path);
  
  if (!existsSync(sampleDir)) {
    console.log(`  Skipping ${sample.id}: directory not found`);
    reportBuilder.skipSample(sample.id, 'Directory not found');
    return true;
  }

  console.log(`\nRunning sample: ${sample.name} (${sample.id})`);
  
  // Load prompt and context
  const promptContext = loadPromptContext(sampleDir, sample);
  
  // Step 1: Translate
  console.log('  Step 1/3: Translate');
  reportBuilder.startStep(sample.id, 'translate');
  const translateResult = await runTranslateStep(promptContext, sampleDir, config);
  reportBuilder.completeStep(sample.id, 'translate', translateResult);
  
  if (translateResult.status === 'failed') {
    reportBuilder.completeSample(sample.id);
    return !config.bailOnFailure;
  }

  // Step 2: Generate
  console.log('  Step 2/3: Generate');
  reportBuilder.startStep(sample.id, 'generate');
  const generateResult = await runGenerateStep(translateResult.output ?? '', sampleDir, config);
  reportBuilder.completeStep(sample.id, 'generate', generateResult);
  
  if (generateResult.status === 'failed') {
    reportBuilder.completeSample(sample.id);
    return !config.bailOnFailure;
  }

  // Step 3: Verify
  console.log('  Step 3/3: Verify');
  reportBuilder.startStep(sample.id, 'verify');
  const verifyResult = await runVerifyStep(sample, sampleDir, config);
  reportBuilder.completeStep(sample.id, 'verify', verifyResult);

  // Complete the sample
  reportBuilder.completeSample(sample.id, {
    generatedIsl: translateResult.output,
    generatedTs: generateResult.output,
  });

  if (verifyResult.status === 'failed' && config.bailOnFailure) {
    return false;
  }

  return true;
}

async function main(): Promise<void> {
  const options = parseCliArgs();
  
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('ISL Evidence Bench Harness');
  console.log('='.repeat(40));

  // Load configuration
  const config = loadConfig(options.config);
  config.verbose = options.verbose;
  config.bailOnFailure = options.bail;
  
  if (options.output) {
    config.outputDir = resolve(options.output);
  }

  // Ensure output directory exists
  if (!existsSync(config.outputDir)) {
    mkdirSync(config.outputDir, { recursive: true });
  }

  // Filter samples
  let samples = config.samples.filter(s => s.enabled);
  
  if (options.sample) {
    samples = samples.filter(s => s.id === options.sample);
    if (samples.length === 0) {
      console.error(`Sample not found: ${options.sample}`);
      process.exit(1);
    }
  }
  
  if (options.tag) {
    samples = samples.filter(s => s.tags.includes(options.tag!));
    if (samples.length === 0) {
      console.error(`No samples found with tag: ${options.tag}`);
      process.exit(1);
    }
  }

  if (samples.length === 0) {
    console.log('\nNo samples found to run.');
    console.log('Create samples in bench/isl-evidence/samples/');
    console.log('See README.md for instructions.');
    process.exit(0);
  }

  console.log(`\nFound ${samples.length} sample(s) to run`);

  // Initialize report builder
  const reportBuilder = new ReportBuilder(config);
  
  for (const sample of samples) {
    reportBuilder.initSample(sample);
  }

  // Run samples
  for (const sample of samples) {
    const shouldContinue = await runSample(sample, config, reportBuilder);
    if (!shouldContinue) {
      console.log('\nBailing on failure as requested');
      break;
    }
  }

  // Generate and write report
  const report = reportBuilder.build();
  const reportPath = writeReport(report, config.outputDir);
  
  // Also write markdown report
  const mdReport = generateMarkdownReport(report);
  const mdPath = join(config.outputDir, 'evidence-report.md');
  require('node:fs').writeFileSync(mdPath, mdReport, 'utf-8');

  // Print summary
  printReportSummary(report);
  
  console.log(`Reports written to:`);
  console.log(`  JSON: ${reportPath}`);
  console.log(`  Markdown: ${mdPath}`);

  // Exit with appropriate code
  const exitCode = report.summary.failed > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Run if executed directly
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
