// ============================================================================
// Temporal Logic Encoding for SMT-LIB
// Translates ISL temporal specifications to bounded model checking
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';
import { encodeExpression, EncodingContext } from './expressions';

// ============================================================================
// TYPES
// ============================================================================

export interface TemporalEncodingOptions {
  maxSteps?: number;       // Bound for bounded model checking
  timeUnit?: 'ms' | 'seconds' | 'minutes';
}

// ============================================================================
// TEMPORAL PROPERTY ENCODING
// ============================================================================

/**
 * Encode a temporal specification to SMT-LIB
 */
export function encodeTemporalProperty(
  spec: AST.TemporalSpec,
  ctx: EncodingContext,
  options: TemporalEncodingOptions = {}
): string {
  const maxSteps = options.maxSteps ?? 100;
  
  switch (spec.operator) {
    case 'eventually':
      return encodeEventually(spec, ctx, maxSteps);
    case 'always':
      return encodeAlways(spec, ctx, maxSteps);
    case 'within':
      return encodeWithin(spec, ctx);
    case 'never':
      return encodeNever(spec, ctx, maxSteps);
    default:
      return `; Unknown temporal operator: ${spec.operator}`;
  }
}

// ============================================================================
// OPERATOR ENCODINGS
// ============================================================================

/**
 * Encode "eventually P" - ◇P
 * Property P must hold at some future state
 */
function encodeEventually(
  spec: AST.TemporalSpec,
  ctx: EncodingContext,
  maxSteps: number
): string {
  const predicate = encodeExpression(spec.predicate, ctx);
  const bound = spec.duration ? durationToSteps(spec.duration, maxSteps) : maxSteps;
  
  // ◇P ≡ ∃k ∈ [0, bound]. P@k
  // Encode as: exists a step k where predicate holds
  const lines: string[] = [];
  
  lines.push(`; Eventually: ${predicate}`);
  lines.push(`(declare-const eventually-step Int)`);
  lines.push(`(assert (and (>= eventually-step 0) (<= eventually-step ${bound})))`);
  
  // State at step k satisfies predicate
  lines.push(`(declare-fun state-at-step (Int) Bool)`);
  lines.push(`(assert (state-at-step eventually-step))`);
  
  // The predicate defines what the state looks like
  lines.push(`(assert (forall ((k Int))`);
  lines.push(`  (=> (state-at-step k) ${predicate})))`);
  
  return lines.join('\n');
}

/**
 * Encode "always P" - □P
 * Property P must hold at all future states
 */
function encodeAlways(
  spec: AST.TemporalSpec,
  ctx: EncodingContext,
  maxSteps: number
): string {
  const predicate = encodeExpression(spec.predicate, ctx);
  
  // □P ≡ ∀k ∈ [0, maxSteps]. P@k
  const lines: string[] = [];
  
  lines.push(`; Always: ${predicate}`);
  lines.push(`(assert (forall ((k Int))`);
  lines.push(`  (=> (and (>= k 0) (<= k ${maxSteps}))`);
  lines.push(`      ${predicate})))`);
  
  return lines.join('\n');
}

/**
 * Encode "within D: P" - P must complete within duration D
 * Response time bounded by D
 */
function encodeWithin(
  spec: AST.TemporalSpec,
  ctx: EncodingContext
): string {
  const predicate = encodeExpression(spec.predicate, ctx);
  
  if (!spec.duration) {
    return `; Within requires duration: ${predicate}`;
  }
  
  const durationMs = durationToMs(spec.duration);
  const percentile = spec.percentile ?? 100;
  
  const lines: string[] = [];
  
  lines.push(`; Within ${durationMs}ms (p${percentile}): ${predicate}`);
  
  // Model response time as a variable
  lines.push(`(declare-const response-time Int)`);
  lines.push(`(assert (>= response-time 0))`);
  
  // Percentile constraint
  if (percentile === 100) {
    // All responses within bound
    lines.push(`(assert (<= response-time ${durationMs}))`);
  } else {
    // Statistical constraint - simplified as soft assertion
    lines.push(`; Percentile ${percentile} - response-time <= ${durationMs} for ${percentile}% of executions`);
    lines.push(`(assert-soft (<= response-time ${durationMs}) :weight ${percentile})`);
  }
  
  // Predicate holds when response completes
  lines.push(`(assert ${predicate})`);
  
  return lines.join('\n');
}

/**
 * Encode "never P" - ¬◇P = □¬P
 * Property P must never hold
 */
function encodeNever(
  spec: AST.TemporalSpec,
  ctx: EncodingContext,
  maxSteps: number
): string {
  const predicate = encodeExpression(spec.predicate, ctx);
  
  // never P ≡ ∀k ∈ [0, maxSteps]. ¬P@k
  const lines: string[] = [];
  
  lines.push(`; Never: ${predicate}`);
  lines.push(`(assert (forall ((k Int))`);
  lines.push(`  (=> (and (>= k 0) (<= k ${maxSteps}))`);
  lines.push(`      (not ${predicate}))))`);
  
  return lines.join('\n');
}

