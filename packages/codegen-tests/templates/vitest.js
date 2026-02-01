// ============================================================================
// Vitest Template
// Template code and configuration for Vitest test generation
// ============================================================================
/**
 * Get the Vitest template for test files
 */
export function getVitestTemplate() {
    return {
        header: `
/**
 * Generated test file - Vitest
 * Do not modify manually. Regenerate from ISL spec.
 * @generated
 */
    `.trim(),
        beforeEach: `
  beforeEach(() => {
    // Reset mocks and state before each test
    vi.clearAllMocks();
  });
    `.trim(),
        afterEach: `
  afterEach(() => {
    // Cleanup after each test
    vi.restoreAllMocks();
  });
    `.trim(),
        imports: `
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
    `.trim(),
    };
}
/**
 * Get Vitest configuration file content
 */
export function getVitestConfig() {
    return `
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/types.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    sequence: {
      shuffle: false,
    },
    reporters: ['verbose'],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
  `.trim();
}
/**
 * Get Vitest setup file content
 */
export function getVitestSetup() {
    return `
/**
 * Vitest setup file
 * @generated
 */
import { expect } from 'vitest';

// Extend Vitest matchers
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

  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () =>
        pass
          ? \`expected \${received} not to be within range \${floor} - \${ceiling}\`
          : \`expected \${received} to be within range \${floor} - \${ceiling}\`,
      pass,
    };
  },
});

// Type declarations for custom matchers
declare module 'vitest' {
  interface Assertion<T = unknown> {
    toPass(options?: { timeout?: number }): Promise<void>;
    toBeWithinRange(floor: number, ceiling: number): void;
  }
  interface AsymmetricMatchersContaining {
    toBeWithinRange(floor: number, ceiling: number): unknown;
  }
}
  `.trim();
}
/**
 * Generate a Vitest describe block
 */
export function generateVitestDescribe(name, content, options = {}) {
    let modifier = '';
    if (options.skip)
        modifier = '.skip';
    else if (options.only)
        modifier = '.only';
    else if (options.concurrent)
        modifier = '.concurrent';
    return `
describe${modifier}('${escapeString(name)}', () => {
  ${content}
});
  `.trim();
}
/**
 * Generate a Vitest it block
 */
export function generateVitestIt(name, content, options = {}) {
    let modifier = '';
    if (options.skip)
        modifier = '.skip';
    else if (options.only)
        modifier = '.only';
    else if (options.concurrent)
        modifier = '.concurrent';
    const asyncKeyword = options.async ? 'async ' : '';
    const timeoutArg = options.timeout ? `, { timeout: ${options.timeout} }` : '';
    return `
it${modifier}('${escapeString(name)}', ${asyncKeyword}() => {
  ${content}
}${timeoutArg});
  `.trim();
}
/**
 * Generate a Vitest beforeEach block
 */
export function generateVitestBeforeEach(content, options = {}) {
    const asyncKeyword = options.async ? 'async ' : '';
    return `
beforeEach(${asyncKeyword}() => {
  ${content}
});
  `.trim();
}
/**
 * Generate a Vitest afterEach block
 */
export function generateVitestAfterEach(content, options = {}) {
    const asyncKeyword = options.async ? 'async ' : '';
    return `
afterEach(${asyncKeyword}() => {
  ${content}
});
  `.trim();
}
/**
 * Generate a Vitest mock
 */
export function generateVitestMock(target, implementation) {
    if (implementation) {
        return `vi.mock('${escapeString(target)}', () => (${implementation}));`;
    }
    return `vi.mock('${escapeString(target)}');`;
}
/**
 * Generate a Vitest spy
 */
export function generateVitestSpy(object, method) {
    return `vi.spyOn(${object}, '${method}')`;
}
/**
 * Generate a Vitest fn (mock function)
 */
export function generateVitestFn(implementation) {
    if (implementation) {
        return `vi.fn(${implementation})`;
    }
    return `vi.fn()`;
}
/**
 * Generate Vitest assertion
 */
export function generateVitestExpect(value, matcher, expected) {
    if (expected !== undefined) {
        return `expect(${value}).${matcher}(${expected});`;
    }
    return `expect(${value}).${matcher}();`;
}
/**
 * Generate Vitest snapshot test
 */
export function generateVitestSnapshot(value, inline = false) {
    if (inline) {
        return `expect(${value}).toMatchInlineSnapshot();`;
    }
    return `expect(${value}).toMatchSnapshot();`;
}
function escapeString(str) {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
}
//# sourceMappingURL=vitest.js.map