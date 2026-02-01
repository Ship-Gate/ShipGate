/**
 * Best Practices Analyzer
 * 
 * Checks for ISL best practices and patterns.
 */

import type { DomainDeclaration, BehaviorDeclaration, EntityDeclaration } from '@isl-lang/isl-core';

export interface BestPracticeIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  location?: { line: number; column: number };
  fix?: string;
  documentation?: string;
}

export interface BestPracticesResult {
  score: number;
  issues: BestPracticeIssue[];
  suggestions: string[];
}

/**
 * Analyze domain for best practices
 */
export function analyzeBestPractices(domain: DomainDeclaration): BestPracticesResult {
  const issues: BestPracticeIssue[] = [];
  const suggestions: string[] = [];

  // Check domain-level best practices
  issues.push(...checkDomainBestPractices(domain));

  // Check entity best practices
  for (const entity of domain.entities) {
    issues.push(...checkEntityBestPractices(entity, domain));
  }

  // Check behavior best practices
  for (const behavior of domain.behaviors) {
    issues.push(...checkBehaviorBestPractices(behavior, domain));
  }

  // Check for missing scenarios
  issues.push(...checkScenarioCoverage(domain));

  // Check for CQRS patterns
  issues.push(...checkCQRSPatterns(domain));

  // Check for event sourcing patterns
  issues.push(...checkEventSourcingPatterns(domain));

  // Generate suggestions based on analysis
  suggestions.push(...generateBestPracticeSuggestions(domain, issues));

  // Calculate score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const maxScore = 100;
  const deductions = criticalCount * 15 + warningCount * 7 + infoCount * 2;
  const score = Math.max(0, maxScore - deductions);

  return { score, issues, suggestions };
}

/**
 * Check domain-level best practices
 */
function checkDomainBestPractices(domain: DomainDeclaration): BestPracticeIssue[] {
  const issues: BestPracticeIssue[] = [];

  // Check for version
  if (!domain.version) {
    issues.push({
      id: 'best-practice-no-version',
      severity: 'warning',
      title: 'Domain has no version specified',
      description: 'Domains should specify a version for API evolution tracking.',
      location: domain.span ? { line: domain.span.line, column: domain.span.column } : undefined,
      fix: 'Add version: "1.0.0" to the domain declaration.',
    });
  }

  // Check for invariants
  if (domain.invariants.length === 0) {
    issues.push({
      id: 'best-practice-no-domain-invariants',
      severity: 'info',
      title: 'Domain has no global invariants',
      description: 'Consider adding domain-wide invariants to enforce business rules.',
      location: domain.span ? { line: domain.span.line, column: domain.span.column } : undefined,
    });
  }

  // Check entity count
  if (domain.entities.length > 20) {
    issues.push({
      id: 'best-practice-too-many-entities',
      severity: 'info',
      title: 'Domain has many entities',
      description: 'Consider splitting into bounded contexts if domain has >20 entities.',
      location: domain.span ? { line: domain.span.line, column: domain.span.column } : undefined,
      documentation: 'See: Domain-Driven Design bounded contexts',
    });
  }

  // Check behavior-to-entity ratio
  const ratio = domain.behaviors.length / Math.max(domain.entities.length, 1);
  if (ratio < 0.5) {
    issues.push({
      id: 'best-practice-low-behavior-ratio',
      severity: 'info',
      title: 'Low behavior-to-entity ratio',
      description: 'Most entities should have associated behaviors. Consider if some entities are missing behaviors.',
    });
  }

  return issues;
}

/**
 * Check entity best practices
 */
