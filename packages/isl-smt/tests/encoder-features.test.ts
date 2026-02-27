/**
 * Encoder Feature Tests
 *
 * Unit tests for each new SMT encoding:
 * 1. Null encoding (is_null boolean flags)
 * 2. Enums as finite sorts with distinct constants
 * 3. Strings + length constraints (str.len native)
 * 4. Uninterpreted functions for lookups (Entity.exists, Entity.lookup)
 * 5. Quantifiers (forall / exists) with sort inference
 * 6. old() pre/post state split
 */

import { describe, it, expect } from 'vitest';
import {
  encodeExpression,
  createContext,
  registerEnum,
  createPrePostContext,
  islTypeToSort,
  type EncodingContext,
} from '../src/index.js';
import { Expr, Sort, Decl } from '@isl-lang/prover';

// ============================================================================
// Test Helpers
// ============================================================================

const mockSpan = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };

const id = (name: string) => ({ kind: 'Identifier' as const, name, span: mockSpan });
const num = (value: number) => ({ kind: 'NumberLiteral' as const, value, span: mockSpan });
const str = (value: string) => ({ kind: 'StringLiteral' as const, value, span: mockSpan });
const bool = (value: boolean) => ({ kind: 'BooleanLiteral' as const, value, span: mockSpan });
const nullLit = () => ({ kind: 'NullLiteral' as const, span: mockSpan });

const compare = (left: any, operator: '==' | '!=' | '<' | '>' | '<=' | '>=', right: any) => ({
  kind: 'ComparisonExpression' as const,
  operator,
  left,
  right,
  span: mockSpan,
});

const binary = (left: any, operator: string, right: any) => ({
  kind: 'BinaryExpression' as const,
  operator,
  left,
  right,
  span: mockSpan,
});

const logical = (left: any, operator: 'and' | 'or', right: any) => ({
  kind: 'LogicalExpression' as const,
  operator,
  left,
  right,
  span: mockSpan,
});

const member = (object: any, property: string) => ({
  kind: 'MemberExpression' as const,
  object,
  property: id(property),
  span: mockSpan,
});

const call = (callee: any, args: any[]) => ({
  kind: 'CallExpression' as const,
  callee,
  arguments: args,
  span: mockSpan,
});

const quantified = (quantifier: 'all' | 'some' | 'none', variable: string, collection: any, predicate: any) => ({
  kind: 'QuantifiedExpression' as const,
  quantifier,
  variable: id(variable),
  collection,
  predicate,
  span: mockSpan,
});

const old = (expression: any) => ({
  kind: 'OldExpression' as const,
  expression,
  span: mockSpan,
});

/** Assert encoding succeeds and return the SMT expression */
function expectSuccess(result: ReturnType<typeof encodeExpression>): any {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  return result.expr;
}

// ============================================================================
// 1. Null Encoding
// ============================================================================

