// ============================================================================
// Executable Test Generator
// Main entry point for generating tests that bind to real implementations
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  ExecutableTestOptions,
  ExecutableTestResult,
  ExecutableTestFile,
  TestBinding,
  PostconditionBinding,
  PreconditionBinding,
  ErrorBinding,
  TestGenerationError,
  LanguageAdapter,
} from './types.js';
import { TypeScriptAdapter } from './adapters/typescript.js';
import { GoAdapter } from './adapters/go.js';
import { PythonAdapter } from './adapters/python.js';
import { compileExpression, createCompilerContext } from '../expression-compiler.js';

/**
 * Executable Test Generator
 * 
 * Generates tests that:
 * 1. Bind to real implementations
 * 2. Assert postconditions that FAIL when contracts are violated
 * 3. Support multiple target languages
 */
export class ExecutableTestGenerator {
  private adapter: LanguageAdapter;
  private options: ExecutableTestOptions;

  constructor(options: ExecutableTestOptions) {
    this.options = options;
    this.adapter = this.getAdapter(options.language);
  }

  private getAdapter(language: string): LanguageAdapter {
    switch (language) {
      case 'typescript':
        return new TypeScriptAdapter(this.options.framework as 'vitest' | 'jest');
      case 'go':
        return new GoAdapter();
      case 'python':
        return new PythonAdapter(this.options.framework as 'pytest' | 'unittest');
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Generate executable tests from an ISL domain
   */
  generate(domain: AST.Domain): ExecutableTestResult {
    const files: ExecutableTestFile[] = [];
    const errors: TestGenerationError[] = [];
    const bindings: TestBinding[] = [];

    try {
      // Generate bindings and tests for each behavior
      for (const behavior of domain.behaviors) {
        const binding = this.createBinding(behavior, domain);
        bindings.push(binding);

        const testFile = this.generateTestFile(behavior, domain, binding);
        files.push(testFile);

        // Generate violation tests if requested
        if (this.options.generateViolationTests) {
          const violationFile = this.generateViolationTestFile(behavior, domain, binding);
          files.push(violationFile);
        }
      }

      // Generate shared helpers
      files.push(this.generateHelpers(domain, bindings));
      files.push(this.generateFixtures(domain, bindings));

      // Generate test configuration
      files.push(this.generateConfig());

    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'GENERATION_ERROR',
        severity: 'error',
      });
    }

    return {
      success: errors.filter(e => e.severity === 'error').length === 0,
      files,
      errors,
      bindings,
    };
  }

  /**
   * Create test binding for a behavior
   */
  private createBinding(behavior: AST.Behavior, domain: AST.Domain): TestBinding {
    const entityNames = domain.entities.map(e => e.name.name);
    const ctx = createCompilerContext(entityNames);

    // Compile postconditions to executable assertions
    const postconditions: PostconditionBinding[] = [];
    for (const block of behavior.postconditions) {
      const condition = this.getConditionName(block.condition);
      
      for (const predicate of block.predicates) {
        const assertionCode = this.adapter.compileExpression(predicate, {
          entityNames,
          inOldExpr: false,
          variables: new Map(),
          imports: new Set(),
        });

        postconditions.push({
          expression: predicate,
          assertionCode,
          condition,
          description: this.describeExpression(predicate),
          failsOnViolation: true,
        });
      }
    }

    // Compile preconditions to validators
    const preconditions: PreconditionBinding[] = behavior.preconditions.map(pre => ({
      expression: pre,
      validationCode: compileExpression(pre, ctx),
      description: this.describeExpression(pre),
      violatingInput: this.generateViolatingInput(pre, behavior),
    }));

    // Compile error specifications
    const errorBindings: ErrorBinding[] = behavior.output.errors.map(err => ({
      name: err.name.name,
      when: err.when?.value || 'specific conditions',
      retriable: err.retriable,
      triggerInput: this.generateErrorTriggerInput(err, behavior),
      assertionCode: this.generateErrorAssertion(err),
    }));

    return {
      behaviorName: behavior.name.name,
      implementationName: this.camelCase(behavior.name.name),
      modulePath: this.options.implementationPath,
      inputType: {
        islType: `${behavior.name.name}Input`,
        implType: `${behavior.name.name}Input`,
      },
      outputType: {
        islType: `${behavior.name.name}Result`,
        implType: `${behavior.name.name}Result`,
      },
      postconditions,
      preconditions,
      errors: errorBindings,
    };
  }

