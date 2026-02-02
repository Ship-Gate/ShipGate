#!/usr/bin/env node
/**
 * ISL Pipeline CLI
 * 
 * Commands:
 *   generate <prompt>  - Generate code from natural language
 *   heal <dir>         - Heal existing code to pass the gate
 *   verify <dir>       - Verify code passes semantic rules
 * 
 * @module @isl-lang/pipeline
 */

import { createTranslator, type RepoContext } from '@isl-lang/translator';
import { createGenerator } from '@isl-lang/generator';
import { healSemantically } from './semantic-healer.js';
import { runSemanticRules, checkProofCompleteness } from './semantic-rules.js';
import { generateNextJSRoute, generateTests, type TemplateContext } from './code-templates.js';
import { formatProofBundle } from '@isl-lang/proof';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'generate':
      await handleGenerate(args.slice(1));
      break;
    case 'heal':
      await handleHeal(args.slice(1));
      break;
    case 'verify':
      await handleVerify(args.slice(1));
      break;
    case 'demo':
      await handleDemo();
      break;
    default:
      printHelp();
  }
}

function printHelp() {
  console.log(`
ISL Pipeline CLI

Usage:
  isl-pipeline generate <prompt>     Generate code from natural language
  isl-pipeline heal <directory>      Heal existing code to pass the gate
  isl-pipeline verify <directory>    Verify code passes semantic rules
  isl-pipeline demo                  Run the demo pipeline

Options:
  --framework <name>   Target framework (nextjs, express, fastify)
  --output <dir>       Output directory (default: ./generated)
  --dry-run            Don't write files, just show what would be generated
  --verbose            Show detailed output

Examples:
  isl-pipeline generate "Write me a login with rate limiting"
  isl-pipeline generate "Create user registration" --framework nextjs
  isl-pipeline verify ./src/app/api
  isl-pipeline heal ./src/app/api --verbose
`);
}

// ============================================================================
// Generate Command
// ============================================================================

async function handleGenerate(args: string[]) {
  const prompt = args.find(a => !a.startsWith('--')) || '';
  const framework = getFlag(args, '--framework') || 'nextjs';
  const outputDir = getFlag(args, '--output') || './generated';
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  if (!prompt) {
    console.error('Error: Please provide a prompt');
    console.error('Example: isl-pipeline generate "Write me a login"');
    process.exit(1);
  }

  console.log('═'.repeat(60));
  console.log(' ISL Pipeline: Generate');
  console.log('═'.repeat(60));
  console.log();
  console.log(`Prompt: "${prompt}"`);
  console.log(`Framework: ${framework}`);
  console.log(`Output: ${outputDir}`);
  console.log();

  const repoContext: RepoContext = {
    framework: framework as 'nextjs' | 'express' | 'fastify',
    validationLib: 'zod',
    routingStyle: framework === 'nextjs' ? 'file-based' : 'explicit',
    conventions: { apiPrefix: '/api' },
  };

  // Step 1: Translate NL → ISL
  console.log('─'.repeat(60));
  console.log(' Step 1: NL → ISL Translation');
  console.log('─'.repeat(60));

  const translator = createTranslator();
  const translation = translator.translate({ prompt, repoContext });

  if (!translation.success || !translation.ast) {
    console.error('Translation failed:', translation.errors);
    process.exit(1);
  }

  console.log(`✓ Matched pattern: ${translation.matchedPattern || 'generic'}`);
  console.log(`✓ Confidence: ${(translation.confidence * 100).toFixed(0)}%`);
  console.log(`✓ Behaviors: ${translation.ast.behaviors.map(b => b.name).join(', ')}`);
  console.log(`✓ Intents: ${translation.ast.behaviors.flatMap(b => b.intents.map(i => i.tag)).join(', ')}`);

  if (translation.openQuestions.length > 0) {
    console.log();
    console.log('⚠ Open questions (may need clarification):');
    for (const q of translation.openQuestions) {
      console.log(`  • ${q.question}`);
    }
  }
  console.log();

  // Step 2: Generate production-ready code
  console.log('─'.repeat(60));
  console.log(' Step 2: ISL → Code (Production Templates)');
  console.log('─'.repeat(60));

  const filesToWrite: Array<{ path: string; content: string }> = [];

  for (const behavior of translation.ast.behaviors) {
    const ctx: TemplateContext = {
      ast: translation.ast,
      behavior,
      repoContext,
    };

    const behaviorKebab = behavior.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    
    // Generate route handler
    const routePath = framework === 'nextjs'
      ? `${outputDir}/app/api/${behaviorKebab}/route.ts`
      : `${outputDir}/routes/${behaviorKebab}.ts`;
    
    const routeCode = generateNextJSRoute(ctx);
    filesToWrite.push({ path: routePath, content: routeCode });
    console.log(`✓ Generated: ${routePath}`);

    // Generate tests
    const testPath = routePath.replace('.ts', '.test.ts');
    const testCode = generateTests(ctx);
    filesToWrite.push({ path: testPath, content: testCode });
    console.log(`✓ Generated: ${testPath}`);
  }

  // Generate ISL spec file
  const specPath = `${outputDir}/${translation.ast.name.toLowerCase()}.isl`;
  filesToWrite.push({ path: specPath, content: translation.isl! });
  console.log(`✓ Generated: ${specPath}`);
  console.log();

  // Step 3: Verify with semantic rules
  console.log('─'.repeat(60));
  console.log(' Step 3: Semantic Verification');
  console.log('─'.repeat(60));

  const codeMap = new Map(filesToWrite.map(f => [f.path, f.content]));
  const violations = runSemanticRules(codeMap);

  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const highCount = violations.filter(v => v.severity === 'high').length;
  const score = Math.max(0, 100 - (criticalCount * 25) - (highCount * 10) - (violations.length * 2));

  console.log(`Score: ${score}/100`);
  console.log(`Violations: ${violations.length} (${criticalCount} critical, ${highCount} high)`);

  if (violations.length > 0 && verbose) {
    for (const v of violations) {
      console.log(`  [${v.severity}] ${v.ruleId}: ${v.message}`);
    }
  }

  const verdict = criticalCount === 0 && highCount === 0 ? 'SHIP' : 'NO_SHIP';
  console.log(`Verdict: ${verdict}`);
  console.log();

  // Step 4: Write files
  if (!dryRun) {
    console.log('─'.repeat(60));
    console.log(' Step 4: Writing Files');
    console.log('─'.repeat(60));

    for (const file of filesToWrite) {
      const dir = path.dirname(file.path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file.path, file.content, 'utf-8');
      console.log(`✓ Wrote: ${file.path}`);
    }
    console.log();
  } else {
    console.log('(Dry run - no files written)');
    console.log();
  }

  // Summary
  console.log('═'.repeat(60));
  console.log(' Summary');
  console.log('═'.repeat(60));
  console.log();
  console.log(`  Files: ${filesToWrite.length}`);
  console.log(`  Score: ${score}/100`);
  console.log(`  Verdict: ${verdict}`);
  
  if (verdict === 'NO_SHIP') {
    console.log();
    console.log('  Note: Code has violations. Run with --verbose to see details.');
    console.log('  Run "isl-pipeline heal <dir>" to attempt automatic fixes.');
  }
  console.log();
}

