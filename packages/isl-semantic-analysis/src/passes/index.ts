/**
 * Semantic Analysis Passes
 * 
 * Collection of semantic analysis passes that run after parsing and type checking.
 * Each pass implements specific semantic checks with proper diagnostic reporting.
 * 
 * Pipeline Order (by priority):
 * 1. import-graph (100) - Import resolution and cycle detection
 * 2. symbol-resolver (95) - Symbol table and name resolution  
 * 3. type-coherence (90) - Type checking and inference
 * 4. purity-constraints (85) - Side-effect and purity analysis
 * 5. unreachable-clauses (80) - Control flow and reachability
 * 6. enhanced-consistency-checker (75) - Contract completeness
 * 7. exhaustiveness (70) - Pattern coverage
 * 8. redundant-conditions (65) - Optimization hints
 */

import type { SemanticPass } from '../types.js';

// ============================================================================
// Pass Exports
// ============================================================================

// Core passes
export { symbolResolverPass, SymbolResolverPass } from './symbol-resolver.js';
export { SymbolTable, type Symbol, type ResolverSymbolKind, type SymbolTableOptions, BUILTIN_TYPES, BUILTIN_GENERICS } from './symbol-table.js';

// New passes (8-pass pipeline)
export { 
  importGraphPass, 
  ImportGraphPass,
  buildImportGraph,
  getProcessingOrder,
  type ImportGraphResult,
} from './import-graph.js';
export { 
  purityConstraintsPass, 
  PurityConstraintsPass,
  _internals as purityInternals,
} from './purity-constraints.js';
export { 
  exhaustivenessPass, 
  ExhaustivenessPass,
  _internals as exhaustivenessInternals,
} from './exhaustiveness.js';

// Existing passes
export { unreachableClausesPass, UnreachableClausesPass } from './unreachable-clauses.js';
export { unsatisfiablePreconditionsPass, UnsatisfiablePreconditionsPass } from './unsatisfiable-preconditions.js';
export { unusedSymbolsPass, UnusedSymbolsPass } from './unused-symbols.js';
export { intentCoherencePass, IntentCoherencePass } from './intent-coherence.js';
export { typeCoherencePass, TypeCoherencePass } from './type-coherence.js';
export { redundantConditionsPass, RedundantConditionsPass } from './redundant-conditions.js';
export { cyclicDependenciesPass, CyclicDependenciesPass } from './cyclic-dependencies.js';
export { 
  enhancedConsistencyCheckerPass, 
  EnhancedConsistencyCheckerPass,
  _internals as enhancedConsistencyInternals,
} from './enhanced-consistency-checker.js';

// ============================================================================
// Internal Imports for Registration
// ============================================================================

import { importGraphPass } from './import-graph.js';
import { purityConstraintsPass } from './purity-constraints.js';
import { exhaustivenessPass } from './exhaustiveness.js';
import { unreachableClausesPass } from './unreachable-clauses.js';
import { unsatisfiablePreconditionsPass } from './unsatisfiable-preconditions.js';
import { unusedSymbolsPass } from './unused-symbols.js';
import { intentCoherencePass } from './intent-coherence.js';
import { typeCoherencePass } from './type-coherence.js';
import { redundantConditionsPass } from './redundant-conditions.js';
import { cyclicDependenciesPass } from './cyclic-dependencies.js';
import { enhancedConsistencyCheckerPass } from './enhanced-consistency-checker.js';

// ============================================================================
// Legacy Framework Support
// ============================================================================

export { symbolResolverPass as LegacySymbolResolverPass } from './symbol-resolver.js';
import type { SemanticPass as LegacySemanticPass } from '../framework.js';
import { symbolResolverPass } from './symbol-resolver.js';

/**
 * Built-in passes using the simple framework (Domain -> Diagnostic[])
 * Kept for backwards compatibility
 */
export const frameworkPasses: LegacySemanticPass[] = [
  symbolResolverPass,
];

/**
 * Get a framework pass by ID (legacy)
 */
export function getFrameworkPassById(id: string): LegacySemanticPass | undefined {
  return frameworkPasses.find(p => p.id === id);
}

// ============================================================================
// 8-Pass Semantic Analysis Pipeline
// ============================================================================

