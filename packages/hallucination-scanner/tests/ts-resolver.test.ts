import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { resolveTs, scanTsFile } from '../src/ts/resolver.js';
import { parseImports, extractPackageName } from '../src/ts/import-parser.js';
import { isNodeBuiltin, isFakeNodeBuiltin } from '../src/ts/builtins.js';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');

// ── Builtins ──────────────────────────────────────────────────────────────

describe('isNodeBuiltin', () => {
  it('recognizes core modules without prefix', () => {
    expect(isNodeBuiltin('fs')).toBe(true);
    expect(isNodeBuiltin('path')).toBe(true);
    expect(isNodeBuiltin('crypto')).toBe(true);
    expect(isNodeBuiltin('http')).toBe(true);
    expect(isNodeBuiltin('stream')).toBe(true);
    expect(isNodeBuiltin('child_process')).toBe(true);
  });

  it('recognizes core modules with node: prefix', () => {
    expect(isNodeBuiltin('node:fs')).toBe(true);
    expect(isNodeBuiltin('node:path')).toBe(true);
    expect(isNodeBuiltin('node:crypto')).toBe(true);
    expect(isNodeBuiltin('node:test')).toBe(true);
  });

  it('recognizes subpath builtins', () => {
    expect(isNodeBuiltin('fs/promises')).toBe(true);
    expect(isNodeBuiltin('node:fs/promises')).toBe(true);
    expect(isNodeBuiltin('stream/web')).toBe(true);
    expect(isNodeBuiltin('path/posix')).toBe(true);
  });

  it('rejects non-builtins', () => {
    expect(isNodeBuiltin('express')).toBe(false);
    expect(isNodeBuiltin('lodash')).toBe(false);
    expect(isNodeBuiltin('@types/node')).toBe(false);
    expect(isNodeBuiltin('./local')).toBe(false);
  });
});

describe('isFakeNodeBuiltin', () => {
  it('detects fake node: imports', () => {
    expect(isFakeNodeBuiltin('node:fakemod')).toBe(true);
    expect(isFakeNodeBuiltin('node:database')).toBe(true);
    expect(isFakeNodeBuiltin('node:express')).toBe(true);
  });

  it('passes real node: imports', () => {
    expect(isFakeNodeBuiltin('node:fs')).toBe(false);
    expect(isFakeNodeBuiltin('node:path')).toBe(false);
  });

  it('ignores non-node: specifiers', () => {
    expect(isFakeNodeBuiltin('express')).toBe(false);
    expect(isFakeNodeBuiltin('fakemod')).toBe(false);
  });
});

// ── extractPackageName ────────────────────────────────────────────────────

describe('extractPackageName', () => {
  it('extracts bare package names', () => {
    expect(extractPackageName('express')).toBe('express');
    expect(extractPackageName('lodash')).toBe('lodash');
  });

  it('extracts package name from subpath', () => {
    expect(extractPackageName('express/json')).toBe('express');
    expect(extractPackageName('lodash/get')).toBe('lodash');
  });

  it('extracts scoped package names', () => {
    expect(extractPackageName('@prisma/client')).toBe('@prisma/client');
    expect(extractPackageName('@types/express')).toBe('@types/express');
  });

  it('extracts scoped package name from subpath', () => {
    expect(extractPackageName('@scope/pkg/sub/path')).toBe('@scope/pkg');
  });

  it('returns undefined for relative imports', () => {
    expect(extractPackageName('./utils')).toBeUndefined();
    expect(extractPackageName('../lib/helper')).toBeUndefined();
    expect(extractPackageName('/absolute/path')).toBeUndefined();
  });

  it('returns undefined for builtins', () => {
    expect(extractPackageName('fs')).toBeUndefined();
    expect(extractPackageName('node:path')).toBeUndefined();
  });
});

// ── Import parser ─────────────────────────────────────────────────────────

