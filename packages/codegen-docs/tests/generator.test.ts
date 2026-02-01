// ============================================================================
// Documentation Generator Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { generate } from '../src/generator';
import { generateMarkdown } from '../src/markdown';
import { generateOpenAPI } from '../src/openapi';
import { generateMermaidDiagrams } from '../src/diagrams';
import { generateExamples } from '../src/examples';
import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createSourceLocation = (): AST.SourceLocation => ({
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
});

const createMinimalDomain = (): AST.Domain => ({
  kind: 'Domain',
  name: { kind: 'Identifier', name: 'TestDomain', location: createSourceLocation() },
  version: { kind: 'StringLiteral', value: '1.0.0', location: createSourceLocation() },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      name: { kind: 'Identifier', name: 'User', location: createSourceLocation() },
      fields: [
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'id', location: createSourceLocation() },
          type: { kind: 'PrimitiveType', name: 'UUID', location: createSourceLocation() },
          optional: false,
          annotations: [
            { kind: 'Annotation', name: { kind: 'Identifier', name: 'immutable', location: createSourceLocation() }, location: createSourceLocation() },
            { kind: 'Annotation', name: { kind: 'Identifier', name: 'unique', location: createSourceLocation() }, location: createSourceLocation() },
          ],
          location: createSourceLocation(),
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'email', location: createSourceLocation() },
          type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
      ],
      invariants: [],
      location: createSourceLocation(),
    },
  ],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: createSourceLocation(),
});