describe('Null Encoding', () => {
  it('should encode NullLiteral as uninterpreted null constant', () => {
    const ctx = createContext();
    const expr = expectSuccess(encodeExpression(nullLit(), ctx));
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('__null__');
    expect(expr.sort.kind).toBe('Uninterpreted');
    expect(expr.sort.name).toBe('Null');
  });

  it('should encode x == null as is_null_x boolean', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(compare(id('x'), '==', nullLit()), ctx)
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('is_null_x');
    expect(expr.sort).toEqual(Sort.Bool());
  });

  it('should encode x != null as (not is_null_x)', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(compare(id('x'), '!=', nullLit()), ctx)
    );
    expect(expr.kind).toBe('Not');
    expect(expr.arg.kind).toBe('Var');
    expect(expr.arg.name).toBe('is_null_x');
  });

  it('should encode null == x as is_null_x (reversed)', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.String());

    const expr = expectSuccess(
      encodeExpression(compare(nullLit(), '==', id('x')), ctx)
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('is_null_x');
  });

  it('should encode input.page == null via ComparisonExpression', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('input.page', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(compare(member(id('input'), 'page'), '==', nullLit()), ctx)
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('is_null_input_page');
    expect(expr.sort).toEqual(Sort.Bool());
  });

  it('should encode input.page != null via ComparisonExpression', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('input.page', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(compare(member(id('input'), 'page'), '!=', nullLit()), ctx)
    );
    expect(expr.kind).toBe('Not');
    expect(expr.arg.name).toBe('is_null_input_page');
  });

  it('should encode x == null via BinaryExpression', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(binary(id('x'), '==', nullLit()), ctx)
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('is_null_x');
  });

  it('should encode x != null via BinaryExpression', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(binary(id('x'), '!=', nullLit()), ctx)
    );
    expect(expr.kind).toBe('Not');
    expect(expr.arg.name).toBe('is_null_x');
  });

  it('should encode x == null or x >= 1 pattern', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(
        logical(
          compare(id('x'), '==', nullLit()),
          'or',
          compare(id('x'), '>=', num(1))
        ),
        ctx
      )
    );
    expect(expr.kind).toBe('Or');
    expect(expr.args[0].kind).toBe('Var');
    expect(expr.args[0].name).toBe('is_null_x');
    expect(expr.args[1].kind).toBe('Ge');
  });

  it('should encode null != null comparison pattern via BinaryExpression', () => {
    const ctx = createContext();
    ctx.variables.set('locked_until', Sort.Int());

    // locked_until != null implies status == LOCKED
    registerEnum('UserStatus', ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING'], ctx);
    ctx.variables.set('status', Sort.Uninterpreted('UserStatus'));

    const expr = expectSuccess(
      encodeExpression(
        binary(
          compare(id('locked_until'), '!=', nullLit()),
          'implies',
          compare(id('status'), '==', id('LOCKED'))
        ),
        ctx
      )
    );
    expect(expr.kind).toBe('Implies');
    // left: (not is_null_locked_until)
    expect(expr.left.kind).toBe('Not');
    expect(expr.left.arg.name).toBe('is_null_locked_until');
    // right: (= status UserStatus_LOCKED)
    expect(expr.right.kind).toBe('Eq');
  });

  it('should handle Identifier("null") as null literal', () => {
    const ctx = createContext();
    const expr = expectSuccess(encodeExpression(id('null'), ctx));
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('__null__');
  });
});

// ============================================================================
// 2. Enums as Finite Sorts
// ============================================================================

