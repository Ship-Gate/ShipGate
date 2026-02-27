/**
 * ISL Coverage Analytics Engine
 * 
 * Analyzes coverage metrics for ISL specifications:
 * 1. Behavior binding coverage
 * 2. Runtime verification coverage
 * 3. Constraint unknown tracking
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parse } from '@isl-lang/parser';
import type {
  Domain,
  Behavior,
  Expression,
  SourceLocation,
} from '@isl-lang/parser';
import type {
  CoverageReport,
  CoverageOptions,
  DomainCoverage,
  BehaviorCoverage,
  ConstraintCoverage,
  UnboundBehavior,
  UnknownConstraint,
} from './types.js';

/**
 * Analyze coverage for ISL specifications
 */
export async function analyzeCoverage(
  options: CoverageOptions
): Promise<CoverageReport> {
  const {
    specFiles,
    bindingsFile = '.shipgate.bindings.json',
    verificationTracesDir,
    detailed = false,
  } = options;

  // Load bindings if available
  const bindings = loadBindings(bindingsFile);

  // Load verification traces if available
  const verificationTraces = verificationTracesDir
    ? loadVerificationTraces(verificationTracesDir)
    : undefined;

  // Parse all spec files
  const domains: DomainCoverage[] = [];
  const unboundBehaviors: UnboundBehavior[] = [];
  const unknownConstraints: UnknownConstraint[] = [];

  for (const specFile of specFiles) {
    const domainCoverage = analyzeDomain(
      specFile,
      bindings,
      verificationTraces,
      detailed
    );

    domains.push(domainCoverage);

    // Collect unbound behaviors
    for (const behavior of domainCoverage.behaviors) {
      if (!behavior.hasBinding) {
        unboundBehaviors.push({
          name: behavior.name,
          domain: behavior.domain,
          file: behavior.location.file || specFile,
          line: behavior.location?.line ?? 0,
          column: behavior.location?.column ?? 0,
        });
      }

      // Collect always-unknown constraints
      for (const constraint of [
        ...behavior.preconditions,
        ...behavior.postconditions,
        ...behavior.invariants,
      ]) {
        if (constraint.alwaysUnknown) {
          const constraintType =
            behavior.preconditions.includes(constraint)
              ? 'precondition'
              : behavior.postconditions.includes(constraint)
                ? 'postcondition'
                : 'invariant';

          unknownConstraints.push({
            expression: constraint.expression,
            type: constraintType,
            behavior: behavior.name,
            domain: behavior.domain,
            file: constraint.location.file || specFile,
            line: constraint.location?.line ?? 0,
            column: constraint.location?.column ?? 0,
            unknownReasons: constraint.unknownReasons,
            evaluationCount: constraint.evaluationCount,
          });
        }
      }
    }
  }

  // Calculate summary
  const summary = {
    totalDomains: domains.length,
    totalBehaviors: domains.reduce((sum, d) => sum + d.totalBehaviors, 0),
    boundBehaviors: domains.reduce((sum, d) => sum + d.boundBehaviors, 0),
    exercisedBehaviors: domains.reduce(
      (sum, d) => sum + d.exercisedBehaviors,
      0
    ),
    totalConstraints: domains.reduce(
      (sum, d) => sum + d.totalConstraints,
      0
    ),
    evaluatedConstraints: domains.reduce(
      (sum, d) => sum + d.evaluatedConstraints,
      0
    ),
    alwaysUnknownConstraints: unknownConstraints.length,
  };

  return {
    timestamp: new Date().toISOString(),
    summary,
    domains,
    unboundBehaviors,
    unknownConstraints,
  };
}

/**
 * Analyze coverage for a single domain
 */
