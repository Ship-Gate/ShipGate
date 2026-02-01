/**
 * Performance Analyzer
 * 
 * Checks for performance concerns and optimization opportunities.
 */

import type { DomainDeclaration, BehaviorDeclaration, EntityDeclaration } from '@isl-lang/isl-core';

export interface PerformanceIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  location?: { line: number; column: number };
  fix?: string;
  impact?: string;
}

export interface PerformanceResult {
  score: number;
  issues: PerformanceIssue[];
  suggestions: string[];
}

/**
 * Analyze domain for performance issues
 */
export function analyzePerformance(domain: DomainDeclaration): PerformanceResult {
  const issues: PerformanceIssue[] = [];
  const suggestions: string[] = [];

  // Check for missing indexes
  issues.push(...checkMissingIndexes(domain));

  // Check for N+1 query patterns
  issues.push(...checkNPlusOnePatterns(domain));

  // Check for unbounded queries
  issues.push(...checkUnboundedQueries(domain));

  // Check for missing caching hints
  issues.push(...checkCachingOpportunities(domain));

  // Check temporal requirements
  issues.push(...checkTemporalRequirements(domain));

  // Check for expensive computations
  issues.push(...checkExpensiveComputations(domain));

  // Check batch operation efficiency
  issues.push(...checkBatchOperations(domain));

  // Generate suggestions
  const unindexedLookups = countUnindexedLookups(domain);
  if (unindexedLookups > 0) {
    suggestions.push(`Consider adding indexes to ${unindexedLookups} frequently queried fields.`);
  }

  if (!domain.behaviors.some(b => b.temporal)) {
    suggestions.push('Consider adding temporal requirements to define performance SLAs.');
  }

  // Calculate score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const maxScore = 100;
  const deductions = criticalCount * 20 + warningCount * 10 + infoCount * 3;
  const score = Math.max(0, maxScore - deductions);

  return { score, issues, suggestions };
}

/**
 * Check for missing indexes on frequently queried fields
 */