  /**
   * Generate test file for a behavior
   */
  private generateTestFile(
    behavior: AST.Behavior,
    domain: AST.Domain,
    binding: TestBinding
  ): ExecutableTestFile {
    const content = this.adapter.generateTestFile(behavior, domain, binding, this.options);
    const ext = this.getFileExtension();

    return {
      path: `${this.options.outputDir}/${behavior.name.name}.test${ext}`,
      content,
      type: 'test',
      language: this.options.language,
    };
  }

  /**
   * Generate violation test file - tests that MUST fail when contracts are violated
   */
  private generateViolationTestFile(
    behavior: AST.Behavior,
    domain: AST.Domain,
    binding: TestBinding
  ): ExecutableTestFile {
    const header = this.adapter.generateHeader(this.options, binding);
    const tests = binding.postconditions
      .filter(p => p.failsOnViolation)
      .map(p => this.adapter.generateViolationTest(p, binding))
      .join('\n\n');

    const content = `${header}

/**
 * Contract Violation Tests for ${behavior.name.name}
 * 
 * These tests VERIFY that assertions fail when contracts are violated.
 * If any of these tests PASS, it means the contract enforcement is broken.
 */
describe('${behavior.name.name} Contract Violations', () => {
${tests}
});
`;

    const ext = this.getFileExtension();
    return {
      path: `${this.options.outputDir}/${behavior.name.name}.violations.test${ext}`,
      content,
      type: 'test',
      language: this.options.language,
    };
  }

  /**
   * Generate helper utilities
   */
  private generateHelpers(domain: AST.Domain, bindings: TestBinding[]): ExecutableTestFile {
    const ext = this.getFileExtension();
    const content = this.generateHelperContent(domain, bindings);

    return {
      path: `${this.options.outputDir}/helpers/test-runtime${ext}`,
      content,
      type: 'helper',
      language: this.options.language,
    };
  }

  /**
   * Generate fixtures
   */
  private generateFixtures(domain: AST.Domain, bindings: TestBinding[]): ExecutableTestFile {
    const ext = this.getFileExtension();
    const content = this.generateFixtureContent(domain, bindings);

    return {
      path: `${this.options.outputDir}/fixtures/index${ext}`,
      content,
      type: 'fixture',
      language: this.options.language,
    };
  }

  /**
   * Generate test configuration
   */
  private generateConfig(): ExecutableTestFile {
    const content = this.generateConfigContent();
    const filename = this.getConfigFilename();

    return {
      path: `${this.options.outputDir}/${filename}`,
      content,
      type: 'config',
      language: this.options.language,
    };
  }

  // Helper methods

  private getConditionName(condition: AST.Identifier | 'success' | 'any_error'): string {
    if (condition === 'success') return 'success';
    if (condition === 'any_error') return 'error';
    return condition.name;
  }

  private describeExpression(expr: AST.Expression): string {
    // Generate human-readable description of expression
    switch (expr.kind) {
      case 'BinaryExpr':
        return `${this.describeExpression(expr.left)} ${expr.operator} ${this.describeExpression(expr.right)}`;
      case 'CallExpr':
        return `${this.describeExpression(expr.callee)}(...)`;
      case 'MemberExpr':
        return `${this.describeExpression(expr.object)}.${expr.property.name}`;
      case 'Identifier':
        return expr.name;
      case 'ResultExpr':
        return expr.property ? `result.${expr.property.name}` : 'result';
      case 'InputExpr':
        return `input.${expr.property.name}`;
      default:
        return `[${expr.kind}]`;
    }
  }

  private generateViolatingInput(expr: AST.Expression, behavior: AST.Behavior): string {
    // Generate input that violates the precondition
    return `{ /* TODO: input that violates ${this.describeExpression(expr)} */ }`;
  }

  private generateErrorTriggerInput(err: AST.ErrorSpec, behavior: AST.Behavior): string {
    return `create${this.pascalCase(err.name.name)}TriggerInput()`;
  }

  private generateErrorAssertion(err: AST.ErrorSpec): string {
    return `expect(result.success).toBe(false);
    expect(result.error).toEqual('${err.name.name}');
    expect(result.retriable).toBe(${err.retriable});`;
  }

  private getFileExtension(): string {
    switch (this.options.language) {
      case 'typescript': return '.ts';
      case 'go': return '.go';
      case 'python': return '.py';
      default: return '.ts';
    }
  }

