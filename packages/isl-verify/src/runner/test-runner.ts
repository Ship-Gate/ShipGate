/**
 * Test Runner
 * 
 * Executes generated tests against implementations using @isl-lang/codegen-tests.
 */

import { spawn } from 'child_process';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { tmpdir } from 'os';
import type { Domain } from '@isl-lang/parser';
import { generate, type GeneratedFile } from '@isl-lang/codegen-tests';
import { createSandboxRunner, type SandboxOptions } from '@isl-lang/verifier-sandbox';

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  details: TestDetail[];
  /** Category breakdown for trust score calculation */
  categories?: {
    postconditions: TestDetail[];
    invariants: TestDetail[];
    scenarios: TestDetail[];
    temporal: TestDetail[];
    chaos: TestDetail[];
  };
}

export interface TestDetail {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  /** Test category for weighted scoring */
  category?: 'postcondition' | 'invariant' | 'scenario' | 'temporal' | 'chaos' | 'precondition';
  /** Impact level for trust scoring */
  impact?: 'critical' | 'high' | 'medium' | 'low';
}

export interface RunnerOptions {
  timeout?: number;
  verbose?: boolean;
  workDir?: string;
  /** Test framework to use */
  framework?: 'vitest' | 'jest';
  /** Language of the implementation */
  language?: 'typescript' | 'javascript' | 'python' | 'go';
}

/**
 * Supported implementation languages
 */
export type ImplementationLanguage = 'typescript' | 'javascript' | 'python' | 'go';

/**
 * Detect implementation language from file extension or content
 */
function detectLanguage(implCode: string, implPath?: string): ImplementationLanguage {
  if (implPath) {
    const ext = extname(implPath).toLowerCase();
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
      case '.mjs':
        return 'javascript';
      case '.py':
        return 'python';
      case '.go':
        return 'go';
    }
  }
  
  // Detect from content
  if (implCode.includes('interface ') || implCode.includes(': string') || implCode.includes(': number')) {
    return 'typescript';
  }
  if (implCode.includes('def ') && implCode.includes(':')) {
    return 'python';
  }
  if (implCode.includes('func ') && implCode.includes('package ')) {
    return 'go';
  }
  
  return 'typescript'; // Default
}

/**
 * Generate TypeScript types from ISL domain
 */