function checkEntityBestPractices(entity: EntityDeclaration, domain: DomainDeclaration): BestPracticeIssue[] {
  const issues: BestPracticeIssue[] = [];
  const entityName = entity.name.name;

  // Check for ID field
  const hasIdField = entity.fields.some(f => 
    f.name.name.toLowerCase() === 'id' && 
    f.annotations?.some(a => 
      a.name.name === 'unique' || a.name.name === 'immutable'
    )
  );

  if (!hasIdField) {
    issues.push({
      id: `best-practice-no-id-${entityName}`,
      severity: 'warning',
      title: `Entity "${entityName}" may lack proper ID field`,
      description: 'Entities should have an immutable, unique ID field.',
      location: entity.span ? { line: entity.span.line, column: entity.span.column } : undefined,
      fix: 'Add id: UUID [immutable, unique] to the entity.',
    });
  }

  // Check for timestamp fields
  const hasCreatedAt = entity.fields.some(f => 
    f.name.name.toLowerCase().includes('created')
  );
  const hasUpdatedAt = entity.fields.some(f => 
    f.name.name.toLowerCase().includes('updated')
  );

  if (!hasCreatedAt) {
    issues.push({
      id: `best-practice-no-created-at-${entityName}`,
      severity: 'info',
      title: `Entity "${entityName}" has no created_at timestamp`,
      description: 'Consider adding a created_at timestamp for auditing.',
      location: entity.span ? { line: entity.span.line, column: entity.span.column } : undefined,
    });
  }

  // Check field count (anemic vs god entity)
  if (entity.fields.length < 2) {
    issues.push({
      id: `best-practice-anemic-entity-${entityName}`,
      severity: 'info',
      title: `Entity "${entityName}" has very few fields`,
      description: 'Entity might be anemic. Consider if it should be a value object or merged.',
      location: entity.span ? { line: entity.span.line, column: entity.span.column } : undefined,
    });
  }

  if (entity.fields.length > 30) {
    issues.push({
      id: `best-practice-god-entity-${entityName}`,
      severity: 'warning',
      title: `Entity "${entityName}" has too many fields (${entity.fields.length})`,
      description: 'Consider decomposing into smaller entities or value objects.',
      location: entity.span ? { line: entity.span.line, column: entity.span.column } : undefined,
    });
  }

  // Check for optional field overuse
  const optionalCount = entity.fields.filter(f => f.optional).length;
  const totalCount = entity.fields.length;
  if (totalCount > 5 && optionalCount / totalCount > 0.7) {
    issues.push({
      id: `best-practice-too-many-optional-${entityName}`,
      severity: 'info',
      title: `Entity "${entityName}" has many optional fields`,
      description: 'Many optional fields may indicate entity does too much. Consider splitting.',
      location: entity.span ? { line: entity.span.line, column: entity.span.column } : undefined,
    });
  }

  return issues;
}

/**
 * Check behavior best practices
 */
function checkBehaviorBestPractices(behavior: BehaviorDeclaration, domain: DomainDeclaration): BestPracticeIssue[] {
  const issues: BestPracticeIssue[] = [];
  const behaviorName = behavior.name.name;

  // Check input field count
  const inputFieldCount = behavior.input?.fields?.length ?? 0;
  if (inputFieldCount > 10) {
    issues.push({
      id: `best-practice-too-many-inputs-${behaviorName}`,
      severity: 'info',
      title: `Behavior "${behaviorName}" has many input parameters`,
      description: 'Consider grouping related parameters into a request object.',
      location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
    });
  }

  // Check error count
  const errorCount = behavior.output?.errors?.length ?? 0;
  if (errorCount > 10) {
    issues.push({
      id: `best-practice-too-many-errors-${behaviorName}`,
      severity: 'info',
      title: `Behavior "${behaviorName}" has many error cases`,
      description: 'Consider if some errors can be grouped or if behavior does too much.',
      location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
    });
  }

  // Check for retriable errors
  if (behavior.output?.errors) {
    const hasRetriableErrors = behavior.output.errors.some(e => e.retriable);
    const hasNetworkRelatedBehavior = behaviorName.toLowerCase().includes('send') ||
                                       behaviorName.toLowerCase().includes('fetch') ||
                                       behaviorName.toLowerCase().includes('call');
    
    if (hasNetworkRelatedBehavior && !hasRetriableErrors) {
      issues.push({
        id: `best-practice-no-retriable-${behaviorName}`,
        severity: 'info',
        title: `Network behavior "${behaviorName}" has no retriable errors`,
        description: 'Network operations should typically have retriable error cases.',
        location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
        fix: 'Add retriable: true to transient error cases.',
      });
    }
  }

  // Check for idempotency support on create/update
  if ((behaviorName.toLowerCase().includes('create') || 
       behaviorName.toLowerCase().includes('update')) &&
      !behavior.input?.fields?.some(f => f.name.name.toLowerCase().includes('idempotency'))) {
    issues.push({
      id: `best-practice-no-idempotency-${behaviorName}`,
      severity: 'info',
      title: `Behavior "${behaviorName}" may need idempotency key`,
      description: 'Create/update operations should support idempotency for safe retries.',
      location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
      fix: 'Add idempotency_key: String? to input.',
    });
  }

  return issues;
}

/**
 * Check for scenario coverage
 */
