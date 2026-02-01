// ============================================================================
// ISL Dependent Types - Types That Depend on Values
// Version: 0.1.0
// ============================================================================

/**
 * Dependent Types allow types to be parameterized by values, not just other types.
 * This enables encoding complex invariants and relationships at the type level.
 * 
 * Examples:
 * - Vector<N>: A list with exactly N elements
 * - Matrix<M, N>: A matrix with M rows and N columns
 * - Fin<N>: Natural numbers less than N
 * - Equal<A, B>: Proof that A equals B
 */

// ============================================================================
// DEPENDENT FUNCTION TYPES (Pi Types)
// ============================================================================

/**
 * Pi type: (x: A) -> B(x)
 * A function where the return type can depend on the input value
 * 
 * ISL syntax:
 * ```isl
 * // Return type depends on input value
 * function replicate<N: Nat>(value: T, count: N): Vector<T, N>
 * 
 * // Matrix multiplication with dimension checking
 * function multiply<M, N, P>(
 *   a: Matrix<M, N>,
 *   b: Matrix<N, P>
 * ): Matrix<M, P>
 * ```
 */
export interface PiType<A, B extends (a: A) => unknown> {
  readonly _tag: 'PiType';
  readonly domain: A;
  readonly codomain: B;
}

// ============================================================================
// DEPENDENT PAIR TYPES (Sigma Types)
// ============================================================================

/**
 * Sigma type: (x: A, B(x))
 * A pair where the type of the second element depends on the first
 * 
 * ISL syntax:
 * ```isl
 * // Length-indexed vector as sigma type
 * type ExistentialVector<T> = (n: Nat, Vector<T, n>)
 * 
 * // File with its schema
 * type ValidatedData<S: Schema> = (schema: S, data: ConformsTo<S>)
 * ```
 */
export interface SigmaType<A, B extends (a: A) => unknown> {
  readonly _tag: 'SigmaType';
  readonly fst: A;
  readonly snd: ReturnType<B>;
}

// ============================================================================
// LENGTH-INDEXED VECTORS
// ============================================================================

/**
 * Vector with statically known length
 * 
 * ISL syntax:
 * ```isl
 * type Vector<T, N: Nat> = 
 *   | Empty when N == 0
 *   | Cons(head: T, tail: Vector<T, N - 1>) when N > 0
 * 
 * // Safe head - only works on non-empty vectors
 * function head<T, N: Nat { N > 0 }>(vec: Vector<T, N>): T
 * 
 * // Safe tail
 * function tail<T, N: Nat { N > 0 }>(vec: Vector<T, N>): Vector<T, N - 1>
 * 
 * // Append with length tracking
 * function append<T, M, N>(a: Vector<T, M>, b: Vector<T, N>): Vector<T, M + N>
 * ```
 */
export interface Vector<T, N extends number> {
  readonly _tag: 'Vector';
  readonly length: N;
  readonly elements: T[];
}

// Type-level natural number operations
export type Zero = 0;
export type Succ<N extends number> = N extends number ? number : never;

// Empty vector
export type Empty<T> = Vector<T, 0>;

// Non-empty vector
export type NonEmpty<T> = Vector<T, number>;

// Safe operations
export function head<T, N extends number>(vec: Vector<T, N>): N extends 0 ? never : T {
  if (vec.length === 0) {
    throw new Error('Cannot take head of empty vector');
  }
  return vec.elements[0] as N extends 0 ? never : T;
}

export function tail<T, N extends number>(vec: Vector<T, N>): Vector<T, number> {
  return {
    _tag: 'Vector',
    length: Math.max(0, vec.length - 1) as number,
    elements: vec.elements.slice(1),
  };
}

// ============================================================================
// FINITE TYPES
// ============================================================================

/**
 * Fin<N> represents natural numbers strictly less than N
 * 
 * ISL syntax:
 * ```isl
 * type Fin<N: Nat { N > 0 }> = Nat { value < N }
 * 
 * // Safe array access
 * function index<T, N>(arr: Vector<T, N>, i: Fin<N>): T
 * ```
 */
export interface Fin<N extends number> {
  readonly _tag: 'Fin';
  readonly bound: N;
  readonly value: number;
}

export function fin<N extends number>(value: number, bound: N): Fin<N> | null {
  if (value >= 0 && value < bound) {
    return { _tag: 'Fin', bound, value };
  }
  return null;
}