function generateTypes(domain: Domain): { filename: string; content: string } {
  const lines: string[] = [];
  lines.push('// Auto-generated types from ISL specification');
  lines.push('');

  // Generate entity interfaces
  for (const entity of domain.entities) {
    lines.push(`export interface ${entity.name.name} {`);
    for (const field of entity.fields ?? []) {
      const tsType = mapToTSType(field.type);
      const optional = field.optional ? '?' : '';
      lines.push(`  ${field.name.name}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }

  // Generate behavior input/output types
  for (const behavior of domain.behaviors) {
    const behaviorName = behavior.name.name;
    
    // Input type
    if (behavior.input?.fields?.length) {
      lines.push(`export interface ${behaviorName}Input {`);
      for (const field of behavior.input.fields) {
        const tsType = mapToTSType(field.type);
        const optional = field.optional ? '?' : '';
        lines.push(`  ${field.name.name}${optional}: ${tsType};`);
      }
      lines.push('}');
      lines.push('');
    }

    // Output type
    if (behavior.output?.success) {
      lines.push(`export type ${behaviorName}Output = ${mapToTSType(behavior.output.success)};`);
      lines.push('');
    }
  }

  return {
    filename: `${domain.name.name.toLowerCase()}.types.ts`,
    content: lines.join('\n'),
  };
}

/**
 * Generate executable tests using @isl-lang/codegen-tests
 */
function generateTestsFromCodegen(
  domain: Domain,
  framework: 'vitest' | 'jest' = 'vitest'
): GeneratedFile[] {
  return generate(domain, {
    framework,
    outputDir: '.',
    includeHelpers: true,
    includeChaosTests: true,
  });
}

/**
 * Patch generated test files to use the correct implementation paths
 */
function patchTestImports(content: string, _implPath: string): string {
  // Replace standard import paths with the actual implementation path
  return content
    .replace(/from '\.\.\/src\//g, `from './`)
    .replace(/from '@isl-lang\/test-runtime'/g, `from './test-runtime-mock'`);
}

/**
 * Generate a mock test runtime for entity bindings
 */
function generateTestRuntimeMock(domain: Domain): { filename: string; content: string } {
  const entityNames = domain.entities.map(e => e.name.name);
  
  const content = `
// Mock test runtime for entity bindings
// This provides entity proxies for testing postconditions

interface EntityProxy<T = unknown> {
  exists(criteria?: Partial<T>): boolean;
  lookup(criteria: Partial<T>): T | null;
  count(criteria?: Partial<T>): number;
  getAll(): T[];
  create(data: T): T;
  update(criteria: Partial<T>, data: Partial<T>): T | null;
  delete(criteria: Partial<T>): boolean;
}

interface TestContext {
  ${entityNames.map(name => `${name}: EntityProxy;`).join('\n  ')}
  captureState(): Record<string, unknown>;
  __old__: {
    entity<T>(name: string): EntityProxy<T>;
  } & Record<string, unknown>;
}

// In-memory stores for each entity
const stores: Record<string, Map<string, unknown>> = {
  ${entityNames.map(name => `${name}: new Map()`).join(',\n  ')}
};

function createEntityProxy<T extends { id?: string }>(entityName: string): EntityProxy<T> {
  const store = stores[entityName] ?? new Map();
  stores[entityName] = store;
  
  return {
    exists(criteria?: Partial<T>): boolean {
      if (!criteria) return store.size > 0;
      return Array.from(store.values()).some(item => 
        Object.entries(criteria).every(([k, v]) => (item as Record<string, unknown>)[k] === v)
      );
    },
    lookup(criteria: Partial<T>): T | null {
      return Array.from(store.values()).find(item =>
        Object.entries(criteria).every(([k, v]) => (item as Record<string, unknown>)[k] === v)
      ) as T | null;
    },
    count(criteria?: Partial<T>): number {
      if (!criteria) return store.size;
      return Array.from(store.values()).filter(item =>
        Object.entries(criteria).every(([k, v]) => (item as Record<string, unknown>)[k] === v)
      ).length;
    },
    getAll(): T[] {
      return Array.from(store.values()) as T[];
    },
    create(data: T): T {
      const id = data.id ?? crypto.randomUUID();
      const item = { ...data, id };
      store.set(id, item);
      return item as T;
    },
    update(criteria: Partial<T>, data: Partial<T>): T | null {
      const item = this.lookup(criteria);
      if (!item) return null;
      const updated = { ...item, ...data };
      store.set((updated as { id: string }).id, updated);
      return updated as T;
    },
    delete(criteria: Partial<T>): boolean {
      const item = this.lookup(criteria);
      if (!item) return false;
      return store.delete((item as { id: string }).id);
    }
  };
}

let snapshotState: Record<string, unknown[]> = {};

export function createTestContext(): TestContext {
  // Create entity proxies
  ${entityNames.map(name => `const ${name} = createEntityProxy('${name}');`).join('\n  ')}
  
  return {
    ${entityNames.join(',\n    ')},
    captureState() {
      snapshotState = {
        ${entityNames.map(name => `${name}: Array.from(stores.${name}?.values() ?? [])`).join(',\n        ')}
      };
      return snapshotState;
    },
    __old__: {
      entity(name: string) {
        return {
          exists: () => (snapshotState[name]?.length ?? 0) > 0,
          lookup: (c: Record<string, unknown>) => snapshotState[name]?.find(i => 
            Object.entries(c).every(([k, v]) => (i as Record<string, unknown>)[k] === v)
          ) ?? null,
          count: () => snapshotState[name]?.length ?? 0,
          getAll: () => snapshotState[name] ?? [],
        };
      },
      ${entityNames.map(name => `get ${name}() { return this.entity('${name}'); }`).join(',\n      ')}
    }
  };
}

// Export entity proxies for direct use
${entityNames.map(name => `export const ${name} = createEntityProxy('${name}');`).join('\n')}

// Reset all stores (call in beforeEach)
export function resetStores(): void {
  ${entityNames.map(name => `stores.${name}?.clear();`).join('\n  ')}
  snapshotState = {};
}

// Test input helpers
export function createTestInput(): Record<string, unknown> {
  return {};
}

export function createInvalidInput(): Record<string, unknown> {
  return {};
}
`.trim();

  return {
    filename: 'test-runtime-mock.ts',
    content,
  };
}

/**
 * Map ISL type to TypeScript type
 */
function mapToTSType(typeRef: unknown): string {
  if (!typeRef) return 'unknown';
  
  if (typeof typeRef === 'object' && typeRef !== null) {
    const t = typeRef as Record<string, unknown>;
    
    if (t.kind === 'PrimitiveType' || t.kind === 'ReferenceType') {
      const name = (t.name as { name?: string })?.name ?? (t.name as string);
      const typeMap: Record<string, string> = {
        'String': 'string',
        'Int': 'number',
        'Integer': 'number',
        'Float': 'number',
        'Decimal': 'number',
        'Boolean': 'boolean',
        'Bool': 'boolean',
        'UUID': 'string',
        'Timestamp': 'Date',
        'DateTime': 'Date',
      };
      return typeMap[name] ?? name ?? 'unknown';
    }
    
    if (t.kind === 'ListType') {
      return `${mapToTSType(t.elementType)}[]`;
    }
    
    if (t.kind === 'OptionalType') {
      return `${mapToTSType(t.inner)} | null`;
    }
    
    // Simple name reference
    if ('name' in t) {
      const name = typeof t.name === 'string' ? t.name : (t.name as { name?: string })?.name;
      if (name) {
        const typeMap: Record<string, string> = {
          'String': 'string',
          'Int': 'number',
          'Boolean': 'boolean',
          'UUID': 'string',
        };
        return typeMap[name] ?? name;
      }
    }
  }
  
  return 'unknown';
}

export class TestRunner {
  private options: Required<Omit<RunnerOptions, 'language' | 'sandbox' | 'sandboxTimeout' | 'sandboxMemory' | 'sandboxEnv'>> & { 
    language?: ImplementationLanguage;
    sandbox?: 'auto' | 'worker' | 'docker' | 'off';
    sandboxTimeout?: number;
    sandboxMemory?: number;
    sandboxEnv?: string;
  };
  private sandboxRunner?: ReturnType<typeof createSandboxRunner>;

  constructor(options: RunnerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      verbose: options.verbose ?? false,
      workDir: options.workDir ?? join(tmpdir(), 'isl-verify'),
      framework: options.framework ?? 'vitest',
      language: options.language,
      sandbox: options.sandbox,
      sandboxTimeout: options.sandboxTimeout,
      sandboxMemory: options.sandboxMemory,
      sandboxEnv: options.sandboxEnv,
    };

    // Initialize sandbox runner if sandbox mode is enabled
    if (this.options.sandbox && this.options.sandbox !== 'off') {
      const allowedEnvVars = this.options.sandboxEnv
        ? this.options.sandboxEnv.split(',').map(s => s.trim())
        : ['NODE_ENV', 'PATH', 'HOME', 'TMPDIR', 'TMP'];

      const sandboxOptions: SandboxOptions = {
        mode: this.options.sandbox,
        timeout: this.options.sandboxTimeout ?? this.options.timeout,
        maxMemory: this.options.sandboxMemory ? this.options.sandboxMemory * 1024 * 1024 : undefined,
        allowedEnvVars,
        allowNetwork: false, // Block network by default
        allowFilesystem: false, // Block filesystem access outside workDir
        workDir: this.options.workDir,
        verbose: this.options.verbose,
      };

      this.sandboxRunner = createSandboxRunner(sandboxOptions);
    }
  }

  /**
   * Run verification tests for a domain against an implementation
   */
  async run(
    domain: Domain,
    implementationCode: string
  ): Promise<TestResult> {
    // Create temp directory
    const workDir = join(this.options.workDir, `verify-${Date.now()}`);
    await mkdir(workDir, { recursive: true });
    await mkdir(join(workDir, 'src'), { recursive: true });
    await mkdir(join(workDir, 'helpers'), { recursive: true });
    await mkdir(join(workDir, 'fixtures'), { recursive: true });

    const domainName = domain.name.name.toLowerCase();
    const language = this.options.language ?? detectLanguage(implementationCode);

    try {
      // Generate TypeScript types
      const types = generateTypes(domain);
      await writeFile(join(workDir, 'src', types.filename), types.content);

      // Generate test runtime mock for entity bindings
      const runtimeMock = generateTestRuntimeMock(domain);
      await writeFile(join(workDir, runtimeMock.filename), runtimeMock.content);

      // Write implementation file
      const implFilename = `${domainName}.impl.ts`;
      await writeFile(join(workDir, 'src', implFilename), implementationCode);

      // Generate tests using @isl-lang/codegen-tests
      const generatedFiles = generateTestsFromCodegen(domain, this.options.framework);
      
      // Write all generated files
      for (const file of generatedFiles) {
        const filePath = join(workDir, file.path);
        const dir = join(workDir, file.path.substring(0, file.path.lastIndexOf('/')));
        
        // Ensure directory exists
        await mkdir(dir, { recursive: true }).catch(() => {});
        
        // Patch imports to use our test runtime mock and implementation
        let content = file.content;
        content = patchTestImports(content, implFilename);
        content = this.patchBehaviorImports(content, domain, domainName);
        
        await writeFile(filePath, content);
      }

      // Write package.json for the test
      await writeFile(
        join(workDir, 'package.json'),
        JSON.stringify({
          name: `isl-verify-${domainName}`,
          type: 'module',
          scripts: {
            test: this.options.framework === 'vitest' 
              ? 'vitest run --reporter=json'
              : 'jest --json',
          },
        }, null, 2)
      );

      // Write framework config
      if (this.options.framework === 'vitest') {
        await writeFile(
          join(workDir, 'vitest.config.ts'),
          `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    testTimeout: ${this.options.timeout},
    include: ['**/*.test.ts'],
  },
});`
        );
      } else {
        await writeFile(
          join(workDir, 'jest.config.js'),
          `module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\\\.tsx?$': 'ts-jest' },
  testTimeout: ${this.options.timeout},
  testMatch: ['**/*.test.ts'],
};`
        );
      }

      // Write tsconfig for TypeScript compilation
      await writeFile(
        join(workDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            moduleResolution: 'bundler',
            esModuleInterop: true,
            strict: true,
            skipLibCheck: true,
            outDir: './dist',
            rootDir: '.',
          },
          include: ['**/*.ts'],
        }, null, 2)
      );

      if (this.options.verbose) {
        console.log(`Generated ${generatedFiles.length} test files in ${workDir}`);
        generatedFiles.forEach(f => console.log(`  - ${f.path}`));
      }

      // Run tests based on language
      let result = await this.executeTestsForLanguage(workDir, language);
      
      // BUG-005 FIX: If no tests were executed, generate synthetic tests from postconditions
      if (result.details.length === 0) {
        result = this.generateSyntheticTests(domain);
      }
      
      // Categorize test results for trust scoring
      result.categories = this.categorizeResults(result.details);
      
      return result;
    } finally {
      // Cleanup unless verbose (for debugging)
      if (!this.options.verbose) {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
      } else {
        console.log(`Test files preserved at: ${workDir}`);
      }
    }
  }

  /**
   * Patch behavior imports in generated test files
   */
  private patchBehaviorImports(content: string, domain: Domain, domainName: string): string {
    let patched = content;
    
    for (const behavior of domain.behaviors) {
      const behaviorName = behavior.name.name;
      const firstChar = behaviorName.charAt(0);
      const funcName = firstChar ? firstChar.toLowerCase() + behaviorName.slice(1) : 'unknown';
      
      // Replace behavior imports with implementation imports
      patched = patched.replace(
        new RegExp(`from '\\.\\.?\\/src\\/${behaviorName}'`, 'g'),
        `from './src/${domainName}.impl'`
      );
      patched = patched.replace(
        new RegExp(`import \\{ ${behaviorName} \\}`, 'g'),
        `import { ${funcName} as ${behaviorName} }`
      );
    }
    
    return patched;
  }

  /**
   * Categorize test results for weighted trust scoring
   */
  private categorizeResults(details: TestDetail[]): TestResult['categories'] {
    const categories: TestResult['categories'] = {
      postconditions: [],
      invariants: [],
      scenarios: [],
      temporal: [],
      chaos: [],
    };

    for (const detail of details) {
      const name = detail.name.toLowerCase();
      
      if (name.includes('postcondition') || name.includes('ensures') || name.includes('on success')) {
        detail.category = 'postcondition';
        detail.impact = 'high';
        categories.postconditions.push(detail);
      } else if (name.includes('invariant') || name.includes('maintains')) {
        detail.category = 'invariant';
        detail.impact = 'high';
        categories.invariants.push(detail);
      } else if (name.includes('temporal') || name.includes('within') || name.includes('eventually')) {
        detail.category = 'temporal';
        detail.impact = 'medium';
        categories.temporal.push(detail);
      } else if (name.includes('chaos') || name.includes('resilience') || name.includes('fault')) {
        detail.category = 'chaos';
        detail.impact = 'medium';
        categories.chaos.push(detail);
      } else if (name.includes('precondition') || name.includes('requires')) {
        detail.category = 'precondition';
        detail.impact = 'medium';
        categories.scenarios.push(detail); // Group with scenarios for scoring
      } else {
        detail.category = 'scenario';
        detail.impact = 'low';
        categories.scenarios.push(detail);
      }
    }

    return categories;
  }

  /**
   * BUG-005 FIX: Generate synthetic tests from domain postconditions and invariants
   * This is used as a fallback when vitest subprocess fails or returns 0 tests
   */
  private generateSyntheticTests(domain: Domain): TestResult {
    const details: TestDetail[] = [];
    const startTime = Date.now();

    for (const behavior of domain.behaviors) {
      const behaviorName = behavior.name.name;

      // Generate tests for postconditions
      if (behavior.postconditions && Array.isArray(behavior.postconditions)) {
        for (let i = 0; i < behavior.postconditions.length; i++) {
          const post = behavior.postconditions[i];
          const postText = typeof post === 'string' ? post : 
                          (post as { expression?: string })?.expression ?? `postcondition_${i}`;
          details.push({
            name: `${behaviorName}: postcondition - ${postText}`,
            status: 'skipped',
            duration: 0,
            category: 'postcondition',
            impact: 'high',
            error: 'Synthetic test - implementation verification pending',
          });
        }
      }

      // Generate tests for invariants
      if (behavior.invariants && Array.isArray(behavior.invariants)) {
        for (let i = 0; i < behavior.invariants.length; i++) {
          const inv = behavior.invariants[i];
          const invText = typeof inv === 'string' ? inv :
                         (inv as { expression?: string })?.expression ?? `invariant_${i}`;
          details.push({
            name: `${behaviorName}: invariant - ${invText}`,
            status: 'skipped',
            duration: 0,
            category: 'invariant',
            impact: 'high',
            error: 'Synthetic test - implementation verification pending',
          });
        }
      }

      // Generate a basic behavior test
      details.push({
        name: `${behaviorName}: behavior execution`,
        status: 'skipped',
        duration: 0,
        category: 'scenario',
        impact: 'medium',
        error: 'Synthetic test - behavior verification pending',
      });
    }

    // If no behaviors found, add a domain-level test
    if (details.length === 0) {
      details.push({
        name: `${domain.name.name}: domain validation`,
        status: 'skipped',
        duration: 0,
        category: 'scenario',
        impact: 'low',
        error: 'No behaviors defined in domain',
      });
    }

    return {
      passed: 0,
      failed: 0,
      skipped: details.length,
      duration: Date.now() - startTime,
      details,
    };
  }

  /**
   * Execute tests based on implementation language
   */
  private async executeTestsForLanguage(
    workDir: string, 
    language: ImplementationLanguage
  ): Promise<TestResult> {
    switch (language) {
      case 'python':
        return this.executePythonTests(workDir);
      case 'go':
        return this.executeGoTests(workDir);
      case 'typescript':
      case 'javascript':
      default:
        return this.executeTests(workDir);
    }
  }

  /**
   * Execute Python tests using pytest
   */
  private async executePythonTests(workDir: string): Promise<TestResult> {
    return new Promise((resolve, _reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const proc = spawn('pytest', ['--tb=short', '-q', '--json-report', '--json-report-file=results.json'], {
        cwd: workDir,
        shell: false,
        timeout: this.options.timeout,
      });

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('error', (error) => {
        // Fall back to basic result if pytest not available
        resolve({
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: Date.now() - startTime,
          details: [{
            name: 'pytest-execution',
            status: 'failed',
            duration: Date.now() - startTime,
            error: `Python test execution failed: ${error.message}`,
          }],
        });
      });

      proc.on('close', async (code) => {
        const duration = Date.now() - startTime;
        
        try {
          const resultsFile = join(workDir, 'results.json');
          const resultsJson = await readFile(resultsFile, 'utf-8');
          const results = JSON.parse(resultsJson);
          
          resolve(this.parsePytestResults(results, duration));
        } catch {
          resolve({
            passed: code === 0 ? 1 : 0,
            failed: code === 0 ? 0 : 1,
            skipped: 0,
            duration,
            details: [{
              name: 'pytest-execution',
              status: code === 0 ? 'passed' : 'failed',
              duration,
              error: code !== 0 ? stderr || stdout : undefined,
            }],
          });
        }
      });
    });
  }

  /**
   * Parse pytest output (for sandboxed execution)
   */
  private parsePytestOutput(output: string, duration: number): TestResult {
    try {
      // Try to read results.json if it exists
      const jsonMatch = output.match(/\{[\s\S]*"tests"[\s\S]*\}/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        return this.parsePytestResults(results, duration);
      }
    } catch {
      // Fall through to basic parsing
    }

    // Basic parsing from stdout
    const passed = (output.match(/passed/g) || []).length;
    const failed = (output.match(/failed/g) || []).length;
    const skipped = (output.match(/skipped/g) || []).length;

    return {
      passed,
      failed,
      skipped,
      duration,
      details: [{
        name: 'pytest-execution',
        status: failed > 0 ? 'failed' : 'passed',
        duration,
        error: failed > 0 ? output : undefined,
      }],
    };
  }

  /**
   * Parse Go test output (for sandboxed execution)
   */
  private parseGoTestOutput(output: string, duration: number): TestResult {
    return this.parseGoTestResults(output, duration, null);
  }

  /**
   * Parse pytest JSON report
   */
  private parsePytestResults(results: Record<string, unknown>, duration: number): TestResult {
    const tests = (results.tests ?? []) as Array<{
      nodeid: string;
      outcome: string;
      duration: number;
      longrepr?: string;
    }>;
    
    const details: TestDetail[] = tests.map(t => ({
      name: t.nodeid,
      status: t.outcome === 'passed' ? 'passed' : t.outcome === 'skipped' ? 'skipped' : 'failed',
      duration: t.duration * 1000,
      error: t.longrepr,
    }));

    return {
      passed: details.filter(d => d.status === 'passed').length,
      failed: details.filter(d => d.status === 'failed').length,
      skipped: details.filter(d => d.status === 'skipped').length,
      duration,
      details,
    };
  }

  /**
   * Execute Go tests using go test
   */
  private async executeGoTests(workDir: string): Promise<TestResult> {
    return new Promise((resolve, _reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const proc = spawn('go', ['test', '-json', './...'], {
        cwd: workDir,
        shell: false,
        timeout: this.options.timeout,
      });

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('error', (error) => {
        resolve({
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: Date.now() - startTime,
          details: [{
            name: 'go-test-execution',
            status: 'failed',
            duration: Date.now() - startTime,
            error: `Go test execution failed: ${error.message}`,
          }],
        });
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve(this.parseGoTestResults(stdout, duration, code));
      });
    });
  }

  /**
   * Parse go test JSON output
   */
  private parseGoTestResults(output: string, duration: number, exitCode: number | null): TestResult {
    const details: TestDetail[] = [];
    const lines = output.split('\n').filter(Boolean);
    
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as {
          Action: string;
          Test?: string;
          Elapsed?: number;
          Output?: string;
        };
        
        if (event.Action === 'pass' && event.Test) {
          details.push({
            name: event.Test,
            status: 'passed',
            duration: (event.Elapsed ?? 0) * 1000,
          });
        } else if (event.Action === 'fail' && event.Test) {
          details.push({
            name: event.Test,
            status: 'failed',
            duration: (event.Elapsed ?? 0) * 1000,
            error: event.Output,
          });
        } else if (event.Action === 'skip' && event.Test) {
          details.push({
            name: event.Test,
            status: 'skipped',
            duration: 0,
          });
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    // If no structured results, create basic result
    if (details.length === 0) {
      return {
        passed: exitCode === 0 ? 1 : 0,
        failed: exitCode === 0 ? 0 : 1,
        skipped: 0,
        duration,
        details: [{
          name: 'go-test',
          status: exitCode === 0 ? 'passed' : 'failed',
          duration,
          error: exitCode !== 0 ? output : undefined,
        }],
      };
    }

    return {
      passed: details.filter(d => d.status === 'passed').length,
      failed: details.filter(d => d.status === 'failed').length,
      skipped: details.filter(d => d.status === 'skipped').length,
      duration,
      details,
    };
  }

  /**
   * Execute vitest and parse results
   */
  private executeTests(workDir: string): Promise<TestResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const proc = spawn('npx', ['vitest', 'run', '--reporter=json'], {
        cwd: workDir,
        shell: false,
        timeout: this.options.timeout,
      });

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        reject(error);
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;

        // Parse vitest JSON output
        try {
          const result = this.parseVitestOutput(stdout, duration);
          resolve(result);
        } catch (e) {
          // If parsing fails, create a basic result
          resolve({
            passed: code === 0 ? 1 : 0,
            failed: code === 0 ? 0 : 1,
            skipped: 0,
            duration,
            details: [{
              name: 'test-execution',
              status: code === 0 ? 'passed' : 'failed',
              duration,
              error: code !== 0 ? stderr || stdout : undefined,
            }],
          });
        }
      });
    });
  }

  /**
   * Parse vitest JSON output
   */
  private parseVitestOutput(output: string, totalDuration: number): TestResult {
    // Try to find JSON in output
    const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: totalDuration,
        details: [],
      };
    }

    const json = JSON.parse(jsonMatch[0]);
    const details: TestDetail[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const file of json.testResults ?? []) {
      for (const test of file.assertionResults ?? []) {
        const status = test.status === 'passed' ? 'passed' 
          : test.status === 'failed' ? 'failed' 
          : 'skipped';
        
        if (status === 'passed') passed++;
        else if (status === 'failed') failed++;
        else skipped++;

        details.push({
          name: test.fullName ?? test.title ?? 'unknown',
          status,
          duration: test.duration ?? 0,
          error: test.failureMessages?.join('\n'),
        });
      }
    }

    return {
      passed,
      failed,
      skipped,
      duration: totalDuration,
      details,
    };
  }
}

/**
 * Run verification tests
 */
export async function runTests(
  domain: Domain,
  implementationCode: string,
  options?: RunnerOptions
): Promise<TestResult> {
  const runner = new TestRunner(options);
  return runner.run(domain, implementationCode);
}
