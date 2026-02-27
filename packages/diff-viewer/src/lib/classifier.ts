// ============================================================================
// Change Classifier
// Classifies and categorizes ISL specification changes
// ============================================================================

import type { SemanticChange, SemanticChangeType, BreakingChangeLevel } from '../types';

/**
 * Categories for grouping changes
 */
export type ChangeCategory =
  | 'schema'
  | 'behavior'
  | 'contract'
  | 'policy'
  | 'documentation';

export interface ClassifiedChange extends SemanticChange {
  category: ChangeCategory;
  impact: string;
  affectedComponents: string[];
}

export interface ChangeClassification {
  categories: Map<ChangeCategory, ClassifiedChange[]>;
  breakingChanges: ClassifiedChange[];
  warnings: ClassifiedChange[];
  safeChanges: ClassifiedChange[];
  summary: ClassificationSummary;
}

export interface ClassificationSummary {
  totalChanges: number;
  byCategory: Record<ChangeCategory, number>;
  byLevel: Record<BreakingChangeLevel, number>;
  riskScore: number; // 0-100
}

/**
 * Map change types to categories
 */
const CHANGE_TYPE_CATEGORIES: Record<SemanticChangeType, ChangeCategory> = {
  // Domain level
  domain_version_changed: 'documentation',
  domain_renamed: 'schema',

  // Types
  type_added: 'schema',
  type_removed: 'schema',
  type_renamed: 'schema',
  type_constraint_added: 'contract',
  type_constraint_removed: 'contract',
  type_constraint_modified: 'contract',

  // Entities
  entity_added: 'schema',
  entity_removed: 'schema',
  entity_renamed: 'schema',
  field_added: 'schema',
  field_removed: 'schema',
  field_renamed: 'schema',
  field_type_changed: 'schema',
  field_made_optional: 'schema',
  field_made_required: 'schema',
  field_annotation_added: 'schema',
  field_annotation_removed: 'schema',
  invariant_added: 'contract',
  invariant_removed: 'contract',
  invariant_modified: 'contract',

  // Behaviors
  behavior_added: 'behavior',
  behavior_removed: 'behavior',
  behavior_renamed: 'behavior',
  input_field_added: 'behavior',
  input_field_removed: 'behavior',
  input_field_type_changed: 'behavior',
  output_type_changed: 'behavior',
  error_added: 'behavior',
  error_removed: 'behavior',
  precondition_added: 'contract',
  precondition_removed: 'contract',
  precondition_modified: 'contract',
  postcondition_added: 'contract',
  postcondition_removed: 'contract',
  postcondition_modified: 'contract',
  temporal_spec_added: 'contract',
  temporal_spec_removed: 'contract',
  temporal_spec_modified: 'contract',
  security_spec_added: 'policy',
  security_spec_removed: 'policy',

  // Scenarios
  scenario_added: 'documentation',
  scenario_removed: 'documentation',
  scenario_modified: 'documentation',

  // Policies
  policy_added: 'policy',
  policy_removed: 'policy',
  policy_modified: 'policy',
};

/**
 * Impact descriptions for each change type
 */
const CHANGE_TYPE_IMPACTS: Record<SemanticChangeType, string> = {
  domain_version_changed: 'Documentation update only',
  domain_renamed: 'Major namespace change, affects all imports',

  type_added: 'New type available for use',
  type_removed: 'Type no longer available, update all usages',
  type_renamed: 'Type name changed, update all references',
  type_constraint_added: 'New validation rules apply to existing data',
  type_constraint_removed: 'Validation relaxed, previously invalid data may now be valid',
  type_constraint_modified: 'Validation rules changed, verify existing data compliance',

  entity_added: 'New entity available',
  entity_removed: 'Entity no longer exists, remove all references',
  entity_renamed: 'Entity name changed, update all references',
  field_added: 'New field available on entity',
  field_removed: 'Field no longer exists, remove all usages',
  field_renamed: 'Field name changed, update all references',
  field_type_changed: 'Field type changed, data migration required',
  field_made_optional: 'Field now nullable, update null checks',
  field_made_required: 'Field now required, backfill existing records',
  field_annotation_added: 'New metadata on field',
  field_annotation_removed: 'Metadata removed from field',
  invariant_added: 'New constraint must be satisfied',
  invariant_removed: 'Constraint relaxed',
  invariant_modified: 'Constraint rules changed',

  behavior_added: 'New API endpoint available',
  behavior_removed: 'API endpoint removed',
  behavior_renamed: 'API endpoint renamed, update clients',
  input_field_added: 'New input field on API',
  input_field_removed: 'Input field removed from API',
  input_field_type_changed: 'Input field type changed',
  output_type_changed: 'API response type changed',
  error_added: 'New error type may be returned',
  error_removed: 'Error type no longer returned',
  precondition_added: 'New validation on requests',
  precondition_removed: 'Validation relaxed on requests',
  precondition_modified: 'Request validation changed',
  postcondition_added: 'New guarantee on responses',
  postcondition_removed: 'Guarantee removed from responses',
  postcondition_modified: 'Response guarantee changed',
  temporal_spec_added: 'New timing requirement',
  temporal_spec_removed: 'Timing requirement removed',
  temporal_spec_modified: 'Timing requirement changed',
  security_spec_added: 'New security requirement',
  security_spec_removed: 'Security requirement removed',

  scenario_added: 'New test scenario',
  scenario_removed: 'Test scenario removed',
  scenario_modified: 'Test scenario updated',

  policy_added: 'New policy in effect',
  policy_removed: 'Policy removed',
  policy_modified: 'Policy rules changed',
};