describe('parseImports', () => {
  it('parses static imports', () => {
    const source = `import express from 'express';
import { z } from 'zod';
import * as path from 'node:path';`;
    const imports = parseImports(source, 'test.ts');
    expect(imports).toHaveLength(3);
    expect(imports[0]!.specifier).toBe('express');
    expect(imports[0]!.kind).toBe('import');
    expect(imports[1]!.specifier).toBe('zod');
    expect(imports[2]!.specifier).toBe('node:path');
    expect(imports[2]!.isBuiltin).toBe(true);
  });

  it('parses type-only imports', () => {
    const source = `import type { Request } from 'express';
import type { Config } from './config';`;
    const imports = parseImports(source, 'test.ts');
    expect(imports).toHaveLength(2);
    expect(imports[0]!.kind).toBe('import-type');
    expect(imports[0]!.specifier).toBe('express');
    expect(imports[1]!.kind).toBe('import-type');
    expect(imports[1]!.isRelative).toBe(true);
  });

  it('parses side-effect imports', () => {
    const source = `import 'reflect-metadata';
import './polyfills';`;
    const imports = parseImports(source, 'test.ts');
    expect(imports).toHaveLength(2);
    expect(imports[0]!.specifier).toBe('reflect-metadata');
    expect(imports[1]!.specifier).toBe('./polyfills');
    expect(imports[1]!.isRelative).toBe(true);
  });

  it('parses export-from statements', () => {
    const source = `export { foo } from 'bar';
export * from '@scope/pkg';
export type { Config } from './types';`;
    const imports = parseImports(source, 'test.ts');
    expect(imports).toHaveLength(3);
    expect(imports[0]!.kind).toBe('export-from');
    expect(imports[0]!.specifier).toBe('bar');
    expect(imports[1]!.specifier).toBe('@scope/pkg');
    expect(imports[1]!.isScoped).toBe(true);
  });

  it('parses require() calls', () => {
    const source = `const express = require('express');
const { join } = require('path');
require('./setup');`;
    const imports = parseImports(source, 'test.js');
    expect(imports).toHaveLength(3);
    expect(imports[0]!.kind).toBe('require');
    expect(imports[0]!.specifier).toBe('express');
    expect(imports[1]!.specifier).toBe('path');
    expect(imports[2]!.specifier).toBe('./setup');
  });

  it('parses dynamic import()', () => {
    const source = `const mod = await import('chalk');
import('./lazy-module');`;
    const imports = parseImports(source, 'test.ts');
    expect(imports).toHaveLength(2);
    expect(imports[0]!.kind).toBe('dynamic');
    expect(imports[0]!.specifier).toBe('chalk');
    expect(imports[1]!.specifier).toBe('./lazy-module');
  });

  it('handles multi-line imports', () => {
    const source = `import {
  foo,
  bar,
  baz,
} from 'some-package';`;
    const imports = parseImports(source, 'test.ts');
    expect(imports).toHaveLength(1);
    expect(imports[0]!.specifier).toBe('some-package');
  });

  it('skips single-line comments', () => {
    const source = `// import foo from 'foo';
import bar from 'bar';`;
    const imports = parseImports(source, 'test.ts');
    expect(imports).toHaveLength(1);
    expect(imports[0]!.specifier).toBe('bar');
  });

  it('classifies relative imports', () => {
    const source = `import { a } from './local';
import { b } from '../parent';
import { c } from 'external';`;
    const imports = parseImports(source, 'test.ts');
    expect(imports[0]!.isRelative).toBe(true);
    expect(imports[1]!.isRelative).toBe(true);
    expect(imports[2]!.isRelative).toBe(false);
  });

  it('classifies scoped packages', () => {
    const source = `import { PrismaClient } from '@prisma/client';
import express from 'express';`;
    const imports = parseImports(source, 'test.ts');
    expect(imports[0]!.isScoped).toBe(true);
    expect(imports[0]!.packageName).toBe('@prisma/client');
    expect(imports[1]!.isScoped).toBe(false);
    expect(imports[1]!.packageName).toBe('express');
  });
});

// ── Resolver — valid project ──────────────────────────────────────────────