function analyzeDomain(
  specFile: string,
  bindings: Map<string, BindingInfo> | undefined,
  verificationTraces: VerificationTraces | undefined,
  detailed: boolean
): DomainCoverage {
  // Parse spec file
  const specContent = readFileSync(specFile, 'utf-8');
  const parseResult = parse(specContent, specFile);

  if (!parseResult.success || !parseResult.domain) {
    throw new Error(
      `Failed to parse ${specFile}: ${parseResult.errors?.[0]?.message || 'Unknown error'}`
    );
  }

  const domain = parseResult.domain;
  const domainName = domain.name.name;

  // Analyze each behavior
  const behaviors: BehaviorCoverage[] = [];
  let totalConstraints = 0;
  let evaluatedConstraints = 0;
  let boundBehaviors = 0;
  let exercisedBehaviors = 0;

  const constraintCounts = {
    preconditions: 0,
    postconditions: 0,
    invariants: 0,
  };

  for (const behavior of domain.behaviors) {
    const behaviorName = behavior.name.name;
    const bindingKey = `${domainName}.${behaviorName}`;
    const binding = bindings?.get(bindingKey);

    // Get verification trace for this behavior
    const trace = verificationTraces?.behaviors.get(bindingKey);

    // Analyze constraints
    const preconditions = analyzeConstraints(
      behavior.preconditions || [],
      trace?.preconditions || [],
      specFile,
      detailed
    );
    const postconditions = analyzeConstraints(
      behavior.postconditions?.flatMap((pc) => pc.predicates ?? []) ?? [],
      trace?.postconditions || [],
      specFile,
      detailed
    );
    const invariants = analyzeConstraints(
      behavior.invariants || [],
      trace?.invariants || [],
      specFile,
      detailed
    );

    const behaviorConstraints =
      preconditions.length + postconditions.length + invariants.length;
    totalConstraints += behaviorConstraints;

    const behaviorEvaluated =
      preconditions.filter((c) => c.evaluated).length +
      postconditions.filter((c) => c.evaluated).length +
      invariants.filter((c) => c.evaluated).length;
    evaluatedConstraints += behaviorEvaluated;

    constraintCounts.preconditions += preconditions.length;
    constraintCounts.postconditions += postconditions.length;
    constraintCounts.invariants += invariants.length;

    const behaviorCoverage: BehaviorCoverage = {
      name: behaviorName,
      domain: domainName,
      location: behavior.location || createLocation(specFile, 0),
      hasBinding: !!binding,
      bindingFile: binding?.file,
      bindingConfidence: binding?.confidence,
      exercisedInVerification: !!trace && trace.exerciseCount > 0,
      exerciseCount: trace?.exerciseCount || 0,
      preconditions,
      postconditions,
      invariants,
    };

    behaviors.push(behaviorCoverage);

    if (binding) {
      boundBehaviors++;
    }
    if (trace && trace.exerciseCount > 0) {
      exercisedBehaviors++;
    }
  }

  return {
    domain: domainName,
    sourceFile: specFile,
    totalBehaviors: behaviors.length,
    boundBehaviors,
    exercisedBehaviors,
    behaviors,
    totalConstraints,
    evaluatedConstraints,
    alwaysUnknownConstraints: behaviors.reduce(
      (sum, b) =>
        sum +
        [...b.preconditions, ...b.postconditions, ...b.invariants].filter(
          (c) => c.alwaysUnknown
        ).length,
      0
    ),
    constraints: constraintCounts,
  };
}

/**
 * Analyze constraints for coverage
 */
function analyzeConstraints(
  constraints: Expression[],
  traceData: ConstraintTrace[] | undefined,
  specFile: string,
  detailed: boolean
): ConstraintCoverage[] {
  return constraints.map((constraint, index) => {
    const trace = traceData?.[index];
    const expression = constraintToString(constraint);

    const results = {
      true: trace?.results?.true || 0,
      false: trace?.results?.false || 0,
      unknown: trace?.results?.unknown || 0,
    };

    const totalEvaluations =
      results.true + results.false + results.unknown;
    const alwaysUnknown =
      totalEvaluations > 0 && results.unknown === totalEvaluations;

    return {
      expression,
      location: constraint.location || createLocation(specFile, 0),
      evaluated: totalEvaluations > 0,
      evaluationCount: totalEvaluations,
      results,
      alwaysUnknown,
      unknownReasons: trace?.unknownReasons || [],
    };
  });
}