const createDomainWithBehavior = (): AST.Domain => {
  const domain = createMinimalDomain();
  domain.behaviors = [
    {
      kind: 'Behavior',
      name: { kind: 'Identifier', name: 'CreateUser', location: createSourceLocation() },
      description: { kind: 'StringLiteral', value: 'Create a new user', location: createSourceLocation() },
      input: {
        kind: 'InputSpec',
        fields: [
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'email', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
            optional: false,
            annotations: [],
            location: createSourceLocation(),
          },
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'name', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
            optional: true,
            annotations: [],
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      output: {
        kind: 'OutputSpec',
        success: {
          kind: 'ReferenceType',
          name: {
            kind: 'QualifiedName',
            parts: [{ kind: 'Identifier', name: 'User', location: createSourceLocation() }],
            location: createSourceLocation(),
          },
          location: createSourceLocation(),
        },
        errors: [
          {
            kind: 'ErrorSpec',
            name: { kind: 'Identifier', name: 'DUPLICATE_EMAIL', location: createSourceLocation() },
            when: { kind: 'StringLiteral', value: 'Email already exists', location: createSourceLocation() },
            retriable: false,
            location: createSourceLocation(),
          },
          {
            kind: 'ErrorSpec',
            name: { kind: 'Identifier', name: 'RATE_LIMITED', location: createSourceLocation() },
            when: { kind: 'StringLiteral', value: 'Too many requests', location: createSourceLocation() },
            retriable: true,
            retryAfter: { kind: 'DurationLiteral', value: 60, unit: 'seconds', location: createSourceLocation() },
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      preconditions: [
        {
          kind: 'MemberExpr',
          object: { kind: 'Identifier', name: 'input', location: createSourceLocation() },
          property: { kind: 'Identifier', name: 'email', location: createSourceLocation() },
          location: createSourceLocation(),
        } as AST.MemberExpr,
      ],
      postconditions: [
        {
          kind: 'PostconditionBlock',
          condition: 'success',
          predicates: [
            {
              kind: 'CallExpr',
              callee: {
                kind: 'MemberExpr',
                object: { kind: 'Identifier', name: 'User', location: createSourceLocation() },
                property: { kind: 'Identifier', name: 'exists', location: createSourceLocation() },
                location: createSourceLocation(),
              },
              arguments: [
                {
                  kind: 'MemberExpr',
                  object: { kind: 'Identifier', name: 'result', location: createSourceLocation() },
                  property: { kind: 'Identifier', name: 'id', location: createSourceLocation() },
                  location: createSourceLocation(),
                },
              ],
              location: createSourceLocation(),
            } as AST.CallExpr,
          ],
          location: createSourceLocation(),
        },
      ],
      invariants: [],
      temporal: [
        {
          kind: 'TemporalSpec',
          operator: 'within',
          predicate: { kind: 'Identifier', name: 'response', location: createSourceLocation() },
          duration: { kind: 'DurationLiteral', value: 200, unit: 'ms', location: createSourceLocation() },
          percentile: 50,
          location: createSourceLocation(),
        },
      ],
      security: [
        {
          kind: 'SecuritySpec',
          type: 'rate_limit',
          details: { kind: 'Identifier', name: '10/minute', location: createSourceLocation() },
          location: createSourceLocation(),
        },
      ],
      compliance: [],
      location: createSourceLocation(),
    },
  ];
  return domain;
};

const createDomainWithLifecycle = (): AST.Domain => {
  const domain = createMinimalDomain();
  domain.entities[0].lifecycle = {
    kind: 'LifecycleSpec',
    transitions: [
      {
        kind: 'LifecycleTransition',
        from: { kind: 'Identifier', name: 'PENDING', location: createSourceLocation() },
        to: { kind: 'Identifier', name: 'ACTIVE', location: createSourceLocation() },
        location: createSourceLocation(),
      },
      {
        kind: 'LifecycleTransition',
        from: { kind: 'Identifier', name: 'ACTIVE', location: createSourceLocation() },
        to: { kind: 'Identifier', name: 'SUSPENDED', location: createSourceLocation() },
        location: createSourceLocation(),
      },
      {
        kind: 'LifecycleTransition',
        from: { kind: 'Identifier', name: 'SUSPENDED', location: createSourceLocation() },
        to: { kind: 'Identifier', name: 'ACTIVE', location: createSourceLocation() },
        location: createSourceLocation(),
      },
      {
        kind: 'LifecycleTransition',
        from: { kind: 'Identifier', name: 'ACTIVE', location: createSourceLocation() },
        to: { kind: 'Identifier', name: 'DELETED', location: createSourceLocation() },
        location: createSourceLocation(),
      },
    ],
    location: createSourceLocation(),
  };
  return domain;
};

// ============================================================================
// GENERATOR TESTS
// ============================================================================

describe('generate', () => {
  describe('markdown format', () => {
    it('should generate README.md for domain', () => {
      const domain = createMinimalDomain();
      const files = generate(domain, { format: 'markdown' });
      
      const readme = files.find(f => f.path.endsWith('README.md'));
      expect(readme).toBeDefined();
      expect(readme?.type).toBe('documentation');
      expect(readme?.content).toContain('# TestDomain Domain');
      expect(readme?.content).toContain('Version: 1.0.0');
    });

    it('should generate entity documentation files', () => {
      const domain = createMinimalDomain();
      const files = generate(domain, { format: 'markdown' });
      
      const entityDoc = files.find(f => f.path.includes('entities/User.md'));
      expect(entityDoc).toBeDefined();
      expect(entityDoc?.content).toContain('# User');
    });

    it('should generate behavior documentation files', () => {
      const domain = createDomainWithBehavior();
      const files = generate(domain, { format: 'markdown' });
      
      const behaviorDoc = files.find(f => f.path.includes('behaviors/CreateUser.md'));
      expect(behaviorDoc).toBeDefined();
      expect(behaviorDoc?.content).toContain('# CreateUser');
      expect(behaviorDoc?.content).toContain('Create a new user');
    });

    it('should generate diagrams when includeDiagrams is true', () => {
      const domain = createDomainWithLifecycle();
      const files = generate(domain, { format: 'markdown', includeDiagrams: true });
      
      const diagrams = files.filter(f => f.type === 'diagram');
      expect(diagrams.length).toBeGreaterThan(0);
    });

    it('should generate examples when includeExamples is true', () => {
      const domain = createDomainWithBehavior();
      const files = generate(domain, { format: 'markdown', includeExamples: true });
      
      const examples = files.filter(f => f.type === 'example');
      expect(examples.length).toBeGreaterThan(0);
    });
  });

  describe('openapi format', () => {
    it('should generate OpenAPI spec file', () => {
      const domain = createDomainWithBehavior();
      const files = generate(domain, { format: 'openapi' });
      
      const spec = files.find(f => f.path.endsWith('openapi.yaml'));
      expect(spec).toBeDefined();
      expect(spec?.type).toBe('openapi');
      expect(spec?.content).toContain('openapi: 3.0.3');
    });

    it('should generate API overview markdown', () => {
      const domain = createDomainWithBehavior();
      const files = generate(domain, { format: 'openapi' });
      
      const apiDoc = files.find(f => f.path.endsWith('API.md'));
      expect(apiDoc).toBeDefined();
      expect(apiDoc?.content).toContain('API Reference');
    });
  });
});

// ============================================================================
// MARKDOWN GENERATOR TESTS
// ============================================================================

describe('generateMarkdown', () => {
  it('should include table of contents', () => {
    const domain = createMinimalDomain();
    const markdown = generateMarkdown(domain);
    
    expect(markdown).toContain('## Table of Contents');
    expect(markdown).toContain('[Overview](#overview)');
    expect(markdown).toContain('[Entities](#entities)');
  });

  it('should include domain statistics', () => {
    const domain = createMinimalDomain();
    const markdown = generateMarkdown(domain);
    
    expect(markdown).toContain('### Domain Statistics');
    expect(markdown).toContain('| Entities | 1 |');
  });

  it('should document entity fields with types and modifiers', () => {
    const domain = createMinimalDomain();
    const markdown = generateMarkdown(domain);
    
    expect(markdown).toContain('| id | `UUID`');
    expect(markdown).toContain('`immutable`');
    expect(markdown).toContain('`unique`');
  });

  it('should document behavior input/output', () => {
    const domain = createDomainWithBehavior();
    const markdown = generateMarkdown(domain);
    
    expect(markdown).toContain('### CreateUser');
    expect(markdown).toContain('#### Input');
    expect(markdown).toContain('| email |');
    expect(markdown).toContain('#### Output');
    expect(markdown).toContain('`User`');
  });

  it('should document error codes', () => {
    const domain = createDomainWithBehavior();
    const markdown = generateMarkdown(domain);
    
    expect(markdown).toContain('DUPLICATE_EMAIL');
    expect(markdown).toContain('RATE_LIMITED');
    expect(markdown).toContain('Too many requests');
  });

  it('should include lifecycle diagrams when requested', () => {
    const domain = createDomainWithLifecycle();
    const markdown = generateMarkdown(domain, { includeDiagrams: true });
    
    expect(markdown).toContain('```mermaid');
    expect(markdown).toContain('stateDiagram-v2');
    expect(markdown).toContain('PENDING --> ACTIVE');
  });
});

// ============================================================================
// OPENAPI GENERATOR TESTS
// ============================================================================

describe('generateOpenAPI', () => {
  it('should generate valid OpenAPI 3.0 structure', () => {
    const domain = createDomainWithBehavior();
    const yaml = generateOpenAPI(domain, {
      baseUrl: 'https://api.test.com',
      title: 'Test API',
    });
    
    expect(yaml).toContain('openapi: 3.0.3');
    expect(yaml).toContain('title: Test API');
    expect(yaml).toContain('url: https://api.test.com');
  });

  it('should generate paths for behaviors', () => {
    const domain = createDomainWithBehavior();
    const yaml = generateOpenAPI(domain, {
      baseUrl: 'https://api.test.com',
      title: 'Test API',
    });
    
    expect(yaml).toContain('/create-user:');
    expect(yaml).toContain('post:');
    expect(yaml).toContain('operationId: createUser');
  });

  it('should generate request schemas', () => {
    const domain = createDomainWithBehavior();
    const yaml = generateOpenAPI(domain, {
      baseUrl: 'https://api.test.com',
      title: 'Test API',
    });
    
    expect(yaml).toContain('CreateUserRequest:');
    expect(yaml).toContain('email:');
  });

  it('should generate error responses', () => {
    const domain = createDomainWithBehavior();
    const yaml = generateOpenAPI(domain, {
      baseUrl: 'https://api.test.com',
      title: 'Test API',
    });
    
    expect(yaml).toContain('409:'); // Conflict for DUPLICATE_EMAIL
    expect(yaml).toContain('429:'); // Rate limited
  });

  it('should include entity schemas', () => {
    const domain = createDomainWithBehavior();
    const yaml = generateOpenAPI(domain, {
      baseUrl: 'https://api.test.com',
      title: 'Test API',
    });
    
    expect(yaml).toContain('User:');
    expect(yaml).toContain('type: object');
  });
});

// ============================================================================
// DIAGRAM GENERATOR TESTS
// ============================================================================

describe('generateMermaidDiagrams', () => {
  it('should generate lifecycle diagram for entity with lifecycle', () => {
    const domain = createDomainWithLifecycle();
    const diagrams = generateMermaidDiagrams(domain);
    
    const lifecycleDiagram = diagrams.find(d => d.name === 'UserLifecycle');
    expect(lifecycleDiagram).toBeDefined();
    expect(lifecycleDiagram?.type).toBe('stateDiagram');
    expect(lifecycleDiagram?.content).toContain('PENDING --> ACTIVE');
    expect(lifecycleDiagram?.content).toContain('ACTIVE --> SUSPENDED');
    expect(lifecycleDiagram?.content).toContain('DELETED --> [*]');
  });

  it('should generate ER diagram for entities', () => {
    const domain = createMinimalDomain();
    const diagrams = generateMermaidDiagrams(domain);
    
    const erDiagram = diagrams.find(d => d.name === 'EntityRelationships');
    expect(erDiagram).toBeDefined();
    expect(erDiagram?.type).toBe('erDiagram');
    expect(erDiagram?.content).toContain('User {');
    expect(erDiagram?.content).toContain('UUID id');
  });

  it('should generate behavior flow diagram', () => {
    const domain = createDomainWithBehavior();
    const diagrams = generateMermaidDiagrams(domain);
    
    const flowDiagram = diagrams.find(d => d.name === 'CreateUserFlow');
    expect(flowDiagram).toBeDefined();
    expect(flowDiagram?.type).toBe('flowchart');
    expect(flowDiagram?.content).toContain('Start([CreateUser])');
    expect(flowDiagram?.content).toContain('Execute[Execute Operation]');
  });

  it('should generate domain overview diagram', () => {
    const domain = createDomainWithBehavior();
    const diagrams = generateMermaidDiagrams(domain);
    
    const overviewDiagram = diagrams.find(d => d.name === 'DomainOverview');
    expect(overviewDiagram).toBeDefined();
    expect(overviewDiagram?.content).toContain('TestDomain Domain');
    expect(overviewDiagram?.content).toContain('Entities');
    expect(overviewDiagram?.content).toContain('Behaviors');
  });
});

// ============================================================================
// EXAMPLE GENERATOR TESTS
// ============================================================================

describe('generateExamples', () => {
  it('should generate request examples for behaviors', () => {
    const domain = createDomainWithBehavior();
    const examples = generateExamples(domain);
    
    const requestExample = examples.find(e => e.name.includes('Request'));
    expect(requestExample).toBeDefined();
    expect(requestExample?.type).toBe('request');
    
    const content = JSON.parse(requestExample!.content);
    expect(content).toHaveProperty('email');
  });

  it('should generate response examples', () => {
    const domain = createDomainWithBehavior();
    const examples = generateExamples(domain);
    
    const responseExample = examples.find(e => e.name.includes('Success Response'));
    expect(responseExample).toBeDefined();
    expect(responseExample?.type).toBe('response');
    
    const content = JSON.parse(responseExample!.content);
    expect(content.success).toBe(true);
  });

  it('should generate error examples', () => {
    const domain = createDomainWithBehavior();
    const examples = generateExamples(domain);
    
    const errorExample = examples.find(e => e.name.includes('DUPLICATE_EMAIL'));
    expect(errorExample).toBeDefined();
    expect(errorExample?.type).toBe('error');
    
    const content = JSON.parse(errorExample!.content);
    expect(content.success).toBe(false);
    expect(content.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('should generate contextual example values', () => {
    const domain = createDomainWithBehavior();
    const examples = generateExamples(domain);
    
    const requestExample = examples.find(e => e.name.includes('Request'));
    const content = JSON.parse(requestExample!.content);
    
    // Email field should have email-like value
    expect(content.email).toContain('@');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('integration', () => {
  it('should generate complete documentation set', () => {
    const domain = createDomainWithBehavior();
    const files = generate(domain, {
      format: 'markdown',
      includeDiagrams: true,
      includeExamples: true,
    });
    
    // Should have multiple files
    expect(files.length).toBeGreaterThan(3);
    
    // Should have various types
    const types = new Set(files.map(f => f.type));
    expect(types.has('documentation')).toBe(true);
    expect(types.has('diagram')).toBe(true);
    expect(types.has('example')).toBe(true);
  });

  it('should handle domain with all features', () => {
    const domain = createDomainWithBehavior();
    domain.entities[0].lifecycle = createDomainWithLifecycle().entities[0].lifecycle;
    domain.types = [
      {
        kind: 'TypeDeclaration',
        name: { kind: 'Identifier', name: 'Email', location: createSourceLocation() },
        definition: {
          kind: 'ConstrainedType',
          base: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
          constraints: [
            {
              kind: 'Constraint',
              name: 'max_length',
              value: { kind: 'NumberLiteral', value: 254, isFloat: false, location: createSourceLocation() },
              location: createSourceLocation(),
            },
          ],
          location: createSourceLocation(),
        },
        annotations: [],
        location: createSourceLocation(),
      },
    ];
    
    // Should not throw
    expect(() => generate(domain, { format: 'markdown' })).not.toThrow();
    expect(() => generate(domain, { format: 'openapi' })).not.toThrow();
  });
});
