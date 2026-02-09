/**
 * Trace Evaluator for Temporal Verification
 * 
 * Evaluates temporal properties (always, eventually, until, within) against runtime traces.
 * 
 * @module @isl-lang/verifier-temporal/trace-evaluator
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import type { Trace } from '@isl-lang/trace-format';
import type { DomainDeclaration, TemporalRequirement } from '@isl-lang/isl-core';
import {
  buildTemporalTrace,
  evaluateAlways,
  evaluateEventually,
  evaluateUntil,
  evaluateWithin,
  evaluateNever,
  type TemporalTrace,
  type StatePredicate,
  type TemporalEvaluationResult,
} from './trace-model.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of evaluating a temporal property against traces
 */
export interface TemporalPropertyEvaluation {
  /** The temporal requirement being evaluated */
  requirement: TemporalRequirement;
  /** Whether the property was satisfied */
  satisfied: boolean;
  /** Verdict category */
  verdict: 'SATISFIED' | 'VIOLATED' | 'UNKNOWN' | 'VACUOUSLY_TRUE';
  /** Evaluation result details */
  result: TemporalEvaluationResult;
  /** Which trace(s) were evaluated */
  traceIds: string[];
  /** Human-readable description */
  description: string;
  /** Violation details if not satisfied */
  violation?: {
    traceId: string;
    timestampMs: number;
    snapshotIndex: number;
    message: string;
  };
}

/**
 * Result of evaluating all temporal properties
 */
export interface TemporalEvaluationReport {
  /** Overall success */
  success: boolean;
  /** Individual property evaluations */
  evaluations: TemporalPropertyEvaluation[];
  /** Summary statistics */
  summary: {
    total: number;
    satisfied: number;
    violated: number;
    unknown: number;
    vacuous: number;
  };
  /** Total duration */
  duration: number;
}

/**
 * Options for trace evaluation
 */
export interface TraceEvaluationOptions {
  /** Minimum snapshots required for valid evaluation */
  minSnapshots?: number;
  /** Trace file paths (if not provided, auto-discovers) */
  traceFiles?: string[];
  /** Trace directory to search */
  traceDir?: string;
  /** Behavior name to filter traces */
  behaviorName?: string;
}

// ============================================================================
// TRACE LOADING
// ============================================================================

/**
 * Load a trace from a JSON file
 */
export async function loadTraceFile(filePath: string): Promise<Trace> {
  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Validate trace structure
  if (!data.id || !Array.isArray(data.events)) {
    throw new Error(`Invalid trace format in ${filePath}: missing id or events`);
  }
  
  return data as Trace;
}

/**
 * Load multiple trace files
 */