  private getConfigFilename(): string {
    switch (this.options.framework) {
      case 'vitest': return 'vitest.config.ts';
      case 'jest': return 'jest.config.js';
      case 'go-test': return 'go.mod';
      case 'pytest': return 'pytest.ini';
      case 'unittest': return 'setup.py';
      default: return 'test.config.js';
    }
  }

  private generateHelperContent(domain: AST.Domain, bindings: TestBinding[]): string {
    if (this.options.language === 'typescript') {
      return this.generateTypeScriptHelpers(domain, bindings);
    }
    if (this.options.language === 'go') {
      return this.generateGoHelpers(domain, bindings);
    }
    return this.generatePythonHelpers(domain, bindings);
  }

  private generateFixtureContent(domain: AST.Domain, bindings: TestBinding[]): string {
    if (this.options.language === 'typescript') {
      return this.generateTypeScriptFixtures(domain, bindings);
    }
    if (this.options.language === 'go') {
      return this.generateGoFixtures(domain, bindings);
    }
    return this.generatePythonFixtures(domain, bindings);
  }

  private generateConfigContent(): string {
    switch (this.options.framework) {
      case 'vitest':
        return `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
`;
      case 'jest':
        return `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  collectCoverage: true,
  coverageReporters: ['text', 'json', 'html'],
};
`;
      case 'pytest':
        return `[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short
`;
      default:
        return '';
    }
  }

  private generateTypeScriptHelpers(domain: AST.Domain, bindings: TestBinding[]): string {
    const entityNames = domain.entities.map(e => e.name.name);
    
    return `// ============================================================================
// Executable Test Runtime - TypeScript
// Provides binding infrastructure for contract assertions
// ============================================================================

export interface StateCapture {
  timestamp: number;
  entities: Map<string, EntityState>;
  custom: Record<string, unknown>;
}

export interface EntityState {
  exists: (criteria: Record<string, unknown>) => boolean;
  lookup: (criteria: Record<string, unknown>) => unknown | null;
  count: (criteria?: Record<string, unknown>) => number;
  getAll: () => unknown[];
}

/**
 * Create test context with entity bindings
 */
export function createTestContext(entityStore: Record<string, unknown[]>) {
  const entities = new Map<string, EntityState>();
  
  for (const [name, data] of Object.entries(entityStore)) {
    entities.set(name, {
      exists: (criteria) => data.some(item => matchesCriteria(item, criteria)),
      lookup: (criteria) => data.find(item => matchesCriteria(item, criteria)) ?? null,
      count: (criteria) => criteria 
        ? data.filter(item => matchesCriteria(item, criteria)).length 
        : data.length,
      getAll: () => [...data],
    });
  }

  return {
    entities,
    captureState: (): StateCapture => ({
      timestamp: Date.now(),
      entities: new Map(entities),
      custom: {},
    }),
    reset: () => {
      // Reset entity state for test isolation
    },
  };
}

function matchesCriteria(item: unknown, criteria: Record<string, unknown>): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return Object.entries(criteria).every(([key, value]) => obj[key] === value);
}

/**
 * Assert postcondition and fail with detailed message if violated
 */
export function assertPostcondition(
  condition: boolean,
  description: string,
  context: { input: unknown; result: unknown; oldState?: StateCapture }
): void {
  if (!condition) {
    const details = JSON.stringify(context, null, 2);
    throw new Error(\`Postcondition violated: \${description}\\n\\nContext:\\n\${details}\`);
  }
}

/**
 * Assert precondition validation
 */
export function assertPrecondition(
  condition: boolean,
  description: string,
  input: unknown
): void {
  if (!condition) {
    throw new Error(\`Precondition violated: \${description}\\n\\nInput: \${JSON.stringify(input)}\`);
  }
}

/**
 * Create entity proxy for old() state capture
 */
export function createOldProxy(state: StateCapture) {
  return {
    entity: (name: string) => state.entities.get(name),
    get: (key: string) => state.custom[key],
  };
}

// Entity bindings
${entityNames.map(name => `export const ${name} = createEntityBinding('${name}');`).join('\n')}

function createEntityBinding(name: string) {
  return {
    exists: (criteria: Record<string, unknown>) => {
      // Will be bound to actual entity store at runtime
      throw new Error(\`Entity \${name} not bound. Use createTestContext() to bind entities.\`);
    },
    lookup: (criteria: Record<string, unknown>) => {
      throw new Error(\`Entity \${name} not bound.\`);
    },
    count: (criteria?: Record<string, unknown>) => {
      throw new Error(\`Entity \${name} not bound.\`);
    },
    getAll: () => {
      throw new Error(\`Entity \${name} not bound.\`);
    },
  };
}
`;
  }