/**
 * Convert expression to string
 */
function constraintToString(expr: Expression): string {
  // Simple stringification - in production, use proper AST serializer
  if ('kind' in expr) {
    switch (expr.kind) {
      case 'BinaryExpr':
        return `${constraintToString(expr.left)} ${expr.operator} ${constraintToString(expr.right)}`;
      case 'UnaryExpr':
        return `${expr.operator}${constraintToString(expr.operand)}`;
      case 'Identifier':
        return (expr as { name: string }).name;
      case 'BooleanLiteral':
        return String(expr.value);
      case 'StringLiteral':
        return JSON.stringify(expr.value);
      case 'NumberLiteral':
        return String(expr.value);
      case 'CallExpr':
        const callExpr = expr as { callee: { name?: string }; arguments?: Expression[] };
        return `${callExpr.callee?.name ?? 'call'}(${callExpr.arguments?.map((e: Expression) => constraintToString(e)).join(', ') ?? ''})`;
      default:
        return '[expression]';
    }
  }
  return '[expression]';
}

/**
 * Create a source location
 */
function createLocation(
  file: string,
  line: number,
  column?: number
): SourceLocation {
  return {
    file,
    line,
    column: column ?? 0,
    endLine: line,
    endColumn: column ?? 0,
  };
}

/**
 * Binding information
 */
interface BindingInfo {
  file: string;
  confidence: number;
}

/**
 * Load bindings from file
 */
function loadBindings(
  bindingsFile: string
): Map<string, BindingInfo> | undefined {
  const resolvedPath = resolve(bindingsFile);
  if (!existsSync(resolvedPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(resolvedPath, 'utf-8');
    const data = JSON.parse(content);

    const bindings = new Map<string, BindingInfo>();

    // Handle different bindings file formats
    if (Array.isArray(data.bindings)) {
      for (const binding of data.bindings) {
        const key = binding.isl?.domain && binding.isl?.name
          ? `${binding.isl.domain}.${binding.isl.name}`
          : binding.behavior;
        if (key) {
          bindings.set(key, {
            file: binding.code?.file || binding.file || '',
            confidence: binding.confidence || 0,
          });
        }
      }
    }

    return bindings.size > 0 ? bindings : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Verification trace data
 */
interface VerificationTraces {
  behaviors: Map<string, BehaviorTrace>;
}

/**
 * Behavior trace data
 */
interface BehaviorTrace {
  exerciseCount: number;
  preconditions?: ConstraintTrace[];
  postconditions?: ConstraintTrace[];
  invariants?: ConstraintTrace[];
}

/**
 * Constraint trace data
 */
interface ConstraintTrace {
  results?: {
    true: number;
    false: number;
    unknown: number;
  };
  unknownReasons?: string[];
}

/**
 * Load verification traces from directory
 */
function loadVerificationTraces(
  tracesDir: string
): VerificationTraces | undefined {
  const resolvedPath = resolve(tracesDir);
  if (!existsSync(resolvedPath)) {
    return undefined;
  }

  // Look for trace files (e.g., verification-traces.json)
  const traceFile = resolve(resolvedPath, 'verification-traces.json');
  if (!existsSync(traceFile)) {
    return undefined;
  }

  try {
    const content = readFileSync(traceFile, 'utf-8');
    const data = JSON.parse(content);

    const behaviors = new Map<string, BehaviorTrace>();

    if (Array.isArray(data.behaviors)) {
      for (const behavior of data.behaviors) {
        const key = behavior.domain && behavior.name
          ? `${behavior.domain}.${behavior.name}`
          : behavior.behavior;
        if (key) {
          behaviors.set(key, {
            exerciseCount: behavior.exerciseCount || 0,
            preconditions: behavior.preconditions,
            postconditions: behavior.postconditions,
            invariants: behavior.invariants,
          });
        }
      }
    }

    return behaviors.size > 0 ? { behaviors } : undefined;
  } catch {
    return undefined;
  }
}