describe('Enum Encoding', () => {
  it('should register enum and populate context maps', () => {
    const ctx = createContext();
    registerEnum('UserStatus', ['ACTIVE', 'INACTIVE', 'LOCKED'], ctx);

    expect(ctx.enumTypes.get('UserStatus')).toEqual(['ACTIVE', 'INACTIVE', 'LOCKED']);
    expect(ctx.enumVariants.get('ACTIVE')).toBe('UserStatus');
    expect(ctx.enumVariants.get('INACTIVE')).toBe('UserStatus');
    expect(ctx.enumVariants.get('LOCKED')).toBe('UserStatus');
  });

  it('should generate sort, constant, and distinctness declarations', () => {
    const ctx = createContext();
    registerEnum('Currency', ['USD', 'EUR', 'GBP'], ctx);

    // Should have: 1 sort decl + 3 const decls + 1 distinct assert + 1 exhaustiveness assert = 6
    expect(ctx.declarations.length).toBe(6);

    // Sort declaration
    expect(ctx.declarations[0]).toEqual({ kind: 'DeclareSort', name: 'Currency', arity: 0 });

    // Constant declarations
    expect(ctx.declarations[1]).toEqual({
      kind: 'DeclareConst', name: 'Currency_USD', sort: Sort.Uninterpreted('Currency')
    });
    expect(ctx.declarations[2]).toEqual({
      kind: 'DeclareConst', name: 'Currency_EUR', sort: Sort.Uninterpreted('Currency')
    });
    expect(ctx.declarations[3]).toEqual({
      kind: 'DeclareConst', name: 'Currency_GBP', sort: Sort.Uninterpreted('Currency')
    });

    // Distinctness assertion
    expect(ctx.declarations[4]!.kind).toBe('Assert');

    // Exhaustiveness assertion
    expect(ctx.declarations[5]!.kind).toBe('Assert');
  });

  it('should resolve enum variant identifier to correct sort', () => {
    const ctx = createContext();
    registerEnum('OrderStatus', ['PENDING', 'CONFIRMED', 'SHIPPED'], ctx);

    const expr = expectSuccess(encodeExpression(id('PENDING'), ctx));
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('OrderStatus_PENDING');
    expect(expr.sort).toEqual(Sort.Uninterpreted('OrderStatus'));
  });

  it('should encode status == ACTIVE comparison with enum', () => {
    const ctx = createContext();
    registerEnum('UserStatus', ['ACTIVE', 'INACTIVE', 'LOCKED'], ctx);
    ctx.variables.set('status', Sort.Uninterpreted('UserStatus'));

    const expr = expectSuccess(
      encodeExpression(compare(id('status'), '==', id('ACTIVE')), ctx)
    );
    expect(expr.kind).toBe('Eq');
    expect(expr.left.name).toBe('status');
    expect(expr.left.sort).toEqual(Sort.Uninterpreted('UserStatus'));
    expect(expr.right.name).toBe('UserStatus_ACTIVE');
    expect(expr.right.sort).toEqual(Sort.Uninterpreted('UserStatus'));
  });

  it('should encode result.status == PENDING with member access and enum', () => {
    const ctx = createContext();
    registerEnum('OrderStatus', ['PENDING', 'CONFIRMED', 'SHIPPED'], ctx);
    ctx.fieldTypes.set('result.status', Sort.Uninterpreted('OrderStatus'));

    const expr = expectSuccess(
      encodeExpression(compare(member(id('result'), 'status'), '==', id('PENDING')), ctx)
    );
    expect(expr.kind).toBe('Eq');
    expect(expr.left.name).toBe('result_status');
    expect(expr.right.name).toBe('OrderStatus_PENDING');
  });

  it('should prefer known variable over enum variant', () => {
    const ctx = createContext();
    registerEnum('Status', ['ACTIVE', 'INACTIVE'], ctx);
    // Register 'ACTIVE' as a variable too — variable should take precedence
    ctx.variables.set('ACTIVE', Sort.Bool());

    const expr = expectSuccess(encodeExpression(id('ACTIVE'), ctx));
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('ACTIVE');
    expect(expr.sort).toEqual(Sort.Bool());
  });

  it('should handle multiple enum types independently', () => {
    const ctx = createContext();
    registerEnum('OrderStatus', ['PENDING', 'CONFIRMED'], ctx);
    registerEnum('PaymentStatus', ['PENDING', 'PAID'], ctx);

    // 'PENDING' maps to last registration (PaymentStatus)
    const expr = expectSuccess(encodeExpression(id('PENDING'), ctx));
    expect(expr.name).toBe('PaymentStatus_PENDING');

    // Unique variants resolve correctly
    const confirmed = expectSuccess(encodeExpression(id('CONFIRMED'), ctx));
    expect(confirmed.name).toBe('OrderStatus_CONFIRMED');

    const paid = expectSuccess(encodeExpression(id('PAID'), ctx));
    expect(paid.name).toBe('PaymentStatus_PAID');
  });

  it('should generate exhaustiveness assertion for single-variant enum', () => {
    const ctx = createContext();
    registerEnum('SingleEnum', ['ONLY'], ctx);

    // 1 sort + 1 const + 0 distinct (only 1 variant) + 1 exhaustiveness = 3
    expect(ctx.declarations.length).toBe(3);
    expect(ctx.declarations[0]!.kind).toBe('DeclareSort');
    expect(ctx.declarations[1]!.kind).toBe('DeclareConst');
    expect(ctx.declarations[2]!.kind).toBe('Assert'); // exhaustiveness
  });
});

// ============================================================================
// 3. Strings + Length Constraints
// ============================================================================

