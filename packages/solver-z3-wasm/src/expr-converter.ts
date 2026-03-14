/**
 * Expression Converter
 *
 * Converts SMTExpr from @isl-lang/prover to Z3 WASM API expressions.
 * Supports: Bool, Int, Real, String, Array sorts and quantifiers.
 */

import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Minimal Z3 Context interface matching the z3-solver npm package (v4.x).
 *
 * All Z3 expression types use `any` because the z3-solver package
 * produces duck-typed JavaScript objects whose shape varies by sort.
 */
export interface Z3Context {
  Int: {
    const: (name: string) => any;
    val: (value: number) => any;
    sort: () => any;
  };
  Bool: {
    const: (name: string) => any;
    val: (value: boolean) => any;
    sort: () => any;
  };
  Real: {
    const: (name: string) => any;
    val: (value: number | string) => any;
    sort: () => any;
  };
  String: {
    const: (name: string) => any;
    val: (value: string) => any;
    sort: () => any;
  };
  BitVec: {
    const: (name: string, bits: number) => any;
    val: (value: number | bigint, bits: number) => any;
    sort: (bits: number) => any;
  };
  Array: {
    const: (name: string, domain: any, range: any) => any;
    sort: (domain: any, range: any) => any;
  };
  Solver: new () => {
    add: (expr: any) => void;
    check: () => Promise<string>;
    model: () => any;
  };
  And: (...args: any[]) => any;
  Or: (...args: any[]) => any;
  Not: (arg: any) => any;
  Implies: (a: any, b: any) => any;
  Eq: (a: any, b: any) => any;
  Distinct: (...args: any[]) => any;
  If: (cond: any, t: any, f: any) => any;
  ForAll: (vars: any[], body: any) => any;
  Exists: (vars: any[], body: any) => any;
  ToReal?: (expr: any) => any;
  ToInt?: (expr: any) => any;
  IntToStr?: (expr: any) => any;
  K?: (sort: any, value: any) => any;
}

/**
 * Resolve an SMTSort to a Z3 sort object.
 */
export function resolveSort(sort: SMTSort, ctx: Z3Context): any {
  switch (sort.kind) {
    case 'Bool':
      return ctx.Bool.sort();
    case 'Int':
      return ctx.Int.sort();
    case 'Real':
      return ctx.Real.sort();
    case 'String':
      return ctx.String.sort();
    case 'BitVec':
      if (!ctx.BitVec) throw new Error('BitVec sort not available in this Z3 WASM build');
      return ctx.BitVec.sort(sort.width);
    case 'Array':
      return ctx.Array.sort(
        resolveSort(sort.index, ctx),
        resolveSort(sort.element, ctx),
      );
    default:
      throw new Error(`Unsupported sort for Z3 WASM: ${sort.kind}`);
  }
}

/**
 * Create a Z3 symbolic constant for a given sort.
 */
function createZ3Var(name: string, sort: SMTSort, ctx: Z3Context): any {
  switch (sort.kind) {
    case 'Bool':
      return ctx.Bool.const(name);
    case 'Int':
      return ctx.Int.const(name);
    case 'Real':
      return ctx.Real.const(name);
    case 'String':
      return ctx.String.const(name);
    case 'BitVec':
      if (!ctx.BitVec) throw new Error('BitVec sort not available in this Z3 WASM build');
      return ctx.BitVec.const(name, sort.width);
    case 'Array':
      return ctx.Array.const(
        name,
        resolveSort(sort.index, ctx),
        resolveSort(sort.element, ctx),
      );
    default:
      throw new Error(`Cannot create Z3 variable for sort: ${sort.kind}`);
  }
}

/**
 * Create variable map from declarations.
 * Handles Bool, Int, Real, String, and Array sorts.
 */
export function createVarMap(
  declarations: SMTDecl[],
  ctx: Z3Context,
): Map<string, any> {
  const vars = new Map<string, any>();

  for (const decl of declarations) {
    if (decl.kind === 'DeclareConst') {
      vars.set(decl.name, createZ3Var(decl.name, decl.sort, ctx));
    }
  }

  return vars;
}

