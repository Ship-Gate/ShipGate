// ============================================================================
// ISL Specification Analysis
// AI-powered analysis of ISL specifications
// ============================================================================

import type {
  DomainDeclaration,
  FieldDeclaration,
  SourceSpan,
} from '@isl-lang/isl-core';
import type {
  AIProvider,
  CodeQualityMetric,
  SecurityFinding,
  DesignPattern,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalysisResult {
  quality: CodeQualityMetric[];
  security: SecurityFinding[];
  patterns: DesignPattern[];
  suggestions: AnalysisSuggestion[];
  complexity: ComplexityMetrics;
  coverage: CoverageMetrics;
}

export interface SpecInsight {
  category: 'quality' | 'security' | 'design' | 'performance';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  location?: SourceSpan;
  suggestion?: string;
}

export interface AnalysisSuggestion {
  type: 'add' | 'remove' | 'modify';
  target: string;
  suggestion: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ComplexityMetrics {
  entities: number;
  behaviors: number;
  types: number;
  invariants: number;
  avgFieldsPerEntity: number;
  avgConstraintsPerBehavior: number;
  cyclomaticComplexity: number;
  dependencyDepth: number;
}

export interface CoverageMetrics {
  entitiesWithInvariants: number;
  behaviorsWithPreconditions: number;
  behaviorsWithPostconditions: number;
  behaviorsWithSecurity: number;
  fieldsWithConstraints: number;
  documentationCoverage: number;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze ISL domain for quality, security, and patterns
 */
export async function analyze(
  domain: DomainDeclaration,
  provider: AIProvider
): Promise<AnalysisResult> {
  // Compute basic metrics
  const complexity = computeComplexityMetrics(domain);
  const coverage = computeCoverageMetrics(domain);

  // Run all analyses in parallel
  const [quality, security, patterns, suggestions] = await Promise.all([
    analyzeQuality(domain, provider, complexity, coverage),
    analyzeSecurity(domain, provider),
    analyzePatterns(domain, provider),
    generateSuggestions(domain, provider, complexity, coverage),
  ]);

  return {
    quality,
    security,
    patterns,
    suggestions,
    complexity,
    coverage,
  };
}

// ============================================================================
// QUALITY ANALYSIS
// ============================================================================

async function analyzeQuality(
  domain: DomainDeclaration,
  provider: AIProvider,
  complexity: ComplexityMetrics,
  coverage: CoverageMetrics
): Promise<CodeQualityMetric[]> {
  const metrics: CodeQualityMetric[] = [];

  // Completeness score
  const completenessScore = Math.min(100, Math.round(
    (coverage.entitiesWithInvariants * 25 +
      coverage.behaviorsWithPreconditions * 25 +
      coverage.behaviorsWithPostconditions * 25 +
      coverage.behaviorsWithSecurity * 25) / 4
  ));

  metrics.push({
    name: 'Completeness',
    score: completenessScore,
    description: 'Measures how thoroughly the specification covers all aspects',
    suggestions: completenessScore < 70 ? [
      'Add invariants to entities without them',
      'Add preconditions to behaviors',
      'Add postconditions to verify behavior effects',
    ] : undefined,
  });

  // Documentation score
  const docScore = Math.round(coverage.documentationCoverage * 100);
  metrics.push({
    name: 'Documentation',
    score: docScore,
    description: 'Percentage of constructs with documentation',
    suggestions: docScore < 50 ? [
      'Add descriptions to entities',
      'Document behavior purposes',
      'Add examples to complex types',
    ] : undefined,
  });

  // Complexity score (lower is better, but we invert for a "quality" score)
  const complexityScore = Math.max(0, 100 - complexity.cyclomaticComplexity * 5);
  metrics.push({
    name: 'Simplicity',
    score: complexityScore,
    description: 'Inverse of cyclomatic complexity',
    suggestions: complexityScore < 60 ? [
      'Break down complex behaviors',
      'Extract common patterns into reusable types',
      'Simplify nested conditions',
    ] : undefined,
  });

  // Constraint coverage
  const constraintScore = Math.round(coverage.fieldsWithConstraints * 100);
  metrics.push({
    name: 'Constraint Coverage',
    score: constraintScore,
    description: 'Percentage of fields with validation constraints',
    suggestions: constraintScore < 50 ? [
      'Add length constraints to string fields',
      'Add range constraints to numeric fields',
      'Add format constraints to identifiers',
    ] : undefined,
  });

  // AI-based quality assessment
  const aiAnalysis = await getAIQualityAssessment(domain, provider);
  metrics.push(...aiAnalysis);

  return metrics;
}

async function getAIQualityAssessment(
  domain: DomainDeclaration,
  provider: AIProvider
): Promise<CodeQualityMetric[]> {
  const prompt = `Assess the quality of this ISL specification:

${summarizeDomain(domain)}

Rate these aspects (0-100) and explain:
1. Naming conventions
2. Error handling completeness
3. Business rule clarity
4. Separation of concerns

Respond with JSON: [{"name": "...", "score": N, "description": "...", "suggestions": [...]}]`;

  try {
    const response = await provider.chat([
      { role: 'system', content: 'You are an ISL quality assessor.' },
      { role: 'user', content: prompt },
    ]);

    return JSON.parse(response);
  } catch {
    return [];
  }
}

// ============================================================================
// SECURITY ANALYSIS
// ============================================================================

async function analyzeSecurity(
  domain: DomainDeclaration,
  provider: AIProvider
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  // Check for behaviors without authorization
  for (const behavior of domain.behaviors) {
    const hasNoSecurity = !behavior.security || behavior.security.requirements.length === 0;
    if (hasNoSecurity && !behavior.actors) {
      findings.push({
        severity: 'high',
        category: 'Authorization',
        title: `No authorization on ${behavior.name.name}`,
        description: 'Behavior has no security constraints or actor specifications',
        location: behavior.span,
        fix: `Add security: requires: "permission:${behavior.name.name.toLowerCase()}"`,
      });
    }
  }

  // Check for sensitive fields without protection
  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const fieldName = field.name.name.toLowerCase();
      const sensitivePatterns = ['password', 'secret', 'token', 'key', 'ssn', 'credit'];
      
      if (sensitivePatterns.some(p => fieldName.includes(p))) {
        const hasSensitiveAnnotation = field.annotations.some(
          a => a.name.name === 'sensitive' || a.name.name === 'encrypted'
        );
        
        if (!hasSensitiveAnnotation) {
          findings.push({
            severity: 'high',
            category: 'Data Protection',
            title: `Sensitive field ${entity.name.name}.${field.name.name} not protected`,
            description: 'Field appears to contain sensitive data but has no protection annotations',
            location: field.span,
            fix: `Add @sensitive or @encrypted annotation`,
          });
        }
      }
    }
  }

  // Check for missing rate limiting on public behaviors
  for (const behavior of domain.behaviors) {
    const isPublic = behavior.actors?.actors.some(a => a.name.name === 'Anonymous');
    const hasRateLimit = behavior.security?.requirements.some(s => s.type === 'rate_limit');
    
    if (isPublic && !hasRateLimit) {
      findings.push({
        severity: 'medium',
        category: 'DoS Protection',
        title: `No rate limiting on public behavior ${behavior.name.name}`,
        description: 'Public behaviors should have rate limiting to prevent abuse',
        location: behavior.span,
        fix: `Add security: rate_limit 100/minute per ip`,
      });
    }
  }

  // AI-based security review
  const aiFindings = await getAISecurityReview(domain, provider);
  findings.push(...aiFindings);

  return findings;
}

async function getAISecurityReview(
  domain: DomainDeclaration,
  provider: AIProvider
): Promise<SecurityFinding[]> {
  const prompt = `Security review this ISL specification:

${summarizeDomain(domain)}

Check for:
1. IDOR vulnerabilities (missing ownership checks)
2. Mass assignment risks
3. Business logic flaws
4. Information disclosure
5. Injection risks

Respond with JSON: [{"severity": "high|medium|low", "category": "...", "title": "...", "description": "...", "fix": "..."}]`;

  try {
    const response = await provider.chat([
      { role: 'system', content: 'You are a security expert reviewing ISL specifications.' },
      { role: 'user', content: prompt },
    ]);

    return JSON.parse(response);
  } catch {
    return [];
  }
}

// ============================================================================
// PATTERN ANALYSIS
// ============================================================================

async function analyzePatterns(
  domain: DomainDeclaration,
  provider: AIProvider
): Promise<DesignPattern[]> {
  const patterns: DesignPattern[] = [];

  // Check for common patterns
  patterns.push({
    name: 'Entity-Behavior Separation',
    description: 'Entities define data, behaviors define operations',
    applicable: domain.entities.length > 0 && domain.behaviors.length > 0,
    recommendation: 'Pattern is correctly applied',
  });

  // Check for CQRS pattern (simplified check - no views in current AST)
  const hasBehaviors = domain.behaviors.length > 0;
  patterns.push({
    name: 'CQRS (Command Query Responsibility Segregation)',
    description: 'Separate read models (views) from write operations (behaviors)',
    applicable: hasBehaviors,
    recommendation: 'Consider adding views for read-optimized queries',
  });

  // Check for Event Sourcing readiness
  const hasLifecycles = domain.entities.some(e => e.fields.some(f => 
    f.annotations.some(a => a.name.name === 'lifecycle')
  ));
  patterns.push({
    name: 'Event Sourcing Ready',
    description: 'Lifecycle-based state management enables event sourcing',
    applicable: hasLifecycles,
    recommendation: !hasLifecycles
      ? 'Add lifecycles to stateful entities for event sourcing support'
      : 'Lifecycles enable event sourcing',
  });

  // AI pattern recognition
  const aiPatterns = await getAIPatternAnalysis(domain, provider);
  patterns.push(...aiPatterns);

  return patterns;
}

async function getAIPatternAnalysis(
  domain: DomainDeclaration,
  provider: AIProvider
): Promise<DesignPattern[]> {
  const prompt = `Identify design patterns in this ISL specification:

${summarizeDomain(domain)}

Check for:
1. Aggregate Root pattern
2. Domain Events
3. Saga pattern
4. Repository pattern
5. Factory pattern

Respond with JSON: [{"name": "...", "description": "...", "applicable": boolean, "recommendation": "..."}]`;

  try {
    const response = await provider.chat([
      { role: 'system', content: 'You are a domain-driven design expert.' },
      { role: 'user', content: prompt },
    ]);

    return JSON.parse(response);
  } catch {
    return [];
  }
}

// ============================================================================
// SUGGESTIONS
// ============================================================================

async function generateSuggestions(
  domain: DomainDeclaration,
  _provider: AIProvider,
  complexity: ComplexityMetrics,
  _coverage: CoverageMetrics
): Promise<AnalysisSuggestion[]> {
  const suggestions: AnalysisSuggestion[] = [];

  // Entity suggestions
  for (const entity of domain.entities) {
    if (!entity.invariants || entity.invariants.length === 0) {
      suggestions.push({
        type: 'add',
        target: `entity ${entity.name.name}`,
        suggestion: 'Add invariants to enforce business rules',
        rationale: 'Invariants ensure data integrity at all times',
        priority: 'medium',
      });
    }
  }

  // Behavior suggestions
  for (const behavior of domain.behaviors) {
    if (!behavior.postconditions || behavior.postconditions.conditions.length === 0) {
      suggestions.push({
        type: 'add',
        target: `behavior ${behavior.name.name}`,
        suggestion: 'Add postconditions to specify expected outcomes',
        rationale: 'Postconditions enable formal verification and testing',
        priority: 'high',
      });
    }
  }

  // Complexity-based suggestions
  if (complexity.avgConstraintsPerBehavior > 5) {
    suggestions.push({
      type: 'modify',
      target: 'behaviors',
      suggestion: 'Consider extracting common constraints into policies',
      rationale: 'Reduces duplication and improves maintainability',
      priority: 'medium',
    });
  }

  return suggestions;
}

// ============================================================================
// METRICS COMPUTATION
// ============================================================================

function computeComplexityMetrics(domain: DomainDeclaration): ComplexityMetrics {
  const entityCount = domain.entities.length;
  const behaviorCount = domain.behaviors.length;
  const typeCount = domain.types.length;
  const invariantCount = domain.invariants.length + 
    domain.entities.reduce((sum, e) => sum + (e.invariants?.length ?? 0), 0);

  const totalFields = domain.entities.reduce((sum, e) => sum + e.fields.length, 0);
  const avgFieldsPerEntity = entityCount > 0 ? totalFields / entityCount : 0;

  const totalConstraints = domain.behaviors.reduce(
    (sum, b) => sum + (b.preconditions?.conditions.length ?? 0) + (b.postconditions?.conditions.length ?? 0),
    0
  );
  const avgConstraintsPerBehavior = behaviorCount > 0 ? totalConstraints / behaviorCount : 0;

  // Simple cyclomatic complexity estimate
  const cyclomaticComplexity = behaviorCount + invariantCount + (entityCount > 5 ? entityCount - 5 : 0);

  // Dependency depth (simplified)
  const dependencyDepth = domain.imports.length;

  return {
    entities: entityCount,
    behaviors: behaviorCount,
    types: typeCount,
    invariants: invariantCount,
    avgFieldsPerEntity: Math.round(avgFieldsPerEntity * 10) / 10,
    avgConstraintsPerBehavior: Math.round(avgConstraintsPerBehavior * 10) / 10,
    cyclomaticComplexity,
    dependencyDepth,
  };
}

function computeCoverageMetrics(domain: DomainDeclaration): CoverageMetrics {
  const entitiesWithInvariants = domain.entities.filter(e => e.invariants && e.invariants.length > 0).length;
  const behaviorsWithPreconditions = domain.behaviors.filter(b => b.preconditions && b.preconditions.conditions.length > 0).length;
  const behaviorsWithPostconditions = domain.behaviors.filter(b => b.postconditions && b.postconditions.conditions.length > 0).length;
  const behaviorsWithSecurity = domain.behaviors.filter(b => (b.security && b.security.requirements.length > 0) || b.actors).length;

  const totalFields = domain.entities.reduce((sum, e) => sum + e.fields.length, 0);
  const fieldsWithConstraints = domain.entities.reduce(
    (sum, e) => sum + e.fields.filter(f => hasConstraints(f)).length,
    0
  );

  // Documentation coverage (simplified - check for descriptions)
  const documentedEntities = domain.entities.filter(e => 
    e.fields.some(f => f.annotations.some(a => a.name.name === 'description'))
  ).length;
  const documentedBehaviors = domain.behaviors.filter(b => b.description).length;

  const totalConstructs = domain.entities.length + domain.behaviors.length;
  const documentedConstructs = documentedEntities + documentedBehaviors;

  return {
    entitiesWithInvariants: domain.entities.length > 0 
      ? entitiesWithInvariants / domain.entities.length 
      : 0,
    behaviorsWithPreconditions: domain.behaviors.length > 0 
      ? behaviorsWithPreconditions / domain.behaviors.length 
      : 0,
    behaviorsWithPostconditions: domain.behaviors.length > 0 
      ? behaviorsWithPostconditions / domain.behaviors.length 
      : 0,
    behaviorsWithSecurity: domain.behaviors.length > 0 
      ? behaviorsWithSecurity / domain.behaviors.length 
      : 0,
    fieldsWithConstraints: totalFields > 0 
      ? fieldsWithConstraints / totalFields 
      : 0,
    documentationCoverage: totalConstructs > 0 
      ? documentedConstructs / totalConstructs 
      : 0,
  };
}

function hasConstraints(field: FieldDeclaration): boolean {
  return field.constraints.length > 0 ||
    field.annotations.some(a => 
      ['minLength', 'maxLength', 'min', 'max', 'pattern', 'notEmpty'].includes(a.name.name)
    );
}

function summarizeDomain(domain: DomainDeclaration): string {
  const summary: string[] = [];
  
  const version = domain.version?.value ?? '1.0.0';
  summary.push(`Domain: ${domain.name.name} v${version}`);
  summary.push(`Entities: ${domain.entities.map(e => e.name.name).join(', ')}`);
  summary.push(`Behaviors: ${domain.behaviors.map(b => b.name.name).join(', ')}`);
  summary.push(`Types: ${domain.types.map(t => t.name.name).join(', ')}`);
  
  return summary.join('\n');
}
