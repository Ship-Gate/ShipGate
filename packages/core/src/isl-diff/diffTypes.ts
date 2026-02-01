/**
 * ISL Diff Types
 *
 * Types for representing differences between two ISL ASTs.
 * All diff operations are deterministic (sorted by name for stable output).
 */

// ============================================================================
// CHANGE TYPES
// ============================================================================

/**
 * Type of change detected
 */
export type ChangeType = 'added' | 'removed' | 'changed';

/**
 * Severity of a change for impact analysis
 */
export type ChangeSeverity = 'breaking' | 'compatible' | 'patch';

// ============================================================================
// FIELD CHANGES
// ============================================================================

/**
 * A change to a single field
 */
export interface FieldChange {
  name: string;
  change: ChangeType;
  oldType?: string;
  newType?: string;
  oldOptional?: boolean;
  newOptional?: boolean;
  oldAnnotations?: string[];
  newAnnotations?: string[];
}

// ============================================================================
// CLAUSE CHANGES
// ============================================================================

/**
 * A change to a clause (precondition, postcondition, invariant)
 */
export interface ClauseChange {
  /** Type of clause */
  clauseType: 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'security';
  /** Type of change */
  change: ChangeType;
  /** Original expression (for removed/changed) */
  oldExpression?: string;
  /** New expression (for added/changed) */
  newExpression?: string;
  /** Index in the clause array (for stable identification) */
  index?: number;
}

// ============================================================================
// ERROR SPEC CHANGES
// ============================================================================

/**
 * A change to an error specification
 */
export interface ErrorChange {
  name: string;
  change: ChangeType;
  oldWhen?: string;
  newWhen?: string;
  oldRetriable?: boolean;
  newRetriable?: boolean;
}

// ============================================================================
// ENTITY CHANGES
// ============================================================================

/**
 * Changes to a single entity
 */
export interface EntityDiff {
  name: string;
  change: ChangeType;
  severity: ChangeSeverity;
  fieldChanges: FieldChange[];
  invariantChanges: ClauseChange[];
  lifecycleChanged: boolean;
}

// ============================================================================
// BEHAVIOR CHANGES
// ============================================================================

/**
 * Changes to input specification
 */
export interface InputDiff {
  changed: boolean;
  fieldChanges: FieldChange[];
}

/**
 * Changes to output specification
 */
export interface OutputDiff {
  changed: boolean;
  successTypeChanged: boolean;
  oldSuccessType?: string;
  newSuccessType?: string;
  errorChanges: ErrorChange[];
}

/**
 * Changes to a single behavior
 */
export interface BehaviorDiff {
  name: string;
  change: ChangeType;
  severity: ChangeSeverity;
  descriptionChanged: boolean;
  inputDiff: InputDiff;
  outputDiff: OutputDiff;
  preconditionChanges: ClauseChange[];
  postconditionChanges: ClauseChange[];
  invariantChanges: ClauseChange[];
  temporalChanges: ClauseChange[];
  securityChanges: ClauseChange[];
}

// ============================================================================
// TYPE CHANGES
// ============================================================================

/**
 * Changes to a type declaration
 */
export interface TypeDiff {
  name: string;
  change: ChangeType;
  severity: ChangeSeverity;
  definitionChanged: boolean;
  oldDefinition?: string;
  newDefinition?: string;
}

// ============================================================================
// DOMAIN DIFF
// ============================================================================

/**
 * Summary statistics for a diff
 */
export interface DiffSummary {
  totalChanges: number;
  entitiesAdded: number;
  entitiesRemoved: number;
  entitiesChanged: number;
  behaviorsAdded: number;
  behaviorsRemoved: number;
  behaviorsChanged: number;
  typesAdded: number;
  typesRemoved: number;
  typesChanged: number;
  breakingChanges: number;
  compatibleChanges: number;
  patchChanges: number;
}

/**
 * Complete diff between two domains
 */
export interface DomainDiff {
  /** Name of the domain */
  domainName: string;
  /** Version changes */
  versionChange?: {
    oldVersion: string;
    newVersion: string;
  };
  /** Entity changes (sorted by name) */
  entityDiffs: EntityDiff[];
  /** Behavior changes (sorted by name) */
  behaviorDiffs: BehaviorDiff[];
  /** Type changes (sorted by name) */
  typeDiffs: TypeDiff[];
  /** Summary statistics */
  summary: DiffSummary;
  /** Whether the diff is empty (no changes) */
  isEmpty: boolean;
}

// ============================================================================
// DIFF OPTIONS
// ============================================================================

/**
 * Options for diff calculation
 */
export interface DiffOptions {
  /** Include location information in output */
  includeLocations?: boolean;
  /** Ignore whitespace in expression comparisons */
  ignoreWhitespace?: boolean;
  /** Treat field reordering as a change */
  detectFieldReordering?: boolean;
}