/**
 * Convert an SMTExpr tree to a Z3 expression.
 *
 * Handles all expression kinds: boolean logic, integer/real arithmetic,
 * string operations (via Apply), array operations, quantifiers, and let bindings.
 */
export function convertExpr(
  expr: SMTExpr,
  ctx: Z3Context,
  vars: Map<string, any>,
): any {
  switch (expr.kind) {
    // ---- Constants ----
    case 'BoolConst':
      return ctx.Bool.val(expr.value);

    case 'IntConst':
      return ctx.Int.val(Number(expr.value));

    case 'RealConst':
      return ctx.Real.val(expr.value);

    case 'StringConst':
      return ctx.String.val(expr.value);

    case 'BitVecConst':
      if (!ctx.BitVec) throw new Error('BitVec sort not available in this Z3 WASM build');
      return ctx.BitVec.val(expr.value, expr.width);

    // ---- Variables ----
    case 'Var': {
      const v = vars.get(expr.name);
      if (v !== undefined) return v;
      const created = createZ3Var(expr.name, expr.sort, ctx);
      vars.set(expr.name, created);
      return created;
    }

    // ---- Boolean operations ----
    case 'Not':
      return ctx.Not(convertExpr(expr.arg, ctx, vars));

    case 'And':
      if (expr.args.length === 0) return ctx.Bool.val(true);
      return ctx.And(...expr.args.map(a => convertExpr(a, ctx, vars)));

    case 'Or':
      if (expr.args.length === 0) return ctx.Bool.val(false);
      return ctx.Or(...expr.args.map(a => convertExpr(a, ctx, vars)));

    case 'Implies':
      return ctx.Implies(
        convertExpr(expr.left, ctx, vars),
        convertExpr(expr.right, ctx, vars),
      );

    case 'Iff':
      return ctx.Eq(
        convertExpr(expr.left, ctx, vars),
        convertExpr(expr.right, ctx, vars),
      );

    case 'Ite':
      return ctx.If(
        convertExpr(expr.cond, ctx, vars),
        convertExpr(expr.then, ctx, vars),
        convertExpr(expr.else, ctx, vars),
      );

    // ---- Comparison ----
    case 'Eq':
      return ctx.Eq(
        convertExpr(expr.left, ctx, vars),
        convertExpr(expr.right, ctx, vars),
      );

    case 'Distinct':
      return ctx.Distinct(...expr.args.map(a => convertExpr(a, ctx, vars)));

    case 'Lt': {
      const l = convertExpr(expr.left, ctx, vars);
      const r = convertExpr(expr.right, ctx, vars);
      return l.lt(r);
    }

    case 'Le': {
      const l = convertExpr(expr.left, ctx, vars);
      const r = convertExpr(expr.right, ctx, vars);
      return l.le(r);
    }

    case 'Gt': {
      const l = convertExpr(expr.left, ctx, vars);
      const r = convertExpr(expr.right, ctx, vars);
      return l.gt(r);
    }

    case 'Ge': {
      const l = convertExpr(expr.left, ctx, vars);
      const r = convertExpr(expr.right, ctx, vars);
      return l.ge(r);
    }

    // ---- Arithmetic (works for both Int and Real) ----
    case 'Add': {
      const operands = expr.args.map(a => convertExpr(a, ctx, vars));
      if (operands.length === 0) return ctx.Int.val(0);
      return operands.reduce((acc: any, val: any) => acc.add(val));
    }

    case 'Sub':
      return convertExpr(expr.left, ctx, vars).sub(
        convertExpr(expr.right, ctx, vars),
      );

    case 'Mul': {
      const operands = expr.args.map(a => convertExpr(a, ctx, vars));
      if (operands.length === 0) return ctx.Int.val(1);
      return operands.reduce((acc: any, val: any) => acc.mul(val));
    }

    case 'Div':
      return convertExpr(expr.left, ctx, vars).div(
        convertExpr(expr.right, ctx, vars),
      );

    case 'Mod':
      return convertExpr(expr.left, ctx, vars).mod(
        convertExpr(expr.right, ctx, vars),
      );

    case 'Neg':
      return convertExpr(expr.arg, ctx, vars).neg();

    case 'Abs': {
      const inner = convertExpr(expr.arg, ctx, vars);
      return ctx.If(inner.ge(ctx.Int.val(0)), inner, inner.neg());
    }

    // ---- Quantifiers ----
    case 'Forall': {
      const scope = new Map(vars);
      const bound: any[] = [];
      for (const v of expr.vars) {
        const z3v = createZ3Var(v.name, v.sort, ctx);
        scope.set(v.name, z3v);
        bound.push(z3v);
      }
      return ctx.ForAll(bound, convertExpr(expr.body, ctx, scope));
    }

    case 'Exists': {
      const scope = new Map(vars);
      const bound: any[] = [];
      for (const v of expr.vars) {
        const z3v = createZ3Var(v.name, v.sort, ctx);
        scope.set(v.name, z3v);
        bound.push(z3v);
      }
      return ctx.Exists(bound, convertExpr(expr.body, ctx, scope));
    }

    // ---- Arrays ----
    case 'Select':
      return convertExpr(expr.array, ctx, vars).select(
        convertExpr(expr.index, ctx, vars),
      );

    case 'Store':
      return convertExpr(expr.array, ctx, vars).store(
        convertExpr(expr.index, ctx, vars),
        convertExpr(expr.value, ctx, vars),
      );

    case 'ConstArray': {
      const val = convertExpr(expr.value, ctx, vars);
      if (ctx.K) {
        return ctx.K(resolveSort(expr.sort, ctx), val);
      }
      throw new Error('ConstArray requires Z3 K() — not available in this build');
    }

    // ---- Function application (string ops, type conversions) ----
    case 'Apply':
      return convertApply(expr.func, expr.args, ctx, vars);

    // ---- Let bindings ----
    case 'Let': {
      const scope = new Map(vars);
      for (const b of expr.bindings) {
        scope.set(b.name, convertExpr(b.value, ctx, vars));
      }
      return convertExpr(expr.body, ctx, scope);
    }

    default:
      throw new Error(
        `Unsupported expression kind: ${(expr as { kind: string }).kind}`,
      );
  }
}

