#!/usr/bin/env npx tsx
/**
 * ISL Pipeline Demo
 * 
 * Shows the full flow:
 * 1. "Write me a login" (NL)
 * 2. → ISL specification (Translator)
 * 3. → Code generation plan (Generator would go here)
 * 4. → Gate verification (SHIP/NO_SHIP)
 */

import { createTranslator } from './src/index.js';

// ============================================================================
// Demo: NL → ISL Translation
// ============================================================================

console.log('═'.repeat(60));
console.log(' ISL Pipeline Demo: NL → ISL → Code → Gate');
console.log('═'.repeat(60));
console.log();

const translator = createTranslator();

// Example prompts
const prompts = [
  'Write me a login',
  'Create user registration with email verification',
  'Add a password reset flow',
  'Build a payment checkout',
];

for (const prompt of prompts) {
  console.log(`┌${'─'.repeat(58)}┐`);
  console.log(`│ Input: "${prompt}"${' '.repeat(Math.max(0, 56 - prompt.length - 10))}│`);
  console.log(`└${'─'.repeat(58)}┘`);
  console.log();

  const result = translator.translate({ prompt });

  if (result.success) {
    // Show matched pattern
    if (result.matchedPattern) {
      console.log(`✓ Matched pattern: ${result.matchedPattern}`);
    } else {
      console.log(`○ No pattern match (generic translation)`);
    }
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log();

    // Show assumptions
    if (result.assumptions.length > 0) {
      console.log('  Assumptions:');
      for (const assumption of result.assumptions) {
        console.log(`    • [${(assumption.confidence * 100).toFixed(0)}%] ${assumption.description}`);
      }
      console.log();
    }

    // Show open questions
    if (result.openQuestions.length > 0) {
      console.log('  ⚠ Open Questions (need clarification):');
      for (const q of result.openQuestions) {
        console.log(`    • ${q.question}`);
        if (q.options) {
          console.log(`      Options: ${q.options.join(', ')}`);
        }
      }
      console.log();
    }

    // Show ISL output
    console.log('  Generated ISL:');
    console.log('  ┌' + '─'.repeat(54) + '┐');
    const islLines = result.isl!.split('\n').slice(0, 25);
    for (const line of islLines) {
      const trimmed = line.length > 52 ? line.slice(0, 49) + '...' : line;
      console.log(`  │ ${trimmed}${' '.repeat(Math.max(0, 52 - trimmed.length))} │`);
    }
    if (result.isl!.split('\n').length > 25) {
      console.log(`  │ ... (${result.isl!.split('\n').length - 25} more lines)${' '.repeat(30)} │`);
    }
    console.log('  └' + '─'.repeat(54) + '┘');
    console.log();

    // Show what the gate would check
    const behaviors = result.ast!.behaviors;
    if (behaviors.length > 0) {
      console.log('  Gate will enforce:');
      for (const behavior of behaviors) {
        for (const intent of behavior.intents) {
          console.log(`    ✓ @intent ${intent.tag}`);
        }
      }
      console.log();
    }
  } else {
    console.log(`✗ Translation failed: ${result.errors?.join(', ')}`);
  }

  console.log();
}

// ============================================================================
// Show the pipeline
// ============================================================================

console.log('═'.repeat(60));
console.log(' The Pipeline That Works');
console.log('═'.repeat(60));
console.log();
console.log('  ┌─────────────────────────────────────────────────────┐');
console.log('  │                                                     │');
console.log('  │   Human/Agent: "Write me a login"                   │');
console.log('  │                     │                               │');
console.log('  │                     ▼                               │');
console.log('  │   ┌─────────────────────────────────────┐           │');
console.log('  │   │  NL → ISL Translator                │           │');
console.log('  │   │  - Pattern matching                 │           │');
console.log('  │   │  - Assumptions + confidence         │           │');
console.log('  │   │  - Open questions                   │           │');
console.log('  │   │  - JSON AST output                  │           │');
console.log('  │   └─────────────────────────────────────┘           │');
console.log('  │                     │                               │');
console.log('  │                     ▼                               │');
console.log('  │   ┌─────────────────────────────────────┐           │');
console.log('  │   │  ISL → Code Generator               │           │');
console.log('  │   │  - Builds plan (files to touch)     │           │');
console.log('  │   │  - Generates from templates         │           │');
console.log('  │   │  - Produces diffs (never blind)     │           │');
console.log('  │   │  - Refuses to invent APIs           │           │');
console.log('  │   └─────────────────────────────────────┘           │');
console.log('  │                     │                               │');
console.log('  │                     ▼                               │');
console.log('  │   ┌─────────────────────────────────────┐           │');
console.log('  │   │  ShipGate + ISL Gate               │           │');
console.log('  │   │  - Truthpack validation             │           │');
console.log('  │   │  - 25 policy rules                  │           │');
console.log('  │   │  - Intent enforcement               │           │');
console.log('  │   │  - Proof bundle generation          │           │');
console.log('  │   └─────────────────────────────────────┘           │');
console.log('  │                     │                               │');
console.log('  │                     ▼                               │');
console.log('  │            SHIP ✓  or  NO_SHIP ✗                    │');
console.log('  │                                                     │');
console.log('  └─────────────────────────────────────────────────────┘');
console.log();
console.log('  Key insight: ISL is the intermediate representation.');
console.log('  Nothing ships until it becomes valid ISL and passes the gate.');
console.log();
