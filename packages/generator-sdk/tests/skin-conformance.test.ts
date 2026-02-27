/**
 * Skin Conformance Tests
 *
 * Verifies that sdk-typescript, sdk-web, and sdk-react-native
 * actually re-export from the shared runtime engine — not duplicates.
 * Reads source files and asserts they contain the expected import paths.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readSrc(pkg: string, file: string): string {
  const p = join(ROOT, 'packages', pkg, 'src', file);
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf-8');
}

// ============================================================================
// sdk-typescript
// ============================================================================

describe('sdk-typescript skin', () => {
  it('errors.ts re-exports from @isl-lang/generator-sdk/runtime', () => {
    const src = readSrc('sdk-typescript', 'errors.ts');
    expect(src).toContain("from '@isl-lang/generator-sdk/runtime'");
    // Must NOT define its own ISLError class
    expect(src).not.toMatch(/class ISLError/);
  });

  it('config.ts imports shared types from @isl-lang/generator-sdk/runtime', () => {
    const src = readSrc('sdk-typescript', 'config.ts');
    expect(src).toContain("from '@isl-lang/generator-sdk/runtime'");
  });

  it('client.ts extends BaseClient from @isl-lang/generator-sdk/runtime', () => {
    const src = readSrc('sdk-typescript', 'client.ts');
    expect(src).toContain("import { BaseClient }");
    expect(src).toContain("extends BaseClient");
  });

  it('package.json depends on @isl-lang/generator-sdk', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages', 'sdk-typescript', 'package.json'), 'utf-8'));
    expect(pkg.dependencies['@isl-lang/generator-sdk']).toBeDefined();
  });
});

// ============================================================================
// sdk-web
// ============================================================================

describe('sdk-web skin', () => {
  it('types.ts re-exports from @isl-lang/generator-sdk/runtime', () => {
    const src = readSrc('sdk-web', 'types.ts');
    expect(src).toContain("from '@isl-lang/generator-sdk/runtime'");
    // Must NOT define its own ApiError class
    expect(src).not.toMatch(/class ApiError/);
  });

  it('client.ts extends BaseClient from @isl-lang/generator-sdk/runtime', () => {
    const src = readSrc('sdk-web', 'client.ts');
    expect(src).toContain("import { BaseClient }");
    expect(src).toContain("extends BaseClient");
  });

  it('interceptors.ts delegates auth to shared engine', () => {
    const src = readSrc('sdk-web', 'interceptors.ts');
    expect(src).toContain("from '@isl-lang/generator-sdk/runtime'");
    // Should not have its own refresh coalescing logic
    expect(src).not.toMatch(/let isRefreshing/);
  });

  it('package.json depends on @isl-lang/generator-sdk', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages', 'sdk-web', 'package.json'), 'utf-8'));
    expect(pkg.dependencies['@isl-lang/generator-sdk']).toBeDefined();
  });
});

// ============================================================================
// sdk-react-native
// ============================================================================

describe('sdk-react-native skin', () => {
  it('types.ts re-exports from @isl-lang/generator-sdk/runtime', () => {
    const src = readSrc('sdk-react-native', 'types.ts');
    expect(src).toContain("from '@isl-lang/generator-sdk/runtime'");
    // Must NOT define its own ISLError type union locally
    expect(src).not.toMatch(/^export type ISLError =/m);
  });

  it('ISLClient.ts imports shared retry logic', () => {
    const src = readSrc('sdk-react-native', join('client', 'ISLClient.ts'));
    expect(src).toContain("from '@isl-lang/generator-sdk/runtime'");
    expect(src).toContain('sharedCalcDelay');
  });

  it('package.json depends on @isl-lang/generator-sdk', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages', 'sdk-react-native', 'package.json'), 'utf-8'));
    expect(pkg.dependencies['@isl-lang/generator-sdk']).toBeDefined();
  });
});