  private generateGoHelpers(domain: AST.Domain, bindings: TestBinding[]): string {
    return `// Code generated by @isl-lang/codegen-tests. DO NOT EDIT.
package testruntime

import (
	"testing"
	"time"
)

// StateCapture holds pre-execution state for postcondition checks
type StateCapture struct {
	Timestamp time.Time
	Entities  map[string][]interface{}
	Custom    map[string]interface{}
}

// TestContext provides entity bindings for tests
type TestContext struct {
	Entities map[string][]interface{}
}

// NewTestContext creates a test context with entity bindings
func NewTestContext(entities map[string][]interface{}) *TestContext {
	return &TestContext{Entities: entities}
}

// CaptureState captures current state for postcondition checks
func (tc *TestContext) CaptureState() *StateCapture {
	return &StateCapture{
		Timestamp: time.Now(),
		Entities:  tc.Entities,
		Custom:    make(map[string]interface{}),
	}
}

// AssertPostcondition asserts a postcondition and fails the test if violated
func AssertPostcondition(t *testing.T, condition bool, description string) {
	t.Helper()
	if !condition {
		t.Errorf("Postcondition violated: %s", description)
	}
}

// AssertPrecondition asserts a precondition
func AssertPrecondition(t *testing.T, condition bool, description string) {
	t.Helper()
	if !condition {
		t.Errorf("Precondition violated: %s", description)
	}
}

// EntityExists checks if an entity exists matching criteria
func EntityExists(entities []interface{}, criteria map[string]interface{}) bool {
	for _, e := range entities {
		if matchesCriteria(e, criteria) {
			return true
		}
	}
	return false
}

// EntityLookup finds an entity matching criteria
func EntityLookup(entities []interface{}, criteria map[string]interface{}) interface{} {
	for _, e := range entities {
		if matchesCriteria(e, criteria) {
			return e
		}
	}
	return nil
}

// EntityCount counts entities matching criteria
func EntityCount(entities []interface{}, criteria map[string]interface{}) int {
	count := 0
	for _, e := range entities {
		if matchesCriteria(e, criteria) {
			count++
		}
	}
	return count
}

func matchesCriteria(entity interface{}, criteria map[string]interface{}) bool {
	m, ok := entity.(map[string]interface{})
	if !ok {
		return false
	}
	for k, v := range criteria {
		if m[k] != v {
			return false
		}
	}
	return true
}
`;
  }

  private generatePythonHelpers(domain: AST.Domain, bindings: TestBinding[]): string {
    return `"""
Executable Test Runtime - Python
Provides binding infrastructure for contract assertions
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable
import json


@dataclass
class StateCapture:
    """Captures state before execution for postcondition checks"""
    timestamp: datetime
    entities: Dict[str, List[Any]]
    custom: Dict[str, Any]


class EntityBinding:
    """Provides entity query methods"""
    
    def __init__(self, name: str, data: List[Any]):
        self.name = name
        self.data = data
    
    def exists(self, **criteria) -> bool:
        return any(self._matches(item, criteria) for item in self.data)
    
    def lookup(self, **criteria) -> Optional[Any]:
        for item in self.data:
            if self._matches(item, criteria):
                return item
        return None
    
    def count(self, **criteria) -> int:
        if not criteria:
            return len(self.data)
        return sum(1 for item in self.data if self._matches(item, criteria))
    
    def get_all(self) -> List[Any]:
        return list(self.data)
    
    def _matches(self, item: Any, criteria: Dict[str, Any]) -> bool:
        if not isinstance(item, dict):
            return False
        return all(item.get(k) == v for k, v in criteria.items())


class TestContext:
    """Test context with entity bindings"""
    
    def __init__(self, entity_store: Dict[str, List[Any]]):
        self.entities = {
            name: EntityBinding(name, data)
            for name, data in entity_store.items()
        }
    
    def capture_state(self) -> StateCapture:
        return StateCapture(
            timestamp=datetime.now(),
            entities={name: binding.get_all() for name, binding in self.entities.items()},
            custom={}
        )
    
    def reset(self):
        """Reset state for test isolation"""
        pass


def assert_postcondition(
    condition: bool,
    description: str,
    context: Dict[str, Any]
) -> None:
    """Assert postcondition and fail with detailed message if violated"""
    if not condition:
        details = json.dumps(context, indent=2, default=str)
        raise AssertionError(f"Postcondition violated: {description}\\n\\nContext:\\n{details}")


def assert_precondition(
    condition: bool,
    description: str,
    input_data: Any
) -> None:
    """Assert precondition validation"""
    if not condition:
        raise AssertionError(f"Precondition violated: {description}\\n\\nInput: {input_data}")


class OldProxy:
    """Proxy for accessing old() state"""
    
    def __init__(self, state: StateCapture):
        self.state = state
    
    def entity(self, name: str) -> EntityBinding:
        data = self.state.entities.get(name, [])
        return EntityBinding(name, data)
    
    def get(self, key: str) -> Any:
        return self.state.custom.get(key)
`;
  }