describe('resolveTs — valid project', () => {
  it('reports no findings for a clean project', async () => {
    const result = await resolveTs({
      projectRoot: path.join(FIXTURES, 'ts-valid'),
      entries: [path.join(FIXTURES, 'ts-valid', 'src', 'index.ts')],
    });

    expect(result.success).toBe(true);
    expect(result.findings).toHaveLength(0);
    expect(result.trustScore).toBe(100);
    expect(result.manifest).not.toBeNull();
    expect(result.manifest!.name).toBe('ts-valid-fixture');
  });

  it('finds all declared packages', async () => {
    const result = await resolveTs({
      projectRoot: path.join(FIXTURES, 'ts-valid'),
      entries: [path.join(FIXTURES, 'ts-valid', 'src', 'index.ts')],
    });

    expect(result.declaredPackages.has('express')).toBe(true);
    expect(result.declaredPackages.has('@prisma/client')).toBe(true);
    expect(result.declaredPackages.has('zod')).toBe(true);
    expect(result.declaredPackages.has('vitest')).toBe(true);
  });

  it('correctly classifies all import types', async () => {
    const result = await resolveTs({
      projectRoot: path.join(FIXTURES, 'ts-valid'),
      entries: [path.join(FIXTURES, 'ts-valid', 'src', 'index.ts')],
    });

    const builtins = result.imports.filter(i => i.isBuiltin);
    const relatives = result.imports.filter(i => i.isRelative);
    const packages = result.imports.filter(i => !i.isBuiltin && !i.isRelative);

    expect(builtins.length).toBeGreaterThanOrEqual(2); // node:path, fs
    expect(relatives.length).toBeGreaterThanOrEqual(1); // ./utils
    expect(packages.length).toBeGreaterThanOrEqual(3); // express, zod, @prisma/client
  });
});

// ── Resolver — missing packages ───────────────────────────────────────────

describe('resolveTs — missing packages', () => {
  it('detects missing packages', async () => {
    const result = await resolveTs({
      projectRoot: path.join(FIXTURES, 'ts-missing'),
      entries: [path.join(FIXTURES, 'ts-missing', 'src', 'app.ts')],
      checkRelativeImports: false,
    });

    expect(result.success).toBe(false);
    expect(result.missingPackages).toContain('zod');
    expect(result.missingPackages).toContain('@prisma/client');
    expect(result.missingPackages).toContain('@types/config');
    // express IS declared, so it should NOT be missing
    expect(result.missingPackages).not.toContain('express');
  });

  it('produces findings for each missing package', async () => {
    const result = await resolveTs({
      projectRoot: path.join(FIXTURES, 'ts-missing'),
      entries: [path.join(FIXTURES, 'ts-missing', 'src', 'app.ts')],
      checkRelativeImports: false,
    });

    const missingFindings = result.findings.filter(f => f.kind === 'missing_package');
    const typeOnlyFindings = result.findings.filter(f => f.kind === 'type_only_missing');

    // zod and @prisma/client are runtime missing
    expect(missingFindings.some(f => f.packageName === 'zod')).toBe(true);
    expect(missingFindings.some(f => f.packageName === '@prisma/client')).toBe(true);

    // @types/config is a type-only import
    expect(typeOnlyFindings.some(f => f.packageName === '@types/config')).toBe(true);
  });

  it('penalizes trust score for missing packages', async () => {
    const result = await resolveTs({
      projectRoot: path.join(FIXTURES, 'ts-missing'),
      entries: [path.join(FIXTURES, 'ts-missing', 'src', 'app.ts')],
      checkRelativeImports: false,
    });

    expect(result.trustScore).toBeLessThan(100);
    expect(result.trustScore).toBeGreaterThanOrEqual(0);
  });

  it('includes fix suggestions', async () => {
    const result = await resolveTs({
      projectRoot: path.join(FIXTURES, 'ts-missing'),
      entries: [path.join(FIXTURES, 'ts-missing', 'src', 'app.ts')],
      checkRelativeImports: false,
    });

    for (const f of result.findings) {
      expect(f.suggestion).toBeDefined();
      expect(f.suggestion!.length).toBeGreaterThan(0);
    }
  });
});

// ── Resolver — ghost imports ──────────────────────────────────────────────

describe('resolveTs — ghost imports', () => {
  it('detects relative imports to non-existent files', async () => {
    const result = await resolveTs({
      projectRoot: path.join(FIXTURES, 'ts-missing'),
      entries: [path.join(FIXTURES, 'ts-missing', 'src', 'app.ts')],
      checkRelativeImports: true,
    });

    const ghostFindings = result.findings.filter(f => f.kind === 'ghost_import');
    expect(ghostFindings.length).toBeGreaterThanOrEqual(1);
    expect(ghostFindings.some(f => f.specifier === './does-not-exist')).toBe(true);
  });
});

