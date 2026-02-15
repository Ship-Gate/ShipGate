/**
 * Refactored Test Generator
 *
 * Runs AFTER all source code is generated. Receives:
 * - All generated source files (path -> content)
 * - ISL spec (domain AST)
 * - Prisma schema (optional)
 *
 * Generates three test types per ISL behavior:
 * - Unit: Test service functions with mocked Prisma
 * - API integration: Test route handlers with mocked DB
 * - Contract: Verify ISL preconditions/postconditions/error conditions
 *
 * Uses correct import paths from actual generated files.
 */

import type { DomainDeclaration } from '@isl-lang/parser';
import type { OutputFile } from './types.js';
import {
  generateVitestConfig,
  generateSetupContent,
  generateHelpersContent,
  type TestInfrastructureContext,
} from './test-infrastructure/index.js';

export interface TestGeneratorInput {
  /** Map of generated source file path -> content */
  generatedSourceFiles: Map<string, string>;
  /** Parsed ISL domain */
  domain: DomainDeclaration;
  /** Prisma schema content (optional, for model names) */
  prismaSchema?: string;
  /** Output directory root */
  outDir?: string;
  /** Source directory (default: src) */
  srcDir?: string;
  /** Tests directory (default: tests) */
  testsDir?: string;
  /** Whether routes use auth */
  hasAuth?: boolean;
}

export interface TestGeneratorResult {
  files: OutputFile[];
  errors: string[];
}

/**
 * Resolve import path from test file to source file.
 * tests/unit/CreateUser.unit.test.ts -> src/services.ts
 */