function checkScenarioCoverage(domain: DomainDeclaration): BestPracticeIssue[] {
  const issues: BestPracticeIssue[] = [];

  // Check if behaviors have scenarios
  for (const behavior of domain.behaviors) {
    // This would need scenario blocks in the AST
    // For now, just note that scenarios are recommended
  }

  if (domain.behaviors.length > 0) {
    issues.push({
      id: 'best-practice-add-scenarios',
      severity: 'info',
      title: 'Consider adding scenario blocks',
      description: 'Scenarios provide executable examples and serve as documentation.',
    });
  }

  return issues;
}

/**
 * Check for CQRS patterns
 */
function checkCQRSPatterns(domain: DomainDeclaration): BestPracticeIssue[] {
  const issues: BestPracticeIssue[] = [];

  // Separate read and write behaviors
  const readBehaviors = domain.behaviors.filter(b => {
    const name = b.name.name.toLowerCase();
    return name.startsWith('get') || name.startsWith('find') || 
           name.startsWith('list') || name.startsWith('search');
  });

  const writeBehaviors = domain.behaviors.filter(b => {
    const name = b.name.name.toLowerCase();
    return name.startsWith('create') || name.startsWith('update') || 
           name.startsWith('delete') || name.startsWith('set');
  });

  // Check for mixed read/write in single behavior
  for (const behavior of domain.behaviors) {
    const name = behavior.name.name.toLowerCase();
    if ((name.includes('and') || name.includes('then')) && 
        (name.includes('get') || name.includes('create') || name.includes('update'))) {
      issues.push({
        id: `best-practice-mixed-cqrs-${behavior.name.name}`,
        severity: 'info',
        title: `Behavior "${behavior.name.name}" may mix commands and queries`,
        description: 'Consider separating read and write operations (CQRS pattern).',
        location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
        documentation: 'See: Command Query Responsibility Segregation',
      });
    }
  }

  return issues;
}

/**
 * Check for event sourcing patterns
 */
function checkEventSourcingPatterns(domain: DomainDeclaration): BestPracticeIssue[] {
  const issues: BestPracticeIssue[] = [];

  // Check for entities that might benefit from event sourcing
  for (const entity of domain.entities) {
    const hasLifecycle = entity.lifecycle && entity.lifecycle.transitions.length > 3;
    const hasAuditNeeds = entity.fields.some(f => 
      f.name.name.toLowerCase().includes('history') ||
      f.name.name.toLowerCase().includes('changes')
    );

    if (hasLifecycle && hasAuditNeeds) {
      issues.push({
        id: `best-practice-event-sourcing-${entity.name.name}`,
        severity: 'info',
        title: `Entity "${entity.name.name}" might benefit from event sourcing`,
        description: 'Complex lifecycle with history tracking is a good fit for event sourcing.',
        location: entity.span ? { line: entity.span.line, column: entity.span.column } : undefined,
        documentation: 'See: Event Sourcing pattern',
      });
    }
  }

  return issues;
}

/**
 * Generate best practice suggestions
 */
function generateBestPracticeSuggestions(
  domain: DomainDeclaration, 
  issues: BestPracticeIssue[]
): string[] {
  const suggestions: string[] = [];

  // General suggestions based on domain analysis
  if (domain.behaviors.length > 30) {
    suggestions.push('Consider organizing behaviors into logical groups or separate modules.');
  }

  if (domain.entities.every(e => !e.lifecycle)) {
    suggestions.push('Consider adding lifecycle definitions to entities with state transitions.');
  }

  const hasSecurity = domain.behaviors.some(b => b.security);
  if (!hasSecurity) {
    suggestions.push('Consider adding security blocks to define authentication and authorization.');
  }

  const hasTemporal = domain.behaviors.some(b => b.temporal);
  if (!hasTemporal) {
    suggestions.push('Consider adding temporal requirements to define SLAs and timeouts.');
  }

  const hasCompliance = domain.behaviors.some(b => b.compliance);
  if (!hasCompliance && domain.entities.some(e => 
    e.fields.some(f => f.annotations?.some(a => a.name.name === 'pii'))
  )) {
    suggestions.push('PII detected but no compliance blocks. Consider adding GDPR/CCPA compliance specs.');
  }

  // Suggestions based on issue categories
  const securityIssues = issues.filter(i => i.id.includes('security'));
  if (securityIssues.length > 3) {
    suggestions.push('Multiple security concerns found. Consider a security review.');
  }

  return suggestions;
}
