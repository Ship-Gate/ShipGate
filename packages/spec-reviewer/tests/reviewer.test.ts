/**
 * Spec Reviewer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DomainDeclaration, EntityDeclaration, BehaviorDeclaration, FieldDeclaration } from '@intentos/isl-core';
import {
  review,
  SpecReviewer,
  analyzeCompleteness,
  analyzeConsistency,
  analyzeSecurity,
  analyzePerformance,
  analyzeNaming,
  analyzeBestPractices,
  generateSuggestions,
  findApplicableTemplates,
  AIClient,
  createMockAIClient,
  formatConsole,
  formatMarkdown,
  formatSarif,
} from '../src/index.js';

// ============================================================================
// FIXTURES
// ============================================================================

function createMinimalDomain(overrides: Partial<DomainDeclaration> = {}): DomainDeclaration {
  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name: 'TestDomain' },
    types: [],
    enums: [],
    entities: [],
    behaviors: [],
    invariants: [],
    policies: [],
    ...overrides,
  };
}

function createEntity(name: string, fields: Partial<FieldDeclaration>[] = []): EntityDeclaration {
  return {
    kind: 'Entity',
    name: { kind: 'Identifier', name },
    fields: fields.map((f, i) => ({
      kind: 'Field',
      name: { kind: 'Identifier', name: f.name?.name ?? `field${i}` },
      type: f.type ?? { kind: 'SimpleType', name: { kind: 'Identifier', name: 'String' } },
      optional: f.optional ?? false,
      annotations: f.annotations ?? [],
      constraints: f.constraints ?? [],
      ...f,
    })) as FieldDeclaration[],
    invariants: [],
  };
}

function createBehavior(name: string, config: Partial<BehaviorDeclaration> = {}): BehaviorDeclaration {
  return {
    kind: 'Behavior',
    name: { kind: 'Identifier', name },
    input: config.input,
    output: config.output ?? {
      success: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'Boolean' } },
      errors: [],
    },
    preconditions: config.preconditions,
    postconditions: config.postconditions,
    temporal: config.temporal,
    security: config.security,
    description: config.description,
    ...config,
  };
}

// ============================================================================
// COMPLETENESS ANALYZER TESTS
// ============================================================================

describe('Completeness Analyzer', () => {
  it('should detect behavior without output', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('CreateUser', { output: undefined }),
      ],
    });

    const result = analyzeCompleteness(domain);

    expect(result.issues.some(i => 
      i.title.includes('no output') && i.severity === 'critical'
    )).toBe(true);
  });

  it('should detect behavior without description', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('CreateUser'),
      ],
    });

    const result = analyzeCompleteness(domain);

    expect(result.issues.some(i => 
      i.title.includes('no description')
    )).toBe(true);
  });

  it('should detect entity without invariants', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('User', [
          { name: { kind: 'Identifier', name: 'id' } },
        ]),
      ],
    });

    const result = analyzeCompleteness(domain);

    expect(result.issues.some(i => 
      i.title.includes('no invariants')
    )).toBe(true);
  });

  it('should detect behavior without pre/postconditions', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('UpdateUser'),
      ],
    });

    const result = analyzeCompleteness(domain);

    expect(result.issues.some(i => 
      i.title.includes('no pre/postconditions')
    )).toBe(true);
  });

  it('should calculate score based on issues', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('Test', { output: undefined }),
      ],
    });

    const result = analyzeCompleteness(domain);

    expect(result.score).toBeLessThan(100);
  });
});

// ============================================================================
// CONSISTENCY ANALYZER TESTS
// ============================================================================

describe('Consistency Analyzer', () => {
  it('should detect undefined types', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('User', [
          {
            name: { kind: 'Identifier', name: 'status' },
            type: { 
              kind: 'SimpleType', 
              name: { kind: 'Identifier', name: 'UndefinedStatus' },
            },
          },
        ]),
      ],
    });

    const result = analyzeConsistency(domain);

    expect(result.issues.some(i => 
      i.title.includes('Undefined type') && i.severity === 'critical'
    )).toBe(true);
  });

  it('should detect duplicate error codes', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('CreateUser', {
          output: {
            success: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'User' } },
            errors: [
              { name: { kind: 'Identifier', name: 'NOT_FOUND' } },
              { name: { kind: 'Identifier', name: 'NOT_FOUND' } },
            ],
          },
        }),
      ],
    });

    const result = analyzeConsistency(domain);

    expect(result.issues.some(i => 
      i.title.includes('Duplicate error code')
    )).toBe(true);
  });
});

// ============================================================================
// SECURITY ANALYZER TESTS
// ============================================================================

describe('Security Analyzer', () => {
  it('should detect sensitive fields without annotations', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('User', [
          { name: { kind: 'Identifier', name: 'password' } },
        ]),
      ],
    });

    const result = analyzeSecurity(domain);

    expect(result.issues.some(i => 
      i.title.includes('password') && i.title.includes('not marked as [secret]')
    )).toBe(true);
  });

  it('should detect PII fields without annotations', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('User', [
          { name: { kind: 'Identifier', name: 'email' } },
          { name: { kind: 'Identifier', name: 'phoneNumber' } },
        ]),
      ],
    });

    const result = analyzeSecurity(domain);

    expect(result.issues.filter(i => 
      i.title.includes('PII')
    ).length).toBeGreaterThan(0);
  });

  it('should detect state-modifying behaviors without security', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('CreateUser'),
        createBehavior('DeleteUser'),
      ],
    });

    const result = analyzeSecurity(domain);

    expect(result.issues.some(i => 
      i.title.includes('lacks security block')
    )).toBe(true);
  });

  it('should include CWE references', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('User', [
          { name: { kind: 'Identifier', name: 'password' } },
        ]),
      ],
    });

    const result = analyzeSecurity(domain);
    const passwordIssue = result.issues.find(i => i.title.includes('password'));

    expect(passwordIssue?.cwe).toBeDefined();
  });
});

// ============================================================================
// PERFORMANCE ANALYZER TESTS
// ============================================================================

describe('Performance Analyzer', () => {
  it('should detect missing indexes on foreign keys', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('Order', [
          { name: { kind: 'Identifier', name: 'user_id' } },
        ]),
      ],
    });

    const result = analyzePerformance(domain);

    expect(result.issues.some(i => 
      i.title.includes('not indexed') && i.title.includes('user_id')
    )).toBe(true);
  });

  it('should detect unbounded list operations', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('ListUsers', {
          input: { fields: [] },
        }),
      ],
    });

    const result = analyzePerformance(domain);

    expect(result.issues.some(i => 
      i.title.includes('Unbounded query')
    )).toBe(true);
  });

  it('should detect missing batch operations', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('CreateOrder'),
        createBehavior('SendEmail'),
      ],
    });

    const result = analyzePerformance(domain);

    expect(result.issues.some(i => 
      i.title.includes('No batch version')
    )).toBe(true);
  });
});

// ============================================================================
// NAMING ANALYZER TESTS
// ============================================================================

describe('Naming Analyzer', () => {
  it('should detect non-PascalCase entity names', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('user_entity'),
      ],
    });

    const result = analyzeNaming(domain);

    expect(result.issues.some(i => 
      i.title.includes('should be PascalCase')
    )).toBe(true);
  });

  it('should detect plural entity names', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('Users'),
      ],
    });

    const result = analyzeNaming(domain);

    expect(result.issues.some(i => 
      i.title.includes('appears to be plural')
    )).toBe(true);
  });

  it('should detect behaviors not starting with verbs', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('UserCreation'),
      ],
    });

    const result = analyzeNaming(domain);

    expect(result.issues.some(i => 
      i.title.includes('should start with a verb')
    )).toBe(true);
  });

  it('should suggest better names', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('user_model'),
      ],
    });

    const result = analyzeNaming(domain);
    const issue = result.issues.find(i => i.title.includes('PascalCase'));

    expect(issue?.suggestedName).toBeDefined();
  });
});

// ============================================================================
// BEST PRACTICES ANALYZER TESTS
// ============================================================================

describe('Best Practices Analyzer', () => {
  it('should detect missing domain version', () => {
    const domain = createMinimalDomain();

    const result = analyzeBestPractices(domain);

    expect(result.issues.some(i => 
      i.title.includes('no version')
    )).toBe(true);
  });

  it('should detect entities with too many fields', () => {
    const fields = Array.from({ length: 35 }, (_, i) => ({
      name: { kind: 'Identifier' as const, name: `field${i}` },
    }));
    
    const domain = createMinimalDomain({
      entities: [createEntity('BigEntity', fields)],
    });

    const result = analyzeBestPractices(domain);

    expect(result.issues.some(i => 
      i.title.includes('too many fields')
    )).toBe(true);
  });

  it('should detect entities without ID field', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('User', [
          { name: { kind: 'Identifier', name: 'name' } },
          { name: { kind: 'Identifier', name: 'email' } },
        ]),
      ],
    });

    const result = analyzeBestPractices(domain);

    expect(result.issues.some(i => 
      i.title.includes('lack proper ID field')
    )).toBe(true);
  });
});

// ============================================================================
// SUGGESTION GENERATOR TESTS
// ============================================================================

describe('Suggestion Generator', () => {
  it('should generate suggestions for entities without timestamps', () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('User', [
          { name: { kind: 'Identifier', name: 'id' } },
          { name: { kind: 'Identifier', name: 'name' } },
        ]),
      ],
    });

    const suggestions = generateSuggestions(domain);

    expect(suggestions.some(s => 
      s.title.includes('timestamp')
    )).toBe(true);
  });

  it('should generate suggestions for behaviors without pagination', () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('ListUsers', {
          input: { fields: [] },
        }),
      ],
    });

    const suggestions = generateSuggestions(domain);

    expect(suggestions.some(s => 
      s.title.includes('pagination')
    )).toBe(true);
  });

  it('should respect minConfidence option', () => {
    const domain = createMinimalDomain({
      entities: [createEntity('User')],
      behaviors: [createBehavior('CreateUser')],
    });

    const lowConfidence = generateSuggestions(domain, { minConfidence: 0.1 });
    const highConfidence = generateSuggestions(domain, { minConfidence: 0.9 });

    expect(lowConfidence.length).toBeGreaterThanOrEqual(highConfidence.length);
  });
});

// ============================================================================
// TEMPLATE TESTS
// ============================================================================

describe('Suggestion Templates', () => {
  it('should find applicable templates', () => {
    const templates = findApplicableTemplates({
      entityName: 'User',
    });

    expect(templates.length).toBeGreaterThan(0);
  });

  it('should find pagination template for list behaviors', () => {
    const templates = findApplicableTemplates({
      behaviorName: 'ListUsers',
    });

    expect(templates.some(t => t.id === 'add-pagination')).toBe(true);
  });

  it('should generate code from templates', () => {
    const templates = findApplicableTemplates({
      entityName: 'User',
    });
    
    const template = templates.find(t => t.id === 'add-timestamps');
    const code = template?.generateCode?.({ entityName: 'User' });

    expect(code).toContain('created_at');
    expect(code).toContain('updated_at');
  });
});

// ============================================================================
// AI CLIENT TESTS
// ============================================================================

describe('AI Client', () => {
  it('should create mock client', () => {
    const client = createMockAIClient();

    expect(client.isConfigured()).toBe(true);
    expect(client.getStatus().provider).toBe('mock');
  });

  it('should perform mock review', async () => {
    const client = createMockAIClient();
    
    const response = await client.review({
      spec: 'domain Test { entity User { id: UUID } }',
    });

    expect(response.success).toBe(true);
    expect(response.parsed).toBeDefined();
    expect(response.parsed?.score).toBeGreaterThan(0);
  });

  it('should return latency information', async () => {
    const client = createMockAIClient();
    
    const response = await client.review({
      spec: 'domain Test {}',
    });

    expect(response.latencyMs).toBeDefined();
    expect(response.latencyMs).toBeGreaterThan(0);
  });
});

// ============================================================================
// MAIN REVIEWER TESTS
// ============================================================================

describe('Spec Reviewer', () => {
  it('should perform full review', async () => {
    const domain = createMinimalDomain({
      version: '1.0.0',
      entities: [
        createEntity('User', [
          { 
            name: { kind: 'Identifier', name: 'id' },
            annotations: [{ name: { kind: 'Identifier', name: 'unique' } }],
          },
          { name: { kind: 'Identifier', name: 'email' } },
        ]),
      ],
      behaviors: [
        createBehavior('CreateUser', {
          description: 'Create a new user',
          input: { fields: [] },
        }),
      ],
    });

    const result = await review(domain);

    expect(result.summary.score).toBeGreaterThan(0);
    expect(result.summary.score).toBeLessThanOrEqual(100);
    expect(result.categories).toBeDefined();
    expect(result.issues).toBeDefined();
    expect(result.metadata.reviewedAt).toBeDefined();
  });

  it('should filter by severity', async () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('Test', { output: undefined }), // Critical
      ],
    });

    const result = await review(domain, { minSeverity: 'critical' });

    expect(result.issues.every(i => i.severity === 'critical')).toBe(true);
  });

  it('should limit categories', async () => {
    const domain = createMinimalDomain();

    const result = await review(domain, {
      categories: ['security', 'naming'],
    });

    expect(result.metadata.categoriesAnalyzed).toEqual(['security', 'naming']);
  });

  it('should include AI analysis when enabled', async () => {
    const domain = createMinimalDomain();

    const result = await review(domain, {
      useAI: true,
      aiConfig: { provider: 'mock' },
    });

    expect(result.aiAnalysis).toBeDefined();
    expect(result.metadata.aiEnabled).toBe(true);
  });

  it('should calculate overall score', async () => {
    const domain = createMinimalDomain({
      version: '1.0.0',
      entities: [
        createEntity('User', [
          { 
            name: { kind: 'Identifier', name: 'id' },
            annotations: [
              { name: { kind: 'Identifier', name: 'unique' } },
              { name: { kind: 'Identifier', name: 'immutable' } },
            ],
          },
        ]),
      ],
    });

    const result = await review(domain);

    // Score should be average of category scores
    const categoryScores = Object.values(result.categories).map(c => c.score);
    const expectedAvg = Math.round(
      categoryScores.reduce((sum, s) => sum + s, 0) / categoryScores.length
    );
    
    expect(result.summary.score).toBe(expectedAvg);
  });
});

// ============================================================================
// REPORTER TESTS
// ============================================================================

describe('Console Reporter', () => {
  it('should format results for console', async () => {
    const domain = createMinimalDomain();
    const result = await review(domain);

    const output = formatConsole(result);

    expect(output).toContain('ISL SPEC REVIEW REPORT');
    expect(output).toContain('Overall Score');
  });

  it('should support no-color mode', async () => {
    const domain = createMinimalDomain();
    const result = await review(domain);

    const output = formatConsole(result, { colors: false });

    expect(output).not.toContain('\x1b[');
  });
});

describe('Markdown Reporter', () => {
  it('should format results as markdown', async () => {
    const domain = createMinimalDomain();
    const result = await review(domain);

    const output = formatMarkdown(result);

    expect(output).toContain('# ISL Spec Review Report');
    expect(output).toContain('## Summary');
    expect(output).toContain('| Category | Score |');
  });

  it('should include table of contents', async () => {
    const domain = createMinimalDomain();
    const result = await review(domain);

    const output = formatMarkdown(result, { includeTableOfContents: true });

    expect(output).toContain('## Table of Contents');
  });
});

describe('SARIF Reporter', () => {
  it('should format results as SARIF', async () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('User', [
          { name: { kind: 'Identifier', name: 'password' } },
        ]),
      ],
    });
    const result = await review(domain);

    const output = formatSarif(result);
    const parsed = JSON.parse(output);

    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs).toBeDefined();
    expect(parsed.runs[0].tool.driver.name).toBe('isl-spec-reviewer');
    expect(parsed.runs[0].results.length).toBeGreaterThan(0);
  });

  it('should include rules for all issues', async () => {
    const domain = createMinimalDomain({
      behaviors: [
        createBehavior('Test', { output: undefined }),
      ],
    });
    const result = await review(domain);

    const output = formatSarif(result);
    const parsed = JSON.parse(output);

    expect(parsed.runs[0].tool.driver.rules.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration', () => {
  it('should handle complex domain', async () => {
    const domain = createMinimalDomain({
      version: '1.0.0',
      enums: [
        {
          kind: 'Enum',
          name: { kind: 'Identifier', name: 'UserStatus' },
          variants: [
            { name: 'ACTIVE' },
            { name: 'INACTIVE' },
          ],
        },
      ],
      entities: [
        createEntity('User', [
          { 
            name: { kind: 'Identifier', name: 'id' },
            annotations: [
              { name: { kind: 'Identifier', name: 'unique' } },
              { name: { kind: 'Identifier', name: 'immutable' } },
            ],
          },
          { name: { kind: 'Identifier', name: 'email' } },
          { 
            name: { kind: 'Identifier', name: 'status' },
            type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'UserStatus' } },
          },
          { name: { kind: 'Identifier', name: 'created_at' } },
        ]),
      ],
      behaviors: [
        createBehavior('CreateUser', {
          description: 'Create a new user',
          input: {
            fields: [
              {
                kind: 'Field',
                name: { kind: 'Identifier', name: 'email' },
                type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'String' } },
                optional: false,
              },
            ],
          },
          output: {
            success: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'User' } },
            errors: [
              { name: { kind: 'Identifier', name: 'VALIDATION_ERROR' } },
            ],
          },
          preconditions: {
            conditions: [],
          },
          postconditions: {
            conditions: [],
          },
        }),
        createBehavior('GetUser', {
          description: 'Get user by ID',
          input: {
            fields: [
              {
                kind: 'Field',
                name: { kind: 'Identifier', name: 'id' },
                type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'UUID' } },
                optional: false,
              },
            ],
          },
          output: {
            success: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'User' } },
            errors: [
              { name: { kind: 'Identifier', name: 'NOT_FOUND' } },
            ],
          },
        }),
      ],
    });

    const result = await review(domain);

    // Should complete without errors
    expect(result.summary).toBeDefined();
    expect(result.categories).toBeDefined();
    
    // Should have reasonable score
    expect(result.summary.score).toBeGreaterThan(0);
  });

  it('should provide actionable output', async () => {
    const domain = createMinimalDomain({
      entities: [
        createEntity('User', [
          { name: { kind: 'Identifier', name: 'password' } }, // Should trigger security issue
        ]),
      ],
      behaviors: [
        createBehavior('ListUsers'), // Should trigger performance issue
      ],
    });

    const result = await review(domain);

    // Should have issues with fixes
    const issuesWithFixes = result.issues.filter(i => i.fix);
    expect(issuesWithFixes.length).toBeGreaterThan(0);

    // Should have suggestions with code
    const suggestionsWithCode = result.suggestions.filter(s => s.suggestedCode);
    expect(suggestionsWithCode.length).toBeGreaterThan(0);
  });
});
