/**
 * ISL Parsing — wraps @isl-lang/parser with a stable public surface.
 *
 * Converts raw AST output into simplified DomainSummary / BehaviorSummary
 * so that AST internals never leak into the public contract.
 *
 * @internal — consumers import from the root `@shipgate/sdk` entry.
 */

import { parse, parseFile } from '@isl-lang/parser';
import type {
  Domain,
  Behavior,
  Expression,
} from '@isl-lang/parser';
import type { ParseResult, DomainSummary, BehaviorSummary } from './types.js';

// ============================================================================
// Expression → string (internal helper, not exported)
// ============================================================================

/**
 * Convert an AST Expression node into a human-readable string.
 * Covers all expression kinds defined in the ISL grammar.
 */
function exprToString(expr: Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'QualifiedName':
      return expr.parts.map((p) => p.name).join('.');
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'NumberLiteral':
      return String(expr.value);
    case 'BooleanLiteral':
      return String(expr.value);
    case 'NullLiteral':
      return 'null';
    case 'DurationLiteral':
      return `${expr.value}${expr.unit}`;
    case 'RegexLiteral':
      return `/${expr.pattern}/${expr.flags}`;
    case 'BinaryExpr':
      return `${exprToString(expr.left)} ${expr.operator} ${exprToString(expr.right)}`;
    case 'UnaryExpr':
      return `${expr.operator} ${exprToString(expr.operand)}`;
    case 'CallExpr':
      return `${exprToString(expr.callee)}(${expr.arguments.map(exprToString).join(', ')})`;
    case 'MemberExpr':
      return `${exprToString(expr.object)}.${expr.property.name}`;
    case 'IndexExpr':
      return `${exprToString(expr.object)}[${exprToString(expr.index)}]`;
    case 'QuantifierExpr':
      return `${expr.quantifier}(${expr.variable.name} in ${exprToString(expr.collection)}, ${exprToString(expr.predicate)})`;
    case 'ConditionalExpr':
      return `${exprToString(expr.condition)} ? ${exprToString(expr.thenBranch)} : ${exprToString(expr.elseBranch)}`;
    case 'OldExpr':
      return `old(${exprToString(expr.expression)})`;
    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';
    case 'InputExpr':
      return `input.${expr.property.name}`;
    case 'LambdaExpr':
      return `(${expr.params.map((p) => p.name).join(', ')}) => ${exprToString(expr.body)}`;
    case 'ListExpr':
      return `[${expr.elements.map(exprToString).join(', ')}]`;
    case 'MapExpr':
      return `{${expr.entries.map((e) => `${exprToString(e.key)}: ${exprToString(e.value)}`).join(', ')}}`;
    case 'Literal':
      return `[${expr.litKind}]`;
    default:
      return '[expr]';
  }
}

// ============================================================================
// AST → Summary converters (internal)
// ============================================================================

function summarizeBehavior(behavior: Behavior): BehaviorSummary {
  const preconditions = behavior.preconditions.map(exprToString);

  const postconditions: string[] = [];
  for (const block of behavior.postconditions) {
    for (const predicate of block.predicates) {
      postconditions.push(exprToString(predicate));
    }
  }

  const invariants = behavior.invariants.map(exprToString);

  return Object.freeze({
    name: behavior.name.name,
    preconditions: Object.freeze(preconditions),
    postconditions: Object.freeze(postconditions),
    invariants: Object.freeze(invariants),
  });
}

function summarizeDomain(domain: Domain): DomainSummary {
  return Object.freeze({
    name: domain.name.name,
    version: domain.version?.value ?? '0.0.0',
    behaviors: Object.freeze(domain.behaviors.map(summarizeBehavior)),
    entities: Object.freeze(domain.entities.map((e) => e.name.name)),
    invariants: Object.freeze(domain.invariants.map((i) => i.name.name)),
  });
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse ISL source code into a stable {@link ParseResult}.
 *
 * This is a **pure, synchronous** function — no I/O, no side effects.
 * The returned `domain` is a simplified summary; AST internals are not exposed.
 *
 * @param source - ISL source code string
 * @returns Parse result with domain summary and any errors
 *
 * @example
 * ```typescript
 * const result = parseISL(`
 *   domain Auth version "1.0" {
 *     behavior Login {
 *       postconditions { success { result.token.length > 0 } }
 *     }
 *   }
 * `);
 *
 * if (result.success) {
 *   console.log(result.domain.behaviors.map(b => b.name));
 * }
 * ```
 */
export function parseISL(source: string): ParseResult {
  const result = parse(source);

  return Object.freeze({
    success: result.success,
    domain: result.domain ? summarizeDomain(result.domain) : undefined,
    errors: Object.freeze(
      result.errors.map((e) =>
        Object.freeze({
          message: e.message,
          line: e.location?.line,
          column: e.location?.column,
          code: e.code,
        }),
      ),
    ),
  });
}

/**
 * Parse an ISL file from disk into a stable {@link ParseResult}.
 *
 * Reads the file asynchronously, then delegates to the ISL parser.
 * File-read errors are returned as parse errors (never throws).
 *
 * @param path - Absolute or relative path to an `.isl` file
 * @returns Promise resolving to the parse result
 *
 * @example
 * ```typescript
 * const result = await parseISLFile('src/auth/login.isl');
 * if (result.success && result.domain) {
 *   console.log(`Domain: ${result.domain.name}`);
 * }
 * ```
 */
export async function parseISLFile(path: string): Promise<ParseResult> {
  const result = await parseFile(path);

  return Object.freeze({
    success: result.success,
    domain: result.domain ? summarizeDomain(result.domain) : undefined,
    errors: Object.freeze(
      result.errors.map((e) =>
        Object.freeze({
          message: e.message,
          line: e.location?.line,
          column: e.location?.column,
          code: e.code,
        }),
      ),
    ),
  });
}