// ============================================================================
// BOUNDED MODEL CHECKING
// ============================================================================

/**
 * Generate state transition system for bounded model checking
 */
export function generateTransitionSystem(
  behaviors: AST.Behavior[],
  maxSteps: number
): string {
  const lines: string[] = [];
  
  lines.push('; Transition system for bounded model checking');
  lines.push('');
  
  // State sort
  lines.push('(declare-sort State 0)');
  lines.push('(declare-fun state-at (Int) State)');
  lines.push('');
  
  // Initial state
  lines.push('; Initial state');
  lines.push('(declare-const initial-state State)');
  lines.push('(assert (= (state-at 0) initial-state))');
  lines.push('');
  
  // Transition relation
  lines.push('; Transition relation');
  lines.push('(declare-fun transition (State State) Bool)');
  lines.push('');
  
  // Transitions follow the relation
  lines.push(`(assert (forall ((k Int))`);
  lines.push(`  (=> (and (>= k 0) (< k ${maxSteps}))`);
  lines.push(`      (transition (state-at k) (state-at (+ k 1))))))`);
  lines.push('');
  
  // Generate behavior-specific transitions
  for (const behavior of behaviors) {
    lines.push(generateBehaviorTransition(behavior));
  }
  
  return lines.join('\n');
}

function generateBehaviorTransition(behavior: AST.Behavior): string {
  const name = behavior.name.name;
  const lines: string[] = [];
  
  lines.push(`; Transition for ${name}`);
  lines.push(`(declare-fun ${name.toLowerCase()}-enabled (State) Bool)`);
  lines.push(`(declare-fun ${name.toLowerCase()}-effect (State State) Bool)`);
  
  // Preconditions define enabled
  if (behavior.preconditions.length > 0) {
    lines.push(`; ${name} preconditions`);
    // Simplified: just declare the relation
  }
  
  // Postconditions define effect
  if (behavior.postconditions.length > 0) {
    lines.push(`; ${name} postconditions`);
    // Simplified: just declare the relation
  }
  
  lines.push('');
  return lines.join('\n');
}

// ============================================================================
// LIVENESS AND FAIRNESS
// ============================================================================

/**
 * Encode liveness property: something good eventually happens
 * Under fairness: if enabled infinitely often, then executed infinitely often
 */
export function encodeLiveness(
  property: AST.Expression,
  fairnessCondition: AST.Expression | null,
  ctx: EncodingContext,
  maxSteps: number
): string {
  const propEncoded = encodeExpression(property, ctx);
  
  const lines: string[] = [];
  lines.push('; Liveness property');
  
  if (fairnessCondition) {
    const fairEncoded = encodeExpression(fairnessCondition, ctx);
    lines.push(`; Under fairness: ${fairEncoded}`);
    lines.push(`(assert (=> `);
    lines.push(`  (exists ((k Int)) (and (>= k 0) (<= k ${maxSteps}) ${fairEncoded}))`);
    lines.push(`  (exists ((j Int)) (and (>= j 0) (<= j ${maxSteps}) ${propEncoded}))))`);
  } else {
    lines.push(`(assert (exists ((k Int)) (and (>= k 0) (<= k ${maxSteps}) ${propEncoded})))`);
  }
  
  return lines.join('\n');
}

/**
 * Encode safety property: nothing bad ever happens
 */
export function encodeSafety(
  badProperty: AST.Expression,
  ctx: EncodingContext,
  maxSteps: number
): string {
  const badEncoded = encodeExpression(badProperty, ctx);
  
  const lines: string[] = [];
  lines.push('; Safety property (bad state never reached)');
  lines.push(`(assert (forall ((k Int))`);
  lines.push(`  (=> (and (>= k 0) (<= k ${maxSteps}))`);
  lines.push(`      (not ${badEncoded}))))`);
  
  return lines.join('\n');
}

// ============================================================================
// HELPERS
// ============================================================================

function durationToMs(duration: AST.DurationLiteral): number {
  let ms = duration.value;
  
  switch (duration.unit) {
    case 'seconds':
      ms *= 1000;
      break;
    case 'minutes':
      ms *= 60000;
      break;
    case 'hours':
      ms *= 3600000;
      break;
    case 'days':
      ms *= 86400000;
      break;
    // ms stays as is
  }
  
  return Math.floor(ms);
}

function durationToSteps(duration: AST.DurationLiteral, maxSteps: number): number {
  // Convert duration to discrete steps
  // Assume each step is ~10ms for simplicity
  const ms = durationToMs(duration);
  const steps = Math.ceil(ms / 10);
  return Math.min(steps, maxSteps);
}

/**
 * Generate declarations for temporal variables
 */
export function generateTemporalDeclarations(): string {
  return `
; Temporal logic support
(declare-const current-time Int)
(declare-const start-time Int)
(assert (>= current-time start-time))
(assert (>= start-time 0))

; Response time tracking
(declare-const response-time Int)
(assert (>= response-time 0))

; Step counter for bounded model checking
(declare-const current-step Int)
(assert (>= current-step 0))
`;
}