/**
 * All built-in semantic passes using the new PassRunner framework.
 * 
 * Pipeline execution order (by priority, highest first):
 * 
 * Pass 1: import-graph (100)
 *   - Builds import dependency graph
 *   - Detects circular imports
 *   - Determines processing order
 * 
 * Pass 2: type-coherence (90) [was symbol-resolver]
 *   - Type checking and constraint validation
 *   - Generic type parameter resolution
 * 
 * Pass 3: purity-constraints (85)
 *   - Side-effect detection in preconditions
 *   - old()/result usage validation
 *   - Pure vs impure expression marking
 * 
 * Pass 4: unreachable-clauses (80)
 *   - Control flow analysis
 *   - Unreachable code detection
 *   - Guard contradiction detection
 * 
 * Pass 5: enhanced-consistency-checker (75)
 *   - Contract completeness
 *   - Pre/post condition consistency
 *   - Unused input/output detection
 * 
 * Pass 6: exhaustiveness (70)
 *   - Enum variant coverage
 *   - Error handler completeness
 *   - Pattern matching exhaustiveness
 * 
 * Pass 7: redundant-conditions (65) [+ optimization-hints]
 *   - Tautological conditions
 *   - Duplicate conditions
 *   - Constant folding candidates
 * 
 * Pass 8: cyclic-dependencies (40)
 *   - Entity/behavior cycle detection
 *   - Deep nesting warnings
 */
export const builtinPasses: SemanticPass[] = [
  // Pass 1: Import Graph (Priority 100)
  importGraphPass,
  
  // Pass 2: Type Coherence (Priority 90)
  typeCoherencePass,
  
  // Pass 3: Purity Constraints (Priority 85)
  purityConstraintsPass,
  
  // Pass 4: Control Flow / Reachability (Priority 80)
  unreachableClausesPass,
  unsatisfiablePreconditionsPass,  // depends on unreachable-clauses
  
  // Pass 5: Contract Completeness (Priority 75)
  enhancedConsistencyCheckerPass,
  unusedSymbolsPass,
  
  // Pass 6: Exhaustiveness (Priority 70)
  exhaustivenessPass,
  intentCoherencePass,
  
  // Pass 7: Optimization Hints (Priority 65)
  redundantConditionsPass,
  
  // Pass 8: Dependency Analysis (Priority 40)
  cyclicDependenciesPass,
];

/**
 * Core passes for the 8-pass pipeline (one per pass category)
 */
export const corePasses: SemanticPass[] = [
  importGraphPass,           // Pass 1
  typeCoherencePass,         // Pass 2/3
  purityConstraintsPass,     // Pass 4
  unreachableClausesPass,    // Pass 5
  enhancedConsistencyCheckerPass, // Pass 6
  exhaustivenessPass,        // Pass 7
  redundantConditionsPass,   // Pass 8
  cyclicDependenciesPass,    // Pass 8 (supplementary)
];

/**
 * Get all builtin pass IDs
 */
export function getBuiltinPassIds(): string[] {
  return builtinPasses.map(p => p.id);
}

/**
 * Get a builtin pass by ID
 */
export function getBuiltinPass(id: string): SemanticPass | undefined {
  return builtinPasses.find(p => p.id === id);
}

/**
 * Get passes by severity level (passes that emit a specific severity)
 */
export function getPassesBySeverity(severity: 'error' | 'warning' | 'hint'): SemanticPass[] {
  const errorPasses = [
    'import-graph',
    'purity-constraints', 
    'unreachable-clauses', 
    'unsatisfiable-preconditions', 
    'type-coherence', 
    'enhanced-consistency-checker',
  ];
  const warningPasses = [
    'unused-symbols', 
    'redundant-conditions', 
    'enhanced-consistency-checker',
    'purity-constraints',
    'exhaustiveness',
  ];
  const hintPasses = [
    'intent-coherence', 
    'cyclic-dependencies',
    'exhaustiveness',
    'redundant-conditions',
  ];
  
  const passIds = severity === 'error' ? errorPasses :
                  severity === 'warning' ? warningPasses : hintPasses;
  
  return builtinPasses.filter(p => passIds.includes(p.id));
}

/**
 * Get passes by pipeline phase
 */
export function getPassesByPhase(phase: number): SemanticPass[] {
  const phaseMap: Record<number, string[]> = {
    1: ['import-graph'],
    2: ['type-coherence'],
    3: ['purity-constraints'],
    4: ['unreachable-clauses', 'unsatisfiable-preconditions'],
    5: ['enhanced-consistency-checker', 'unused-symbols'],
    6: ['exhaustiveness', 'intent-coherence'],
    7: ['redundant-conditions'],
    8: ['cyclic-dependencies'],
  };
  
  const passIds = phaseMap[phase] || [];
  return builtinPasses.filter(p => passIds.includes(p.id));
}