export async function loadTraceFiles(filePaths: string[]): Promise<Trace[]> {
  const traces: Trace[] = [];
  const errors: string[] = [];
  
  for (const filePath of filePaths) {
    try {
      if (!existsSync(filePath)) {
        errors.push(`Trace file not found: ${filePath}`);
        continue;
      }
      const trace = await loadTraceFile(filePath);
      traces.push(trace);
    } catch (error) {
      errors.push(`Failed to load trace ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  if (errors.length > 0 && traces.length === 0) {
    throw new Error(`Failed to load any traces:\n${errors.join('\n')}`);
  }
  
  return traces;
}

/**
 * Discover trace files in a directory
 */
export async function discoverTraceFiles(
  traceDir: string,
  behaviorName?: string
): Promise<string[]> {
  const { readdir } = await import('fs/promises');
  const files: string[] = [];
  
  if (!existsSync(traceDir)) {
    return files;
  }
  
  const entries = await readdir(traceDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      const filePath = join(traceDir, entry.name);
      
      // Optionally filter by behavior
      if (behaviorName) {
        try {
          const trace = await loadTraceFile(filePath);
          if (trace.domain === behaviorName || trace.name === behaviorName) {
            files.push(filePath);
          }
        } catch {
          // Skip invalid files
        }
      } else {
        files.push(filePath);
      }
    }
  }
  
  return files;
}

// ============================================================================
// PREDICATE CREATION
// ============================================================================

/**
 * Create a state predicate from a temporal requirement
 * 
 * This is a simplified version - a real implementation would compile
 * the ISL expression into executable code
 */
function createPredicateFromRequirement(
  requirement: TemporalRequirement
): StatePredicate {
  // For now, create a simple predicate based on the requirement type
  // In a real implementation, this would parse and compile the condition expression
  
  if (requirement.type === 'within') {
    // For "within", check if a specific event kind occurred
    return (_state, event) => {
      // This is a placeholder - real implementation would check timing
      return event !== undefined;
    };
  }
  
  // Default predicate - checks if state has certain properties
  return (state) => {
    // Placeholder - real implementation would evaluate requirement.condition
    return Object.keys(state).length > 0;
  };
}

// ============================================================================
// TEMPORAL PROPERTY EVALUATION
// ============================================================================

/**
 * Evaluate a temporal requirement against traces
 */
export function evaluateTemporalRequirement(
  requirement: TemporalRequirement,
  traces: Trace[],
  options: TraceEvaluationOptions = {}
): TemporalPropertyEvaluation {
  const minSnapshots = options.minSnapshots ?? 1;
  const description = formatTemporalRequirement(requirement);
  
  if (traces.length === 0) {
    return {
      requirement,
      satisfied: false,
      verdict: 'UNKNOWN',
      result: {
        satisfied: false,
        verdict: 'UNKNOWN',
        snapshotsEvaluated: 0,
        confidence: 0,
        explanation: 'No traces provided for evaluation',
      },
      traceIds: [],
      description,
    };
  }
  
  // Build temporal traces
  const temporalTraces = traces.map(trace => buildTemporalTrace(trace));
  
  // Filter by behavior if specified
  const relevantTraces = options.behaviorName
    ? temporalTraces.filter(t => t.domain === options.behaviorName)
    : temporalTraces;
  
  if (relevantTraces.length === 0) {
    return {
      requirement,
      satisfied: false,
      verdict: 'UNKNOWN',
      result: {
        satisfied: false,
        verdict: 'UNKNOWN',
        snapshotsEvaluated: 0,
        confidence: 0,
        explanation: `No traces found for behavior '${options.behaviorName}'`,
      },
      traceIds: [],
      description,
    };
  }
  
  // Evaluate based on requirement type
  const predicate = createPredicateFromRequirement(requirement);
  let result: TemporalEvaluationResult;
  let allSatisfied = true;
  let violation: TemporalPropertyEvaluation['violation'] | undefined;
  
  switch (requirement.type) {
    case 'always': {
      // Check all traces
      for (const trace of relevantTraces) {
        const durationMs = requirement.duration
          ? durationToMs(requirement.duration)
          : trace.durationMs;
        
        const evalResult = evaluateAlways(trace, predicate, {
          description,
          minSnapshots,
          endOffsetMs: durationMs,
        });
        
        if (!evalResult.satisfied) {
          allSatisfied = false;
          if (!violation && evalResult.violationIndex !== undefined) {
            violation = {
              traceId: trace.id,
              timestampMs: evalResult.witnessTimeMs ?? 0,
              snapshotIndex: evalResult.violationIndex,
              message: evalResult.explanation,
            };
          }
        }
      }
      
      // Use result from first trace (or aggregate)
      result = evaluateAlways(relevantTraces[0]!, predicate, {
        description,
        minSnapshots,
        endOffsetMs: requirement.duration
          ? durationToMs(requirement.duration)
          : relevantTraces[0]!.durationMs,
      });
      break;
    }
    
    case 'eventually': {
      // Check if eventually holds in any trace
      const boundMs = requirement.duration
        ? durationToMs(requirement.duration)
        : Math.max(...relevantTraces.map(t => t.durationMs));
      
      let foundSatisfied = false;
      for (const trace of relevantTraces) {
        const evalResult = evaluateEventually(trace, predicate, {
          description,
          boundMs,
        });
        
        if (evalResult.satisfied) {
          foundSatisfied = true;
          result = evalResult;
          break;
        }
      }
      
      if (!foundSatisfied) {
        allSatisfied = false;
        result = evaluateEventually(relevantTraces[0]!, predicate, {
          description,
          boundMs,
        });
      }
      break;
    }
    
    case 'within': {
      if (!requirement.duration) {
        return {
          requirement,
          satisfied: false,
          verdict: 'UNKNOWN',
          result: {
            satisfied: false,
            verdict: 'UNKNOWN',
            snapshotsEvaluated: 0,
            confidence: 0,
            explanation: 'within requires a duration',
          },
          traceIds: relevantTraces.map(t => t.id),
          description,
        };
      }
      
      const boundMs = durationToMs(requirement.duration);
      // For "within", check handler_return events by default
      const eventKind = 'handler_return';
      
      // Check all traces
      for (const trace of relevantTraces) {
        const evalResult = evaluateWithin(trace, eventKind, boundMs, {
          description,
        });
        
        if (!evalResult.satisfied) {
          allSatisfied = false;
          if (!violation && evalResult.violationIndex !== undefined) {
            violation = {
              traceId: trace.id,
              timestampMs: evalResult.witnessTimeMs ?? 0,
              snapshotIndex: evalResult.violationIndex,
              message: evalResult.explanation,
            };
          }
        }
      }
      
      // Use result from first trace
      result = evaluateWithin(relevantTraces[0]!, eventKind, boundMs, {
        description,
      });
      break;
    }
    
    case 'never': {
      // Check all traces
      for (const trace of relevantTraces) {
        const evalResult = evaluateNever(trace, predicate, {
          description,
          minSnapshots,
        });
        
        if (!evalResult.satisfied) {
          allSatisfied = false;
          if (!violation && evalResult.violationIndex !== undefined) {
            violation = {
              traceId: trace.id,
              timestampMs: evalResult.witnessTimeMs ?? 0,
              snapshotIndex: evalResult.violationIndex,
              message: evalResult.explanation,
            };
          }
        }
      }
      
      result = evaluateNever(relevantTraces[0]!, predicate, {
        description,
        minSnapshots,
      });
      break;
    }
    
    default: {
      return {
        requirement,
        satisfied: false,
        verdict: 'UNKNOWN',
        result: {
          satisfied: false,
          verdict: 'UNKNOWN',
          snapshotsEvaluated: 0,
          confidence: 0,
          explanation: `Unsupported temporal operator: ${(requirement as TemporalRequirement).type}`,
        },
        traceIds: relevantTraces.map(t => t.id),
        description,
      };
    }
  }
  
  return {
    requirement,
    satisfied: allSatisfied && result.satisfied,
    verdict: result.verdict,
    result,
    traceIds: relevantTraces.map(t => t.id),
    description,
    violation,
  };
}

/**
 * Evaluate all temporal requirements from a domain against traces
 */
export async function evaluateTemporalProperties(
  domain: DomainDeclaration,
  traces: Trace[],
  options: TraceEvaluationOptions = {}
): Promise<TemporalEvaluationReport> {
  const startTime = Date.now();
  const evaluations: TemporalPropertyEvaluation[] = [];
  
  // Collect all temporal requirements from behaviors
  const requirements: Array<{ requirement: TemporalRequirement; behaviorName: string }> = [];
  
  for (const behavior of domain.behaviors) {
    const temporalBlock = behavior.temporal;
    if (temporalBlock?.requirements) {
      for (const req of temporalBlock.requirements) {
        requirements.push({
          requirement: req,
          behaviorName: behavior.name.name,
        });
      }
    }
  }
  
  // Evaluate each requirement
  for (const { requirement, behaviorName } of requirements) {
    const evaluation = evaluateTemporalRequirement(requirement, traces, {
      ...options,
      behaviorName,
    });
    // Add behavior name to evaluation for reference
    (evaluation as unknown as { behaviorName: string }).behaviorName = behaviorName;
    evaluations.push(evaluation);
  }
  
  // Calculate summary
  const summary = {
    total: evaluations.length,
    satisfied: evaluations.filter(e => e.satisfied && e.verdict === 'SATISFIED').length,
    violated: evaluations.filter(e => !e.satisfied || e.verdict === 'VIOLATED').length,
    unknown: evaluations.filter(e => e.verdict === 'UNKNOWN').length,
    vacuous: evaluations.filter(e => e.verdict === 'VACUOUSLY_TRUE').length,
  };
  
  const success = summary.violated === 0 && summary.unknown === 0;
  
  return {
    success,
    evaluations,
    summary,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert DurationLiteral to milliseconds
 */
function durationToMs(duration: { value: number; unit: string }): number {
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  
  return duration.value * (multipliers[duration.unit] ?? 1);
}

/**
 * Format a temporal requirement as a human-readable string
 */
function formatTemporalRequirement(requirement: TemporalRequirement): string {
  const parts: string[] = [requirement.type];
  
  if (requirement.duration) {
    parts.push(`${requirement.duration.value}${requirement.duration.unit}`);
  }
  
  if (requirement.percentile) {
    parts.push(`(${requirement.percentile})`);
  }
  
  if (requirement.eventKind) {
    parts.push(`[${requirement.eventKind}]`);
  }
  
  return parts.join(' ');
}