// ============================================================================
// Verify Command
// ============================================================================

async function handleVerify(args: string[]) {
  const dir = args.find(a => !a.startsWith('--')) || '.';
  const verbose = args.includes('--verbose');

  console.log('═'.repeat(60));
  console.log(' ISL Pipeline: Verify');
  console.log('═'.repeat(60));
  console.log();
  console.log(`Directory: ${dir}`);
  console.log();

  // Read all TypeScript files
  const codeMap = new Map<string, string>();
  await readDirectory(dir, codeMap);

  console.log(`Found ${codeMap.size} files`);
  console.log();

  // Run semantic rules
  const violations = runSemanticRules(codeMap);

  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const highCount = violations.filter(v => v.severity === 'high').length;
  const mediumCount = violations.filter(v => v.severity === 'medium').length;
  const lowCount = violations.filter(v => v.severity === 'low').length;
  const score = Math.max(0, 100 - (criticalCount * 25) - (highCount * 10) - (mediumCount * 5) - (lowCount * 2));

  console.log('─'.repeat(60));
  console.log(' Results');
  console.log('─'.repeat(60));
  console.log();
  console.log(`Score: ${score}/100`);
  console.log(`Violations: ${violations.length}`);
  console.log(`  Critical: ${criticalCount}`);
  console.log(`  High: ${highCount}`);
  console.log(`  Medium: ${mediumCount}`);
  console.log(`  Low: ${lowCount}`);
  console.log();

  if (verbose && violations.length > 0) {
    console.log('Violations:');
    for (const v of violations) {
      console.log(`  [${v.severity}] ${v.file}:${v.line}`);
      console.log(`    ${v.ruleId}: ${v.message}`);
      if (v.fix) {
        console.log(`    Fix: ${v.fix}`);
      }
    }
    console.log();
  }

  const verdict = criticalCount === 0 && highCount === 0 ? 'SHIP' : 'NO_SHIP';
  console.log(`Verdict: ${verdict}`);
  console.log();

  process.exit(verdict === 'SHIP' ? 0 : 1);
}

// ============================================================================
// Heal Command
// ============================================================================

async function handleHeal(args: string[]) {
  const dir = args.find(a => !a.startsWith('--')) || '.';
  const verbose = args.includes('--verbose');
  const maxIterations = parseInt(getFlag(args, '--max-iterations') || '8', 10);

  console.log('═'.repeat(60));
  console.log(' ISL Pipeline: Heal');
  console.log('═'.repeat(60));
  console.log();
  console.log(`Directory: ${dir}`);
  console.log(`Max iterations: ${maxIterations}`);
  console.log();

  // Read existing code
  const codeMap = new Map<string, string>();
  await readDirectory(dir, codeMap);

  console.log(`Found ${codeMap.size} files`);
  console.log();

  // This would need an ISL spec to heal against
  // For now, show what violations exist
  const violations = runSemanticRules(codeMap);
  
  console.log('─'.repeat(60));
  console.log(' Current State');
  console.log('─'.repeat(60));
  console.log();
  console.log(`Violations: ${violations.length}`);
  
  for (const v of violations.slice(0, 10)) {
    console.log(`  [${v.severity}] ${v.ruleId}: ${v.message}`);
  }
  if (violations.length > 10) {
    console.log(`  ... and ${violations.length - 10} more`);
  }
  console.log();
  console.log('Note: Healing requires an ISL spec. Run "generate" first.');
}

// ============================================================================
// Demo Command
// ============================================================================

async function handleDemo() {
  console.log('═'.repeat(60));
  console.log(' ISL Pipeline Demo');
  console.log('═'.repeat(60));
  console.log();
  console.log('Running: generate "Write me a login" --dry-run --verbose');
  console.log();

  await handleGenerate(['Write me a login', '--dry-run', '--verbose']);
}

// ============================================================================
// Utilities
// ============================================================================

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx < args.length - 1) {
    return args[idx + 1];
  }
  return undefined;
}

async function readDirectory(dir: string, codeMap: Map<string, string>): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await readDirectory(fullPath, codeMap);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const content = await fs.readFile(fullPath, 'utf-8');
        codeMap.set(fullPath, content);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }
}

// Run
main().catch(console.error);
