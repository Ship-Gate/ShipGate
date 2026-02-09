// ============================================================================
// Go Code Generator Integration Tests
// Tests handlers, test stubs, scaffold, and stable ordering
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  generate,
  generateHandlers,
  generateHandlerSkeleton,
  generateServiceImpl,
  generateTestStubs,
  generateGoMod,
  generateDocGo,
} from '../src/index.js';
import type {
  Domain,
  Behavior,
  ScenarioBlock,
  Scenario,
} from '../src/ast-types.js';

// Helpers
const loc = () => ({ file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 });
const id = (name: string) => ({ kind: 'Identifier' as const, name, location: loc() });
const str = (value: string) => ({ kind: 'StringLiteral' as const, value, location: loc() });
const num = (value: number, isFloat = false) => ({ kind: 'NumberLiteral' as const, value, isFloat, location: loc() });

function createAuthDomain(): Domain {
  return {
    kind: 'Domain',
    name: id('Auth'),
    version: str('1.0.0'),
    imports: [],
    types: [
      {
        kind: 'TypeDeclaration',
        name: id('UserStatus'),
        definition: {
          kind: 'EnumType',
          variants: [
            { kind: 'EnumVariant', name: id('ACTIVE'), location: loc() },
            { kind: 'EnumVariant', name: id('INACTIVE'), location: loc() },
          ],
          location: loc(),
        },
        annotations: [],
        location: loc(),
      },
    ],
    entities: [
      {
        kind: 'Entity',
        name: id('User'),
        fields: [
          {
            kind: 'Field',
            name: id('id'),
            type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
            optional: false,
            annotations: [
              { kind: 'Annotation', name: id('immutable'), location: loc() },
              { kind: 'Annotation', name: id('unique'), location: loc() },
            ],
            location: loc(),
          },
          {
            kind: 'Field',
            name: id('email'),
            type: { kind: 'PrimitiveType', name: 'String', location: loc() },
            optional: false,
            annotations: [{ kind: 'Annotation', name: id('email'), location: loc() }],
            location: loc(),
          },
          {
            kind: 'Field',
            name: id('status'),
            type: {
              kind: 'ReferenceType',
              name: { kind: 'QualifiedName', parts: [id('UserStatus')], location: loc() },
              location: loc(),
            },
            optional: false,
            annotations: [],
            location: loc(),
          },
        ],
        invariants: [],
        location: loc(),
      },
    ],
    behaviors: [
      {
        kind: 'Behavior',
        name: id('CreateUser'),
        description: str('Create a new user'),
        input: {
          kind: 'InputSpec',
          fields: [
            {
              kind: 'Field',
              name: id('email'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
            {
              kind: 'Field',
              name: id('name'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
          ],
          location: loc(),
        },
        output: {
          kind: 'OutputSpec',
          success: {
            kind: 'ReferenceType',
            name: { kind: 'QualifiedName', parts: [id('User')], location: loc() },
            location: loc(),
          },
          errors: [
            {
              kind: 'ErrorSpec',
              name: id('DUPLICATE_EMAIL'),
              when: str('Email already exists'),
              retriable: false,
              location: loc(),
            },
            {
              kind: 'ErrorSpec',
              name: id('INVALID_INPUT'),
              when: str('Input validation failed'),
              retriable: false,
              location: loc(),
            },
          ],
          location: loc(),
        },
        preconditions: [
          {
            kind: 'BinaryExpr',
            operator: '!=',
            left: {
              kind: 'MemberExpr',
              object: { kind: 'Identifier', name: 'input', location: loc() } as any,
              property: id('email'),
              location: loc(),
            } as any,
            right: { kind: 'StringLiteral', value: '', location: loc() } as any,
            location: loc(),
          } as any,
        ],
        postconditions: [],
        invariants: [],
        temporal: [],
        security: [],
        compliance: [],
        location: loc(),
      },
    ],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: loc(),
  };
}

// ============================================================================
// Handler Generation Tests
// ============================================================================

describe('Handler Skeleton Generation', () => {
  it('should generate handler with precondition checks', () => {
    const domain = createAuthDomain();
    const behavior = domain.behaviors[0]!;

    const handler = generateHandlerSkeleton('Auth', behavior);

    expect(handler.name).toBe('HandleCreateUser');
    expect(handler.code).toContain('func (a *AuthServiceImpl) CreateUser(ctx context.Context, input CreateUserInput) (*CreateUserOutput, error)');
    expect(handler.code).toContain('// Precondition checks');
    expect(handler.code).toContain('PRECONDITION_FAILED');
    expect(handler.code).toContain('// Validate input');
    expect(handler.code).toContain('validate.Struct(&input)');
    expect(handler.code).toContain('// TODO: Implement business logic');
  });

  it('should generate service implementation struct', () => {
    const domain = createAuthDomain();
    const result = generateServiceImpl('Auth', domain.behaviors);

    expect(result.code).toContain('type AuthServiceImpl struct');
    expect(result.code).toContain('func NewAuthService() *AuthServiceImpl');
    expect(result.code).toContain('var _ AuthService = (*AuthServiceImpl)(nil)');
  });

  it('should generate handlers for all behaviors', () => {
    const domain = createAuthDomain();
    const handlers = generateHandlers('Auth', domain.behaviors);

    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.name).toBe('HandleCreateUser');
  });

  it('should handle behavior without preconditions', () => {
    const behavior: Behavior = {
      kind: 'Behavior',
      name: id('DeleteUser'),
      input: {
        kind: 'InputSpec',
        fields: [
          { kind: 'Field', name: id('user_id'), type: { kind: 'PrimitiveType', name: 'UUID', location: loc() }, optional: false, annotations: [], location: loc() },
        ],
        location: loc(),
      },
      output: {
        kind: 'OutputSpec',
        success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() },
        errors: [],
        location: loc(),
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: loc(),
    };

    const handler = generateHandlerSkeleton('Auth', behavior);

    expect(handler.code).not.toContain('// Precondition checks');
    expect(handler.code).toContain('// Validate input');
  });

  it('should handle behavior with description', () => {
    const domain = createAuthDomain();
    const handler = generateHandlerSkeleton('Auth', domain.behaviors[0]!);

    expect(handler.code).toContain('// HandleCreateUser Create a new user');
  });
});

// ============================================================================
// Test Stub Generation Tests
// ============================================================================

describe('Test Stub Generation', () => {
  it('should generate test stubs for behaviors without scenarios', () => {
    const domain = createAuthDomain();
    const testFiles = generateTestStubs('auth', domain.behaviors, []);

    expect(testFiles).toHaveLength(1);
    expect(testFiles[0]!.path).toBe('auth/handlers_test.go');

    const content = testFiles[0]!.content;
    expect(content).toContain('package auth');
    expect(content).toContain('func TestCreateUser_Success(t *testing.T)');
    expect(content).toContain('CreateUserInput{');
    expect(content).toContain('"test@example.com"');
    // Error stubs
    expect(content).toContain('func TestCreateUser_DUPLICATEEMAIL(t *testing.T)');
    expect(content).toContain('func TestCreateUser_INVALIDINPUT(t *testing.T)');
  });

  it('should generate scenario-based tests', () => {
    const domain = createAuthDomain();
    const scenarios: ScenarioBlock[] = [
      {
        kind: 'ScenarioBlock',
        behaviorName: id('CreateUser'),
        scenarios: [
          {
            kind: 'Scenario',
            name: str('valid user creation'),
            given: [],
            when: [
              {
                kind: 'AssignmentStmt',
                target: id('email'),
                value: str('alice@example.com'),
                location: loc(),
              } as any,
            ],
            then: [
              {
                kind: 'BinaryExpr',
                operator: '!=',
                left: { kind: 'Identifier', name: 'result', location: loc() } as any,
                right: { kind: 'NullLiteral', location: loc() } as any,
                location: loc(),
              } as any,
            ],
            location: loc(),
          },
        ],
        location: loc(),
      },
    ];

    const testFiles = generateTestStubs('auth', domain.behaviors, scenarios);
    const content = testFiles[0]!.content;

    expect(content).toContain('func TestCreateUser(t *testing.T)');
    expect(content).toContain('t.Run("valid_user_creation"');
    expect(content).toContain('Email: "alice@example.com"');
    expect(content).toContain('// Assert:');
  });

  it('should include DO NOT EDIT header in test file', () => {
    const domain = createAuthDomain();
    const testFiles = generateTestStubs('auth', domain.behaviors, []);
    expect(testFiles[0]!.content).toContain('DO NOT EDIT');
  });

  it('should include proper imports in test file', () => {
    const domain = createAuthDomain();
    const testFiles = generateTestStubs('auth', domain.behaviors, []);
    const content = testFiles[0]!.content;
    expect(content).toContain('"context"');
    expect(content).toContain('"testing"');
  });
});

// ============================================================================
// Scaffold Generation Tests
// ============================================================================

describe('Scaffold Generation', () => {
  it('should generate go.mod with correct module path', () => {
    const goMod = generateGoMod('example.com/auth');

    expect(goMod.path).toBe('go.mod');
    expect(goMod.content).toContain('module example.com/auth');
    expect(goMod.content).toContain('go 1.21');
    expect(goMod.content).toContain('github.com/go-playground/validator/v10');
    expect(goMod.content).toContain('github.com/google/uuid');
    expect(goMod.content).toContain('github.com/shopspring/decimal');
  });

  it('should generate doc.go with domain info', () => {
    const domain = createAuthDomain();
    const docGo = generateDocGo(domain, 'auth');

    expect(docGo.path).toBe('auth/doc.go');
    expect(docGo.content).toContain('Package auth');
    expect(docGo.content).toContain('Auth domain');
    expect(docGo.content).toContain('v1.0.0');
    expect(docGo.content).toContain('package auth');
  });
});

// ============================================================================
// Full Pipeline Integration Tests
// ============================================================================

describe('Full Pipeline Generation', () => {
  it('should generate all file types for a complete domain', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });

    const fileTypes = files.map(f => f.type);
    expect(fileTypes).toContain('scaffold');
    expect(fileTypes).toContain('types');
    expect(fileTypes).toContain('models');
    expect(fileTypes).toContain('interfaces');
    expect(fileTypes).toContain('handlers');
    expect(fileTypes).toContain('errors');
    expect(fileTypes).toContain('validation');
    expect(fileTypes).toContain('tests');

    const filePaths = files.map(f => f.path);
    expect(filePaths).toContain('go.mod');
    expect(filePaths).toContain('auth/doc.go');
    expect(filePaths).toContain('auth/types.go');
    expect(filePaths).toContain('auth/models.go');
    expect(filePaths).toContain('auth/interfaces.go');
    expect(filePaths).toContain('auth/handlers.go');
    expect(filePaths).toContain('auth/errors.go');
    expect(filePaths).toContain('auth/validation.go');
    expect(filePaths).toContain('auth/handlers_test.go');
  });

  it('should produce stable output ordering', () => {
    const domain = createAuthDomain();

    // Generate twice and compare
    const files1 = generate(domain, { outputDir: 'output', module: 'example.com/auth' });
    const files2 = generate(domain, { outputDir: 'output', module: 'example.com/auth' });

    expect(files1.map(f => f.path)).toEqual(files2.map(f => f.path));
    for (let i = 0; i < files1.length; i++) {
      expect(files1[i]!.content).toBe(files2[i]!.content);
    }
  });

  it('should maintain file order: scaffold, types, models, interfaces, handlers, errors, validation, tests', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });

    const typeOrder: Record<string, number> = {
      scaffold: 0,
      types: 1,
      models: 2,
      interfaces: 3,
      handlers: 4,
      errors: 5,
      validation: 6,
      tests: 7,
    };

    for (let i = 1; i < files.length; i++) {
      const prev = typeOrder[files[i - 1]!.type] ?? 99;
      const curr = typeOrder[files[i]!.type] ?? 99;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('should allow disabling optional file types', () => {
    const domain = createAuthDomain();
    const files = generate(domain, {
      outputDir: 'output',
      module: 'example.com/auth',
      includeHandlers: false,
      includeTests: false,
      includeScaffold: false,
      includeValidation: false,
    });

    const types = files.map(f => f.type);
    expect(types).not.toContain('handlers');
    expect(types).not.toContain('tests');
    expect(types).not.toContain('scaffold');
    expect(types).not.toContain('validation');
    // Core types should still be present
    expect(types).toContain('types');
    expect(types).toContain('models');
    expect(types).toContain('interfaces');
  });

  it('handlers.go should contain service impl + handler bodies', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });
    const handlersFile = files.find(f => f.path.includes('handlers.go'));

    expect(handlersFile).toBeDefined();
    expect(handlersFile!.content).toContain('type AuthServiceImpl struct');
    expect(handlersFile!.content).toContain('NewAuthService');
    expect(handlersFile!.content).toContain('var _ AuthService = (*AuthServiceImpl)(nil)');
    expect(handlersFile!.content).toContain('func (a *AuthServiceImpl) CreateUser(ctx context.Context');
    expect(handlersFile!.content).toContain('PRECONDITION_FAILED');
    expect(handlersFile!.content).toContain('validate.Struct');
  });

  it('test file should contain test functions for each behavior', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });
    const testFile = files.find(f => f.path.includes('_test.go'));

    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('package auth');
    expect(testFile!.content).toContain('func TestCreateUser_Success');
    expect(testFile!.content).toContain('CreateUserInput{');
  });

  it('should handle empty domain gracefully', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('Empty'),
      version: str('1.0.0'),
      imports: [],
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: loc(),
    };

    const files = generate(domain, { outputDir: 'output', module: 'example.com/empty' });

    // Should have scaffold files for an empty domain
    expect(files.find(f => f.path === 'go.mod')).toBeDefined();
    // Should not have handlers, interfaces, or errors (no behaviors/entities)
    expect(files.find(f => f.type === 'handlers')).toBeUndefined();
    expect(files.find(f => f.type === 'interfaces')).toBeUndefined();
    expect(files.find(f => f.type === 'errors')).toBeUndefined();
    expect(files.find(f => f.type === 'models')).toBeUndefined();
    expect(files.find(f => f.type === 'types')).toBeUndefined();
  });

  it('all generated .go files should have DO NOT EDIT header', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });

    for (const file of files) {
      if (file.path.endsWith('.go')) {
        expect(file.content).toContain('DO NOT EDIT');
      }
    }
  });

  it('all generated .go files should have valid package declaration', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });

    for (const file of files) {
      if (file.path.endsWith('.go')) {
        expect(file.content).toMatch(/package \w+/);
      }
    }
  });
});

