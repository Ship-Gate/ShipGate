// ============================================================================
// Jest Template
// Template code and configuration for Jest test generation
// ============================================================================
/**
 * Get the Jest template for test files
 */
export function getJestTemplate() {
    return {
        header: `
/**
 * Generated test file - Jest
 * Do not modify manually. Regenerate from ISL spec.
 * @generated
 */
    `.trim(),
        beforeEach: `
  beforeEach(() => {
    // Reset mocks and state before each test
    jest.clearAllMocks();
  });
    `.trim(),
        afterEach: `
  afterEach(() => {
    // Cleanup after each test
  });
    `.trim(),
        imports: `
// Jest imports are global
    `.trim(),
    };
}
/**
 * Get Jest configuration file content
 */
export function getJestConfig() {
    return `
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 30000,
  verbose: true,
};
  `.trim();
}
/**
 * Get Jest setup file content
 */
export function getJestSetup() {
    return `
/**
 * Jest setup file
 * @generated
 */

// Extend Jest matchers
expect.extend({
  async toPass(received: () => Promise<void>, options: { timeout?: number } = {}) {
    const timeout = options.timeout || 5000;
    const startTime = Date.now();
    let lastError: Error | null = null;

    while (Date.now() - startTime < timeout) {
      try {
        await received();
        return {
          message: () => 'Condition passed',
          pass: true,
        };
      } catch (error) {
        lastError = error as Error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return {
      message: () => lastError?.message || 'Condition did not pass within timeout',
      pass: false,
    };
  },
});

// Global test helpers
global.captureState = () => ({
  timestamp: Date.now(),
});

// Silence console during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}
  `.trim();
}
/**
 * Generate a Jest describe block
 */
export function generateJestDescribe(name, content, options = {}) {
    const modifier = options.skip ? '.skip' : options.only ? '.only' : '';
    return `
describe${modifier}('${escapeString(name)}', () => {
  ${content}
});
  `.trim();
}
/**
 * Generate a Jest it block
 */
export function generateJestIt(name, content, options = {}) {
    const modifier = options.skip ? '.skip' : options.only ? '.only' : '';
    const asyncKeyword = options.async ? 'async ' : '';
    const timeoutArg = options.timeout ? `, ${options.timeout}` : '';
    return `
it${modifier}('${escapeString(name)}', ${asyncKeyword}() => {
  ${content}
}${timeoutArg});
  `.trim();
}
/**
 * Generate a Jest beforeEach block
 */
export function generateJestBeforeEach(content, options = {}) {
    const asyncKeyword = options.async ? 'async ' : '';
    return `
beforeEach(${asyncKeyword}() => {
  ${content}
});
  `.trim();
}
/**
 * Generate a Jest afterEach block
 */
export function generateJestAfterEach(content, options = {}) {
    const asyncKeyword = options.async ? 'async ' : '';
    return `
afterEach(${asyncKeyword}() => {
  ${content}
});
  `.trim();
}
/**
 * Generate a Jest mock call
 */
export function generateJestMock(target, implementation) {
    if (implementation) {
        return `jest.mock('${escapeString(target)}', () => (${implementation}));`;
    }
    return `jest.mock('${escapeString(target)}');`;
}
/**
 * Generate a Jest spy
 */
export function generateJestSpy(object, method) {
    return `jest.spyOn(${object}, '${method}')`;
}
/**
 * Generate Jest assertion
 */
export function generateJestExpect(value, matcher, expected) {
    if (expected !== undefined) {
        return `expect(${value}).${matcher}(${expected});`;
    }
    return `expect(${value}).${matcher}();`;
}
function escapeString(str) {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
}
//# sourceMappingURL=jest.js.map