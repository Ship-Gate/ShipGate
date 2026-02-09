/**
 * ISL Expression Evaluator Demo
 * 
 * This demo shows the expression evaluator resolving complex postconditions
 * that previously returned "unknown" but now evaluate deterministically.
 */

import {
  evaluateV1 as evaluate,
  createEvalContext,
  getCoverageReport,
  foldConstants,
  isConstant,
  type EvalResult,
  type BlameSpan,
} from '@isl-lang/static-analyzer';
import type { Expression } from '@isl-lang/parser';

// ============================================================================
// EXPRESSION CONSTRUCTORS
// ============================================================================

function loc() {
  return { file: 'demo.isl', line: 1, column: 1, endLine: 1, endColumn: 10 };
}

const bool = (value: boolean): Expression =>
  ({ kind: 'BooleanLiteral', value, location: loc() });

const str = (value: string): Expression =>
  ({ kind: 'StringLiteral', value, location: loc() });

const num = (value: number): Expression =>
  ({ kind: 'NumberLiteral', value, isFloat: !Number.isInteger(value), location: loc() });

const id = (name: string): Expression =>
  ({ kind: 'Identifier', name, location: loc() });

const bin = (op: string, left: Expression, right: Expression): Expression =>
  ({ kind: 'BinaryExpr', operator: op as any, left, right, location: loc() });

const unary = (op: string, operand: Expression): Expression =>
  ({ kind: 'UnaryExpr', operator: op as any, operand, location: loc() });

const member = (object: Expression, property: string): Expression =>
  ({ kind: 'MemberExpr', object, property: id(property) as any, location: loc() });

const call = (callee: Expression, args: Expression[] = []): Expression =>
  ({ kind: 'CallExpr', callee, arguments: args, location: loc() });

const list = (elements: Expression[]): Expression =>
  ({ kind: 'ListExpr', elements, location: loc() });

const quantifier = (
  quant: 'all' | 'any' | 'none' | 'count' | 'sum' | 'filter',
  variable: string,
  collection: Expression,
  predicate: Expression
): Expression =>
  ({ kind: 'QuantifierExpr', quantifier: quant, variable: id(variable) as any, collection, predicate, location: loc() });

const oldExpr = (expression: Expression): Expression =>
  ({ kind: 'OldExpr', expression, location: loc() });

// ============================================================================
// DEMO CASES
// ============================================================================

interface DemoCase {
  name: string;
  description: string;
  expression: Expression;
  context: Parameters<typeof createEvalContext>[0];
  previousResult?: string; // What this would have returned before improvements
}

