// ============================================================================
// ISL Expression Evaluator v1 - Micro-Benchmark
// ============================================================================
// Run with: pnpm bench
// ============================================================================

import type { Expression } from '@isl-lang/parser';
import { evaluate, createEvalContext, createEvalAdapter } from './evaluator.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loc() {
  return { file: 'bench.isl', line: 1, column: 1, endLine: 1, endColumn: 10 };
}

function bool(value: boolean): Expression {
  return { kind: 'BooleanLiteral', value, location: loc() } as Expression;
}

function str(value: string): Expression {
  return { kind: 'StringLiteral', value, location: loc() } as Expression;
}

function num(value: number): Expression {
  return { kind: 'NumberLiteral', value, isFloat: false, location: loc() } as Expression;
}

function id(name: string): Expression {
  return { kind: 'Identifier', name, location: loc() } as Expression;
}

function bin(op: string, left: Expression, right: Expression): Expression {
  return { kind: 'BinaryExpr', operator: op, left, right, location: loc() } as Expression;
}

function unary(op: string, operand: Expression): Expression {
  return { kind: 'UnaryExpr', operator: op, operand, location: loc() } as Expression;
}

function member(object: Expression, property: string): Expression {
  return { kind: 'MemberExpr', object, property: id(property), location: loc() } as Expression;
}

function call(callee: Expression, args: Expression[] = []): Expression {
  return { kind: 'CallExpr', callee, arguments: args, location: loc() } as Expression;
}

// ============================================================================
// BENCHMARK CONFIGURATION
// ============================================================================

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgUs: number;
  opsPerSec: number;
}

const ITERATIONS = 1000;
const WARMUP_ITERATIONS = 100;

// ============================================================================
// BENCHMARK RUNNER
// ============================================================================

function runBenchmark(
  name: string,
  setup: () => { ctx: ReturnType<typeof createEvalContext>; expr: Expression },
  iterations: number = ITERATIONS
): BenchmarkResult {
  const { ctx, expr } = setup();
  
  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    evaluate(expr, ctx);
  }
  
  // Benchmark
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    evaluate(expr, ctx);
  }
  const totalMs = performance.now() - start;
  
  const avgUs = (totalMs / iterations) * 1000;
  const opsPerSec = Math.round((iterations / totalMs) * 1000);
  
  return {
    name,
    iterations,
    totalMs: Math.round(totalMs * 100) / 100,
    avgUs: Math.round(avgUs * 100) / 100,
    opsPerSec,
  };
}

// ============================================================================
// BENCHMARK SUITES
// ============================================================================

