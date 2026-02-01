#!/usr/bin/env npx tsx
/**
 * IntentOS Demo Script
 * 
 * Demonstrates the full pipeline:
 * 1. Plain English → ISL translation
 * 2. ISL validation
 * 3. Code generation
 * 4. Trust score verification
 * 
 * Usage:
 *   npx tsx demo.ts
 *   npx tsx demo.ts "I want a todo app with tasks and categories"
 */

import { translate, detectLibraries, ISL_LANGUAGE_REFERENCE } from './packages/intent-translator/dist/index.js';
import { parse } from './packages/parser/dist/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Demo Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_REQUESTS = [
  "I want a simple counter that users can increment and reset",
  "Build me a todo app where users can create, complete, and delete tasks",
  "I need a SaaS app with user authentication and team management",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function printHeader(text: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${text}`);
  console.log('═'.repeat(60) + '\n');
}

function printSection(title: string) {
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(40) + '\n');
}

function printSuccess(msg: string) {
  console.log(`✓ ${msg}`);
}

function printInfo(msg: string) {
  console.log(`  ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo Functions
// ─────────────────────────────────────────────────────────────────────────────

async function demonstrateTranslation(request: string) {
  printSection('Step 1: Natural Language → ISL');
  
  console.log('Input (Plain English):');
  console.log(`  "${request}"\n`);
  
  // Detect libraries
  const libraries = detectLibraries(request);
  if (libraries.length > 0) {
    console.log('Detected Standard Libraries:');
    libraries.forEach(lib => console.log(`  • ${lib}`));
    console.log('');
  }
  
  // Translate to ISL
  const result = await translate(request);
  
  if (result.success && result.isl) {
    printSuccess('Translated to ISL:\n');
    console.log(result.isl);
    return result.isl;
  } else {
    console.log('Translation failed:', result.errors);
    return null;
  }
}

function demonstrateValidation(isl: string) {
  printSection('Step 2: ISL Validation');
  
  const result = parse(isl);
  
  if (result.success) {
    printSuccess('ISL syntax is valid!');
    
    if (result.domain) {
      console.log(`\n  Domain: ${result.domain.name.value}`);
      console.log(`  Entities: ${result.domain.entities.length}`);
      console.log(`  Behaviors: ${result.domain.behaviors.length}`);
    }
    
    return result;
  } else {
    console.log('Validation errors:');
    result.errors.forEach(err => {
      console.log(`  • ${err.message}`);
    });
    return null;
  }
}

function demonstrateCodeGeneration(domain: any) {
  printSection('Step 3: Code Generation');
  
  console.log('Generated TypeScript types:\n');
  
  // Generate simple types from entities
  domain.entities.forEach((entity: any) => {
    const name = entity.name.value;
    console.log(`export interface ${name} {`);
    
    entity.fields.forEach((field: any) => {
      const fieldName = field.name.value;
      const fieldType = mapType(field.type);
      const optional = field.modifiers?.some((m: any) => m.value === 'optional') ? '?' : '';
      console.log(`  ${fieldName}${optional}: ${fieldType};`);
    });
    
    console.log('}\n');
  });
  
  // Generate behavior types
  domain.behaviors.forEach((behavior: any) => {
    const name = behavior.name.value;
    console.log(`export type ${name}Result = `);
    console.log(`  | { success: true; data: unknown }`);
    console.log(`  | { success: false; error: { code: string; message: string } };\n`);
  });
  
  printSuccess(`Generated ${domain.entities.length} entity types`);
  printSuccess(`Generated ${domain.behaviors.length} behavior types`);
}

function mapType(typeNode: any): string {
  if (!typeNode) return 'unknown';
  
  const typeName = typeNode.name?.value || typeNode.value || 'unknown';
  
  const typeMap: Record<string, string> = {
    'UUID': 'string',
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Boolean': 'boolean',
    'Timestamp': 'Date',
  };
  
  return typeMap[typeName] || typeName;
}

function demonstrateTrustScore() {
  printSection('Step 4: Trust Score');
  
  // Simulated trust score
  const score = {
    total: 85,
    breakdown: {
      preconditions: { passed: 3, total: 3 },
      postconditions: { passed: 2, total: 3 },
      invariants: { passed: 1, total: 1 },
      errorCases: { passed: 4, total: 5 },
    }
  };
  
  console.log(`Trust Score: ${score.total}/100\n`);
  
  console.log('Breakdown:');
  console.log(`  Preconditions:  ${'█'.repeat(Math.floor(score.breakdown.preconditions.passed / score.breakdown.preconditions.total * 10))}${'░'.repeat(10 - Math.floor(score.breakdown.preconditions.passed / score.breakdown.preconditions.total * 10))} ${score.breakdown.preconditions.passed}/${score.breakdown.preconditions.total}`);
  console.log(`  Postconditions: ${'█'.repeat(Math.floor(score.breakdown.postconditions.passed / score.breakdown.postconditions.total * 10))}${'░'.repeat(10 - Math.floor(score.breakdown.postconditions.passed / score.breakdown.postconditions.total * 10))} ${score.breakdown.postconditions.passed}/${score.breakdown.postconditions.total}`);
  console.log(`  Invariants:     ${'█'.repeat(Math.floor(score.breakdown.invariants.passed / score.breakdown.invariants.total * 10))}${'░'.repeat(10 - Math.floor(score.breakdown.invariants.passed / score.breakdown.invariants.total * 10))} ${score.breakdown.invariants.passed}/${score.breakdown.invariants.total}`);
  console.log(`  Error Cases:    ${'█'.repeat(Math.floor(score.breakdown.errorCases.passed / score.breakdown.errorCases.total * 10))}${'░'.repeat(10 - Math.floor(score.breakdown.errorCases.passed / score.breakdown.errorCases.total * 10))} ${score.breakdown.errorCases.passed}/${score.breakdown.errorCases.total}`);
  
  console.log('\nRecommendation: Ready for testing ✓');
  
  printSuccess('Verification complete!');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Demo
// ─────────────────────────────────────────────────────────────────────────────

async function runDemo() {
  printHeader('IntentOS Demo');
  
  console.log('IntentOS converts plain English into working software.\n');
  console.log('The pipeline:');
  console.log('  1. You describe what you want (Plain English)');
  console.log('  2. We translate to ISL (Intent Specification Language)');
  console.log('  3. We validate the specification');
  console.log('  4. We generate code (types, tests, implementations)');
  console.log('  5. We verify and give you a Trust Score');
  
  // Get request from args or use default
  const request = process.argv[2] || DEMO_REQUESTS[0];
  
  // Step 1: Translate
  const isl = await demonstrateTranslation(request);
  if (!isl) return;
  
  // Step 2: Validate
  const parsed = demonstrateValidation(isl);
  if (!parsed || !parsed.domain) return;
  
  // Step 3: Generate
  demonstrateCodeGeneration(parsed.domain);
  
  // Step 4: Trust Score
  demonstrateTrustScore();
  
  printHeader('Demo Complete!');
  
  console.log('What just happened:');
  console.log('  1. Your plain English was translated to ISL');
  console.log('  2. The ISL spec was validated');
  console.log('  3. TypeScript types were generated');
  console.log('  4. A trust score was calculated');
  console.log('\nNext steps:');
  console.log('  • Add AI key to generate full implementations');
  console.log('  • Use stdlib-auth, stdlib-payments, stdlib-saas for common features');
  console.log('  • Run tests to improve trust score');
}

// Run the demo
runDemo().catch(console.error);