/**
 * Convert Apply expressions — dispatches on the SMT-LIB function name.
 *
 * Handles string theory operations and sort conversion functions.
 */
function convertApply(
  func: string,
  args: SMTExpr[],
  ctx: Z3Context,
  vars: Map<string, any>,
): any {
  const c = args.map(a => convertExpr(a, ctx, vars));

  switch (func) {
    // ---- String operations ----
    case 'str.len':
      return c[0].length();

    case 'str.++': {
      if (c.length === 0) return ctx.String.val('');
      return c.reduce((acc: any, s: any) => acc.concat(s));
    }

    case 'str.contains':
      return c[0].contains(c[1]);

    case 'str.substr':
      return c[0].extract(c[1], c[2]);

    case 'str.at':
      return c[0].at(c[1]);

    case 'str.indexof':
      return c[0].indexOf(c[1], c[2] ?? ctx.Int.val(0));

    case 'str.replace':
      return c[0].replace(c[1], c[2]);

    case 'str.to_int':
      return c[0].toInt();

    case 'int.to_str': {
      if (ctx.IntToStr) return ctx.IntToStr(c[0]);
      if (typeof c[0].toStr === 'function') return c[0].toStr();
      throw new Error('int.to_str is not available in this Z3 WASM build');
    }

    case 'str.prefixof':
      return c[0].prefixOf(c[1]);

    case 'str.suffixof':
      return c[0].suffixOf(c[1]);

    // ---- Sort conversions ----
    case 'to_real':
    case 'int.to.real': {
      if (ctx.ToReal) return ctx.ToReal(c[0]);
      if (typeof c[0].toReal === 'function') return c[0].toReal();
      throw new Error('to_real is not available in this Z3 WASM build');
    }

    case 'to_int':
    case 'real.to.int': {
      if (ctx.ToInt) return ctx.ToInt(c[0]);
      if (typeof c[0].toInt === 'function') return c[0].toInt();
      throw new Error('to_int is not available in this Z3 WASM build');
    }

    default:
      throw new Error(`Unsupported function application: ${func}`);
  }
}
