/**
 * Semantic Analysis Passes
 * 
 * Collection of semantic analysis passes that run after parsing and type checking.
 * Each pass implements specific semantic checks with proper diagnostic reporting.
 */

import type { SemanticPass } from '../types.js';

// Pass exports
export { symbolResolverPass, SymbolResolverPass } from './symbol-resolver.js';
export { SymbolTable, type Symbol, type ResolverSymbolKind, type SymbolTableOptions, BUILTIN_TYPES, BUILTIN_GENERICS } from './symbol-table.js';
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

// Import passes for registration
import { unreachableClausesPass } from './unreachable-clauses.js';
import { unsatisfiablePreconditionsPass } from './unsatisfiable-preconditions.js';
import { unusedSymbolsPass } from './unused-symbols.js';
import { intentCoherencePass } from './intent-coherence.js';
import { typeCoherencePass } from './type-coherence.js';
import { redundantConditionsPass } from './redundant-conditions.js';
import { cyclicDependenciesPass } from './cyclic-dependencies.js';
import { enhancedConsistencyCheckerPass } from './enhanced-consistency-checker.js';

// Legacy framework support
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

/**
 * All built-in semantic passes using the new PassRunner framework.
 * Ordered by priority and dependencies.
 */
export const builtinPasses: SemanticPass[] = [
  unreachableClausesPass,      // Priority 100 - runs first
  unusedSymbolsPass,           // Priority 90
  enhancedConsistencyCheckerPass, // Priority 85 - contradictory preconditions, unused symbols, metadata
  unsatisfiablePreconditionsPass, // Priority 80, depends on unreachable-clauses
  intentCoherencePass,         // Priority 70
  typeCoherencePass,           // Priority 60
  redundantConditionsPass,     // Priority 50
  cyclicDependenciesPass,      // Priority 40
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
  const errorPasses = ['unreachable-clauses', 'unsatisfiable-preconditions', 'type-coherence', 'enhanced-consistency-checker'];
  const warningPasses = ['unused-symbols', 'redundant-conditions', 'enhanced-consistency-checker'];
  const hintPasses = ['intent-coherence', 'cyclic-dependencies'];
  
  const passIds = severity === 'error' ? errorPasses :
                  severity === 'warning' ? warningPasses : hintPasses;
  
  return builtinPasses.filter(p => passIds.includes(p.id));
}