// Safe array indexing
export function safeIndex<T, N extends number>(
  vec: Vector<T, N>,
  index: Fin<N>
): T {
  return vec.elements[index.value] as T;
}

// ============================================================================
// EQUALITY TYPES
// ============================================================================

/**
 * Propositional equality type
 * Equal<A, B> is inhabited only when A equals B
 * 
 * ISL syntax:
 * ```isl
 * type Equal<A, B> = proof that A == B
 * 
 * // Reflexivity: everything equals itself
 * function refl<A>(): Equal<A, A>
 * 
 * // Symmetry
 * function sym<A, B>(eq: Equal<A, B>): Equal<B, A>
 * 
 * // Transitivity
 * function trans<A, B, C>(eq1: Equal<A, B>, eq2: Equal<B, C>): Equal<A, C>
 * ```
 */
export interface Equal<A, B> {
  readonly _tag: 'Equal';
  readonly _phantom: [A, B];
}

// Reflexivity constructor
export function refl<A>(): Equal<A, A> {
  return { _tag: 'Equal', _phantom: undefined as unknown as [A, A] };
}

// Substitution: if A = B, then P(A) implies P(B)
export function subst<A, B, P extends (x: unknown) => unknown>(
  eq: Equal<A, B>,
  pa: ReturnType<P>
): ReturnType<P> {
  return pa;
}

// ============================================================================
// SIZED TYPES
// ============================================================================

/**
 * Types with statically known size
 * 
 * ISL syntax:
 * ```isl
 * type Sized<T, S: Size> = T { sizeof(this) == S }
 * 
 * // Fixed-size buffer
 * type Buffer<N: Nat> = Sized<Bytes, N>
 * 
 * // Packed struct with known layout
 * type PackedStruct<Fields, S: Size> = {
 *   fields: Fields
 *   _size: S
 *   
 *   invariant {
 *     sum(field.size for field in fields) == S
 *   }
 * }
 * ```
 */
export interface Sized<T, S extends number> {
  readonly _tag: 'Sized';
  readonly size: S;
  readonly value: T;
}

// ============================================================================
// INDEXED FAMILIES
// ============================================================================

/**
 * Type families indexed by values
 * 
 * ISL syntax:
 * ```isl
 * // State machine with typed states
 * type State<S: StateId> = match S {
 *   IDLE => IdleState
 *   RUNNING => RunningState
 *   STOPPED => StoppedState
 * }
 * 
 * // Transition function with state-dependent types
 * function transition<From: StateId, To: StateId>(
 *   state: State<From>,
 *   event: Event<From, To>
 * ): State<To>
 * ```
 */
export type TypeFamily<Index, Mapping extends Record<Index & (string | number | symbol), unknown>> = 
  <I extends Index & (string | number | symbol)>(index: I) => Mapping[I];

// ============================================================================
// GADTs (Generalized Algebraic Data Types)
// ============================================================================

/**
 * GADTs allow constructors to specify type parameters
 * 
 * ISL syntax:
 * ```isl
 * // Type-safe expression language
 * type Expr<T> = 
 *   | IntLit(value: Int) -> Expr<Int>
 *   | BoolLit(value: Bool) -> Expr<Bool>
 *   | Add(left: Expr<Int>, right: Expr<Int>) -> Expr<Int>
 *   | If<A>(cond: Expr<Bool>, then: Expr<A>, else: Expr<A>) -> Expr<A>
 *   | Eq<A>(left: Expr<A>, right: Expr<A>) -> Expr<Bool>
 * 
 * // Type-safe evaluator
 * function eval<T>(expr: Expr<T>): T
 * ```
 */

// Expression GADT
export type Expr<T> =
  | IntLit
  | BoolLit
  | Add
  | IfExpr<T>
  | EqExpr<unknown>;

export interface IntLit {
  readonly _tag: 'IntLit';
  readonly _type: number;
  readonly value: number;
}

export interface BoolLit {
  readonly _tag: 'BoolLit';
  readonly _type: boolean;
  readonly value: boolean;
}

export interface Add {
  readonly _tag: 'Add';
  readonly _type: number;
  readonly left: Expr<number>;
  readonly right: Expr<number>;
}

export interface IfExpr<T> {
  readonly _tag: 'If';
  readonly _type: T;
  readonly cond: Expr<boolean>;
  readonly then: Expr<T>;
  readonly else: Expr<T>;
}

export interface EqExpr<T> {
  readonly _tag: 'Eq';
  readonly _type: boolean;
  readonly left: Expr<T>;
  readonly right: Expr<T>;
}