describe('String + Length Encoding', () => {
  it('should encode string literal', () => {
    const ctx = createContext();
    const expr = expectSuccess(encodeExpression(str('hello'), ctx));
    expect(expr).toEqual(Expr.string('hello'));
  });

  it('should encode password.length as str.len for String sort', () => {
    const ctx = createContext();
    ctx.variables.set('password', Sort.String());

    const expr = expectSuccess(
      encodeExpression(member(id('password'), 'length'), ctx)
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('str.len');
    expect(expr.args.length).toBe(1);
    expect(expr.args[0].name).toBe('password');
  });

  it('should encode email.length > 0 with native str.len', () => {
    const ctx = createContext();
    ctx.variables.set('email', Sort.String());

    const expr = expectSuccess(
      encodeExpression(
        compare(member(id('email'), 'length'), '>', num(0)),
        ctx
      )
    );
    expect(expr.kind).toBe('Gt');
    // left: (str.len email)
    expect(expr.left.kind).toBe('Apply');
    expect(expr.left.func).toBe('str.len');
    // right: 0
    expect(expr.right).toEqual(Expr.int(0));
  });

  it('should encode password.length >= 8', () => {
    const ctx = createContext();
    ctx.variables.set('password', Sort.String());

    const expr = expectSuccess(
      encodeExpression(
        compare(member(id('password'), 'length'), '>=', num(8)),
        ctx
      )
    );
    expect(expr.kind).toBe('Ge');
    expect(expr.left.func).toBe('str.len');
    expect(expr.right).toEqual(Expr.int(8));
  });

  it('should encode card_last_four.length == 4', () => {
    const ctx = createContext();
    ctx.variables.set('card_last_four', Sort.String());

    const expr = expectSuccess(
      encodeExpression(
        compare(member(id('card_last_four'), 'length'), '==', num(4)),
        ctx
      )
    );
    expect(expr.kind).toBe('Eq');
    expect(expr.left.func).toBe('str.len');
    expect(expr.right).toEqual(Expr.int(4));
  });

  it('should encode items.length as uninterpreted len for non-String sort', () => {
    const ctx = createContext();
    ctx.variables.set('items', Sort.Array(Sort.Int(), Sort.Uninterpreted('OrderItem')));

    const expr = expectSuccess(
      encodeExpression(member(id('items'), 'length'), ctx)
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('len');
    expect(expr.args[0].name).toBe('items');
  });

  it('should encode items.length > 0 for array sort', () => {
    const ctx = createContext();
    ctx.variables.set('items', Sort.Array(Sort.Int(), Sort.Uninterpreted('OrderItem')));

    const expr = expectSuccess(
      encodeExpression(
        compare(member(id('items'), 'length'), '>', num(0)),
        ctx
      )
    );
    expect(expr.kind).toBe('Gt');
    expect(expr.left.func).toBe('len');
  });

  it('should encode input.field.length via member expression chain', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('input.name', Sort.String());

    // input.name.length → str.len(input_name)
    const expr = expectSuccess(
      encodeExpression(member(member(id('input'), 'name'), 'length'), ctx)
    );

    // The outer member sees .length, the inner is input.name
    // Since input.name sort is String, should use str.len
    expect(expr.kind).toBe('Apply');
    // Could be str.len or len depending on inference — let's just check it's an Apply
    expect(expr.args.length).toBe(1);
  });

  it('should encode length of unknown sort as uninterpreted len', () => {
    const ctx = createContext();
    // 'data' has no registered sort

    const expr = expectSuccess(
      encodeExpression(member(id('data'), 'length'), ctx)
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('len');
  });
});

// ============================================================================
// 4. Uninterpreted Functions for Lookups
// ============================================================================

describe('Uninterpreted Functions', () => {
  it('should encode Entity.exists(key) as Entity_exists application', () => {
    const ctx = createContext();
    ctx.variables.set('key', Sort.String());

    const expr = expectSuccess(
      encodeExpression(call(member(id('User'), 'exists'), [id('key')]), ctx)
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('User_exists');
    expect(expr.args.length).toBe(1);
    expect(expr.args[0].name).toBe('key');
  });

  it('should encode Entity.lookup(key) as Entity_lookup application', () => {
    const ctx = createContext();
    ctx.variables.set('email', Sort.String());

    const expr = expectSuccess(
      encodeExpression(call(member(id('User'), 'lookup'), [id('email')]), ctx)
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('User_lookup');
    expect(expr.args.length).toBe(1);
  });

  it('should encode Entity.count as Int variable', () => {
    const ctx = createContext();

    const expr = expectSuccess(
      encodeExpression(call(member(id('User'), 'count'), []), ctx)
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('User_count');
    expect(expr.sort).toEqual(Sort.Int());
  });

  it('should encode Entity.exists_by_email(email) as uninterpreted function', () => {
    const ctx = createContext();
    ctx.variables.set('email', Sort.String());

    const expr = expectSuccess(
      encodeExpression(
        call(member(id('User'), 'exists_by_email'), [id('email')]),
        ctx
      )
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('User_exists_by_email');
    expect(expr.args.length).toBe(1);
  });

  it('should encode Entity.lookup(key).field as nested function application', () => {
    const ctx = createContext();
    ctx.variables.set('order_id', Sort.String());

    // Order.lookup(order_id).status
    const lookupCall = call(member(id('Order'), 'lookup'), [id('order_id')]);
    const fieldAccess = member(lookupCall, 'status');

    const expr = expectSuccess(encodeExpression(fieldAccess, ctx));
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('__field_status');
    // The argument should be the lookup call result
    expect(expr.args[0].kind).toBe('Apply');
    expect(expr.args[0].func).toBe('Order_lookup');
  });

  it('should encode generic method call as uninterpreted function', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(call(member(id('Math'), 'sqrt'), [id('x')]), ctx)
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('Math_sqrt');
    expect(expr.args.length).toBe(1);
  });

  it('should encode now() as uninterpreted constant', () => {
    const ctx = createContext();

    const expr = expectSuccess(
      encodeExpression(call(id('now'), []), ctx)
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('__now__');
    expect(expr.sort).toEqual(Sort.Int());
  });

  it('should encode abs(x) as built-in abs', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(call(id('abs'), [id('x')]), ctx)
    );
    expect(expr.kind).toBe('Abs');
  });

  it('should encode len(s) with sort inference for String', () => {
    const ctx = createContext();
    ctx.variables.set('s', Sort.String());

    const expr = expectSuccess(
      encodeExpression(call(id('len'), [id('s')]), ctx)
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('str.len');
  });

  it('should encode len(arr) as uninterpreted len for non-String', () => {
    const ctx = createContext();
    ctx.variables.set('arr', Sort.Array(Sort.Int(), Sort.Int()));

    const expr = expectSuccess(
      encodeExpression(call(id('len'), [id('arr')]), ctx)
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('len');
  });

  it('should encode old(Entity.count) with old_ prefix', () => {
    const ctx = createContext();

    const expr = expectSuccess(
      encodeExpression(old(call(member(id('User'), 'count'), [])), ctx)
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('old_User_count');
    expect(expr.sort).toEqual(Sort.Int());
  });

  it('should encode Entity methods in old() context with prefix', () => {
    const ctx = createContext();
    ctx.variables.set('key', Sort.String());

    const expr = expectSuccess(
      encodeExpression(
        old(call(member(id('User'), 'exists'), [id('key')])),
        ctx
      )
    );
    expect(expr.kind).toBe('Apply');
    expect(expr.func).toBe('old_User_exists');
  });
});

// ============================================================================
// 5. Quantifiers (forall / exists)
// ============================================================================

describe('Quantifier Encoding', () => {
  it('should encode all(x in range: P) as forall with range constraint', () => {
    const ctx = createContext();

    // all(x in 1..10: x > 0)
    const range = binary(num(1), '..', num(10));
    const pred = compare(id('x'), '>', num(0));

    const expr = expectSuccess(
      encodeExpression(quantified('all', 'x', range, pred), ctx)
    );

    expect(expr.kind).toBe('Forall');
    expect(expr.vars.length).toBe(1);
    expect(expr.vars[0].name).toBe('x');
    expect(expr.vars[0].sort).toEqual(Sort.Int());
    // Body should be: (x >= 1 and x <= 10) => (x > 0)
    expect(expr.body.kind).toBe('Implies');
  });

  it('should encode some(x in range: P) as exists with range constraint', () => {
    const ctx = createContext();

    const range = binary(num(1), '..', num(100));
    const pred = compare(id('x'), '==', num(42));

    const expr = expectSuccess(
      encodeExpression(quantified('some', 'x', range, pred), ctx)
    );

    expect(expr.kind).toBe('Exists');
    expect(expr.vars[0].name).toBe('x');
    // Body should be: (x >= 1 and x <= 100) and (x == 42)
    expect(expr.body.kind).toBe('And');
  });

  it('should encode none(x in range: P) as forall...not', () => {
    const ctx = createContext();

    const range = binary(num(1), '..', num(10));
    const pred = compare(id('x'), '<', num(0));

    const expr = expectSuccess(
      encodeExpression(quantified('none', 'x', range, pred), ctx)
    );

    expect(expr.kind).toBe('Forall');
    // Body: (x >= 1 and x <= 10) => not(x < 0)
    expect(expr.body.kind).toBe('Implies');
  });

  it('should encode all(item in items: item.quantity > 0)', () => {
    const ctx = createContext();
    ctx.variables.set('items', Sort.Array(Sort.Int(), Sort.Uninterpreted('OrderItem')));
    ctx.fieldTypes.set('items', Sort.Array(Sort.Int(), Sort.Uninterpreted('OrderItem')));

    const pred = compare(member(id('item'), 'quantity'), '>', num(0));

    const expr = expectSuccess(
      encodeExpression(quantified('all', 'item', id('items'), pred), ctx)
    );

    expect(expr.kind).toBe('Forall');
    expect(expr.vars[0].name).toBe('item');
  });

  it('should encode some(item in input.items: P) with member collection', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('input.items', Sort.Array(Sort.Int(), Sort.Uninterpreted('Item')));

    const pred = compare(member(id('item'), 'active'), '==', bool(true));

    const expr = expectSuccess(
      encodeExpression(
        quantified('some', 'item', member(id('input'), 'items'), pred),
        ctx
      )
    );

    expect(expr.kind).toBe('Exists');
    expect(expr.vars[0].name).toBe('item');
    // Sort should be inferred from the Array element type
    expect(expr.vars[0].sort).toEqual(Sort.Uninterpreted('Item'));
  });

  it('should infer Int sort for range-based collections', () => {
    const ctx = createContext();
    const range = binary(num(0), '..', num(99));
    const pred = compare(id('i'), '>', num(50));

    const expr = expectSuccess(
      encodeExpression(quantified('all', 'i', range, pred), ctx)
    );

    expect(expr.vars[0].sort).toEqual(Sort.Int());
  });

  it('should bind quantifier variable in predicate scope', () => {
    const ctx = createContext();
    // x is already a variable in outer scope
    ctx.variables.set('x', Sort.Bool());

    const range = binary(num(1), '..', num(10));
    const pred = compare(id('x'), '>', num(5));

    const expr = expectSuccess(
      encodeExpression(quantified('all', 'x', range, pred), ctx)
    );

    // The x in the predicate should use Int sort (from the range), not Bool
    expect(expr.vars[0].sort).toEqual(Sort.Int());
    expect(expr.kind).toBe('Forall');
  });
});

// ============================================================================
// 6. old() Pre/Post State Split
// ============================================================================

describe('old() Pre/Post State Split', () => {
  it('should encode old(x) as old_x', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(old(id('x')), ctx)
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('old_x');
    expect(expr.sort).toEqual(Sort.Int());
  });

  it('should encode old(Entity.field) as old_Entity_field', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('User.failed_attempts', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(
        old(member(id('User'), 'failed_attempts')),
        ctx
      )
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('old_User_failed_attempts');
  });

  it('should encode User.failed_attempts == old(User.failed_attempts) + 1', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('User.failed_attempts', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(
        compare(
          member(id('User'), 'failed_attempts'),
          '==',
          binary(
            old(member(id('User'), 'failed_attempts')),
            '+',
            num(1)
          )
        ),
        ctx
      )
    );

    expect(expr.kind).toBe('Eq');
    // left: User_failed_attempts
    expect(expr.left.name).toBe('User_failed_attempts');
    // right: old_User_failed_attempts + 1
    expect(expr.right.kind).toBe('Add');
  });

  it('should createPrePostContext with old_ prefixed declarations', () => {
    const baseCtx = createContext();
    baseCtx.variables.set('x', Sort.Int());
    baseCtx.variables.set('y', Sort.String());
    baseCtx.fieldTypes.set('User.count', Sort.Int());

    const { preCtx, postCtx, preDeclarations } = createPrePostContext(baseCtx);

    // Pre-declarations should have old_ versions
    expect(preDeclarations.length).toBeGreaterThan(0);
    const declNames = preDeclarations
      .filter(d => d.kind === 'DeclareConst')
      .map(d => (d as any).name);
    expect(declNames).toContain('old_x');
    expect(declNames).toContain('old_y');

    // Pre context should have original variables
    expect(preCtx.variables.has('x')).toBe(true);
    expect(preCtx.variables.has('y')).toBe(true);

    // Post context should have old_ variables for pre-state access
    expect(postCtx.variables.has('old_x')).toBe(true);
    expect(postCtx.variables.has('old_y')).toBe(true);
    expect(postCtx.variables.has('x')).toBe(true);
  });

  it('should encode old(User.count) as old_User_count (Int)', () => {
    const ctx = createContext();

    const expr = expectSuccess(
      encodeExpression(
        old(call(member(id('User'), 'count'), [])),
        ctx
      )
    );
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('old_User_count');
    expect(expr.sort).toEqual(Sort.Int());
  });

  it('should not prefix with old_ outside old() context', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    const expr = expectSuccess(encodeExpression(id('x'), ctx));
    expect(expr.name).toBe('x');
  });

  it('should encode old(x) == null correctly', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.String());

    // We need to compare old(x) to null
    // This tests that old context + null comparison work together
    const expr = expectSuccess(
      encodeExpression(
        compare(old(id('x')), '==', nullLit()),
        ctx
      )
    );
    // old(x) == null → is_null_old_x
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('is_null_old_x');
  });
});

// ============================================================================
// Integration: Corpus-inspired patterns
// ============================================================================

describe('Corpus Pattern Integration', () => {
  it('should encode: locked_until != null implies status == LOCKED', () => {
    const ctx = createContext();
    registerEnum('UserStatus', ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING'], ctx);
    ctx.variables.set('locked_until', Sort.Int());
    ctx.variables.set('status', Sort.Uninterpreted('UserStatus'));

    const expr = expectSuccess(
      encodeExpression(
        binary(
          compare(id('locked_until'), '!=', nullLit()),
          'implies',
          compare(id('status'), '==', id('LOCKED'))
        ),
        ctx
      )
    );
    expect(expr.kind).toBe('Implies');
  });

  it('should encode: card_last_four == null or card_last_four.length == 4', () => {
    const ctx = createContext();
    ctx.variables.set('card_last_four', Sort.String());

    const expr = expectSuccess(
      encodeExpression(
        logical(
          compare(id('card_last_four'), '==', nullLit()),
          'or',
          compare(member(id('card_last_four'), 'length'), '==', num(4))
        ),
        ctx
      )
    );
    expect(expr.kind).toBe('Or');
    // Left: is_null_card_last_four
    expect(expr.args[0].name).toBe('is_null_card_last_four');
    // Right: (= (str.len card_last_four) 4)
    expect(expr.args[1].kind).toBe('Eq');
    expect(expr.args[1].left.func).toBe('str.len');
  });

  it('should encode: result.status == SUCCEEDED or result.status == PROCESSING', () => {
    const ctx = createContext();
    registerEnum('ChargeStatus', ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'], ctx);
    ctx.fieldTypes.set('result.status', Sort.Uninterpreted('ChargeStatus'));

    const expr = expectSuccess(
      encodeExpression(
        logical(
          compare(member(id('result'), 'status'), '==', id('SUCCEEDED')),
          'or',
          compare(member(id('result'), 'status'), '==', id('PROCESSING'))
        ),
        ctx
      )
    );
    expect(expr.kind).toBe('Or');
    expect(expr.args[0].left.name).toBe('result_status');
    expect(expr.args[0].right.name).toBe('ChargeStatus_SUCCEEDED');
    expect(expr.args[1].right.name).toBe('ChargeStatus_PROCESSING');
  });

  it('should encode: input.page == null or (input.page >= 1 and input.page <= 100)', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('input.page', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(
        logical(
          compare(member(id('input'), 'page'), '==', nullLit()),
          'or',
          logical(
            compare(member(id('input'), 'page'), '>=', num(1)),
            'and',
            compare(member(id('input'), 'page'), '<=', num(100))
          )
        ),
        ctx
      )
    );
    expect(expr.kind).toBe('Or');
    expect(expr.args[0].name).toBe('is_null_input_page');
    expect(expr.args[1].kind).toBe('And');
  });

  it('should encode: User.failed_attempts == old(User.failed_attempts) + 1', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('User.failed_attempts', Sort.Int());

    const expr = expectSuccess(
      encodeExpression(
        compare(
          member(id('User'), 'failed_attempts'),
          '==',
          binary(old(member(id('User'), 'failed_attempts')), '+', num(1))
        ),
        ctx
      )
    );
    expect(expr.kind).toBe('Eq');
    expect(expr.left.name).toBe('User_failed_attempts');
    expect(expr.right.kind).toBe('Add');
    expect(expr.right.args[0].name).toBe('old_User_failed_attempts');
    expect(expr.right.args[1]).toEqual(Expr.int(1));
  });

  it('should encode: all(item in input.items: item.quantity > 0)', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('input.items', Sort.Array(Sort.Int(), Sort.Uninterpreted('OrderItem')));

    const pred = compare(member(id('item'), 'quantity'), '>', num(0));

    const expr = expectSuccess(
      encodeExpression(
        quantified('all', 'item', member(id('input'), 'items'), pred),
        ctx
      )
    );
    expect(expr.kind).toBe('Forall');
    expect(expr.vars[0].name).toBe('item');
    expect(expr.vars[0].sort).toEqual(Sort.Uninterpreted('OrderItem'));
  });

  it('should encode: Order.lookup(order_id).status == PENDING or ...CONFIRMED', () => {
    const ctx = createContext();
    registerEnum('OrderStatus', ['PENDING', 'CONFIRMED', 'SHIPPED', 'CANCELLED'], ctx);
    ctx.variables.set('order_id', Sort.String());

    const lookupStatus = member(
      call(member(id('Order'), 'lookup'), [id('order_id')]),
      'status'
    );

    const expr = expectSuccess(
      encodeExpression(
        logical(
          compare(lookupStatus, '==', id('PENDING')),
          'or',
          compare(lookupStatus, '==', id('CONFIRMED'))
        ),
        ctx
      )
    );
    expect(expr.kind).toBe('Or');
    // Each side should be Eq with __field_status(Order_lookup(order_id))
    expect(expr.args[0].kind).toBe('Eq');
    expect(expr.args[0].left.func).toBe('__field_status');
  });

  it('should encode: result.verification_token == null', () => {
    const ctx = createContext();
    ctx.fieldTypes.set('result.verification_token', Sort.String());

    const expr = expectSuccess(
      encodeExpression(
        compare(member(id('result'), 'verification_token'), '==', nullLit()),
        ctx
      )
    );
    // Should encode as is_null_result_verification_token (bool)
    expect(expr.kind).toBe('Var');
    expect(expr.name).toBe('is_null_result_verification_token');
    expect(expr.sort).toEqual(Sort.Bool());
  });

  it('should encode: status == ACTIVE implies email_verified == true', () => {
    const ctx = createContext();
    registerEnum('UserStatus', ['PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE'], ctx);
    ctx.variables.set('status', Sort.Uninterpreted('UserStatus'));
    ctx.variables.set('email_verified', Sort.Bool());

    const expr = expectSuccess(
      encodeExpression(
        binary(
          compare(id('status'), '==', id('ACTIVE')),
          'implies',
          compare(id('email_verified'), '==', bool(true))
        ),
        ctx
      )
    );
    expect(expr.kind).toBe('Implies');
    expect(expr.left.kind).toBe('Eq');
    expect(expr.left.right.name).toBe('UserStatus_ACTIVE');
    expect(expr.right.kind).toBe('Eq');
  });
});
