/**
 * Suggestion Generator
 * 
 * Generates improvement suggestions based on analysis results.
 */

import type { DomainDeclaration, BehaviorDeclaration, EntityDeclaration } from '@isl-lang/isl-core';
import { 
  findApplicableTemplates, 
  type SuggestionTemplate, 
  type TemplateContext 
} from './templates.js';

export interface Suggestion {
  id: string;
  category: string;
  title: string;
  description: string;
  location?: { line: number; column: number };
  suggestedCode?: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  relatedIssues?: string[];
}

export interface GeneratorOptions {
  includeAISuggestions?: boolean;
  maxSuggestions?: number;
  minConfidence?: number;
}

/**
 * Generate suggestions for a domain
 */
export function generateSuggestions(
  domain: DomainDeclaration,
  options: GeneratorOptions = {}
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const {
    maxSuggestions = 50,
    minConfidence = 0.5,
  } = options;

  // Generate entity suggestions
  for (const entity of domain.entities) {
    suggestions.push(...generateEntitySuggestions(entity, domain));
  }

  // Generate behavior suggestions
  for (const behavior of domain.behaviors) {
    suggestions.push(...generateBehaviorSuggestions(behavior, domain));
  }

  // Generate domain-level suggestions
  suggestions.push(...generateDomainSuggestions(domain));

  // Filter by confidence
  const filtered = suggestions
    .filter(s => s.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxSuggestions);

  // Deduplicate
  const seen = new Set<string>();
  return filtered.filter(s => {
    const key = `${s.category}-${s.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Generate suggestions for an entity
 */
function generateEntitySuggestions(
  entity: EntityDeclaration, 
  domain: DomainDeclaration
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const entityName = entity.name.name;

  // Check for missing standard fields
  const hasId = entity.fields.some(f => f.name.name.toLowerCase() === 'id');
  const hasCreatedAt = entity.fields.some(f => f.name.name.toLowerCase().includes('created'));
  const hasUpdatedAt = entity.fields.some(f => f.name.name.toLowerCase().includes('updated'));
  const hasVersion = entity.fields.some(f => f.name.name.toLowerCase() === 'version');

  if (!hasId) {
    const templates = findApplicableTemplates({ entityName });
    const template = templates.find(t => t.id === 'add-id-field');
    if (template) {
      suggestions.push(templateToSuggestion(template, { entityName }, entity.span));
    }
  }

  if (!hasCreatedAt || !hasUpdatedAt) {
    const template = findApplicableTemplates({ entityName }).find(t => t.id === 'add-timestamps');
    if (template) {
      suggestions.push(templateToSuggestion(template, { entityName }, entity.span));
    }
  }

  // Check for fields that might need annotations
  for (const field of entity.fields) {
    const fieldName = field.name.name;
    const fieldType = getFieldTypeName(field.type);
    const context: TemplateContext = { entityName, fieldName, fieldType };

    // Check for PII fields
    if (isPotentialPII(fieldName) && !hasAnnotation(field, 'pii')) {
      const template = findApplicableTemplates(context).find(t => t.id === 'add-pii-annotation');
      if (template) {
        suggestions.push(templateToSuggestion(template, context, field.span, 'medium'));
      }
    }

    // Check for sensitive fields
    if (isPotentialSecret(fieldName) && !hasAnnotation(field, 'secret')) {
      const template = findApplicableTemplates(context).find(t => t.id === 'add-secret-annotation');
      if (template) {
        suggestions.push(templateToSuggestion(template, context, field.span, 'high'));
      }
    }

    // Check for string fields without constraints
    if (fieldType === 'String' && !field.constraints?.length) {
      const template = findApplicableTemplates(context).find(t => t.id === 'add-string-constraints');
      if (template) {
        suggestions.push(templateToSuggestion(template, context, field.span, 'low'));
      }
    }

    // Check for email fields
    if (fieldName.toLowerCase().includes('email') && fieldType === 'String') {
      const template = findApplicableTemplates(context).find(t => t.id === 'add-email-type');
      if (template) {
        suggestions.push(templateToSuggestion(template, context, field.span, 'medium'));
      }
    }
  }

  // Check for concurrent updates without versioning
  const hasUpdateBehavior = domain.behaviors.some(b => 
    b.name.name.toLowerCase().includes('update') &&
    b.name.name.toLowerCase().includes(entityName.toLowerCase())
  );
  if (hasUpdateBehavior && !hasVersion) {
    const template = findApplicableTemplates({ entityName }).find(t => t.id === 'add-version-field');
    if (template) {
      suggestions.push(templateToSuggestion(template, { entityName }, entity.span, 'medium'));
    }
  }

  return suggestions;
}

/**
 * Generate suggestions for a behavior
 */
function generateBehaviorSuggestions(
  behavior: BehaviorDeclaration,
  domain: DomainDeclaration
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const behaviorName = behavior.name.name;
  const context: TemplateContext = { behaviorName };

  // Check for missing pagination on list behaviors
  if (isListBehavior(behaviorName)) {
    const hasLimit = behavior.input?.fields?.some(f => 
      f.name.name.toLowerCase() === 'limit' || 
      f.name.name.toLowerCase() === 'pagesize'
    );
    
    if (!hasLimit) {
      const template = findApplicableTemplates(context).find(t => t.id === 'add-pagination');
      if (template) {
        suggestions.push(templateToSuggestion(template, context, behavior.span, 'high'));
      }
    }
  }

  // Check for missing idempotency on create/send behaviors
  if (isCreateBehavior(behaviorName) || isSendBehavior(behaviorName)) {
    const hasIdempotency = behavior.input?.fields?.some(f =>
      f.name.name.toLowerCase().includes('idempotency')
    );
    
    if (!hasIdempotency) {
      const template = findApplicableTemplates(context).find(t => t.id === 'add-idempotency');
      if (template) {
        suggestions.push(templateToSuggestion(template, context, behavior.span, 'medium'));
      }
    }
  }

  // Check for missing rate limiting
  if (!behavior.security) {
    const template = findApplicableTemplates(context).find(t => t.id === 'add-rate-limit');
    if (template) {
      suggestions.push(templateToSuggestion(template, context, behavior.span, 'low'));
    }
  }

  // Check for missing temporal requirements
  if (!behavior.temporal) {
    const template = findApplicableTemplates(context).find(t => t.id === 'add-temporal');
    if (template) {
      suggestions.push(templateToSuggestion(template, context, behavior.span, 'low'));
    }
  }

  // Check for missing standard errors
  if (behavior.output?.errors) {
    const errorCodes = behavior.output.errors.map(e => e.name.name);
    
    // Missing NOT_FOUND on get/update/delete
    if ((isGetBehavior(behaviorName) || isUpdateBehavior(behaviorName) || isDeleteBehavior(behaviorName)) &&
        !errorCodes.includes('NOT_FOUND')) {
      const template = findApplicableTemplates(context).find(t => t.id === 'add-not-found-error');
      if (template) {
        suggestions.push(templateToSuggestion(template, context, behavior.span, 'high'));
      }
    }

    // Missing VALIDATION_ERROR on create/update
    if ((isCreateBehavior(behaviorName) || isUpdateBehavior(behaviorName)) &&
        !errorCodes.some(c => c.includes('VALIDATION'))) {
      const template = findApplicableTemplates(context).find(t => t.id === 'add-validation-error');
      if (template) {
        suggestions.push(templateToSuggestion(template, context, behavior.span, 'medium'));
      }
    }

    // Missing rate limit error when rate limiting is defined
    if (behavior.security && !errorCodes.includes('RATE_LIMITED')) {
      const template = findApplicableTemplates(context).find(t => t.id === 'add-rate-limit-error');
      if (template) {
        suggestions.push(templateToSuggestion(template, context, behavior.span, 'medium'));
      }
    }
  }

  // Check for missing auth on state-changing behaviors
  if (isStateChangingBehavior(behaviorName) && !behavior.actors && !behavior.security) {
    const template = findApplicableTemplates(context).find(t => t.id === 'add-auth-requirement');
    if (template) {
      suggestions.push(templateToSuggestion(template, context, behavior.span, 'high'));
    }
  }

  return suggestions;
}

/**
 * Generate domain-level suggestions
 */
function generateDomainSuggestions(domain: DomainDeclaration): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Check for missing version
  if (!domain.version) {
    suggestions.push({
      id: 'domain-add-version',
      category: 'domain',
      title: 'Add domain version',
      description: 'Specify a semantic version for API evolution tracking.',
      location: domain.span ? { line: domain.span.line, column: domain.span.column } : undefined,
      suggestedCode: 'version: "1.0.0"',
      confidence: 0.9,
      priority: 'medium',
    });
  }

  // Check for entity/behavior imbalance
  const entityCount = domain.entities.length;
  const behaviorCount = domain.behaviors.length;
  
  if (entityCount > 0 && behaviorCount < entityCount * 2) {
    suggestions.push({
      id: 'domain-add-behaviors',
      category: 'domain',
      title: 'Consider adding more behaviors',
      description: 'Most entities should have at least CRUD behaviors defined.',
      confidence: 0.6,
      priority: 'low',
    });
  }

  // Check for missing global invariants
  if (domain.invariants.length === 0 && entityCount > 3) {
    suggestions.push({
      id: 'domain-add-invariants',
      category: 'domain',
      title: 'Add domain invariants',
      description: 'Define cross-entity business rules as domain invariants.',
      confidence: 0.5,
      priority: 'low',
    });
  }

  return suggestions;
}

/**
 * Convert template to suggestion
 */
function templateToSuggestion(
  template: SuggestionTemplate,
  context: TemplateContext,
  span?: { line: number; column: number },
  priority: 'high' | 'medium' | 'low' = 'medium'
): Suggestion {
  return {
    id: `${template.id}-${context.entityName ?? context.behaviorName ?? context.fieldName ?? 'general'}`,
    category: template.category,
    title: template.title,
    description: template.description,
    location: span,
    suggestedCode: template.generateCode?.(context),
    confidence: template.confidence,
    priority,
  };
}

// Helper functions

function getFieldTypeName(type: unknown): string {
  if (!type || typeof type !== 'object') return 'unknown';
  const typeObj = type as { kind?: string; name?: { name?: string } };
  if (typeObj.kind === 'SimpleType') {
    return typeObj.name?.name ?? 'unknown';
  }
  return 'complex';
}

function hasAnnotation(field: { annotations?: Array<{ name: { name: string } }> }, name: string): boolean {
  return field.annotations?.some(a => a.name.name.toLowerCase() === name.toLowerCase()) ?? false;
}

function isPotentialPII(fieldName: string): boolean {
  const piiPatterns = ['email', 'phone', 'address', 'name', 'birth', 'ssn', 'ip'];
  return piiPatterns.some(p => fieldName.toLowerCase().includes(p));
}

function isPotentialSecret(fieldName: string): boolean {
  const secretPatterns = ['password', 'secret', 'token', 'key', 'credential', 'auth'];
  return secretPatterns.some(p => fieldName.toLowerCase().includes(p));
}

function isListBehavior(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('list') || lower.includes('search') || lower.includes('find');
}

function isCreateBehavior(name: string): boolean {
  return name.toLowerCase().startsWith('create');
}

function isUpdateBehavior(name: string): boolean {
  return name.toLowerCase().startsWith('update');
}

function isDeleteBehavior(name: string): boolean {
  return name.toLowerCase().startsWith('delete');
}

function isGetBehavior(name: string): boolean {
  return name.toLowerCase().startsWith('get') || name.toLowerCase().startsWith('find');
}

function isSendBehavior(name: string): boolean {
  return name.toLowerCase().startsWith('send');
}

function isStateChangingBehavior(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('create') ||
    lower.startsWith('update') ||
    lower.startsWith('delete') ||
    lower.startsWith('set') ||
    lower.startsWith('add') ||
    lower.startsWith('remove')
  );
}