// Type-safe evaluation
export function evaluate<T>(expr: Expr<T>): T {
  switch (expr._tag) {
    case 'IntLit':
      return expr.value as T;
    case 'BoolLit':
      return expr.value as T;
    case 'Add':
      return (evaluate(expr.left) + evaluate(expr.right)) as T;
    case 'If':
      return evaluate(expr.cond) ? evaluate(expr.then) : evaluate(expr.else);
    case 'Eq':
      return (evaluate(expr.left) === evaluate(expr.right)) as T;
  }
}

// ============================================================================
// ISL DEPENDENT TYPE SYNTAX EXAMPLES
// ============================================================================

/**
 * ISL supports dependent types for expressing complex invariants:
 * 
 * ```isl
 * // Database schema with typed queries
 * domain TypedDB {
 *   // Schema definition
 *   type Schema = Map<TableName, TableSchema>
 *   type TableSchema = Map<ColumnName, ColumnType>
 *   
 *   // Query result type depends on selected columns
 *   type QueryResult<S: Schema, T: TableName, Cols: List<ColumnName>> = {
 *     rows: List<Row<S[T], Cols>>
 *   }
 *   
 *   type Row<Table: TableSchema, Cols: List<ColumnName>> = {
 *     [col in Cols]: Table[col]
 *   }
 *   
 *   // Type-safe select
 *   behavior Select<S: Schema, T: TableName, Cols: List<ColumnName>> {
 *     input {
 *       schema: S
 *       table: T
 *       columns: Cols
 *       where: WhereClause<S[T]>?
 *     }
 *     
 *     output {
 *       success: QueryResult<S, T, Cols>
 *     }
 *     
 *     preconditions {
 *       T in S.keys
 *       all(Cols, col => col in S[T].keys)
 *     }
 *   }
 * }
 * 
 * // State machine with typed transitions
 * domain TypedStateMachine {
 *   type State = IDLE | RUNNING | PAUSED | STOPPED
 *   
 *   // Allowed transitions encoded in types
 *   type ValidTransition<From: State, To: State> = match (From, To) {
 *     (IDLE, RUNNING) => Unit
 *     (RUNNING, PAUSED) => Unit
 *     (RUNNING, STOPPED) => Unit
 *     (PAUSED, RUNNING) => Unit
 *     (PAUSED, STOPPED) => Unit
 *     _ => Never  // Invalid transition
 *   }
 *   
 *   behavior Transition<From: State, To: State> {
 *     preconditions {
 *       ValidTransition<From, To> != Never
 *     }
 *   }
 * }
 * 
 * // Resource management with linear types
 * domain LinearResources {
 *   // File handle that must be closed
 *   type FileHandle [linear]
 *   
 *   behavior OpenFile {
 *     output {
 *       success: FileHandle [linear]
 *     }
 *   }
 *   
 *   behavior ReadFile {
 *     input {
 *       handle: FileHandle [borrow]  // Borrowed, not consumed
 *     }
 *     output {
 *       success: (content: String, handle: FileHandle)
 *     }
 *   }
 *   
 *   behavior CloseFile {
 *     input {
 *       handle: FileHandle [consume]  // Consumed, cannot be used again
 *     }
 *     output {
 *       success: Unit
 *     }
 *   }
 * }
 * ```
 */

// ============================================================================
// TYPE-LEVEL COMPUTATION
// ============================================================================

/**
 * ISL supports type-level computation for deriving types:
 * 
 * ```isl
 * // Type-level addition
 * type Add<M: Nat, N: Nat>: Nat = match M {
 *   0 => N
 *   Succ(m) => Succ(Add<m, N>)
 * }
 * 
 * // Type-level list length
 * type Length<L: List<_>>: Nat = match L {
 *   [] => 0
 *   [_, ...tail] => Succ(Length<tail>)
 * }
 * 
 * // Type-level list append
 * type Append<A: List<T>, B: List<T>>: List<T> = match A {
 *   [] => B
 *   [head, ...tail] => [head, ...Append<tail, B>]
 * }
 * ```
 */

// Type-level computation helpers
export type If<Cond extends boolean, Then, Else> = Cond extends true ? Then : Else;

export type Length<T extends unknown[]> = T['length'];

export type Head<T extends unknown[]> = T extends [infer H, ...unknown[]] ? H : never;

export type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;

export type Concat<A extends unknown[], B extends unknown[]> = [...A, ...B];
