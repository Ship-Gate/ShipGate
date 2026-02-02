#!/usr/bin/env npx tsx
/**
 * Semantic Healer Demo
 * 
 * Shows the REAL checks:
 * - Audit on ALL exit paths with correct semantics
 * - Rate limit BEFORE body parsing
 * - NO console.* (not just console.log)
 * - NO stubbed handlers can SHIP
 * - Proof bundle is INCOMPLETE unless tests ran
 */

import { createTranslator, type RepoContext } from '@isl-lang/translator';
import { createGenerator } from '@isl-lang/generator';
import { healSemantically, SEMANTIC_RULES, formatProofBundle } from './src/index.js';

async function main() {
  console.log('═'.repeat(70));
  console.log(' Semantic Healer - Real Checks, Not String Matching');
  console.log('═'.repeat(70));
  console.log();
  console.log(' What was BROKEN in the old healer:');
  console.log('   ✗ Audit with success:true on error paths');
  console.log('   ✗ Audit only on one path, not all exit paths');
  console.log('   ✗ console.error still in production');
  console.log('   ✗ Proof bundle shows 0 tests = "proven"');
  console.log('   ✗ Stubbed handlers can SHIP');
  console.log();
  console.log(' What the semantic healer FIXES:');
  console.log('   ✓ Audit on ALL paths with correct success: true/false');
  console.log('   ✓ Rate limit BEFORE body parsing');
  console.log('   ✓ NO console.* - must use safe logger');
  console.log('   ✓ NO stubs - throw Error("Not implemented") blocks SHIP');
  console.log('   ✓ Proof is INCOMPLETE unless tests actually ran');
  console.log();
  
  console.log(' Semantic Rules:');
  for (const rule of SEMANTIC_RULES) {
    console.log(`   • ${rule.id}: ${rule.description}`);
  }
  console.log();

  const repoContext: RepoContext = {
    framework: 'nextjs',
    authLib: 'next-auth',
    validationLib: 'zod',
    routingStyle: 'file-based',
    conventions: { apiPrefix: '/api' },
  };

  // Translate
  console.log('─'.repeat(70));
  console.log(' Step 1: NL → ISL');
  console.log('─'.repeat(70));
  
  const translator = createTranslator();
  const translation = translator.translate({
    prompt: 'Write me a login',
    repoContext,
  });

  if (!translation.success || !translation.ast) {
    console.log('Translation failed!');
    return;
  }

  console.log(`✓ Intents: ${translation.ast.behaviors.flatMap(b => b.intents.map(i => i.tag)).join(', ')}`);
  console.log();

  // Generate
  console.log('─'.repeat(70));
  console.log(' Step 2: ISL → Code (intentionally buggy)');
  console.log('─'.repeat(70));
  
  const generator = createGenerator(repoContext);
  const generation = generator.generate({
    ast: translation.ast,
    repoContext,
    targetDir: './generated',
  });

  console.log(`✓ Generated ${generation.diffs.length} files`);
  console.log();

  // Heal with semantic checks
  console.log('─'.repeat(70));
  console.log(' Step 3: Semantic Healing');
  console.log('─'.repeat(70));

  const result = await healSemantically(
    translation.ast,
    generation.diffs,
    repoContext,
    {
      maxIterations: 8,
      stopOnRepeat: 2,
      verbose: true,
      requireTests: true,
      failOnStubs: true,
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
    console.log('  │                    ✓ PROVEN                        │');
    console.log('  │                                                    │');
    console.log(`  │  Iterations: ${result.iterations}                                   │`);
    console.log(`  │  Final Score: ${result.finalScore}/100                            │`);
    console.log('  └────────────────────────────────────────────────────┘');
  } else {
    console.log('  ┌────────────────────────────────────────────────────┐');
    console.log(`  │  Proof Status: ${result.proofStatus.status.padEnd(20)}              │`);
    console.log('  │                                                    │');
    console.log(`  │  Reason: ${result.reason.padEnd(30)}        │`);
    console.log(`  │  Iterations: ${result.iterations}/${8}                               │`);
    console.log(`  │  Final Score: ${result.finalScore}/100                            │`);
    console.log('  └────────────────────────────────────────────────────┘');
    
    if (result.proofStatus.missing.length > 0) {
      console.log();
      console.log('  Missing for full proof:');
      for (const m of result.proofStatus.missing) {
        console.log(`    ✗ ${m}`);
      }
    }

    if (result.unknownRules?.length) {
      console.log();
      console.log('  Unknown rules (need human):');
      for (const rule of result.unknownRules) {
        console.log(`    • ${rule}`);
      }
    }
  }

  // Show history
  console.log();
  console.log('─'.repeat(70));
  console.log(' Healing History');
  console.log('─'.repeat(70));
  
  for (const iter of result.history) {
    console.log(`\n  Iteration ${iter.iteration}`);
    console.log(`    Fingerprint: ${iter.fingerprint}`);
    console.log(`    Duration: ${iter.duration}ms`);
    
    if (iter.violations.length > 0) {
      console.log(`    Violations: ${iter.violations.length}`);
      for (const v of iter.violations.slice(0, 3)) {
        console.log(`      • [${v.severity}] ${v.ruleId}`);
        console.log(`        ${v.message}`);
      }
      if (iter.violations.length > 3) {
        console.log(`      ... and ${iter.violations.length - 3} more`);
      }
    }
    
    if (iter.patchesApplied.length > 0) {
      console.log('    Patches:');
      for (const p of iter.patchesApplied) {
        console.log(`      ✓ ${p}`);
      }
    }
  }

  // Show final code
  console.log();
  console.log('─'.repeat(70));
  console.log(' Final Code');
  console.log('─'.repeat(70));
  
  const routeFile = Array.from(result.finalCode.keys()).find(f => 
    f.includes('route.ts') && !f.includes('.test.')
  );
  
  if (routeFile) {
    console.log(`\n// ${routeFile}\n`);
    const code = result.finalCode.get(routeFile)!;
    // Show key parts
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Highlight important patterns
      if (line.includes('auditAttempt') || 
          line.includes('@intent') || 
          line.includes('rateLimit') ||
          line.includes('safeLogger') ||
          line.includes('__isl_intents') ||
          line.includes('success:')) {
        console.log(`${String(i + 1).padStart(3)}| >>> ${line}`);
      } else {
        console.log(`${String(i + 1).padStart(3)}| ${line}`);
      }
    }
  }

  // The truth
  console.log();
  console.log('═'.repeat(70));
  console.log(' The Truth');
  console.log('═'.repeat(70));
  console.log();
  console.log('  A "PROVEN" bundle requires ALL of this:');
  console.log('    • Gate SHIP with no critical/high violations');
  console.log('    • TypeScript compilation passed');
  console.log('    • Build passed');
  console.log('    • Tests ran (0 tests = INCOMPLETE)');
  console.log('    • No stubbed handlers remain');
  console.log();
  console.log('  If any of these fail, status is INCOMPLETE_PROOF.');
  console.log();
  console.log('  The semantic rules check MEANING, not just presence:');
  console.log('    • audit-required: Must audit on ALL paths with correct success value');
  console.log('    • rate-limit-required: Must be BEFORE body parsing, with proper audit on 429');
  console.log('    • no-pii-logging: ALL console.* forbidden, must use safe logger');
  console.log('    • no-stubbed-handlers: throw Error("Not implemented") blocks SHIP');
  console.log();
  console.log('  That\'s the difference between "passes the rule" and "satisfies the intent."');
  console.log();
}

main().catch(console.error);
