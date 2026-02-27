#!/usr/bin/env npx tsx
/**
 * Self-Healing ISL Pipeline Demo
 * 
 * Shows the system automatically fixing code until it passes the gate.
 * 
 * "Write me a login" → ISL → Code → Gate → Fix → Repeat → SHIP
 */

import { createTranslator, type RepoContext } from '@isl-lang/translator';
import { createGenerator } from '@isl-lang/generator';
import { selfHeal, formatProofBundle } from './src/index.js';

async function main() {
  console.log('═'.repeat(70));
  console.log(' Self-Healing ISL Pipeline Demo');
  console.log('═'.repeat(70));
  console.log();
  console.log(' This demo shows the system automatically fixing code');
  console.log(' until it passes the gate. No human intervention needed.');
  console.log();

  const repoContext: RepoContext = {
    framework: 'nextjs',
    authLib: 'next-auth',
    validationLib: 'zod',
    routingStyle: 'file-based',
    conventions: { apiPrefix: '/api' },
  };

  // Step 1: Translate NL → ISL
  console.log('┌─ Step 1: NL → ISL ─────────────────────────────────────────┐');
  const translator = createTranslator();
  const translation = translator.translate({
    prompt: 'Write me a login',
    repoContext,
  });

  if (!translation.success || !translation.ast) {
    console.log('Translation failed!');
    return;
  }

  console.log(`│ ✓ Translated: "${translation.matchedPattern}"`);
  console.log(`│ ✓ Intents: ${translation.ast.behaviors.flatMap(b => b.intents.map(i => i.tag)).join(', ')}`);
  console.log('└───────────────────────────────────────────────────────────────┘');
  console.log();

  // Step 2: Generate initial code
  console.log('┌─ Step 2: ISL → Code (initial) ─────────────────────────────┐');
  const generator = createGenerator(repoContext);
  const generation = generator.generate({
    ast: translation.ast,
    repoContext,
    targetDir: './generated',
  });

  console.log(`│ ✓ Generated ${generation.diffs.length} files`);
  for (const diff of generation.diffs) {
    console.log(`│   • ${diff.path}`);
  }
  console.log('└───────────────────────────────────────────────────────────────┘');
  console.log();

  // Step 3: Self-healing loop
  console.log('┌─ Step 3: Self-Healing Loop ────────────────────────────────┐');
  console.log('│ The system will now iterate until the code passes.        │');
  console.log('└───────────────────────────────────────────────────────────────┘');

  const result = await selfHeal(
    translation.ast,
    generation.diffs,
    repoContext,
    {
      maxIterations: 10,
      verbose: true,
    }
  );

  // Show results
  console.log();
  console.log('═'.repeat(70));
  console.log(' Final Result');
  console.log('═'.repeat(70));
  console.log();

  if (result.success) {
    console.log('  ┌──────────────────────────────────────────────────────┐');
    console.log('  │                    ✓ SHIP                            │');
    console.log('  │                                                      │');
    console.log(`  │  Iterations: ${result.iterations}                                     │`);
    console.log(`  │  Final Score: ${result.finalScore}/100                              │`);
    console.log('  │  All intents satisfied!                              │');
    console.log('  └──────────────────────────────────────────────────────┘');
  } else {
    console.log('  ┌──────────────────────────────────────────────────────┐');
    console.log('  │                    ✗ NO_SHIP                         │');
    console.log('  │                                                      │');
    console.log(`  │  Iterations: ${result.iterations}/${result.maxIterations}                                 │`);
    console.log(`  │  Final Score: ${result.finalScore}/100                              │`);
    console.log('  │  Could not satisfy all intents                       │');
    console.log('  └──────────────────────────────────────────────────────┘');
  }

  // Show iteration history
  console.log();
  console.log('Healing History:');
  console.log('─'.repeat(70));
  for (const iter of result.history) {
    const icon = iter.verdict === 'SHIP' ? '✓' : '○';
    console.log(`  ${icon} Iteration ${iter.iteration}: Score ${iter.score}/100`);
    if (iter.fixes.length > 0) {
      console.log(`    Fixes applied:`);
      for (const fix of iter.fixes) {
        console.log(`      • ${fix}`);
      }
    }
  }

  // Show final code for the main route file
  console.log();
  console.log('Final Generated Code (route handler):');
  console.log('─'.repeat(70));
  
  const routeFile = Array.from(result.finalCode.keys()).find(f => f.includes('route.ts') && !f.includes('.test.'));
  if (routeFile) {
    const code = result.finalCode.get(routeFile)!;
    console.log(`\n// ${routeFile}\n`);
    console.log(code);
  }

  // Show proof bundle if available
  if (result.proof) {
    console.log();
    console.log(formatProofBundle(result.proof));
  }

  // Key insight
  console.log();
  console.log('═'.repeat(70));
  console.log(' Key Insight');
  console.log('═'.repeat(70));
  console.log();
  console.log('  The self-healing pipeline:');
  console.log('  1. Generates code from ISL specification');
  console.log('  2. Runs the gate to check policy compliance');
  console.log('  3. If violations found → automatically applies fixes');
  console.log('  4. Repeats until SHIP or max iterations reached');
  console.log();
  console.log('  This means:');
  console.log('  • Agents can generate code freely');
  console.log('  • But the system ensures it meets all intent requirements');
  console.log('  • No unsafe code ships - ever');
  console.log();
}

main().catch(console.error);
