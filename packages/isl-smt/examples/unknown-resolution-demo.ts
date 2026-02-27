/**
 * SMT Unknown Resolution Demo
 * 
 * This demo shows how SMT solving can resolve "unknown" verification results
 * that runtime verification alone cannot determine.
 * 
 * Scenario:
 * - A banking transfer behavior has preconditions that must be satisfiable
 * - Runtime verification produces "unknown" for complex constraint combinations
 * - SMT solving can prove/disprove these constraints
 * 
 * Run with: npx tsx examples/unknown-resolution-demo.ts
 */

import {
  solve,
  resolveUnknown,
  verifySMT,
  Expr,
  Sort,
  translate,
  getGlobalCache,
} from '../src/index.js';

// ============================================================================
// Demo: Transfer Preconditions
// ============================================================================

async function demoTransferPreconditions() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SMT Unknown Resolution Demo: Banking Transfer Preconditions');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Scenario: Transfer behavior has these preconditions:
  // - amount > 0
  // - amount <= balance
  // - amount <= dailyLimit
  // - balance >= 0
  
  // Runtime verification might see: balance=1000, dailyLimit=500
  // But can't determine if ALL combinations are satisfiable
  
  const amount = Expr.var('amount', Sort.Int());
  const balance = Expr.var('balance', Sort.Int());
  const dailyLimit = Expr.var('dailyLimit', Sort.Int());
  
  console.log('1️⃣  Checking Precondition Satisfiability\n');
  console.log('   Preconditions:');
  console.log('   - amount > 0');
  console.log('   - amount <= balance');
  console.log('   - amount <= dailyLimit');
  console.log('   - balance >= 0\n');
  
  // Combined preconditions
  const preconditions = Expr.and(
    Expr.gt(amount, Expr.int(0)),          // amount > 0
    Expr.le(amount, balance),               // amount <= balance
    Expr.le(amount, dailyLimit),            // amount <= dailyLimit
    Expr.ge(balance, Expr.int(0))           // balance >= 0
  );
  
  console.log('   SMT-LIB Query:');
  console.log('   ─────────────────────────────────────────');
  const smtlib = translate(preconditions, []);
  console.log('   ' + smtlib.split('\n').join('\n   '));
  console.log('   ─────────────────────────────────────────\n');
  
  const result1 = await solve(preconditions, { timeout: 5000 });
  
  console.log(`   Result: ${result1.verdict.toUpperCase()}`);
  if (result1.verdict === 'disproved' && result1.model) {
    console.log('   Model (satisfying assignment):');
    for (const [k, v] of Object.entries(result1.model)) {
      console.log(`     ${k} = ${v}`);
    }
  }
  console.log();
  
  // ========================================================================
  
  console.log('2️⃣  Detecting Contradictory Preconditions\n');
  console.log('   Invalid preconditions (someone made a mistake):');
  console.log('   - minAmount > 100');
  console.log('   - maxAmount < 50');
  console.log('   (impossible to satisfy: min > max)\n');
  
  const minAmount = Expr.var('minAmount', Sort.Int());
  const maxAmount = Expr.var('maxAmount', Sort.Int());
  
  const contradictory = Expr.and(
    Expr.gt(minAmount, Expr.int(100)),
    Expr.lt(maxAmount, Expr.int(50)),
    Expr.le(minAmount, maxAmount)  // implicit: min <= max
  );
  
  const result2 = await solve(contradictory, { timeout: 5000 });
  
  console.log(`   Result: ${result2.verdict.toUpperCase()}`);
  if (result2.verdict === 'proved') {
    console.log('   ✓ SMT proved these constraints are UNSATISFIABLE');
    console.log('   → This means the preconditions have a bug!');
  }
  console.log();
  
  // ========================================================================
  
  console.log('3️⃣  Resolving Unknown from Runtime Verification\n');
  console.log('   Scenario: Runtime verification returned "unknown" for:');
  console.log('   - Expression: x * 2 > 10 AND x < 100');
  console.log('   - Context: Could not evaluate at runtime\n');
  
  // Simulate an ISL expression AST
  const mockSpan = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
  
  const islExpression = {
    kind: 'LogicalExpression' as const,
    operator: 'and' as const,
    left: {
      kind: 'ComparisonExpression' as const,
      operator: '>',
      left: {
        kind: 'BinaryExpression' as const,
        operator: '*',
        left: { kind: 'Identifier' as const, name: 'x', span: mockSpan },
        right: { kind: 'NumberLiteral' as const, value: 2, span: mockSpan },
        span: mockSpan,
      },
      right: { kind: 'NumberLiteral' as const, value: 10, span: mockSpan },
      span: mockSpan,
    },
    right: {
      kind: 'ComparisonExpression' as const,
      operator: '<',
      left: { kind: 'Identifier' as const, name: 'x', span: mockSpan },
      right: { kind: 'NumberLiteral' as const, value: 100, span: mockSpan },
      span: mockSpan,
    },
    span: mockSpan,
  };
  
  console.log('   Attempting SMT resolution...');
  const resolution = await resolveUnknown(islExpression, {}, { timeout: 5000 });
  
  console.log(`   Attempted: ${resolution.attempted}`);
  console.log(`   Duration: ${resolution.durationMs}ms`);
  if (resolution.resolved) {
    console.log(`   Verdict: ${resolution.resolved.verdict.toUpperCase()}`);
    if (resolution.resolved.reason) {
      console.log(`   Reason: ${resolution.resolved.reason}`);
    }
    if (resolution.resolved.model) {
      console.log('   Example satisfying value:');
      for (const [k, v] of Object.entries(resolution.resolved.model)) {
        console.log(`     ${k} = ${v}`);
      }
    }
  }
  console.log();
  
  // ========================================================================
  
  console.log('4️⃣  Cache Statistics\n');
  const stats = getGlobalCache().getStats();
  console.log(`   Cache size: ${stats.size}`);
  console.log(`   Cache hits: ${stats.hits}`);
  console.log(`   Cache misses: ${stats.misses}`);
  console.log(`   Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log();
}

// ============================================================================
// Demo: Implication Checking
// ============================================================================

async function demoImplicationChecking() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SMT Demo: Checking Logical Implications');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const x = Expr.var('x', Sort.Int());
  
  // Check: Does x > 10 imply x > 5?
  // To check validity of (P => Q), we check if (P AND NOT Q) is unsat
  
  console.log('   Checking: Does "x > 10" imply "x > 5"?\n');
  
  const premise = Expr.gt(x, Expr.int(10));
  const conclusion = Expr.gt(x, Expr.int(5));
  
  // P AND NOT Q - if unsat, implication is valid
  const counterexampleFormula = Expr.and(premise, Expr.not(conclusion));
  
  const result = await solve(counterexampleFormula, { timeout: 5000 });
  
  if (result.verdict === 'proved') {
    console.log('   ✓ VALID: x > 10 does imply x > 5');
    console.log('   (No counterexample exists)');
  } else if (result.verdict === 'disproved') {
    console.log('   ✗ INVALID: Found counterexample where x > 10 but NOT x > 5');
    if (result.model) {
      console.log(`   Counterexample: x = ${result.model.x}`);
    }
  } else {
    console.log('   ? UNKNOWN: Could not determine');
  }
  console.log();
  
  // Check: Does x > 5 imply x > 10? (Should be invalid)
  console.log('   Checking: Does "x > 5" imply "x > 10"?\n');
  
  const premise2 = Expr.gt(x, Expr.int(5));
  const conclusion2 = Expr.gt(x, Expr.int(10));
  const counterexampleFormula2 = Expr.and(premise2, Expr.not(conclusion2));
  
  const result2 = await solve(counterexampleFormula2, { timeout: 5000 });
  
  if (result2.verdict === 'proved') {
    console.log('   ✓ VALID: x > 5 does imply x > 10');
  } else if (result2.verdict === 'disproved') {
    console.log('   ✗ INVALID: x > 5 does NOT imply x > 10');
    if (result2.model) {
      console.log(`   Counterexample: x = ${result2.model.x}`);
      console.log(`   (${result2.model.x} > 5 but NOT ${result2.model.x} > 10)`);
    }
  }
  console.log();
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('\n');
  
  await demoTransferPreconditions();
  await demoImplicationChecking();
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Demo Complete');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n  Key takeaways:');
  console.log('  • SMT can prove/disprove bounded logical properties');
  console.log('  • Tri-state output: proved / disproved / unknown');
  console.log('  • Caching ensures deterministic results');
  console.log('  • Timeouts prevent unbounded solver runs');
  console.log('  • Works as fallback when runtime verification is inconclusive\n');
}

main().catch(console.error);
