#!/usr/bin/env npx tsx
/**
 * ISL Healer Demo - Robust Self-Healing Pipeline
 * 
 * Shows the system with:
 * - Deterministic fix recipes
 * - Stuck detection (fingerprint repeat)
 * - Unknown rule abort
 * - No-weakening guard
 * - Machine-checkable __isl_intents export
 * - Iteration artifacts for audit
 */

import { createTranslator, type RepoContext } from '@isl-lang/translator';
import { createGenerator } from '@isl-lang/generator';
import { healUntilShip, formatProofBundle, FIX_CATALOG } from './src/index.js';

async function main() {
  console.log('═'.repeat(70));
  console.log(' ISL Healer - Robust Self-Healing Pipeline');
  console.log('═'.repeat(70));
  console.log();
  console.log(' The healer is ALLOWED to:');
  console.log('   ✓ Add missing enforcement (rate limiting, audit, validation)');
  console.log('   ✓ Add missing intent anchors (@intent or __isl_intents)');
  console.log('   ✓ Refactor within touched files minimally');
  console.log('   ✓ Add tests required by the spec');
  console.log();
  console.log(' The healer is NOT allowed to:');
  console.log('   ✗ Remove intents from the ISL spec');
  console.log('   ✗ Add suppressions automatically (islstudio-ignore)');
  console.log('   ✗ Downgrade severity');
  console.log('   ✗ Change gate rules/packs');
  console.log('   ✗ "Make it pass" by hiding violations');
  console.log();
  console.log(' Available Fix Recipes:');
  for (const [ruleId, recipe] of Object.entries(FIX_CATALOG)) {
    console.log(`   • ${ruleId}: ${recipe.description}`);
  }
  console.log();

  const repoContext: RepoContext = {
    framework: 'nextjs',
    authLib: 'next-auth',
    validationLib: 'zod',
    routingStyle: 'file-based',
    conventions: { apiPrefix: '/api' },
  };

  // Step 1: Translate NL → ISL
  console.log('─'.repeat(70));
  console.log(' Step 1: NL → ISL');
  console.log('─'.repeat(70));
  
  const translator = createTranslator();
  const translation = translator.translate({
    prompt: 'Write me a login with rate limiting and audit logging',
    repoContext,
  });

  if (!translation.success || !translation.ast) {
    console.log('Translation failed!');
    return;
  }

  console.log(`✓ Pattern: ${translation.matchedPattern}`);
  console.log(`✓ Confidence: ${(translation.confidence * 100).toFixed(0)}%`);
  console.log(`✓ Intents: ${translation.ast.behaviors.flatMap(b => b.intents.map(i => i.tag)).join(', ')}`);
  console.log();

  // Step 2: Generate initial code (intentionally buggy)
  console.log('─'.repeat(70));
  console.log(' Step 2: ISL → Code (intentionally incomplete)');
  console.log('─'.repeat(70));
  
  const generator = createGenerator(repoContext);
  const generation = generator.generate({
    ast: translation.ast,
    repoContext,
    targetDir: './generated',
  });

  console.log(`✓ Generated ${generation.diffs.length} files`);
  for (const diff of generation.diffs) {
    console.log(`  • ${diff.path}`);
  }
  console.log();

  // Step 3: Run healer
  console.log('─'.repeat(70));
  console.log(' Step 3: Heal Until Ship');
  console.log('─'.repeat(70));

  const result = await healUntilShip(
    translation.ast,
    generation.diffs,
    repoContext,
    {
      maxIterations: 8,
      stopOnRepeat: 2,
      allowNewFiles: false,
      verbose: true,
    }
  );

  // Results
  console.log();
  console.log('═'.repeat(70));
  console.log(' Result');
  console.log('═'.repeat(70));
  console.log();

  if (result.ok) {
    console.log('  ┌────────────────────────────────────────────────────┐');
    console.log('  │                    ✓ SHIP                          │');
    console.log('  │                                                    │');
    console.log(`  │  Iterations: ${result.iterations}                                   │`);
    console.log(`  │  Final Score: ${result.gate.score}/100                            │`);
    console.log('  │  Reason: All intents satisfied                     │');
    console.log('  └────────────────────────────────────────────────────┘');
  } else {
    console.log('  ┌────────────────────────────────────────────────────┐');
    console.log('  │                    ✗ NO_SHIP                       │');
    console.log('  │                                                    │');
    console.log(`  │  Iterations: ${result.iterations}/${8}                               │`);
    console.log(`  │  Final Score: ${result.gate.score}/100                            │`);
    console.log(`  │  Reason: ${result.reason}                          │`);
    console.log('  └────────────────────────────────────────────────────┘');
    
    if (result.unknownRules?.length) {
      console.log();
      console.log('  Unknown rules (need human review):');
      for (const rule of result.unknownRules) {
        console.log(`    • ${rule}`);
      }
    }
  }

  // Iteration history
  console.log();
  console.log('─'.repeat(70));
  console.log(' Healing History (Audit Trail)');
  console.log('─'.repeat(70));
  
  for (const iter of result.history) {
    const icon = iter.verdict === 'SHIP' ? '✓' : '○';
    console.log(`\n  ${icon} Iteration ${iter.iteration}`);
    console.log(`    Score: ${iter.score}/100 | Verdict: ${iter.verdict}`);
    console.log(`    Fingerprint: ${iter.fingerprint}`);
    console.log(`    Duration: ${iter.duration}ms`);
    
    if (iter.patchesApplied.length > 0) {
      console.log('    Patches applied:');
      for (const patch of iter.patchesApplied) {
        console.log(`      • [${patch.ruleId}] ${patch.description}`);
      }
    }
    
    if (iter.violations.length > 0 && iter.verdict !== 'SHIP') {
      console.log(`    Violations remaining: ${iter.violations.length}`);
    }
  }

  // Final code
  console.log();
  console.log('─'.repeat(70));
  console.log(' Final Code');
  console.log('─'.repeat(70));
  
  const routeFile = Array.from(result.finalCode.keys()).find(f => 
    f.includes('route.ts') && !f.includes('.test.')
  );
  
  if (routeFile) {
    console.log(`\n// ${routeFile}\n`);
    console.log(result.finalCode.get(routeFile));
  }

  // Proof bundle
  if (result.proof) {
    console.log();
    console.log(formatProofBundle(result.proof));
  }

  // The contract
  console.log();
  console.log('═'.repeat(70));
  console.log(' The Self-Healing Contract');
  console.log('═'.repeat(70));
  console.log();
  console.log('  What makes this different from "random retries":');
  console.log();
  console.log('  1. DETERMINISTIC - Each rule has ONE fix recipe');
  console.log('     No hallucination, no creativity, just reliable patches');
  console.log();
  console.log('  2. BOUNDED - Max iterations + stuck detection');
  console.log('     Same fingerprint twice? Stop, don\'t loop forever');
  console.log();
  console.log('  3. HONEST - Unknown rule? Abort, ask human');
  console.log('     No pretending we can fix what we don\'t understand');
  console.log();
  console.log('  4. GUARDED - No weakening allowed');
  console.log('     Refuse patches that add suppressions or bypass auth');
  console.log();
  console.log('  5. AUDITABLE - Every iteration saved');
  console.log('     Fingerprint + patches + duration = paper trail');
  console.log();
  console.log('  That\'s your moat: proof that passing means something.');
  console.log();
}

main().catch(console.error);