/**
 * Get affected components for a change type
 */
function getAffectedComponents(change: SemanticChange): string[] {
  const components: string[] = [];
  const type = change.type;

  // Schema changes affect database and data layer
  if (type.startsWith('entity_') || type.startsWith('field_') || type.startsWith('type_')) {
    components.push('database', 'data-layer', 'models');
  }

  // Behavior changes affect API and clients
  if (type.startsWith('behavior_') || type.startsWith('input_') || type.startsWith('output_') || type.startsWith('error_')) {
    components.push('api', 'clients', 'controllers');
  }

  // Contract changes affect validation
  if (type.includes('condition') || type.includes('invariant') || type.includes('constraint')) {
    components.push('validation', 'business-logic');
  }

  // Security changes
  if (type.startsWith('security_')) {
    components.push('security', 'middleware', 'authentication');
  }

  // Temporal changes
  if (type.startsWith('temporal_')) {
    components.push('monitoring', 'slo', 'alerts');
  }

  return [...new Set(components)];
}

/**
 * Classify a semantic change
 */
export function classifyChange(change: SemanticChange): ClassifiedChange {
  const category = CHANGE_TYPE_CATEGORIES[change.type] || 'documentation';
  const impact = CHANGE_TYPE_IMPACTS[change.type] || 'Unknown impact';
  const affectedComponents = getAffectedComponents(change);

  return {
    ...change,
    category,
    impact,
    affectedComponents,
  };
}

/**
 * Classify all changes
 */
export function classifyAllChanges(changes: SemanticChange[]): ChangeClassification {
  const classified = changes.map(classifyChange);

  // Group by category
  const categories = new Map<ChangeCategory, ClassifiedChange[]>();
  for (const change of classified) {
    const existing = categories.get(change.category) || [];
    existing.push(change);
    categories.set(change.category, existing);
  }

  // Group by breaking level
  const breakingChanges = classified.filter((c) => c.breakingLevel === 'breaking');
  const warnings = classified.filter((c) => c.breakingLevel === 'warning');
  const safeChanges = classified.filter((c) => c.breakingLevel === 'safe');

  // Calculate summary
  const byCategory: Record<ChangeCategory, number> = {
    schema: 0,
    behavior: 0,
    contract: 0,
    policy: 0,
    documentation: 0,
  };
  for (const [cat, changes] of categories) {
    byCategory[cat] = changes.length;
  }

  const byLevel: Record<BreakingChangeLevel, number> = {
    breaking: breakingChanges.length,
    warning: warnings.length,
    safe: safeChanges.length,
  };

  // Calculate risk score (0-100)
  const riskScore = calculateRiskScore(classified);

  return {
    categories,
    breakingChanges,
    warnings,
    safeChanges,
    summary: {
      totalChanges: changes.length,
      byCategory,
      byLevel,
      riskScore,
    },
  };
}

/**
 * Calculate risk score based on changes
 */
function calculateRiskScore(changes: ClassifiedChange[]): number {
  if (changes.length === 0) return 0;

  let score = 0;

  for (const change of changes) {
    // Base score by breaking level
    switch (change.breakingLevel) {
      case 'breaking':
        score += 30;
        break;
      case 'warning':
        score += 10;
        break;
      case 'safe':
        score += 2;
        break;
    }

    // Additional weight by category
    switch (change.category) {
      case 'schema':
        score += 5; // Schema changes are risky
        break;
      case 'behavior':
        score += 3; // API changes affect clients
        break;
      case 'policy':
        score += 4; // Security/policy changes need review
        break;
    }

    // Additional weight for certain types
    if (change.type === 'entity_removed') score += 20;
    if (change.type === 'behavior_removed') score += 15;
    if (change.type === 'field_type_changed') score += 10;
  }

  // Normalize to 0-100
  return Math.min(100, score);
}

/**
 * Get human-readable label for a change category
 */
export function getCategoryLabel(category: ChangeCategory): string {
  const labels: Record<ChangeCategory, string> = {
    schema: 'Schema Changes',
    behavior: 'API Changes',
    contract: 'Contract Changes',
    policy: 'Policy Changes',
    documentation: 'Documentation',
  };
  return labels[category];
}

/**
 * Get human-readable label for breaking level
 */
export function getBreakingLevelLabel(level: BreakingChangeLevel): string {
  const labels: Record<BreakingChangeLevel, string> = {
    breaking: 'Breaking Change',
    warning: 'Warning',
    safe: 'Safe Change',
  };
  return labels[level];
}

/**
 * Get color class for breaking level
 */
export function getBreakingLevelColor(level: BreakingChangeLevel): string {
  const colors: Record<BreakingChangeLevel, string> = {
    breaking: 'text-red-600 bg-red-50 border-red-200',
    warning: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    safe: 'text-green-600 bg-green-50 border-green-200',
  };
  return colors[level];
}