// ── Resolver — no package.json ────────────────────────────────────────────

describe('resolveTs — no package.json', () => {
  it('reports phantom packages when no package.json exists', async () => {
    const result = await resolveTs({
      projectRoot: path.join(FIXTURES, 'ts-no-pkg'),
      entries: [path.join(FIXTURES, 'ts-no-pkg', 'src', 'index.ts')],
    });

    expect(result.success).toBe(false);
    expect(result.manifest).toBeNull();

    const phantomFindings = result.findings.filter(f => f.kind === 'phantom_package');
    expect(phantomFindings.length).toBeGreaterThanOrEqual(1);
    expect(phantomFindings.some(f => f.packageName === 'express')).toBe(true);

    // node:fs should NOT produce a finding (it's a builtin)
    expect(result.findings.some(f => f.specifier === 'node:fs')).toBe(false);
  });
});

// ── Resolver — fake builtins ──────────────────────────────────────────────

describe('resolveTs — fake builtins', () => {
  it('detects fake node: imports', async () => {
    const source = `import { magic } from 'node:fakemod';
import * as fs from 'node:fs';`;
    const result = await resolveTs({
      projectRoot: '/tmp/fake-project',
      entries: ['/tmp/fake-project/src/index.ts'],
      readFile: async () => source,
      fileExists: async (p) => p.endsWith('index.ts'),
      packageJsonContent: '{"name":"test","dependencies":{}}',
    });

    const fakeBuiltinFindings = result.findings.filter(f => f.kind === 'unknown_builtin');
    expect(fakeBuiltinFindings).toHaveLength(1);
    expect(fakeBuiltinFindings[0]!.specifier).toBe('node:fakemod');
  });
});

// ── Resolver — virtual (in-memory) ───────────────────────────────────────

describe('resolveTs — virtual project', () => {
  it('works with custom readFile/fileExists', async () => {
    const source = `
import React from 'react';
import axios from 'axios';
import { helper } from './helper';
`;
    const result = await resolveTs({
      projectRoot: '/project',
      entries: ['/project/src/app.tsx'],
      readFile: async () => source,
      fileExists: async (p) => {
        const normalized = p.replace(/\\/g, '/');
        return normalized.endsWith('app.tsx') || normalized.endsWith('helper.ts');
      },
      packageJsonContent: JSON.stringify({
        name: 'virtual',
        dependencies: { 'react': '^18.0.0' },
      }),
    });

    expect(result.manifest).not.toBeNull();
    expect(result.missingPackages).toContain('axios');
    expect(result.missingPackages).not.toContain('react');

    const missingFindings = result.findings.filter(f => f.kind === 'missing_package');
    expect(missingFindings).toHaveLength(1);
    expect(missingFindings[0]!.packageName).toBe('axios');
  });

  it('deduplicates findings for the same package', async () => {
    const source = `
import axios from 'axios';
import { get } from 'axios';
import axiosRetry from 'axios-retry';
`;
    const result = await resolveTs({
      projectRoot: '/project',
      entries: ['/project/src/index.ts'],
      readFile: async () => source,
      fileExists: async (p) => p.endsWith('index.ts'),
      packageJsonContent: '{"name":"test","dependencies":{}}',
    });

    // axios should only produce ONE finding despite two import statements
    const axiosFindings = result.findings.filter(f => f.packageName === 'axios');
    expect(axiosFindings).toHaveLength(1);

    // axios-retry is a different package
    const retryFindings = result.findings.filter(f => f.packageName === 'axios-retry');
    expect(retryFindings).toHaveLength(1);
  });
});

// ── scanTsFile ────────────────────────────────────────────────────────────

describe('scanTsFile', () => {
  it('scans a single file and returns imports + findings', async () => {
    const content = `
import express from 'express';
import * as fs from 'node:fs';
import { ghost } from 'node:phantom';
`;
    const result = await scanTsFile('/tmp/test.ts', content, {
      projectRoot: '/tmp',
    });

    expect(result.imports.length).toBeGreaterThanOrEqual(3);
    expect(result.findings.some(f => f.kind === 'unknown_builtin')).toBe(true);
    expect(result.checkResult).toBeDefined();
  });
});