const benchmarks = [
  // Simple literals
  {
    name: 'Boolean literal',
    setup: () => ({
      ctx: createEvalContext(),
      expr: bool(true),
    }),
  },
  
  // Simple comparison
  {
    name: 'Number equality (5 == 5)',
    setup: () => ({
      ctx: createEvalContext(),
      expr: bin('==', num(5), num(5)),
    }),
  },
  
  // Variable lookup
  {
    name: 'Variable lookup',
    setup: () => ({
      ctx: createEvalContext({ variables: new Map([['x', 42]]) }),
      expr: id('x'),
    }),
  },
  
  // Property access
  {
    name: 'Single property access (obj.prop)',
    setup: () => ({
      ctx: createEvalContext({ variables: new Map([['obj', { prop: 'value' }]]) }),
      expr: member(id('obj'), 'prop'),
    }),
  },
  
  // Nested property access
  {
    name: 'Nested property access (a.b.c.d)',
    setup: () => ({
      ctx: createEvalContext({ 
        variables: new Map([['a', { b: { c: { d: 'deep' } } }]]) 
      }),
      expr: member(member(member(id('a'), 'b'), 'c'), 'd'),
    }),
  },
  
  // Logical AND
  {
    name: 'Logical AND (true && true)',
    setup: () => ({
      ctx: createEvalContext(),
      expr: bin('&&', bool(true), bool(true)),
    }),
  },
  
  // Logical OR with short-circuit
  {
    name: 'Logical OR short-circuit (true || ...)',
    setup: () => ({
      ctx: createEvalContext(),
      expr: bin('||', bool(true), bin('==', num(1), num(2))),
    }),
  },
  
  // Implies
  {
    name: 'Implies (false implies anything)',
    setup: () => ({
      ctx: createEvalContext(),
      expr: bin('implies', bool(false), id('unknown')),
    }),
  },
  
  // NOT
  {
    name: 'Logical NOT',
    setup: () => ({
      ctx: createEvalContext(),
      expr: unary('!', bool(true)),
    }),
  },
  
  // Complex expression
  {
    name: 'Complex: (x > 0) && (y < 100) implies z == true',
    setup: () => ({
      ctx: createEvalContext({ 
        variables: new Map<string, unknown>([['x', 5], ['y', 50], ['z', true]]) 
      }),
      expr: bin('implies',
        bin('&&', 
          bin('>', id('x'), num(0)),
          bin('<', id('y'), num(100))
        ),
        bin('==', id('z'), bool(true))
      ),
    }),
  },
  
  // Function call: is_valid
  {
    name: 'Function: is_valid(email)',
    setup: () => ({
      ctx: createEvalContext({ 
        variables: new Map([['email', 'test@example.com']]) 
      }),
      expr: call(id('is_valid'), [id('email')]),
    }),
  },
  
  // Function call: length
  {
    name: 'Function: length(str)',
    setup: () => ({
      ctx: createEvalContext({ 
        variables: new Map([['str', 'hello world']]) 
      }),
      expr: call(id('length'), [id('str')]),
    }),
  },
  
  // Function call: is_valid_format
  {
    name: 'Function: is_valid_format(email, "email")',
    setup: () => ({
      ctx: createEvalContext({ 
        variables: new Map([['email', 'user@example.com']]) 
      }),
      expr: call(id('is_valid_format'), [id('email'), str('email')]),
    }),
  },
  
  // Function call: now()
  {
    name: 'Function: now()',
    setup: () => ({
      ctx: createEvalContext(),
      expr: call(id('now'), []),
    }),
  },
  
  // Input access
  {
    name: 'Input access (input.email)',
    setup: () => ({
      ctx: createEvalContext({ 
        input: { email: 'test@example.com', password: 'secret' } 
      }),
      expr: member(id('input'), 'email'),
    }),
  },
  
  // Result access
  {
    name: 'Result access (result.session.status)',
    setup: () => ({
      ctx: createEvalContext({ 
        result: { session: { status: 'ACTIVE', id: '123' } } 
      }),
      expr: member(member(id('result'), 'session'), 'status'),
    }),
  },
  
  // Unknown propagation
  {
    name: 'Unknown propagation (unknown && true)',
    setup: () => ({
      ctx: createEvalContext(),
      expr: bin('&&', id('unknownVar'), bool(true)),
    }),
  },
  
  // Login postcondition simulation
  {
    name: 'Login postcondition: success implies session.status == ACTIVE',
    setup: () => ({
      ctx: createEvalContext({ 
        variables: new Map([['success', true]]),
        result: { session: { status: 'ACTIVE', id: 'sess-123' } }
      }),
      expr: bin('implies',
        id('success'),
        bin('==', 
          member(member(id('result'), 'session'), 'status'),
          str('ACTIVE')
        )
      ),
    }),
  },
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('================================================================================');
  console.log('ISL Expression Evaluator v1 - Micro-Benchmark');
  console.log('================================================================================');
  console.log(`Iterations per benchmark: ${ITERATIONS}`);
  console.log(`Warmup iterations: ${WARMUP_ITERATIONS}`);
  console.log('--------------------------------------------------------------------------------\n');
  
  const results: BenchmarkResult[] = [];
  
  for (const bench of benchmarks) {
    const result = runBenchmark(bench.name, bench.setup);
    results.push(result);
    console.log(`${result.name}`);
    console.log(`  Total: ${result.totalMs}ms | Avg: ${result.avgUs}µs | Ops/sec: ${result.opsPerSec.toLocaleString()}`);
    console.log();
  }
  
  console.log('--------------------------------------------------------------------------------');
  console.log('SUMMARY');
  console.log('--------------------------------------------------------------------------------');
  
  const totalTime = results.reduce((sum, r) => sum + r.totalMs, 0);
  const totalOps = results.length * ITERATIONS;
  const avgOpsPerSec = Math.round((totalOps / totalTime) * 1000);
  
  console.log(`Total benchmarks: ${results.length}`);
  console.log(`Total evaluations: ${totalOps.toLocaleString()}`);
  console.log(`Total time: ${Math.round(totalTime)}ms`);
  console.log(`Average ops/sec across all benchmarks: ${avgOpsPerSec.toLocaleString()}`);
  
  // Find slowest and fastest
  const sorted = [...results].sort((a, b) => a.avgUs - b.avgUs);
  console.log(`\nFastest: ${sorted[0].name} (${sorted[0].avgUs}µs)`);
  console.log(`Slowest: ${sorted[sorted.length - 1].name} (${sorted[sorted.length - 1].avgUs}µs)`);
  
  // Regression threshold check
  const regressionThreshold = 100; // 100µs max per evaluation
  const failures = results.filter(r => r.avgUs > regressionThreshold);
  
  if (failures.length > 0) {
    console.log('\n⚠️  REGRESSION WARNING: Some benchmarks exceeded threshold');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.avgUs}µs (threshold: ${regressionThreshold}µs)`);
    }
    process.exit(1);
  } else {
    console.log('\n✅ All benchmarks within acceptable thresholds');
  }
}

main().catch(console.error);