// ============================================================================
// Golden Output Matching Tests
// ============================================================================

describe('Golden Output Matching', () => {
  it('types.go should contain enum type and constants in stable order', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });
    const typesFile = files.find(f => f.path.includes('types.go'));

    expect(typesFile).toBeDefined();
    const content = typesFile!.content;

    // Verify the exact structure
    expect(content).toContain('type UserStatus string');
    expect(content).toContain('UserStatusACTIVE UserStatus = "ACTIVE"');
    expect(content).toContain('UserStatusINACTIVE UserStatus = "INACTIVE"');
    expect(content).toContain('func UserStatusValues()');
    expect(content).toContain('func (e UserStatus) IsValid() bool');

    // Ensure ACTIVE comes before INACTIVE (stable ordering)
    const activeIdx = content.indexOf('UserStatusACTIVE');
    const inactiveIdx = content.indexOf('UserStatusINACTIVE');
    expect(activeIdx).toBeLessThan(inactiveIdx);
  });

  it('models.go should contain entity struct with json + validate tags', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });
    const modelsFile = files.find(f => f.path.includes('models.go'));

    expect(modelsFile).toBeDefined();
    const content = modelsFile!.content;

    expect(content).toContain('type User struct');
    expect(content).toContain('Id uuid.UUID');
    expect(content).toContain('json:"id"');
    expect(content).toContain('validate:"required"');
    expect(content).toContain('Email string');
    expect(content).toContain('json:"email"');
    expect(content).toContain('validate:"required,email"');
  });

  it('interfaces.go should contain service interface with correct methods', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });
    const ifaceFile = files.find(f => f.path.includes('interfaces.go'));

    expect(ifaceFile).toBeDefined();
    const content = ifaceFile!.content;

    expect(content).toContain('type AuthService interface');
    expect(content).toContain('CreateUser(ctx context.Context, input CreateUserInput) (*CreateUserOutput, error)');
    expect(content).toContain('type CreateUserInput struct');
    expect(content).toContain('type CreateUserOutput struct');
  });

  it('errors.go should contain error types and constructors', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });
    const errorsFile = files.find(f => f.path.includes('errors.go'));

    expect(errorsFile).toBeDefined();
    const content = errorsFile!.content;

    expect(content).toContain('type CreateUserError struct');
    expect(content).toContain('type CreateUserErrorCode string');
    expect(content).toContain('CreateUserErrorDUPLICATEEMAIL');
    expect(content).toContain('CreateUserErrorINVALIDINPUT');
    expect(content).toContain('func (e *CreateUserError) Error() string');
    expect(content).toContain('func NewCreateUserDUPLICATEEMAILError');
    expect(content).toContain('IsRetriable');
  });

  it('go.mod should have correct module and dependencies', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: 'output', module: 'example.com/auth' });
    const goMod = files.find(f => f.path === 'go.mod');

    expect(goMod).toBeDefined();
    expect(goMod!.content).toContain('module example.com/auth');
    expect(goMod!.content).toContain('go 1.21');
    expect(goMod!.content).toContain('github.com/go-playground/validator/v10');
  });
});
