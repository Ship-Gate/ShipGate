#!/usr/bin/env npx tsx
/**
 * ISL Pipeline Demo
 * 
 * Demonstrates the complete flow:
 * "Write me a login" → ISL → Code → Gate → Proof
 */

import { runPipeline, formatProofBundle, type RepoContext } from './src/index.js';

async function main() {
  console.log('═'.repeat(60));
  console.log(' ISL Pipeline: "Write me a login" → SHIP/NO_SHIP');
  console.log('═'.repeat(60));
  console.log();
  console.log(' This demo shows the complete flow:');
  console.log(' 1. Natural language → ISL specification');
  console.log(' 2. ISL → Generated code (diffs only)');
  console.log(' 3. Gate verification (policy enforcement)');
  console.log(' 4. Proof bundle (verifiable evidence)');
  console.log();

  const repoContext: RepoContext = {
    framework: 'nextjs',
    authLib: 'next-auth',
    validationLib: 'zod',
    dbLib: 'prisma',
    routingStyle: 'file-based',
    conventions: {
      apiPrefix: '/api',
    },
  };

  // Run the pipeline
  const result = await runPipeline(
    'Write me a login',
    repoContext,
    './generated'
  );

  // Show the verdict
  console.log('═'.repeat(60));
  console.log(' Final Result');
  console.log('═'.repeat(60));
  console.log();

  if (result.verdict === 'SHIP') {
    console.log('  ┌────────────────────────────────────────┐');
    console.log('  │          ✓ SHIP                        │');
    console.log('  │                                        │');
    console.log('  │  All clauses satisfied                 │');
    console.log('  │  All tests passing                     │');
    console.log('  │  Gate: ' + (result.gate?.score || 0) + '/100                            │');
    console.log('  │  Proof bundle generated                │');
    console.log('  └────────────────────────────────────────┘');
  } else {
    console.log('  ┌────────────────────────────────────────┐');
    console.log('  │          ✗ NO_SHIP                     │');
    console.log('  │                                        │');
    if (result.gate?.violations.length) {
      console.log(`  │  Violations: ${result.gate.violations.length}                         │`);
    }
    console.log('  │  Gate: ' + (result.gate?.score || 0) + '/100                            │');
    console.log('  └────────────────────────────────────────┘');
  }
  console.log();

  // Show warnings
  if (result.warnings.length > 0) {
    console.log('Warnings:');
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`);
    }
    console.log();
  }

  // Show proof bundle summary
  if (result.proof) {
    console.log(formatProofBundle(result.proof));
  }

  // Show generated files
  if (result.generation) {
    console.log('\nGenerated Files (diffs):');
    for (const diff of result.generation.diffs) {
      console.log(`\n─── ${diff.path} (${diff.status}) ───`);
      const preview = diff.hunks[0]?.content.split('\n').slice(0, 20).join('\n');
      console.log(preview);
      if (diff.hunks[0]?.content.split('\n').length > 20) {
        console.log('... (truncated)');
      }
    }
  }

  // The key insight
  console.log('\n═'.repeat(60));
  console.log(' Key Insight');
  console.log('═'.repeat(60));
  console.log();
  console.log('  ISL is the intermediate representation for software.');
  console.log();
  console.log('  • Humans/agents talk in natural language');
  console.log('  • But NOTHING ships until it becomes valid ISL');
  console.log('  • Generator only understands ISL (never raw prompts)');
  console.log('  • Gate enforces intents declared in ISL');
  console.log('  • Proof bundle provides verifiable evidence');
  console.log();
  console.log('  The safety contract:');
  console.log('  "Bad translation may produce wrong spec,');
  console.log('   but generator will NEVER produce unsafe code');
  console.log('   because policy packs are always enforced."');
  console.log();
}

main().catch(console.error);
