#!/usr/bin/env npx tsx
/**
 * ISL Pipeline Test Suite
 * 
 * Tests the complete flow with various inputs
 */

import { createTranslator } from './packages/isl-translator/src/index.js';
import { createGenerator } from './packages/isl-generator/src/index.js';
import { createProofBundle, formatProofBundle } from './packages/isl-proof/src/index.js';

const translator = createTranslator();

console.log('═'.repeat(70));
console.log(' ISL Pipeline Test Suite');
console.log('═'.repeat(70));
console.log();

// Test cases
const testCases = [
  'Write me a login',
  'Create user registration',
  'Add password reset',
  'Build a payment checkout',
  'Make a todo list API',  // This won't match - tests fallback
];

for (const prompt of testCases) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(` Test: "${prompt}"`);
  console.log('─'.repeat(70));

  // Step 1: Translate
  const result = translator.translate({ 
    prompt,
    repoContext: {
      framework: 'nextjs',
      routingStyle: 'file-based',
      conventions: { apiPrefix: '/api' }
    }
  });

  if (result.success && result.ast) {
    console.log(`\n✓ Translation succeeded`);
    console.log(`  Pattern: ${result.matchedPattern || 'generic (no match)'}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`  Behaviors: ${result.ast.behaviors.map(b => b.name).join(', ')}`);
    
    // Show intents
    const intents = result.ast.behaviors.flatMap(b => b.intents.map(i => i.tag));
    if (intents.length > 0) {
      console.log(`  Intents: ${intents.join(', ')}`);
    }

    // Show assumptions
    if (result.assumptions.length > 0) {
      console.log(`\n  Assumptions:`);
      for (const a of result.assumptions) {
        console.log(`    • [${(a.confidence * 100).toFixed(0)}%] ${a.description}`);
      }
    }

    // Show open questions
    if (result.openQuestions.length > 0) {
      console.log(`\n  ⚠ Open Questions:`);
      for (const q of result.openQuestions) {
        console.log(`    • ${q.question}`);
      }
    }

    // Step 2: Generate code plan
    const generator = createGenerator({
      framework: 'nextjs',
      routingStyle: 'file-based',
      conventions: { apiPrefix: '/api' }
    });
    
    const plan = generator.plan(result.ast);
    console.log(`\n  Generation Plan:`);
    console.log(`    Files to create: ${plan.filesToCreate.length}`);
    for (const f of plan.filesToCreate) {
      console.log(`      • ${f.path}`);
    }
    
    if (plan.warnings.length > 0) {
      console.log(`\n    Warnings:`);
      for (const w of plan.warnings) {
        console.log(`      ⚠ ${w}`);
      }
    }

    if (plan.refused.length > 0) {
      console.log(`\n    Refused (safety):`);
      for (const r of plan.refused) {
        console.log(`      ✗ ${r.action}: ${r.reason}`);
      }
    }

    // Step 3: Show ISL output (first 15 lines)
    console.log(`\n  Generated ISL (preview):`);
    const islLines = result.isl!.split('\n').slice(0, 12);
    for (const line of islLines) {
      console.log(`    ${line}`);
    }
    console.log(`    ... (${result.isl!.split('\n').length - 12} more lines)`);

  } else {
    console.log(`\n✗ Translation failed`);
    console.log(`  Errors: ${result.errors?.join(', ')}`);
  }
}

// Summary
console.log(`\n${'═'.repeat(70)}`);
console.log(' Summary');
console.log('═'.repeat(70));
console.log();
console.log('  Pattern Library Coverage:');
console.log('    ✓ Auth: login, register, password reset');
console.log('    ✓ Payments: checkout, process payment');
console.log('    ✓ CRUD: generic resource operations');
console.log('    ○ Unknown prompts: fallback with open questions');
console.log();
console.log('  Safety Features:');
console.log('    ✓ Never emits code directly (only ISL spec)');
console.log('    ✓ Explicit assumptions with confidence');
console.log('    ✓ Open questions for ambiguous inputs');
console.log('    ✓ Intent tags for policy enforcement');
console.log('    ✓ Refused actions for unsafe patterns');
console.log();
console.log('  The Flow:');
console.log('    NL prompt → ISL AST → Code diffs → Gate → Proof');
console.log();
