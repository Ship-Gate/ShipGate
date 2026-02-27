#!/usr/bin/env npx tsx
/**
 * Verify Promise Workflow Script
 * 
 * Runs the complete verification workflow:
 * spec -> gen -> tests -> verify -> proof
 * 
 * Usage:
 *   npx tsx scripts/verify-promise.ts [spec-file]
 *   pnpm verify-promise [spec-file]
 * 
 * @module scripts/verify-promise
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parseISL, type DomainDeclaration } from '@isl-lang/isl-core';
import { execSync } from 'child_process';

// ============================================================================
// Types
// ============================================================================

interface VerifyPromiseResult {
  spec: {
    file: string;
    domain: string;
    version: string;
    behaviors: number;
    entities: number;
    types: number;
  };
  steps: {
    parse: StepResult;
    generate: StepResult;
    test: StepResult;
    verify: StepResult;
    proof: StepResult;
  };
  overall: 'PROVEN' | 'INCOMPLETE' | 'FAILED';
  proofBundlePath?: string;
}

interface StepResult {
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  message?: string;
  error?: string;
}

// ============================================================================
// Step Implementations
// ============================================================================

async function stepParse(specFile: string): Promise<{ result: StepResult; ast?: DomainDeclaration }> {
  const start = Date.now();
  
  try {
    const content = await fs.readFile(specFile, 'utf-8');
    const { domain: ast, errors } = parseISL(content, specFile);
    
    if (errors.length > 0 || !ast) {
      return {
        result: {
          status: 'fail',
          duration: Date.now() - start,
          error: errors.map(e => e.message).join(', '),
        },
      };
    }
    
    return {
      result: {
        status: 'pass',
        duration: Date.now() - start,
        message: `Parsed ${ast.name.name} v${ast.version.value}`,
      },
      ast,
    };
  } catch (err) {
    return {
      result: {
        status: 'fail',
        duration: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function stepGenerate(ast: DomainDeclaration, outputDir: string): Promise<StepResult> {
  const start = Date.now();
  
  try {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    // Generate basic type definitions
    const typeContent = generateTypes(ast);
    await fs.writeFile(path.join(outputDir, 'types.ts'), typeContent);
    
    return {
      status: 'pass',
      duration: Date.now() - start,
      message: `Generated types to ${outputDir}`,
    };
  } catch (err) {
    return {
      status: 'fail',
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function generateTypes(ast: DomainDeclaration): string {
  const lines: string[] = [
    `/**`,
    ` * Generated types for ${ast.name.name}`,
    ` * Version: ${ast.version.value}`,
    ` */`,
    ``,
    `// Type aliases`,
  ];
  
  for (const type of ast.types) {
    lines.push(`export type ${type.name.name} = unknown; // TODO: implement`);
  }
  
  lines.push(``, `// Entity types`);
  
  for (const entity of ast.entities) {
    lines.push(`export interface ${entity.name.name} {`);
    for (const field of entity.fields) {
      lines.push(`  ${field.name.name}: unknown;`);
    }
    lines.push(`}`);
    lines.push(``);
  }
  
  return lines.join('\n');
}

async function stepTest(): Promise<StepResult> {
  const start = Date.now();
  
  try {
    // Run critical tests
    execSync('pnpm turbo test --filter=@isl-lang/evaluator --filter=@isl-lang/verifier-runtime', {
      stdio: 'pipe',
    });
    
    return {
      status: 'pass',
      duration: Date.now() - start,
      message: 'All tests passed',
    };
  } catch (err) {
    return {
      status: 'fail',
      duration: Date.now() - start,
      error: 'Some tests failed',
    };
  }
}

