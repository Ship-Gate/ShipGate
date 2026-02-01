// ============================================================================
// Tests for Advanced Documentation Generator
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type * as AST from '../../../master_contracts/ast';
import {
  generateDocs,
  generateAPIReference,
  generateTutorials,
  extractExamples,
  generateMermaidSequenceDiagram,
  generateMermaidStateDiagram,
  getTheme,
  mergeTheme,
} from '../src';

// ============================================================================
// MOCK DATA
// ============================================================================

function createMockDomain(): AST.Domain {
  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name: 'TestDomain' },
    version: { kind: 'StringLiteral', value: '1.0.0' },
    owner: { kind: 'StringLiteral', value: 'TestOwner' },
    imports: [],
    types: [
      {
        kind: 'TypeDeclaration',
        name: { kind: 'Identifier', name: 'Email' },
        definition: {
          kind: 'ConstrainedType',
          base: { kind: 'PrimitiveType', name: 'String' },
          constraints: [
            {
              name: 'format',
              value: { kind: 'StringLiteral', value: 'email' },
            },
          ],
        },
        annotations: [],
      },
    ],
    entities: [
      {
        kind: 'Entity',
        name: { kind: 'Identifier', name: 'User' },
        fields: [
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'id' },
            type: { kind: 'PrimitiveType', name: 'UUID' },
            optional: false,
            annotations: [
              { kind: 'Annotation', name: { kind: 'Identifier', name: 'unique' } },
            ],
          },
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'email' },
            type: {
              kind: 'ReferenceType',
              name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'Email' }] },
            },
            optional: false,
            annotations: [],
          },
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'name' },
            type: { kind: 'PrimitiveType', name: 'String' },
            optional: false,
            annotations: [],
          },
        ],
        invariants: [
          {
            kind: 'BinaryExpr',
            operator: '!=',
            left: {
              kind: 'MemberExpr',
              object: { kind: 'Identifier', name: 'this' },
              property: { kind: 'Identifier', name: 'email' },
            },
            right: { kind: 'StringLiteral', value: '' },
          },
        ],
        annotations: [],
      },
    ],
    behaviors: [
      {
        kind: 'Behavior',
        name: { kind: 'Identifier', name: 'CreateUser' },
        description: { kind: 'StringLiteral', value: 'Create a new user account' },
        actors: [
          {
            kind: 'ActorSpec',
            name: { kind: 'Identifier', name: 'Admin' },
            constraints: [],
          },
        ],
        input: {
          kind: 'InputSpec',
          fields: [
            {
              kind: 'Field',
              name: { kind: 'Identifier', name: 'email' },
              type: {
                kind: 'ReferenceType',
                name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'Email' }] },
              },
              optional: false,
              annotations: [],
            },
            {
              kind: 'Field',
              name: { kind: 'Identifier', name: 'name' },
              type: { kind: 'PrimitiveType', name: 'String' },
              optional: false,
              annotations: [],
            },
          ],
        },
        output: {
          kind: 'OutputSpec',
          success: {
            kind: 'ReferenceType',
            name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'User' }] },
          },
          errors: [
            {
              kind: 'ErrorSpec',
              name: { kind: 'Identifier', name: 'EMAIL_EXISTS' },
              when: { kind: 'StringLiteral', value: 'Email already registered' },
              retriable: false,
            },
            {
              kind: 'ErrorSpec',
              name: { kind: 'Identifier', name: 'INVALID_INPUT' },
              retriable: true,
            },
          ],
        },
        preconditions: [
          {
            kind: 'UnaryExpr',
            operator: 'not',
            operand: {
              kind: 'CallExpr',
              callee: {
                kind: 'MemberExpr',
                object: { kind: 'Identifier', name: 'User' },
                property: { kind: 'Identifier', name: 'exists' },
              },
              arguments: [
                {
                  kind: 'InputExpr',
                  property: { kind: 'Identifier', name: 'email' },
                },
              ],
            },
          },
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
                  object: { kind: 'Identifier', name: 'User' },
                  property: { kind: 'Identifier', name: 'exists' },
                },
                arguments: [
                  {
                    kind: 'MemberExpr',
                    object: { kind: 'ResultExpr' },
                    property: { kind: 'Identifier', name: 'id' },
                  },
                ],
              },
            ],
          },
        ],
        invariants: [],
        temporal: [
          {
            kind: 'TemporalSpec',
            operator: 'completes_within',
            predicate: { kind: 'BooleanLiteral', value: true },
            duration: { kind: 'DurationLiteral', value: 5, unit: 's' },
          },
        ],
        security: [],
        annotations: [],
      },
    ],
    views: [],
    invariants: [],
    scenarios: [
      {
        kind: 'ScenarioBlock',
        behaviorName: { kind: 'Identifier', name: 'CreateUser' },
        scenarios: [
          {
            kind: 'Scenario',
            name: { kind: 'StringLiteral', value: 'Successfully create user' },
            given: [],
            when: [
              {
                kind: 'CallStmt',
                target: { kind: 'Identifier', name: 'result' },
                call: {
                  kind: 'CallExpr',
                  callee: { kind: 'Identifier', name: 'CreateUser' },
                  arguments: [
                    {
                      kind: 'MapExpr',
                      entries: [
                        {
                          key: { kind: 'StringLiteral', value: 'email' },
                          value: { kind: 'StringLiteral', value: 'test@example.com' },
                        },
                        {
                          key: { kind: 'StringLiteral', value: 'name' },
                          value: { kind: 'StringLiteral', value: 'Test User' },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
            then: [
              {
                kind: 'BinaryExpr',
                operator: '!=',
                left: {
                  kind: 'MemberExpr',
                  object: { kind: 'Identifier', name: 'result' },
                  property: { kind: 'Identifier', name: 'id' },
                },
                right: { kind: 'NullLiteral' },
              },
            ],
          },
        ],
      },
    ],
    chaos: [],
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Documentation Generator', () => {
  let domain: AST.Domain;

  beforeEach(() => {
    domain = createMockDomain();
  });

  describe('generateDocs', () => {
    it('should generate complete documentation', async () => {
      const docs = await generateDocs(domain, {
        format: 'nextra',
        outputDir: './docs',
        interactive: true,
        diagrams: true,
      });

      expect(docs).toBeDefined();
      expect(docs.files).toBeInstanceOf(Array);
      expect(docs.files.length).toBeGreaterThan(0);
      expect(docs.navigation).toBeInstanceOf(Array);
      expect(docs.searchIndex).toBeInstanceOf(Array);
    });

    it('should generate navigation structure', async () => {
      const docs = await generateDocs(domain, {
        format: 'markdown',
        outputDir: './docs',
      });

      expect(docs.navigation).toContainEqual(
        expect.objectContaining({ title: 'API Reference' })
      );
      expect(docs.navigation).toContainEqual(
        expect.objectContaining({ title: 'Tutorials' })
      );
    });

    it('should generate search index', async () => {
      const docs = await generateDocs(domain, {
        format: 'markdown',
        outputDir: './docs',
      });

      expect(docs.searchIndex).toBeDefined();
      expect(docs.searchIndex?.length).toBeGreaterThan(0);
      
      const userEntry = docs.searchIndex?.find(e => e.title === 'User');
      expect(userEntry).toBeDefined();
      expect(userEntry?.section).toBe('Entities');
    });
  });

  describe('generateAPIReference', () => {
    it('should extract domain info', () => {
      const ref = generateAPIReference(domain);

      expect(ref.domain.name).toBe('TestDomain');
      expect(ref.domain.version).toBe('1.0.0');
      expect(ref.domain.owner).toBe('TestOwner');
    });

    it('should extract types', () => {
      const ref = generateAPIReference(domain);

      expect(ref.types).toHaveLength(1);
      expect(ref.types[0]?.name).toBe('Email');
      expect(ref.types[0]?.constraints).toHaveLength(1);
    });

    it('should extract entities', () => {
      const ref = generateAPIReference(domain);

      expect(ref.entities).toHaveLength(1);
      expect(ref.entities[0]?.name).toBe('User');
      expect(ref.entities[0]?.fields).toHaveLength(3);
      expect(ref.entities[0]?.invariants).toHaveLength(1);
    });

    it('should extract behaviors', () => {
      const ref = generateAPIReference(domain);

      expect(ref.behaviors).toHaveLength(1);
      const behavior = ref.behaviors[0];
      expect(behavior?.name).toBe('CreateUser');
      expect(behavior?.description).toBe('Create a new user account');
      expect(behavior?.actors).toHaveLength(1);
      expect(behavior?.input.fields).toHaveLength(2);
      expect(behavior?.errors).toHaveLength(2);
      expect(behavior?.preconditions).toHaveLength(1);
      expect(behavior?.postconditions).toHaveLength(1);
    });
  });

  describe('generateTutorials', () => {
    it('should generate getting started tutorial', () => {
      const tutorials = generateTutorials(domain, {
        format: 'markdown',
        outputDir: './docs',
      });

      const gettingStarted = tutorials.find(t => t.id === 'getting-started');
      expect(gettingStarted).toBeDefined();
      expect(gettingStarted?.difficulty).toBe('beginner');
      expect(gettingStarted?.steps.length).toBeGreaterThan(0);
    });

    it('should generate entity tutorials', () => {
      const tutorials = generateTutorials(domain, {
        format: 'markdown',
        outputDir: './docs',
      });

      const userTutorial = tutorials.find(t => t.id === 'entity-user');
      expect(userTutorial).toBeDefined();
      expect(userTutorial?.title).toContain('User');
    });

    it('should generate behavior tutorials', () => {
      const tutorials = generateTutorials(domain, {
        format: 'markdown',
        outputDir: './docs',
      });

      const behaviorTutorial = tutorials.find(t => t.id === 'behavior-createuser');
      expect(behaviorTutorial).toBeDefined();
      expect(behaviorTutorial?.title).toContain('CreateUser');
    });
  });

  describe('extractExamples', () => {
    it('should extract examples from scenarios', () => {
      const examples = extractExamples(domain);

      expect(examples).toHaveLength(1);
      expect(examples[0]?.name).toBe('Successfully create user');
      expect(examples[0]?.when).toHaveLength(1);
      expect(examples[0]?.then).toHaveLength(1);
    });
  });

  describe('Diagram Generation', () => {
    it('should generate sequence diagram', () => {
      const behavior = domain.behaviors[0];
      if (!behavior) throw new Error('No behavior');
      
      const diagram = generateMermaidSequenceDiagram(behavior);

      expect(diagram).toContain('sequenceDiagram');
      expect(diagram).toContain('Client');
      expect(diagram).toContain('System');
      expect(diagram).toContain('CreateUser');
    });

    it('should generate state diagram', () => {
      const diagram = generateMermaidStateDiagram(
        ['Active', 'Suspended', 'Deleted'],
        [
          { from: 'Active', to: 'Suspended' },
          { from: 'Suspended', to: 'Active' },
          { from: 'Active', to: 'Deleted' },
        ]
      );

      expect(diagram).toContain('stateDiagram-v2');
      expect(diagram).toContain('Active --> Suspended');
    });
  });

  describe('Theme System', () => {
    it('should get default theme', () => {
      const theme = getTheme('default');

      expect(theme.name).toBe('default');
      expect(theme.colors.primary).toBeDefined();
      expect(theme.fonts.sans).toBeDefined();
    });

    it('should get corporate theme', () => {
      const theme = getTheme('corporate');

      expect(theme.name).toBe('corporate');
      expect(theme.colors.primary).not.toBe(getTheme('default').colors.primary);
    });

    it('should merge themes', () => {
      const base = getTheme('default');
      const merged = mergeTheme(base, {
        colors: { primary: '#ff0000' },
      });

      expect(merged.colors.primary).toBe('#ff0000');
      expect(merged.colors.secondary).toBe(base.colors.secondary);
    });
  });

  describe('Output Formats', () => {
    it('should generate Nextra configuration', async () => {
      const docs = await generateDocs(domain, {
        format: 'nextra',
        outputDir: './docs',
      });

      const configFile = docs.files.find(f => f.path === 'theme.config.tsx');
      expect(configFile).toBeDefined();
      expect(configFile?.content).toContain('DocsThemeConfig');
    });

    it('should generate Docusaurus configuration', async () => {
      const docs = await generateDocs(domain, {
        format: 'docusaurus',
        outputDir: './docs',
      });

      const configFile = docs.files.find(f => f.path === 'docusaurus.config.js');
      expect(configFile).toBeDefined();
      expect(configFile?.content).toContain('module.exports');
    });
  });

  describe('Interactive Components', () => {
    it('should generate playground when interactive enabled', async () => {
      const docs = await generateDocs(domain, {
        format: 'nextra',
        outputDir: './docs',
        interactive: true,
      });

      const playgroundPage = docs.files.find(f => f.path === 'playground/index.mdx');
      expect(playgroundPage).toBeDefined();
    });

    it('should not generate playground when interactive disabled', async () => {
      const docs = await generateDocs(domain, {
        format: 'nextra',
        outputDir: './docs',
        interactive: false,
      });

      const playgroundPage = docs.files.find(f => f.path === 'playground/index.mdx');
      expect(playgroundPage).toBeUndefined();
    });
  });
});