const demoCases: DemoCase[] = [
  // ============================================================================
  // Case 1: Complex postcondition with old() and arithmetic
  // ============================================================================
  {
    name: 'Balance Update Postcondition',
    description: 'Verify that result.balance equals old(balance) + input.amount',
    expression: bin('==',
      member(id('result'), 'balance'),
      bin('+', oldExpr(id('balance')), member(id('input'), 'amount'))
    ),
    context: {
      result: { balance: 150, currency: 'USD' },
      input: { amount: 50, currency: 'USD' },
      oldState: new Map([['balance', 100]]),
    },
    previousResult: 'PREVIOUSLY: Would return unknown if old() was not properly implemented',
  },

  // ============================================================================
  // Case 2: Quantifier with nested property access
  // ============================================================================
  {
    name: 'All Items Have Valid Price',
    description: 'Verify all items in order have price > 0',
    expression: quantifier('all', 'item', member(id('order'), 'items'),
      bin('>', member(id('item'), 'price'), num(0))
    ),
    context: {
      variables: new Map([
        ['order', {
          id: 'order-123',
          items: [
            { name: 'Widget', price: 29.99 },
            { name: 'Gadget', price: 49.99 },
            { name: 'Gizmo', price: 19.99 },
          ],
        }],
      ]),
    },
    previousResult: 'PREVIOUSLY: Would return unknown if nested property access in quantifiers failed',
  },

  // ============================================================================
  // Case 3: Count quantifier with filter predicate
  // ============================================================================
  {
    name: 'Count Active Sessions',
    description: 'Count sessions where status == "ACTIVE"',
    expression: quantifier('count', 'session', id('sessions'),
      bin('==', member(id('session'), 'status'), str('ACTIVE'))
    ),
    context: {
      variables: new Map([
        ['sessions', [
          { id: 'sess-1', status: 'ACTIVE' },
          { id: 'sess-2', status: 'EXPIRED' },
          { id: 'sess-3', status: 'ACTIVE' },
          { id: 'sess-4', status: 'ACTIVE' },
        ]],
      ]),
    },
    previousResult: 'PREVIOUSLY: Count quantifier was not implemented',
  },

  // ============================================================================
  // Case 4: Implies with nested conditions
  // ============================================================================
  {
    name: 'Success Implies Valid Session',
    description: 'success implies result.session.status == "ACTIVE" and result.session.expires_at > now()',
    expression: bin('implies',
      id('success'),
      bin('and',
        bin('==', member(member(id('result'), 'session'), 'status'), str('ACTIVE')),
        bin('>', member(member(id('result'), 'session'), 'expires_at'), call(id('now')))
      )
    ),
    context: {
      variables: new Map([['success', true]]),
      result: {
        session: {
          id: 'sess-123',
          status: 'ACTIVE',
          expires_at: Date.now() + 3600000, // 1 hour from now
        },
      },
    },
    previousResult: 'PREVIOUSLY: Would return unknown if now() was not implemented',
  },

  // ============================================================================
  // Case 5: Filter quantifier with multiple conditions
  // ============================================================================
  {
    name: 'Filter High-Value Transactions',
    description: 'Filter transactions where amount > 100 and status == "COMPLETED"',
    expression: quantifier('filter', 'tx', id('transactions'),
      bin('and',
        bin('>', member(id('tx'), 'amount'), num(100)),
        bin('==', member(id('tx'), 'status'), str('COMPLETED'))
      )
    ),
    context: {
      variables: new Map([
        ['transactions', [
          { id: 'tx-1', amount: 50, status: 'COMPLETED' },
          { id: 'tx-2', amount: 150, status: 'COMPLETED' },
          { id: 'tx-3', amount: 200, status: 'PENDING' },
          { id: 'tx-4', amount: 300, status: 'COMPLETED' },
        ]],
      ]),
    },
    previousResult: 'PREVIOUSLY: Filter quantifier was not implemented',
  },

  // ============================================================================
  // Case 6: Complex validation with format checking
  // ============================================================================
  {
    name: 'Email and Password Validation',
    description: 'Validate email format and password length',
    expression: bin('and',
      call(id('is_valid_format'), [member(id('input'), 'email'), str('email')]),
      bin('>=', call(id('length'), [member(id('input'), 'password')]), num(8))
    ),
    context: {
      input: {
        email: 'user@example.com',
        password: 'securepassword123',
      },
    },
    previousResult: 'PREVIOUSLY: is_valid_format was not fully implemented',
  },

  // ============================================================================
  // Case 7: None quantifier (negative existential)
  // ============================================================================
  {
    name: 'No Negative Balances',
    description: 'Verify none of the accounts have negative balance',
    expression: quantifier('none', 'account', id('accounts'),
      bin('<', member(id('account'), 'balance'), num(0))
    ),
    context: {
      variables: new Map([
        ['accounts', [
          { id: 'acc-1', balance: 100 },
          { id: 'acc-2', balance: 50 },
          { id: 'acc-3', balance: 0 },
        ]],
      ]),
    },
    previousResult: 'PREVIOUSLY: None quantifier was not implemented',
  },

  // ============================================================================
  // Case 8: Membership check with enum values
  // ============================================================================
  {
    name: 'Status in Allowed Values',
    description: 'Verify status is one of the allowed enum values',
    expression: bin('in',
      member(id('result'), 'status'),
      list([str('ACTIVE'), str('PENDING'), str('COMPLETED')])
    ),
    context: {
      result: { status: 'ACTIVE', id: 'task-123' },
    },
    previousResult: 'PREVIOUSLY: in operator for arrays was not fully implemented',
  },

  // ============================================================================
  // Case 9: Constant folding optimization
  // ============================================================================
  {
    name: 'Constant Folding',
    description: 'Demonstrate constant folding optimization',
    expression: bin('==',
      bin('*', num(2), bin('+', num(3), num(4))), // 2 * (3 + 4) = 14
      num(14)
    ),
    context: {},
    previousResult: 'This demonstrates constant folding: 2 * (3 + 4) is pre-computed to 14',
  },

  // ============================================================================
  // Case 10: String method chains
  // ============================================================================
  {
    name: 'String Validation Chain',
    description: 'Validate trimmed, lowercased email starts with expected prefix',
    expression: call(member(call(member(call(member(id('rawEmail'), 'trim'), []), 'toLowerCase'), []), 'startsWith'), [str('admin@')]),
    context: {
      variables: new Map([['rawEmail', '  ADMIN@example.com  ']]),
    },
    previousResult: 'PREVIOUSLY: String method chaining was not fully supported',
  },
];

