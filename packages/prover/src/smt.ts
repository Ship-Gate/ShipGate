// ============================================================================
// ISL Formal Prover - SMT Expression Builder
// ============================================================================

import type { SMTSort, SMTExpr, SMTDecl } from './types.js';

/**
 * SMT Sort constructors
 */
export const Sort = {
  Bool: (): SMTSort => ({ kind: 'Bool' }),
  Int: (): SMTSort => ({ kind: 'Int' }),
  Real: (): SMTSort => ({ kind: 'Real' }),
  String: (): SMTSort => ({ kind: 'String' }),
  BitVec: (width: number): SMTSort => ({ kind: 'BitVec', width }),
  Array: (index: SMTSort, element: SMTSort): SMTSort => ({ kind: 'Array', index, element }),
  Set: (element: SMTSort): SMTSort => ({ kind: 'Set', element }),
  Uninterpreted: (name: string): SMTSort => ({ kind: 'Uninterpreted', name }),
};

/**
 * SMT Expression constructors
 */
export const Expr = {
  // Constants
  bool: (value: boolean): SMTExpr => ({ kind: 'BoolConst', value }),
  int: (value: number | bigint): SMTExpr => ({ kind: 'IntConst', value }),
  real: (value: number): SMTExpr => ({ kind: 'RealConst', value }),
  string: (value: string): SMTExpr => ({ kind: 'StringConst', value }),
  
  // Variables
  var: (name: string, sort: SMTSort): SMTExpr => ({ kind: 'Var', name, sort }),
  
  // Boolean operations
  not: (arg: SMTExpr): SMTExpr => ({ kind: 'Not', arg }),
  and: (...args: SMTExpr[]): SMTExpr => 
    args.length === 0 ? Expr.bool(true) :
    args.length === 1 ? args[0]! :
    { kind: 'And', args },
  or: (...args: SMTExpr[]): SMTExpr => 
    args.length === 0 ? Expr.bool(false) :
    args.length === 1 ? args[0]! :
    { kind: 'Or', args },
  implies: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Implies', left, right }),
  iff: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Iff', left, right }),
  ite: (cond: SMTExpr, thenExpr: SMTExpr, elseExpr: SMTExpr): SMTExpr => 
    ({ kind: 'Ite', cond, then: thenExpr, else: elseExpr }),
  
  // Comparison
  eq: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Eq', left, right }),
  neq: (left: SMTExpr, right: SMTExpr): SMTExpr => Expr.not(Expr.eq(left, right)),
  distinct: (...args: SMTExpr[]): SMTExpr => ({ kind: 'Distinct', args }),
  lt: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Lt', left, right }),
  le: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Le', left, right }),
  gt: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Gt', left, right }),
  ge: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Ge', left, right }),
  
  // Arithmetic
  add: (...args: SMTExpr[]): SMTExpr => 
    args.length === 0 ? Expr.int(0) :
    args.length === 1 ? args[0]! :
    { kind: 'Add', args },
  sub: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Sub', left, right }),
  mul: (...args: SMTExpr[]): SMTExpr => 
    args.length === 0 ? Expr.int(1) :
    args.length === 1 ? args[0]! :
    { kind: 'Mul', args },
  div: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Div', left, right }),
  mod: (left: SMTExpr, right: SMTExpr): SMTExpr => ({ kind: 'Mod', left, right }),
  neg: (arg: SMTExpr): SMTExpr => ({ kind: 'Neg', arg }),
  abs: (arg: SMTExpr): SMTExpr => ({ kind: 'Abs', arg }),
  
  // Quantifiers
  forall: (vars: { name: string; sort: SMTSort }[], body: SMTExpr): SMTExpr => 
    ({ kind: 'Forall', vars, body }),
  exists: (vars: { name: string; sort: SMTSort }[], body: SMTExpr): SMTExpr => 
    ({ kind: 'Exists', vars, body }),
  
  // Arrays
  select: (array: SMTExpr, index: SMTExpr): SMTExpr => ({ kind: 'Select', array, index }),
  store: (array: SMTExpr, index: SMTExpr, value: SMTExpr): SMTExpr => 
    ({ kind: 'Store', array, index, value }),
  constArray: (sort: SMTSort, value: SMTExpr): SMTExpr => ({ kind: 'ConstArray', sort, value }),
  
  // Functions
  apply: (func: string, ...args: SMTExpr[]): SMTExpr => ({ kind: 'Apply', func, args }),
  
  // Let bindings
  let: (bindings: { name: string; value: SMTExpr }[], body: SMTExpr): SMTExpr => 
    ({ kind: 'Let', bindings, body }),
};

/**
 * SMT Declaration constructors
 */