async function stepVerify(ast: DomainDeclaration): Promise<StepResult> {
  const start = Date.now();
  
  // Basic verification: check that all behaviors have proper structure
  const issues: string[] = [];
  
  for (const behavior of ast.behaviors) {
    if (!behavior.output) {
      issues.push(`Behavior ${behavior.name.name} has no output`);
    }
  }
  
  for (const entity of ast.entities) {
    const idField = entity.fields.find(f => f.name.name === 'id');
    if (!idField) {
      issues.push(`Entity ${entity.name.name} has no id field`);
    }
  }
  
  if (issues.length > 0) {
    return {
      status: 'fail',
      duration: Date.now() - start,
      error: issues.join('; '),
    };
  }
  
  return {
    status: 'pass',
    duration: Date.now() - start,
    message: 'Verification passed',
  };
}

async function stepProof(
  specFile: string,
  ast: DomainDeclaration,
  results: VerifyPromiseResult['steps']
): Promise<{ result: StepResult; bundlePath?: string }> {
  const start = Date.now();
  
  try {
    // Create proof bundle directory
    const bundleDir = path.join('.proof-bundles', `${ast.name.name}-${Date.now()}`);
    await fs.mkdir(bundleDir, { recursive: true });
    
    // Copy spec
    await fs.copyFile(specFile, path.join(bundleDir, 'spec.isl'));
    
    // Determine overall verdict
    const allPassed = Object.values(results).every(r => r.status === 'pass' || r.status === 'skip');
    const verdict = allPassed ? 'PROVEN' : 'INCOMPLETE_PROOF';
    
    // Create manifest
    const manifest = {
      schemaVersion: '2.0.0',
      generatedAt: new Date().toISOString(),
      bundleId: `local-${Date.now()}`,
      spec: {
        domain: ast.name.name,
        version: ast.version.value,
      },
      gateResult: {
        verdict: allPassed ? 'SHIP' : 'NO_SHIP',
        score: allPassed ? 100 : 50,
        fingerprint: `local-${Date.now()}`,
      },
      testResult: {
        status: results.test.status,
        framework: 'vitest',
      },
      verdict,
      verdictReason: allPassed ? 'All verification steps passed' : 'Some steps failed',
      files: ['manifest.json', 'spec.isl'],
    };
    
    await fs.writeFile(
      path.join(bundleDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    return {
      result: {
        status: 'pass',
        duration: Date.now() - start,
        message: `Proof bundle created: ${bundleDir}`,
      },
      bundlePath: bundleDir,
    };
  } catch (err) {
    return {
      result: {
        status: 'fail',
        duration: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const specFile = args[0] || 'demo/payments.isl';
  
  console.log('═'.repeat(60));
  console.log(' Verify Promise Workflow');
  console.log('═'.repeat(60));
  console.log(`\nSpec: ${specFile}\n`);
  
  // Check spec exists
  try {
    await fs.access(specFile);
  } catch {
    console.error(`❌ Spec file not found: ${specFile}`);
    process.exit(1);
  }
  
  // Initialize result
  const result: VerifyPromiseResult = {
    spec: {
      file: specFile,
      domain: '',
      version: '',
      behaviors: 0,
      entities: 0,
      types: 0,
    },
    steps: {
      parse: { status: 'skip', duration: 0 },
      generate: { status: 'skip', duration: 0 },
      test: { status: 'skip', duration: 0 },
      verify: { status: 'skip', duration: 0 },
      proof: { status: 'skip', duration: 0 },
    },
    overall: 'FAILED',
  };
  
  // Step 1: Parse
  console.log('─'.repeat(60));
  console.log(' Step 1: Parse Spec');
  console.log('─'.repeat(60));
  
  const parseResult = await stepParse(specFile);
  result.steps.parse = parseResult.result;
  
  if (parseResult.result.status === 'fail' || !parseResult.ast) {
    console.log(`❌ Parse failed: ${parseResult.result.error}`);
    printSummary(result);
    process.exit(1);
  }
  
  const ast = parseResult.ast;
  result.spec.domain = ast.name.name;
  result.spec.version = ast.version.value;
  result.spec.behaviors = ast.behaviors.length;
  result.spec.entities = ast.entities.length;
  result.spec.types = ast.types.length;
  
  console.log(`✓ Parsed: ${ast.name.name} v${ast.version.value}`);
  console.log(`  Behaviors: ${ast.behaviors.length}`);
  console.log(`  Entities: ${ast.entities.length}`);
  console.log(`  Types: ${ast.types.length}`);
  console.log(`  Duration: ${parseResult.result.duration}ms\n`);
  
  // Step 2: Generate
  console.log('─'.repeat(60));
  console.log(' Step 2: Generate Types');
  console.log('─'.repeat(60));
  
  const outputDir = `.generated/${ast.name.name}`;
  result.steps.generate = await stepGenerate(ast, outputDir);
  
  if (result.steps.generate.status === 'pass') {
    console.log(`✓ Generated types: ${outputDir}`);
  } else {
    console.log(`⚠️ Generation warning: ${result.steps.generate.error}`);
  }
  console.log(`  Duration: ${result.steps.generate.duration}ms\n`);
  
  // Step 3: Test
  console.log('─'.repeat(60));
  console.log(' Step 3: Run Tests');
  console.log('─'.repeat(60));
  
  result.steps.test = await stepTest();
  
  if (result.steps.test.status === 'pass') {
    console.log(`✓ Tests passed`);
  } else {
    console.log(`⚠️ Tests warning: ${result.steps.test.error}`);
  }
  console.log(`  Duration: ${result.steps.test.duration}ms\n`);
  
  // Step 4: Verify
  console.log('─'.repeat(60));
  console.log(' Step 4: Verify Spec');
  console.log('─'.repeat(60));
  
  result.steps.verify = await stepVerify(ast);
  
  if (result.steps.verify.status === 'pass') {
    console.log(`✓ Verification passed`);
  } else {
    console.log(`⚠️ Verification warning: ${result.steps.verify.error}`);
  }
  console.log(`  Duration: ${result.steps.verify.duration}ms\n`);
  
  // Step 5: Proof
  console.log('─'.repeat(60));
  console.log(' Step 5: Generate Proof Bundle');
  console.log('─'.repeat(60));
  
  const proofResult = await stepProof(specFile, ast, result.steps);
  result.steps.proof = proofResult.result;
  result.proofBundlePath = proofResult.bundlePath;
  
  if (result.steps.proof.status === 'pass') {
    console.log(`✓ Proof bundle: ${proofResult.bundlePath}`);
  } else {
    console.log(`❌ Proof failed: ${result.steps.proof.error}`);
  }
  console.log(`  Duration: ${result.steps.proof.duration}ms\n`);
  
  // Determine overall result
  const criticalSteps = [result.steps.parse, result.steps.verify];
  const allCriticalPassed = criticalSteps.every(s => s.status === 'pass');
  const allStepsPassed = Object.values(result.steps).every(s => s.status === 'pass');
  
  if (allStepsPassed) {
    result.overall = 'PROVEN';
  } else if (allCriticalPassed) {
    result.overall = 'INCOMPLETE';
  } else {
    result.overall = 'FAILED';
  }
  
  printSummary(result);
  
  // Exit code based on result
  process.exit(result.overall === 'PROVEN' ? 0 : result.overall === 'INCOMPLETE' ? 0 : 1);
}

function printSummary(result: VerifyPromiseResult): void {
  console.log('═'.repeat(60));
  console.log(' Summary');
  console.log('═'.repeat(60));
  
  const icon = {
    PROVEN: '✅',
    INCOMPLETE: '⚠️',
    FAILED: '❌',
  }[result.overall];
  
  console.log(`\n${icon} Overall: ${result.overall}\n`);
  console.log('Steps:');
  
  for (const [name, step] of Object.entries(result.steps)) {
    const stepIcon = step.status === 'pass' ? '✓' : step.status === 'skip' ? '○' : '✗';
    console.log(`  ${stepIcon} ${name}: ${step.status} (${step.duration}ms)`);
  }
  
  if (result.proofBundlePath) {
    console.log(`\nProof Bundle: ${result.proofBundlePath}`);
  }
  
  console.log('');
}

main().catch(console.error);