function checkMissingIndexes(domain: DomainDeclaration): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  for (const entity of domain.entities) {
    // Check for fields likely to be queried
    for (const field of entity.fields) {
      const fieldName = field.name.name.toLowerCase();
      const hasIndex = field.annotations?.some(a => 
        a.name.name.toLowerCase() === 'indexed'
      );

      // Foreign key-like fields should be indexed
      if ((fieldName.endsWith('_id') || fieldName.endsWith('Id')) && !hasIndex) {
        issues.push({
          id: `performance-missing-index-fk-${entity.name.name}-${field.name.name}`,
          severity: 'warning',
          title: `Foreign key field "${field.name.name}" not indexed`,
          description: `Field "${field.name.name}" in "${entity.name.name}" appears to be a foreign key but is not indexed.`,
          location: field.span ? { line: field.span.line, column: field.span.column } : undefined,
          fix: `Add [indexed] annotation to field "${field.name.name}".`,
          impact: 'Queries filtering by this field may be slow.',
        });
      }

      // Status/state fields used in filters should be indexed
      if ((fieldName === 'status' || fieldName === 'state') && !hasIndex) {
        issues.push({
          id: `performance-missing-index-status-${entity.name.name}`,
          severity: 'info',
          title: `Status field not indexed in "${entity.name.name}"`,
          description: 'Status fields are commonly filtered and should typically be indexed.',
          location: field.span ? { line: field.span.line, column: field.span.column } : undefined,
          fix: `Add [indexed] annotation to "${field.name.name}".`,
        });
      }

      // Timestamp fields used for sorting should be indexed
      if ((fieldName.includes('created') || fieldName.includes('updated')) && !hasIndex) {
        issues.push({
          id: `performance-missing-index-timestamp-${entity.name.name}-${field.name.name}`,
          severity: 'info',
          title: `Timestamp field "${field.name.name}" not indexed`,
          description: 'Timestamp fields used for sorting should be indexed.',
          location: field.span ? { line: field.span.line, column: field.span.column } : undefined,
          fix: `Add [indexed] annotation if this field is used for sorting.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Check for N+1 query patterns
 */
function checkNPlusOnePatterns(domain: DomainDeclaration): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  for (const behavior of domain.behaviors) {
    const name = behavior.name.name.toLowerCase();
    
    // List operations that might trigger N+1
    if (name.includes('list') || name.includes('all') || name.includes('search')) {
      // Check if output includes nested entities
      if (hasNestedEntityReferences(behavior)) {
        issues.push({
          id: `performance-potential-n-plus-1-${behavior.name.name}`,
          severity: 'info',
          title: `Potential N+1 query pattern in "${behavior.name.name}"`,
          description: 'List operation with nested entity references may cause N+1 queries. Consider using batch loading or joins.',
          location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
          fix: 'Use batch loading, includes, or denormalization for nested data.',
          impact: 'Performance degrades linearly with result set size.',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for unbounded query results
 */
function checkUnboundedQueries(domain: DomainDeclaration): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  for (const behavior of domain.behaviors) {
    const name = behavior.name.name.toLowerCase();
    
    // List/search operations should have pagination
    if (name.includes('list') || name.includes('all') || name.includes('search') || name.includes('find')) {
      const hasLimit = behavior.input?.fields?.some(f => 
        f.name.name.toLowerCase() === 'limit' || 
        f.name.name.toLowerCase() === 'pagesize' ||
        f.name.name.toLowerCase() === 'max'
      );

      const hasPagination = behavior.input?.fields?.some(f =>
        f.name.name.toLowerCase() === 'cursor' ||
        f.name.name.toLowerCase() === 'page' ||
        f.name.name.toLowerCase() === 'offset'
      );

      if (!hasLimit) {
        issues.push({
          id: `performance-unbounded-query-${behavior.name.name}`,
          severity: 'warning',
          title: `Unbounded query in "${behavior.name.name}"`,
          description: 'List/search operations should have a limit parameter to prevent fetching too many records.',
          location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
          fix: 'Add a "limit" input parameter with a reasonable maximum.',
          impact: 'Could cause memory exhaustion or timeout on large datasets.',
        });
      } else if (!hasPagination) {
        issues.push({
          id: `performance-no-pagination-${behavior.name.name}`,
          severity: 'info',
          title: `No pagination in "${behavior.name.name}"`,
          description: 'Consider adding cursor-based pagination for large result sets.',
          location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
          fix: 'Add cursor or page/offset parameters for pagination.',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for caching opportunities
 */
function checkCachingOpportunities(domain: DomainDeclaration): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  for (const behavior of domain.behaviors) {
    const name = behavior.name.name.toLowerCase();
    
    // Read-only operations are candidates for caching
    if (name.startsWith('get') || name.startsWith('find') || name.startsWith('lookup')) {
      // Check if behavior is computationally expensive or has heavy dependencies
      // This is a simplified check - real implementation would analyze more deeply
      
      if (!behavior.temporal) {
        issues.push({
          id: `performance-caching-opportunity-${behavior.name.name}`,
          severity: 'info',
          title: `Consider caching for "${behavior.name.name}"`,
          description: 'Read-only operations may benefit from caching. Consider adding cache hints or TTL.',
          location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
          fix: 'Add caching configuration or response time requirements.',
        });
      }
    }
  }

  return issues;
}

/**
 * Check temporal requirements
 */
function checkTemporalRequirements(domain: DomainDeclaration): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  for (const behavior of domain.behaviors) {
    if (behavior.temporal) {
      // Check for unrealistic temporal requirements
      const requirements = behavior.temporal.requirements;
      
      for (const req of requirements ?? []) {
        if (req.type === 'within' && req.duration) {
          const durationMs = parseDuration(req.duration);
          
          // Very tight requirements
          if (durationMs !== null && durationMs < 10) {
            issues.push({
              id: `performance-unrealistic-temporal-${behavior.name.name}`,
              severity: 'warning',
              title: `Possibly unrealistic temporal requirement in "${behavior.name.name}"`,
              description: `Response time requirement of ${durationMs}ms may be too aggressive.`,
              location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
              fix: 'Consider if this requirement is achievable given network latency.',
            });
          }
          
          // Very loose requirements
          if (durationMs !== null && durationMs > 30000) {
            issues.push({
              id: `performance-loose-temporal-${behavior.name.name}`,
              severity: 'info',
              title: `Loose temporal requirement in "${behavior.name.name}"`,
              description: `Response time requirement of ${durationMs}ms may be too lenient for good UX.`,
              location: behavior.span ? { line: behavior.span.line, column: behavior.span.column } : undefined,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Check for expensive computations
 */
function checkExpensiveComputations(domain: DomainDeclaration): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      // Check for computed fields that might be expensive
      if (field.computed) {
        const isIndexed = field.annotations?.some(a => 
          a.name.name.toLowerCase() === 'indexed'
        );

        if (isIndexed) {
          issues.push({
            id: `performance-computed-indexed-${entity.name.name}-${field.name.name}`,
            severity: 'warning',
            title: `Computed field "${field.name.name}" is indexed`,
            description: 'Indexing computed fields may cause performance issues if computation is expensive.',
            location: field.span ? { line: field.span.line, column: field.span.column } : undefined,
            fix: 'Consider materializing the computed value if it needs to be indexed.',
            impact: 'May cause slow writes or stale index data.',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check batch operation efficiency
 */
function checkBatchOperations(domain: DomainDeclaration): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  // Look for repeated single-item operations that could be batched
  const singleItemOps: string[] = [];
  const batchOps: string[] = [];

  for (const behavior of domain.behaviors) {
    const name = behavior.name.name.toLowerCase();
    
    if (name.includes('batch') || name.includes('bulk')) {
      batchOps.push(behavior.name.name);
    } else if (
      name.startsWith('create') ||
      name.startsWith('update') ||
      name.startsWith('delete') ||
      name.startsWith('send')
    ) {
      singleItemOps.push(behavior.name.name);
    }
  }

  // Check if there are single-item ops without corresponding batch ops
  for (const singleOp of singleItemOps) {
    const baseName = singleOp.replace(/^(Create|Update|Delete|Send)/i, '');
    const hasBatch = batchOps.some(b => 
      b.toLowerCase().includes(baseName.toLowerCase())
    );

    if (!hasBatch) {
      issues.push({
        id: `performance-no-batch-op-${singleOp}`,
        severity: 'info',
        title: `No batch version of "${singleOp}"`,
        description: 'Consider adding a batch version for bulk operations.',
        fix: `Add a Batch${singleOp} behavior for efficient bulk processing.`,
      });
    }
  }

  return issues;
}

// Helper functions

function hasNestedEntityReferences(behavior: BehaviorDeclaration): boolean {
  // Simplified check - would need deeper analysis in real implementation
  const outputStr = JSON.stringify(behavior.output ?? {});
  return outputStr.includes('List<') && outputStr.split('>').length > 2;
}

function countUnindexedLookups(domain: DomainDeclaration): number {
  let count = 0;
  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const fieldName = field.name.name.toLowerCase();
      const hasIndex = field.annotations?.some(a => 
        a.name.name.toLowerCase() === 'indexed'
      );
      if ((fieldName.endsWith('_id') || fieldName === 'status') && !hasIndex) {
        count++;
      }
    }
  }
  return count;
}

function parseDuration(duration: unknown): number | null {
  if (!duration || typeof duration !== 'object') return null;
  
  const d = duration as { value?: number; unit?: string };
  if (typeof d.value !== 'number') return null;
  
  const multipliers: Record<string, number> = {
    'ms': 1,
    's': 1000,
    'm': 60000,
    'h': 3600000,
  };
  
  const mult = multipliers[d.unit ?? 'ms'] ?? 1;
  return d.value * mult;
}