export const Decl = {
  const: (name: string, sort: SMTSort): SMTDecl => ({ kind: 'DeclareConst', name, sort }),
  fun: (name: string, params: SMTSort[], returnSort: SMTSort): SMTDecl => 
    ({ kind: 'DeclareFun', name, params, returnSort }),
  sort: (name: string, arity: number = 0): SMTDecl => ({ kind: 'DeclareSort', name, arity }),
  define: (
    name: string, 
    params: { name: string; sort: SMTSort }[], 
    returnSort: SMTSort, 
    body: SMTExpr
  ): SMTDecl => ({ kind: 'DefineFun', name, params, returnSort, body }),
  assert: (expr: SMTExpr): SMTDecl => ({ kind: 'Assert', expr }),
};

/**
 * Convert SMT expression to SMT-LIB string
 */
export function toSMTLib(expr: SMTExpr): string {
  switch (expr.kind) {
    case 'BoolConst':
      return expr.value ? 'true' : 'false';
    case 'IntConst':
      return String(expr.value);
    case 'RealConst':
      return expr.value.toString();
    case 'StringConst':
      return `"${expr.value.replace(/"/g, '""')}"`;
    case 'BitVecConst':
      return `#x${expr.value.toString(16).padStart(expr.width / 4, '0')}`;
    case 'Var':
      return expr.name;
    case 'Not':
      return `(not ${toSMTLib(expr.arg)})`;
    case 'And':
      return expr.args.length === 0 ? 'true' : `(and ${expr.args.map(toSMTLib).join(' ')})`;
    case 'Or':
      return expr.args.length === 0 ? 'false' : `(or ${expr.args.map(toSMTLib).join(' ')})`;
    case 'Implies':
      return `(=> ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Iff':
      return `(= ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Ite':
      return `(ite ${toSMTLib(expr.cond)} ${toSMTLib(expr.then)} ${toSMTLib(expr.else)})`;
    case 'Eq':
      return `(= ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Distinct':
      return `(distinct ${expr.args.map(toSMTLib).join(' ')})`;
    case 'Lt':
      return `(< ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Le':
      return `(<= ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Gt':
      return `(> ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Ge':
      return `(>= ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Add':
      return `(+ ${expr.args.map(toSMTLib).join(' ')})`;
    case 'Sub':
      return `(- ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Mul':
      return `(* ${expr.args.map(toSMTLib).join(' ')})`;
    case 'Div':
      return `(div ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Mod':
      return `(mod ${toSMTLib(expr.left)} ${toSMTLib(expr.right)})`;
    case 'Neg':
      return `(- ${toSMTLib(expr.arg)})`;
    case 'Abs':
      return `(abs ${toSMTLib(expr.arg)})`;
    case 'Forall':
      const forallVars = expr.vars.map(v => `(${v.name} ${sortToSMTLib(v.sort)})`).join(' ');
      return `(forall (${forallVars}) ${toSMTLib(expr.body)})`;
    case 'Exists':
      const existsVars = expr.vars.map(v => `(${v.name} ${sortToSMTLib(v.sort)})`).join(' ');
      return `(exists (${existsVars}) ${toSMTLib(expr.body)})`;
    case 'Select':
      return `(select ${toSMTLib(expr.array)} ${toSMTLib(expr.index)})`;
    case 'Store':
      return `(store ${toSMTLib(expr.array)} ${toSMTLib(expr.index)} ${toSMTLib(expr.value)})`;
    case 'ConstArray':
      return `((as const ${sortToSMTLib(expr.sort)}) ${toSMTLib(expr.value)})`;
    case 'Apply':
      return expr.args.length === 0 ? expr.func : `(${expr.func} ${expr.args.map(toSMTLib).join(' ')})`;
    case 'Let':
      const bindings = expr.bindings.map(b => `(${b.name} ${toSMTLib(b.value)})`).join(' ');
      return `(let (${bindings}) ${toSMTLib(expr.body)})`;
    default:
      throw new Error(`Unknown expression kind: ${(expr as SMTExpr).kind}`);
  }
}

/**
 * Convert sort to SMT-LIB string
 */
export function sortToSMTLib(sort: SMTSort): string {
  switch (sort.kind) {
    case 'Bool':
      return 'Bool';
    case 'Int':
      return 'Int';
    case 'Real':
      return 'Real';
    case 'String':
      return 'String';
    case 'BitVec':
      return `(_ BitVec ${sort.width})`;
    case 'Array':
      return `(Array ${sortToSMTLib(sort.index)} ${sortToSMTLib(sort.element)})`;
    case 'Set':
      return `(Set ${sortToSMTLib(sort.element)})`;
    case 'Uninterpreted':
      return sort.name;
    case 'Datatype':
      return sort.name;
    default:
      throw new Error(`Unknown sort kind: ${(sort as SMTSort).kind}`);
  }
}

/**
 * Convert declaration to SMT-LIB string
 */
export function declToSMTLib(decl: SMTDecl): string {
  switch (decl.kind) {
    case 'DeclareConst':
      return `(declare-const ${decl.name} ${sortToSMTLib(decl.sort)})`;
    case 'DeclareFun':
      const params = decl.params.map(sortToSMTLib).join(' ');
      return `(declare-fun ${decl.name} (${params}) ${sortToSMTLib(decl.returnSort)})`;
    case 'DeclareSort':
      return `(declare-sort ${decl.name} ${decl.arity})`;
    case 'DefineFun':
      const fnParams = decl.params.map(p => `(${p.name} ${sortToSMTLib(p.sort)})`).join(' ');
      return `(define-fun ${decl.name} (${fnParams}) ${sortToSMTLib(decl.returnSort)} ${toSMTLib(decl.body)})`;
    case 'Assert':
      return `(assert ${toSMTLib(decl.expr)})`;
    default:
      throw new Error(`Unknown declaration kind: ${(decl as SMTDecl).kind}`);
  }
}

/**
 * Simplify SMT expression
 */
export function simplify(expr: SMTExpr): SMTExpr {
  switch (expr.kind) {
    case 'Not':
      const inner = simplify(expr.arg);
      // Double negation
      if (inner.kind === 'Not') {
        return simplify(inner.arg);
      }
      // Not of constants
      if (inner.kind === 'BoolConst') {
        return Expr.bool(!inner.value);
      }
      return { ...expr, arg: inner };

    case 'And':
      const andArgs = expr.args.map(simplify);
      // Remove true, short-circuit on false
      const filteredAnd = andArgs.filter(a => !(a.kind === 'BoolConst' && a.value));
      if (filteredAnd.some(a => a.kind === 'BoolConst' && !a.value)) {
        return Expr.bool(false);
      }
      if (filteredAnd.length === 0) return Expr.bool(true);
      if (filteredAnd.length === 1) return filteredAnd[0]!;
      return { ...expr, args: filteredAnd };

    case 'Or':
      const orArgs = expr.args.map(simplify);
      // Remove false, short-circuit on true
      const filteredOr = orArgs.filter(a => !(a.kind === 'BoolConst' && !a.value));
      if (filteredOr.some(a => a.kind === 'BoolConst' && a.value)) {
        return Expr.bool(true);
      }
      if (filteredOr.length === 0) return Expr.bool(false);
      if (filteredOr.length === 1) return filteredOr[0]!;
      return { ...expr, args: filteredOr };

    case 'Implies':
      const left = simplify(expr.left);
      const right = simplify(expr.right);
      // false => x = true
      if (left.kind === 'BoolConst' && !left.value) return Expr.bool(true);
      // true => x = x
      if (left.kind === 'BoolConst' && left.value) return right;
      // x => true = true
      if (right.kind === 'BoolConst' && right.value) return Expr.bool(true);
      return { ...expr, left, right };

    case 'Add':
      const addTerms = expr.args.map(simplify);
      // Collect constants
      let sum = 0;
      const nonConst: SMTExpr[] = [];
      for (const t of addTerms) {
        if (t.kind === 'IntConst') {
          sum += Number(t.value);
        } else {
          nonConst.push(t);
        }
      }
      if (sum !== 0) {
        nonConst.push(Expr.int(sum));
      }
      if (nonConst.length === 0) return Expr.int(0);
      if (nonConst.length === 1) return nonConst[0]!;
      return { ...expr, args: nonConst };

    default:
      return expr;
  }
}

/**
 * Collect free variables from expression
 */
export function freeVars(expr: SMTExpr): Set<string> {
  const vars = new Set<string>();
  
  function collect(e: SMTExpr, bound: Set<string>): void {
    switch (e.kind) {
      case 'Var':
        if (!bound.has(e.name)) vars.add(e.name);
        break;
      case 'Not':
        collect(e.arg, bound);
        break;
      case 'And':
      case 'Or':
      case 'Add':
      case 'Mul':
      case 'Distinct':
        for (const arg of e.args) collect(arg, bound);
        break;
      case 'Implies':
      case 'Iff':
      case 'Eq':
      case 'Lt':
      case 'Le':
      case 'Gt':
      case 'Ge':
      case 'Sub':
      case 'Div':
      case 'Mod':
        collect(e.left, bound);
        collect(e.right, bound);
        break;
      case 'Ite':
        collect(e.cond, bound);
        collect(e.then, bound);
        collect(e.else, bound);
        break;
      case 'Neg':
      case 'Abs':
        collect(e.arg, bound);
        break;
      case 'Forall':
      case 'Exists':
        const newBound = new Set(bound);
        for (const v of e.vars) newBound.add(v.name);
        collect(e.body, newBound);
        break;
      case 'Select':
        collect(e.array, bound);
        collect(e.index, bound);
        break;
      case 'Store':
        collect(e.array, bound);
        collect(e.index, bound);
        collect(e.value, bound);
        break;
      case 'ConstArray':
        collect(e.value, bound);
        break;
      case 'Apply':
        for (const arg of e.args) collect(arg, bound);
        break;
      case 'Let':
        const letBound = new Set(bound);
        for (const b of e.bindings) {
          collect(b.value, bound);
          letBound.add(b.name);
        }
        collect(e.body, letBound);
        break;
    }
  }
  
  collect(expr, new Set());
  return vars;
}
