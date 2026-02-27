// ============================================================================
// ISL Expression Evaluator - Performance Benchmarks
// ============================================================================

import type { Expression } from '@isl-lang/parser';
import { evaluate, createContext } from './index.js';

function loc(): { file: string; line: number; column: number; endLine: number; endColumn: number } {
  return { file: 'bench.isl', line: 1, column: 1, endLine: 1, endColumn: 10 };
}

function bool(value: boolean): Expression {
  return { kind: 'BooleanLiteral', value, location: loc() };
}

function num(value: number): Expression {
  return { kind: 'NumberLiteral', value, isFloat: false, location: loc() };
}

function id(name: string): Expression {
  return { kind: 'Identifier', name, location: loc() };
}

function bin(op: string, left: Expression, right: Expression): Expression {
  return {
    kind: 'BinaryExpr',
    operator: op as any,
    left,
    right,
    location: loc(),
  };
}

function quantifier(quant: 'all' | 'any', variable: string, collection: Expression, predicate: Expression): Expression {
  return {
    kind: 'QuantifierExpr',
    quantifier: quant,
    variable: id(variable) as any,
    collection,
    predicate,
    location: loc(),
  };
}

console.log('Running performance benchmarks...\n');

// Benchmark 1: Simple comparisons
console.log('Benchmark 1: Simple comparisons (1000 expressions)');
const comparisons: Expression[] = [];
for (let i = 0; i < 1000; i++) {
  comparisons.push(bin('==', num(i), num(i)));
}

const start1 = performance.now();
const context = createContext();
for (const expr of comparisons) {
  evaluate(expr, context);
}
const duration1 = performance.now() - start1;
console.log(`  Duration: ${duration1.toFixed(2)}ms`);
console.log(`  Per expression: ${(duration1 / 1000).toFixed(4)}ms`);
console.log(`  Status: ${duration1 < 100 ? '✓ PASS' : '✗ FAIL'} (< 100ms target)\n`);

// Benchmark 2: Complex logical expressions
console.log('Benchmark 2: Complex logical expressions (1000 expressions)');
const logical: Expression[] = [];
for (let i = 0; i < 1000; i++) {
  logical.push(
    bin('and',
      bin('or', bool(i % 2 === 0), bool(i % 3 === 0)),
      bin('==', num(i), num(i))
    )
  );
}

const start2 = performance.now();
for (const expr of logical) {
  evaluate(expr, context);
}
const duration2 = performance.now() - start2;
console.log(`  Duration: ${duration2.toFixed(2)}ms`);
console.log(`  Per expression: ${(duration2 / 1000).toFixed(4)}ms`);
console.log(`  Status: ${duration2 < 100 ? '✓ PASS' : '✗ FAIL'} (< 100ms target)\n`);

// Benchmark 3: Quantifiers
console.log('Benchmark 3: Quantifiers (100 expressions with arrays of 100 items)');
const quantifiers: Expression[] = [];
for (let i = 0; i < 100; i++) {
  const items = Array.from({ length: 100 }, (_, j) => j);
  context.variables.set(`items${i}`, items);
  quantifiers.push(
    quantifier('all', 'item', id(`items${i}`), bin('>=', id('item'), num(0)))
  );
}

const start3 = performance.now();
for (const expr of quantifiers) {
  evaluate(expr, context);
}
const duration3 = performance.now() - start3;
console.log(`  Duration: ${duration3.toFixed(2)}ms`);
console.log(`  Per expression: ${(duration3 / 100).toFixed(4)}ms`);
console.log(`  Status: ${duration3 < 100 ? '✓ PASS' : '✗ FAIL'} (< 100ms target)\n`);

// Summary
const total = duration1 + duration2 + duration3;
console.log('Summary:');
console.log(`  Total: ${total.toFixed(2)}ms`);
console.log(`  Average per expression: ${(total / 2100).toFixed(4)}ms`);
console.log(`  Overall status: ${total < 300 ? '✓ PASS' : '✗ FAIL'} (all benchmarks < 100ms each)`);