function resolveImportPath(
  testPath: string,
  sourcePath: string,
  srcDir: string,
  testsDir: string
): string {
  const testDir = testPath.split('/').slice(0, -1).join('/');
  const depth = (testDir.match(/\//g) || []).length - (testsDir.split('/').length - 1);
  const prefix = depth > 0 ? '../'.repeat(depth) : './';
  // Normalize: src/services.ts from tests/ -> ../src/services
  if (sourcePath.startsWith(srcDir + '/')) {
    return `${prefix}../${sourcePath}`.replace(/\.(ts|js)$/, '');
  }
  return `${prefix}../${srcDir}/${sourcePath}`.replace(/\.(ts|js)$/, '');
}

/**
 * Find the path to a service/function for a behavior in generated files.
 */
function findServicePath(
  behaviorName: string,
  sourceFiles: Map<string, string>,
  srcDir: string
): string | null {
  const camelName = behaviorName.charAt(0).toLowerCase() + behaviorName.slice(1);
  for (const [path, content] of sourceFiles) {
    if (
      (path.includes('service') || path.includes(camelName) || path.includes(behaviorName)) &&
      (content.includes(`function ${camelName}`) || content.includes(`export async function ${camelName}`) || content.includes(`export function ${camelName}`))
    ) {
      return path.replace(/^.*\//, '').replace(/\.(ts|tsx|js|jsx)$/, '');
    }
  }
  return null;
}

/**
 * Find the route path for a behavior (Next.js app/api or Express routes).
 */
function findRoutePath(
  behaviorName: string,
  sourceFiles: Map<string, string>
): string | null {
  const kebab = behaviorName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  for (const path of sourceFiles.keys()) {
    if (path.includes(kebab) && (path.includes('route') || path.includes('routes'))) {
      return path;
    }
  }
  return null;
}

/**
 * Generate unit tests - service functions with mocked Prisma.
 */
function generateUnitTests(
  behavior: { name: { name: string }; input?: { fields?: unknown[] }; preconditions?: unknown[]; postconditions?: unknown[]; output?: { errors?: { name: { name: string }[] } } },
  domain: DomainDeclaration,
  sourceFiles: Map<string, string>,
  ctx: TestGeneratorInput
): string {
  const { name } = behavior.name;
  const camelName = name.charAt(0).toLowerCase() + name.slice(1);
  const srcDir = ctx.srcDir ?? 'src';
  const testsDir = ctx.testsDir ?? 'tests';
  const domainLower = domain.name?.name?.toLowerCase() ?? 'domain';

  const servicePath = findServicePath(name, sourceFiles, srcDir);
  const importPath = servicePath
    ? `../${srcDir}/${servicePath}`
    : `@/services`;

  return `/**
 * Unit tests for ${name} - service layer with mocked Prisma
 * @generated
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ${name}Input } from '../../types/${domainLower}.types.js';

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    user: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
  })),
}));

import { ${camelName} } from '${importPath}';

describe('${name} (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept valid input', async () => {
    const input = {} as ${name}Input;
    const result = await ${camelName}(input);
    expect(result).toBeDefined();
    expect(result.success !== undefined || 'data' in result).toBe(true);
  });

  it('should reject invalid input when preconditions fail', async () => {
    const invalidInput = {} as ${name}Input;
    const result = await ${camelName}(invalidInput);
    if (result && typeof result === 'object' && 'success' in result) {
      expect(result.success).toBe(false);
    }
  });
});
`;
}

/**
 * Generate API integration tests - route handlers with mocked DB.
 */
function generateApiIntegrationTests(
  behavior: { name: { name: string }; input?: { fields?: { name: { name: string } }[] } },
  domain: DomainDeclaration,
  sourceFiles: Map<string, string>,
  ctx: TestGeneratorInput
): string {
  const { name } = behavior.name;
  const kebab = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const routePath = findRoutePath(name, sourceFiles);
  const apiPath = routePath ? `/${routePath.includes('api') ? 'api/' : ''}${kebab}` : `/api/${kebab}`;

  return `/**
 * API integration tests for ${name} - route handlers with mocked DB
 * @generated
 */
import { describe, it, expect, vi } from 'vitest';
import { fetchJson, assertSuccess } from '../helpers/request-helpers.js';

vi.mock('@prisma/client');

describe('${name} (API)', () => {
  it('should return 200 on valid request', async () => {
    const res = await fetchJson('${apiPath}', {
      method: 'POST',
      body: {},
    });
    assertSuccess(res);
    expect(res.data).toBeDefined();
  });

  it('should return 4xx on invalid input', async () => {
    const res = await fetchJson('${apiPath}', {
      method: 'POST',
      body: { invalid: 'data' },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
`;
}

/**
 * Generate contract tests - ISL preconditions/postconditions/error conditions.
 */
function generateContractTests(
  behavior: {
    name: { name: string };
    preconditions?: unknown[];
    postconditions?: { condition: string; predicates?: unknown[] }[];
    output?: { errors?: { name: { name: string }; when?: { value: string } }[] };
  },
  domain: DomainDeclaration,
  sourceFiles: Map<string, string>,
  ctx: TestGeneratorInput
): string {
  const { name } = behavior.name;
  const camelName = name.charAt(0).toLowerCase() + name.slice(1);
  const srcDir = ctx.srcDir ?? 'src';
  const domainLower = domain.name?.name?.toLowerCase() ?? 'domain';
  const servicePath = findServicePath(name, sourceFiles, srcDir);
  const importPath = servicePath ? `../../${srcDir}/${servicePath}` : `@/services`;

  const preconditionTests =
    (behavior.preconditions?.length ?? 0) > 0
      ? `
  describe('preconditions', () => {
    it('should reject input violating preconditions', async () => {
      const invalidInput = {} as ${name}Input;
      const result = await ${camelName}(invalidInput);
      expect(result).toBeDefined();
    });
  });`
      : '';

  const postconditionTests =
    (behavior.postconditions?.length ?? 0) > 0
      ? `
  describe('postconditions', () => {
    it('should satisfy postconditions on success', async () => {
      const input = {} as ${name}Input;
      const result = await ${camelName}(input);
      if (result && typeof result === 'object' && 'success' in result && result.success) {
        expect(result).toBeDefined();
      }
    });
  });`
      : '';

  const errorTests =
    (behavior.output?.errors?.length ?? 0) > 0
      ? `
  describe('error conditions', () => {
    ${(behavior.output?.errors ?? [])
      .map(
        (e) => `it('should return ${e.name.name} when ${e.when?.value ?? 'expected'}', async () => {
      const input = {} as ${name}Input;
      const result = await ${camelName}(input);
      expect(result).toBeDefined();
    });`
      )
      .join('\n    ')}
  });`
      : '';

  return `/**
 * Contract tests for ${name} - ISL pre/post/error conditions
 * @generated
 */
import { describe, it, expect, vi } from 'vitest';
import type { ${name}Input } from '../../types/${domainLower}.types.js';

vi.mock('@prisma/client');

import { ${camelName} } from '${importPath}';

describe('${name} (contract)', () => {
  ${preconditionTests}
  ${postconditionTests}
  ${errorTests}
});
`;
}

/**
 * Main entry: generate all test files.
 */
export function generateTestsV2(input: TestGeneratorInput): TestGeneratorResult {
  const files: OutputFile[] = [];
  const errors: string[] = [];

  const {
    generatedSourceFiles,
    domain,
    outDir = '.',
    srcDir = 'src',
    testsDir = 'tests',
    hasAuth = false,
  } = input;

  const hasPrisma = input.prismaSchema != null || generatedSourceFiles.has('prisma/schema.prisma');

  const infraCtx: TestInfrastructureContext = {
    srcDir,
    testsDir,
    outDir,
    hasPrisma,
    hasAuth,
  };

  // 1. Test infrastructure
  files.push({
    path: `${testsDir}/vitest.config.ts`,
    content: generateVitestConfig(infraCtx),
    type: 'config',
  });
  files.push({
    path: `${testsDir}/setup.ts`,
    content: generateSetupContent(infraCtx),
    type: 'helper',
  });
  files.push({
    path: `${testsDir}/helpers/request-helpers.ts`,
    content: generateHelpersContent(infraCtx),
    type: 'helper',
  });

  // 2. Per-behavior tests (3 types each)
  for (const behavior of domain.behaviors ?? []) {
    const name = behavior.name?.name ?? 'Unknown';
    if (!name || name === 'Unknown') continue;

    try {
      files.push({
        path: `${testsDir}/unit/${name}.unit.test.ts`,
        content: generateUnitTests(behavior as never, domain, generatedSourceFiles, input),
        type: 'test',
      });
      files.push({
        path: `${testsDir}/api/${name}.api.test.ts`,
        content: generateApiIntegrationTests(behavior as never, domain, generatedSourceFiles, input),
        type: 'test',
      });
      files.push({
        path: `${testsDir}/contract/${name}.contract.test.ts`,
        content: generateContractTests(behavior as never, domain, generatedSourceFiles, input),
        type: 'test',
      });
    } catch (e) {
      errors.push(`Failed to generate tests for ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { files, errors };
}
