/**
 * ISL Migration V2 Demo Runner
 *
 * Demonstrates the migration of various source formats to ISL.
 * Reads samples from packages/core/src/isl-migrate-v2/samples/
 * and prints canonical ISL output with summary.
 *
 * Usage:
 *   npx tsx bench/isl-migrate-demo/run.ts
 *   npx tsx bench/isl-migrate-demo/run.ts --format=openapi
 *   npx tsx bench/isl-migrate-demo/run.ts --verbose
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const samplesDir = path.resolve(rootDir, 'packages/core/src/isl-migrate-v2/samples');

// Import the migrator (dynamic import for ESM)
async function loadMigrator() {
  const migratePath = path.resolve(rootDir, 'packages/core/src/isl-migrate-v2/migrate.js');

  // Try direct import first, fall back to reading from dist
  try {
    const { migrateToISL } = await import('../../packages/core/src/isl-migrate-v2/migrate.js');
    return migrateToISL;
  } catch {
    // If direct import fails, try to load from the built output
    console.log('Note: Running from source files directly');
    const { migrateToISL } = await import(migratePath);
    return migrateToISL;
  }
}

// Types
interface DemoOptions {
  format?: 'openapi' | 'zod' | 'typescript' | 'all';
  verbose?: boolean;
}

interface MigrationSource {
  id: string;
  sourceType: string;
  name: string;
  filePath: string;
  content: string;
}

// Parse CLI arguments
function parseArgs(): DemoOptions {
  const args = process.argv.slice(2);
  const options: DemoOptions = { format: 'all', verbose: false };

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1] as DemoOptions['format'];
    }
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
ISL Migration V2 Demo Runner

Usage:
  npx tsx bench/isl-migrate-demo/run.ts [options]

Options:
  --format=<type>   Source format to demo: openapi, zod, typescript, all (default: all)
  --verbose, -v     Show detailed output including open questions
  --help, -h        Show this help message

Examples:
  npx tsx bench/isl-migrate-demo/run.ts
  npx tsx bench/isl-migrate-demo/run.ts --format=openapi
  npx tsx bench/isl-migrate-demo/run.ts --format=zod --verbose
`);
}

// Load sample files
function loadSamples(options: DemoOptions): MigrationSource[] {
  const sources: MigrationSource[] = [];

  // OpenAPI sample
  if (options.format === 'all' || options.format === 'openapi') {
    const openapiPath = path.join(samplesDir, 'openapi.json');
    if (fs.existsSync(openapiPath)) {
      sources.push({
        id: 'sample-openapi',
        sourceType: 'openapi',
        name: 'OpenAPI Sample',
        filePath: openapiPath,
        content: fs.readFileSync(openapiPath, 'utf-8'),
      });
    }
  }

  // Zod sample
  if (options.format === 'all' || options.format === 'zod') {
    const zodPath = path.join(samplesDir, 'zod.ts.fixture');
    if (fs.existsSync(zodPath)) {
      sources.push({
        id: 'sample-zod',
        sourceType: 'zod',
        name: 'Zod Sample',
        filePath: zodPath,
        content: fs.readFileSync(zodPath, 'utf-8'),
      });
    }
  }

  // TypeScript sample
  if (options.format === 'all' || options.format === 'typescript') {
    const tsPath = path.join(samplesDir, 'types.ts.fixture');
    if (fs.existsSync(tsPath)) {
      sources.push({
        id: 'sample-typescript',
        sourceType: 'typescript',
        name: 'TypeScript Sample',
        filePath: tsPath,
        content: fs.readFileSync(tsPath, 'utf-8'),
      });
    }
  }

  return sources;
}

// Format output with colors (basic ANSI)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function printHeader(text: string) {
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  ${text}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function printSubHeader(text: string) {
  console.log(`\n${colors.cyan}───────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.cyan}  ${text}${colors.reset}`);
  console.log(`${colors.cyan}───────────────────────────────────────────────────────────────${colors.reset}\n`);
}

// Main demo function
async function runDemo() {
  const options = parseArgs();

  printHeader('ISL Migration V2 Demo');

  console.log(`${colors.dim}Samples directory: ${samplesDir}${colors.reset}`);
  console.log(`${colors.dim}Format filter: ${options.format}${colors.reset}`);
  console.log(`${colors.dim}Verbose: ${options.verbose}${colors.reset}`);

  // Load migrator
  let migrateToISL: Function;
  try {
    migrateToISL = await loadMigrator();
  } catch (error) {
    console.error(`${colors.red}Failed to load migrator:${colors.reset}`, error);
    console.log(`\n${colors.yellow}Tip: Make sure to build the project first:${colors.reset}`);
    console.log('  pnpm build\n');
    process.exit(1);
  }

  // Load samples
  const sources = loadSamples(options);

  if (sources.length === 0) {
    console.error(`${colors.red}No sample files found in ${samplesDir}${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.green}Loaded ${sources.length} sample(s):${colors.reset}`);
  for (const source of sources) {
    console.log(`  - ${source.name} (${source.sourceType})`);
  }

  // Run migration for each source individually for better output
  for (const source of sources) {
    printSubHeader(`Migrating: ${source.name} (${source.sourceType})`);

    try {
      const result = migrateToISL([source], {
        generatePreconditions: true,
        generatePostconditions: true,
        inferEntities: true,
      });

      // Print canonical ISL output
      console.log(`${colors.bright}Generated ISL:${colors.reset}`);
      console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
      console.log(result.islOutput);
      console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);

      // Print summary
      console.log(`\n${colors.bright}Summary:${colors.reset}`);
      console.log(`  ${colors.green}✓${colors.reset} Types extracted: ${result.stats.typesExtracted}`);
      console.log(`  ${colors.green}✓${colors.reset} Behaviors created: ${result.stats.behaviorsCreated}`);
      console.log(`  ${colors.green}✓${colors.reset} Entities inferred: ${result.stats.entitiesInferred}`);
      console.log(`  ${colors.yellow}?${colors.reset} Open questions: ${result.stats.openQuestionsCount}`);
      console.log(`  ${colors.dim}⏱${colors.reset} Duration: ${result.stats.durationMs}ms`);

      // Print open questions if verbose
      if (options.verbose && result.openQuestions.length > 0) {
        console.log(`\n${colors.bright}Open Questions:${colors.reset}`);
        for (const question of result.openQuestions) {
          const priorityColor =
            question.priority === 'critical'
              ? colors.red
              : question.priority === 'high'
                ? colors.yellow
                : colors.dim;
          console.log(
            `  ${priorityColor}[${question.priority.toUpperCase()}]${colors.reset} ${question.question}`
          );
          if (question.suggestion) {
            console.log(`    ${colors.dim}Suggestion: ${question.suggestion}${colors.reset}`);
          }
        }
      }
    } catch (error) {
      console.error(`${colors.red}Migration failed:${colors.reset}`, error);
    }
  }

  // Combined migration summary
  printSubHeader('Combined Migration');

  try {
    const combinedResult = migrateToISL(sources, {
      domainName: 'CombinedAPI',
      generatePreconditions: true,
      generatePostconditions: true,
      inferEntities: true,
    });

    console.log(`${colors.bright}Combined ISL Output (first 100 lines):${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
    const lines = combinedResult.islOutput?.split('\n') ?? [];
    console.log(lines.slice(0, 100).join('\n'));
    if (lines.length > 100) {
      console.log(`${colors.dim}... (${lines.length - 100} more lines)${colors.reset}`);
    }
    console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);

    console.log(`\n${colors.bright}Combined Summary:${colors.reset}`);
    console.log(`  ${colors.green}✓${colors.reset} Total types: ${combinedResult.stats.typesExtracted}`);
    console.log(`  ${colors.green}✓${colors.reset} Total behaviors: ${combinedResult.stats.behaviorsCreated}`);
    console.log(`  ${colors.green}✓${colors.reset} Total entities: ${combinedResult.stats.entitiesInferred}`);
    console.log(`  ${colors.yellow}?${colors.reset} Total questions: ${combinedResult.stats.openQuestionsCount}`);
    console.log(`  ${colors.dim}⏱${colors.reset} Total duration: ${combinedResult.stats.durationMs}ms`);
  } catch (error) {
    console.error(`${colors.red}Combined migration failed:${colors.reset}`, error);
  }

  printHeader('Demo Complete');
}

// Run the demo
runDemo().catch((error) => {
  console.error('Demo failed:', error);
  process.exit(1);
});