  private generateTypeScriptFixtures(domain: AST.Domain, bindings: TestBinding[]): string {
    const fixtures = domain.entities.map(entity => {
      const fields = entity.fields.map(f => {
        const value = this.getDefaultValue(f.type);
        return `  ${f.name.name}: ${value},`;
      }).join('\n');

      return `export const ${entity.name.name.toLowerCase()}Fixture = {
${fields}
};

export function create${entity.name.name}(overrides?: Partial<typeof ${entity.name.name.toLowerCase()}Fixture>) {
  return { ...${entity.name.name.toLowerCase()}Fixture, ...overrides };
}`;
    }).join('\n\n');

    const inputFixtures = bindings.map(binding => {
      return `export function createValid${binding.behaviorName}Input(): ${binding.inputType.implType} {
  return {
    // TODO: Provide valid input values
  };
}

export function createInvalid${binding.behaviorName}Input(): ${binding.inputType.implType} {
  return {
    // TODO: Provide invalid input that violates preconditions
  };
}`;
    }).join('\n\n');

    return `// ============================================================================
// Test Fixtures - Auto-generated
// ============================================================================

${fixtures}

// Input fixtures for behaviors
${inputFixtures}
`;
  }

  private generateGoFixtures(domain: AST.Domain, bindings: TestBinding[]): string {
    return `// Code generated by @isl-lang/codegen-tests. DO NOT EDIT.
package fixtures

// Test fixtures for ${domain.name.name}

${domain.entities.map(entity => `
// ${entity.name.name}Fixture creates a test fixture
func ${entity.name.name}Fixture() map[string]interface{} {
	return map[string]interface{}{
		// TODO: Add default field values
	}
}

// Create${entity.name.name} creates a ${entity.name.name} with optional overrides
func Create${entity.name.name}(overrides map[string]interface{}) map[string]interface{} {
	fixture := ${entity.name.name}Fixture()
	for k, v := range overrides {
		fixture[k] = v
	}
	return fixture
}
`).join('\n')}
`;
  }

  private generatePythonFixtures(domain: AST.Domain, bindings: TestBinding[]): string {
    return `"""
Test Fixtures - Auto-generated
"""

from typing import Any, Dict, Optional

${domain.entities.map(entity => `
def ${entity.name.name.toLowerCase()}_fixture() -> Dict[str, Any]:
    """Create a test fixture for ${entity.name.name}"""
    return {
        # TODO: Add default field values
    }


def create_${entity.name.name.toLowerCase()}(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create a ${entity.name.name} with optional overrides"""
    fixture = ${entity.name.name.toLowerCase()}_fixture()
    if overrides:
        fixture.update(overrides)
    return fixture
`).join('\n')}
`;
  }

  private getDefaultValue(type: AST.TypeDefinition): string {
    switch (type.kind) {
      case 'PrimitiveType':
        switch (type.name) {
          case 'String': return `'test-value'`;
          case 'Int': return '1';
          case 'Decimal': return '1.0';
          case 'Boolean': return 'true';
          case 'UUID': return `'00000000-0000-0000-0000-000000000001'`;
          case 'Timestamp': return 'new Date()';
          default: return 'undefined';
        }
      case 'ListType': return '[]';
      case 'OptionalType': return 'undefined';
      default: return '{}';
    }
  }

  private camelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  private pascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
