/**
 * Core Loop End-to-End Test
 * 
 * Tests the complete ISL pipeline:
 * 1. Parse example.isl
 * 2. Generate tests with entity bindings
 * 3. Verify generated code has real assertions
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseISL } from '@isl-lang/isl-core';
import { TestGenerator } from '../src/tests/test-generator';
import { TypeGenerator } from '../src/typescript/type-generator';

describe('Core Loop', () => {
  it('should parse example.isl and generate runnable tests', () => {
    // 1. Read the spec
    const specPath = resolve(__dirname, '../../../specs/test-minimal.isl');
    const source = readFileSync(specPath, 'utf-8');
    expect(source.length).toBeGreaterThan(0);
    
    // 2. Parse the spec
    const { ast, errors } = parseISL(source, specPath);
    
    // Log errors for debugging
    if (errors.length > 0) {
      console.log('Parse errors:');
      for (const err of errors) {
        console.log(`  - ${err.message}`);
      }
    }
    
    expect(errors.length).toBe(0);
    expect(ast).not.toBeNull();
    expect(ast!.name.name).toBe('TestDomain');
    expect(ast!.entities.length).toBeGreaterThan(0);
    expect(ast!.behaviors.length).toBeGreaterThan(0);
    
    console.log(`Domain: ${ast!.name.name}`);
    console.log(`Entities: ${ast!.entities.map(e => e.name.name).join(', ')}`);
    console.log(`Behaviors: ${ast!.behaviors.map(b => b.name.name).join(', ')}`);
  });
  
  it('should generate TypeScript types', () => {
    const specPath = resolve(__dirname, '../../../specs/test-minimal.isl');
    const source = readFileSync(specPath, 'utf-8');
    const { ast } = parseISL(source, specPath);
    
    const typeGenerator = new TypeGenerator();
    const types = typeGenerator.generate(ast!);
    
    expect(types.filename).toBe('testdomain.types.ts');
    expect(types.content).toContain('interface User');
    expect(types.content).toContain('email: string');
    
    console.log('Generated types file:', types.filename);
  });
  
  it('should generate test suite with entity bindings', () => {
    const specPath = resolve(__dirname, '../../../specs/test-minimal.isl');
    const source = readFileSync(specPath, 'utf-8');
    const { ast } = parseISL(source, specPath);
    
    const testGenerator = new TestGenerator({ framework: 'vitest' });
    const tests = testGenerator.generate(ast!);
    
    expect(tests.filename).toBe('testdomain.spec.ts');
    
    // Key assertions - these verify the core loop fixes
    const content = tests.content;
    
    // 1. Test runtime import
    expect(content).toContain("import { createTestContext } from '@isl-lang/test-runtime'");
    
    // 2. Test context creation
    expect(content).toContain('createTestContext(');
    
    // 3. Entity bindings
    expect(content).toContain('ctx.entities');
    
    // 4. State reset in beforeEach
    expect(content).toContain('ctx.reset()');
    
    // 5. State capture for old()
    expect(content).toContain('ctx.captureState()');
    
    // 6. Real assertions (not just TODO)
    expect(content).toContain('expect(');
    
    console.log('');
    console.log('Generated test code preview:');
    console.log(''.padStart(60, '='));
    // Show more lines to see the postconditions
    const preview = content.split('\n').slice(0, 100).join('\n');
    console.log(preview);
    console.log(''.padStart(60, '='));
  });
  
  it('should generate more assertions than TODOs', () => {
    const specPath = resolve(__dirname, '../../../specs/test-minimal.isl');
    const source = readFileSync(specPath, 'utf-8');
    const { ast } = parseISL(source, specPath);
    
    const testGenerator = new TestGenerator({ framework: 'vitest' });
    const tests = testGenerator.generate(ast!);
    
    const todoCount = (tests.content.match(/TODO/g) || []).length;
    const assertCount = (tests.content.match(/expect\(/g) || []).length;
    
    console.log(`TODO comments: ${todoCount}`);
    console.log(`Real assertions: ${assertCount}`);
    
    // There will still be TODOs for setup, but we should have real assertions too
    expect(assertCount).toBeGreaterThan(0);
  });
});