// ============================================================================
// MAIN DEMO
// ============================================================================

function formatResult(result: EvalResult): string {
  const kindEmoji = result.kind === 'true' ? '✅' : result.kind === 'false' ? '❌' : '❓';
  let output = `${kindEmoji} Result: ${result.kind}`;
  
  if (result.evidence !== undefined) {
    const evidenceStr = JSON.stringify(result.evidence, null, 2);
    if (evidenceStr.length < 100) {
      output += `\n   Evidence: ${evidenceStr}`;
    } else {
      output += `\n   Evidence: ${evidenceStr.slice(0, 100)}...`;
    }
  }
  
  if (result.reason) {
    output += `\n   Reason: ${result.reason}`;
  }
  
  if (result.reasonCode) {
    output += `\n   Reason Code: ${result.reasonCode}`;
  }
  
  if (result.blameSpan) {
    output += `\n   Blame Span: ${result.blameSpan.exprKind} at ${result.blameSpan.path || 'root'}`;
  }
  
  return output;
}

async function runDemo() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('    ISL EXPRESSION EVALUATOR DEMO');
  console.log('    Demonstrating Previously-Unknown Cases Now Resolving');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Show coverage report
  const coverage = getCoverageReport();
  console.log('📊 Evaluator Coverage Report:');
  console.log(`   Supported Types: ${coverage.supported.length}`);
  console.log(`   Partial Types: ${coverage.partial.length}`);
  console.log(`   Unsupported Types: ${coverage.unsupported.length}`);
  console.log(`   Coverage: ~${Math.round((coverage.supported.length / (coverage.supported.length + coverage.partial.length + coverage.unsupported.length)) * 100)}%\n`);

  let passCount = 0;
  let unknownCount = 0;

  for (const demo of demoCases) {
    console.log('───────────────────────────────────────────────────────────────────────');
    console.log(`📋 ${demo.name}`);
    console.log(`   ${demo.description}`);
    if (demo.previousResult) {
      console.log(`   ${demo.previousResult}`);
    }
    console.log();

    const ctx = createEvalContext(demo.context);
    const result = evaluate(demo.expression, ctx);
    
    console.log(formatResult(result));
    console.log();

    if (result.kind === 'unknown') {
      unknownCount++;
    } else {
      passCount++;
    }
  }

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📈 DEMO SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`   Total Cases: ${demoCases.length}`);
  console.log(`   ✅ Deterministic (true/false): ${passCount}`);
  console.log(`   ❓ Unknown: ${unknownCount}`);
  console.log(`   Deterministic Rate: ${Math.round((passCount / demoCases.length) * 100)}%`);
  console.log();

  // Demonstrate constant folding
  console.log('───────────────────────────────────────────────────────────────────────');
  console.log('🔧 Constant Folding Demo');
  console.log('───────────────────────────────────────────────────────────────────────');
  
  const complexExpr = bin('*', num(2), bin('+', num(3), num(4)));
  console.log(`   Expression: 2 * (3 + 4)`);
  console.log(`   Is Constant: ${isConstant(complexExpr)}`);
  
  const folded = foldConstants(complexExpr);
  console.log(`   Folded: ${folded.folded}`);
  console.log(`   Folded Value: ${folded.value}`);
  console.log(`   Folded Expression Kind: ${folded.expr.kind}`);
  console.log();

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('    DEMO COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════');
}

// Run the demo
runDemo().catch(console.error);
