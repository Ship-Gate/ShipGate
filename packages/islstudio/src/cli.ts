#!/usr/bin/env node
/**
 * ISL Studio CLI
 * 
 * Usage:
 *   npx islstudio gate              # Run gate on changed files
 *   npx islstudio gate --all        # Run on all files
 *   npx islstudio gate --ci         # CI mode (machine readable)
 *   npx islstudio gate --output json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { runGate } from './gate.js';
import { loadConfig } from './config.js';
import { formatTerminalOutput, formatJsonOutput, formatWithExplanations, formatSarifOutput } from './formatters.js';
import { generateHtmlReport } from './report.js';
import { runRulesCommand } from './rules-cli.js';
import { saveBaseline, loadBaseline } from './baseline.js';

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  if (command === 'gate') {
    await runGateCommand(args.slice(1));
  } else if (command === 'init') {
    const { runInitCommand } = await import('./init-command.js');
    await runInitCommand(args.slice(1));
  } else if (command === 'rules') {
    await runRulesCommand(args.slice(1));
  } else if (command === 'baseline') {
    await runBaselineCommand(args.slice(1));
  } else if (command === 'version' || command === '--version' || command === '-v') {
    console.log('islstudio v0.1.1');
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run "islstudio help" for usage.');
    process.exit(1);
  }
}

// ============================================================================
// Gate Command
// ============================================================================

async function runGateCommand(args: string[]) {
  const options = parseArgs(args);
  const cwd = process.cwd();
  
  // Load config
  const config = await loadConfig(cwd);
  
  // Find files to check
  const files = await findFiles(cwd, options);
  
  if (files.length === 0) {
    if (!options.ci) {
      console.log('No files to check.');
    }
    process.exit(0);
  }

  // Run the gate
  const result = await runGate(files, config);

  // Output results
  if (options.output === 'json') {
    console.log(formatJsonOutput(result));
  } else if (options.output === 'sarif') {
    console.log(formatSarifOutput(result, cwd));
  } else if (options.explain) {
    console.log(formatWithExplanations(result));
  } else {
    console.log(formatTerminalOutput(result, options.ci));
  }

  // Write evidence
  if (config.evidence?.outputDir) {
    await writeEvidence(result, cwd, config.evidence.outputDir);
  }

  // Exit with appropriate code
  if (result.verdict === 'NO_SHIP') {
    process.exit(1);
  }
}

// ============================================================================
// Argument Parsing
// ============================================================================

interface CliOptions {
  all: boolean;
  ci: boolean;
  output: 'text' | 'json' | 'sarif';
  configPath?: string;
  explain: boolean;
  changedOnly: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    all: false,
    ci: false,
    output: 'text',
    explain: false,
    changedOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all' || arg === '-a') {
      options.all = true;
    } else if (arg === '--ci') {
      options.ci = true;
    } else if (arg === '--output' || arg === '-o') {
      const next = args[++i];
      if (next === 'json' || next === 'sarif') {
        options.output = next;
      }
    } else if (arg === '--config' || arg === '-c') {
      options.configPath = args[++i];
    } else if (arg === '--explain' || arg === '-e') {
      options.explain = true;
    } else if (arg === '--changed-only') {
      options.changedOnly = true;
    }
  }

  return options;
}

// ============================================================================
// File Discovery
// ============================================================================

async function findFiles(cwd: string, options: CliOptions): Promise<Array<{path: string, content: string}>> {
  const files: Array<{path: string, content: string}> = [];
  
  // For now, scan src/ directory
  const srcDir = path.join(cwd, 'src');
  
  try {
    await scanDirectory(srcDir, files, cwd);
  } catch {
    // src/ doesn't exist, try current directory
    await scanDirectory(cwd, files, cwd);
  }

  return files;
}

async function scanDirectory(dir: string, files: Array<{path: string, content: string}>, cwd: string) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip common non-source directories
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.git', '.islstudio'].includes(entry.name)) {
          continue;
        }
        await scanDirectory(fullPath, files, cwd);
      } else if (entry.isFile()) {
        // Only check .ts, .js, .tsx, .jsx files
        if (/\.(ts|js|tsx|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
          const content = await fs.readFile(fullPath, 'utf-8');
          const relativePath = path.relative(cwd, fullPath);
          files.push({ path: relativePath, content });
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }
}

// ============================================================================
// Evidence Writing
// ============================================================================

async function writeEvidence(result: any, cwd: string, outputDir: string) {
  const evidenceDir = path.join(cwd, outputDir, new Date().toISOString().slice(0, 10));
  
  await fs.mkdir(evidenceDir, { recursive: true });
  
  // Write manifest
  const manifest = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    gateVersion: '0.1.0',
    fingerprint: result.fingerprint,
    project: { root: cwd },
    files: ['manifest.json', 'results.json', 'report.html'],
  };
  
  await fs.writeFile(
    path.join(evidenceDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  // Write results
  await fs.writeFile(
    path.join(evidenceDir, 'results.json'),
    JSON.stringify(result, null, 2)
  );

  // Write HTML report
  const projectName = path.basename(cwd);
  const html = generateHtmlReport(result, projectName);
  await fs.writeFile(
    path.join(evidenceDir, 'report.html'),
    html
  );
}

// ============================================================================
// Help
// ============================================================================

function printHelp() {
  console.log(`
ISL Studio - Ship decisions with receipts

USAGE
  islstudio <command> [options]

COMMANDS
  gate          Run the gate on your code
  init          Set up ISL Studio in your project
  rules         Manage and explore rules
  baseline      Manage baseline for legacy code
  help          Show this help message
  version       Show version

GATE OPTIONS
  --all, -a        Check all files (not just changed)
  --changed-only   Only check files changed in git
  --ci             CI mode (exit 1 on NO_SHIP)
  --output, -o     Output format: text, json, sarif
  --explain, -e    Show detailed fix guidance for each violation
  --config, -c     Path to config file

RULES COMMANDS
  islstudio rules list              List all rules
  islstudio rules explain <id>      Explain a rule
  islstudio rules pack list         List policy packs

BASELINE COMMANDS
  islstudio baseline create         Capture current violations as baseline
  islstudio baseline show           Show baseline summary
  islstudio baseline clear          Remove baseline

SUPPRESSION
  Add inline comments to suppress specific violations:
  
  // islstudio-ignore pii/console-in-production: Development debugging only

EXAMPLES
  islstudio gate                    # Check src/ files
  islstudio gate --changed-only     # Check only git-changed files
  islstudio gate --explain          # Show fix guidance
  islstudio gate --ci --output json # CI mode with JSON output
  islstudio gate --output sarif     # SARIF for GitHub Security tab
  islstudio rules explain auth/bypass-detected

CONFIG
  Create .islstudio/config.json:

  {
    "preset": "startup-default",
    "packs": {
      "auth": { "enabled": true },
      "pii": { "enabled": true },
      "payments": { "enabled": false }
    },
    "threshold": 70
  }

LEARN MORE
  https://islstudio.dev/docs
`);
}

// ============================================================================
// Baseline Command
// ============================================================================

async function runBaselineCommand(args: string[]) {
  const subcommand = args[0];
  const cwd = process.cwd();
  const baselinePath = path.join(cwd, '.islstudio', 'baseline.json');

  if (subcommand === 'create') {
    const config = await loadConfig(cwd);
    const files = await findFiles(cwd, { all: true, ci: false, output: 'text', explain: false, changedOnly: false });
    const result = await runGate(files, config);
    
    const baseline = await saveBaseline(baselinePath, result.violations);
    
    console.log(`\n✅ Baseline created with ${baseline.entries.length} entries`);
    console.log(`   Saved to: ${baselinePath}\n`);
    console.log('Future runs will only flag NEW violations.\n');
  } else if (subcommand === 'show') {
    const baseline = await loadBaseline(baselinePath);
    if (!baseline) {
      console.log('\nNo baseline found. Run "islstudio baseline create" first.\n');
      return;
    }
    
    console.log(`\nBaseline: ${baseline.entries.length} entries`);
    console.log(`Created: ${baseline.createdAt}\n`);
    
    const byRule = new Map<string, number>();
    for (const e of baseline.entries) {
      byRule.set(e.ruleId, (byRule.get(e.ruleId) || 0) + 1);
    }
    
    for (const [rule, count] of byRule) {
      console.log(`  ${rule}: ${count}`);
    }
    console.log('');
  } else if (subcommand === 'clear') {
    await fs.unlink(baselinePath).catch(() => {});
    console.log('\n✅ Baseline cleared.\n');
  } else {
    console.log(`
ISL Studio - Baseline Management

Baselines allow teams to adopt ISL Studio without fixing legacy issues.
Only NEW violations will block PRs.

COMMANDS
  islstudio baseline create   Create baseline from current violations
  islstudio baseline show     Show baseline summary
  islstudio baseline clear    Remove baseline

WORKFLOW
  1. Run "islstudio baseline create" to capture existing issues
  2. Commit .islstudio/baseline.json
  3. Future PRs only fail on NEW violations
`);
  }
}

// Run
main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
