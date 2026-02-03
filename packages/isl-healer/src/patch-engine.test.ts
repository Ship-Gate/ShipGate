/**
 * Patch Engine Tests
 *
 * Tests for idempotency, safety, and correctness of patch application.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PatchEngine,
  applyPatches,
  insertImport,
  addHelperFunction,
  wrapHandler,
  replaceCall,
  createFile,
  type Patch,
  type PatchEngineConfig,
} from './patch-engine';

// ============================================================================
// Test Fixtures
// ============================================================================

const SAMPLE_ROUTE_HANDLER = `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  // Process the request
  const result = processData(body);
  
  return NextResponse.json({ success: true, data: result });
}

function processData(data: unknown) {
  return data;
}
`;

const SAMPLE_HELPER_FILE = `// Helper utilities

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function validateInput(input: unknown): boolean {
  return input !== null && input !== undefined;
}
`;

// ============================================================================
// Idempotency Tests
// ============================================================================

describe('Patch Engine - Idempotency', () => {
  let codeMap: Map<string, string>;

  beforeEach(() => {
    codeMap = new Map([
      ['app/api/route.ts', SAMPLE_ROUTE_HANDLER],
      ['lib/helpers.ts', SAMPLE_HELPER_FILE],
    ]);
  });

  describe('InsertImport', () => {
    it('should skip duplicate import insertions', () => {
      const patch = insertImport(
        'app/api/route.ts',
        '{ rateLimit }',
        '@/lib/rate-limit'
      );

      // Apply twice
      const engine = new PatchEngine(codeMap);
      const result1 = engine.applyPatch(patch);
      const result2 = engine.applyPatch(patch);

      expect(result1.success).toBe(true);
      expect(result1.skipped).toBe(false);

      expect(result2.success).toBe(true);
      expect(result2.skipped).toBe(true);

      // Verify only one import added
      const code = engine.getCodeMap().get('app/api/route.ts')!;
      const importMatches = code.match(/@\/lib\/rate-limit/g);
      expect(importMatches?.length).toBe(1);
    });

    it('should detect existing import and skip', () => {
      // Add the import first
      const codeWithImport = `import { rateLimit } from '@/lib/rate-limit';
${SAMPLE_ROUTE_HANDLER}`;
      codeMap.set('app/api/route.ts', codeWithImport);

      const patch = insertImport(
        'app/api/route.ts',
        '{ rateLimit }',
        '@/lib/rate-limit'
      );

      const engine = new PatchEngine(codeMap);
      const result = engine.applyPatch(patch);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });

  describe('AddHelperFunction', () => {
    it('should skip duplicate function additions', () => {
      const patch = addHelperFunction(
        'lib/helpers.ts',
        'checkRateLimit',
        `function checkRateLimit(ip: string): boolean {
  return true;
}`,
        { position: 'top' }
      );

      const engine = new PatchEngine(codeMap);
      const result1 = engine.applyPatch(patch);
      const result2 = engine.applyPatch(patch);

      expect(result1.success).toBe(true);
      expect(result1.skipped).toBe(false);

      expect(result2.success).toBe(true);
      expect(result2.skipped).toBe(true);

      // Verify only one function added
      const code = engine.getCodeMap().get('lib/helpers.ts')!;
      const funcMatches = code.match(/function checkRateLimit/g);
      expect(funcMatches?.length).toBe(1);
    });

    it('should detect existing function and skip', () => {
      // Add function that already exists
      const codeWithFunc = `// Helper utilities

function checkRateLimit() { return true; }

export function formatDate(date: Date): string {
  return date.toISOString();
}
`;
      codeMap.set('lib/helpers.ts', codeWithFunc);

      const patch = addHelperFunction(
        'lib/helpers.ts',
        'checkRateLimit',
        `function checkRateLimit(): boolean { return false; }`
      );

      const engine = new PatchEngine(codeMap);
      const result = engine.applyPatch(patch);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });

  describe('WrapHandler', () => {
    it('should skip duplicate handler wraps using idempotency marker', () => {
      const patch = wrapHandler(
        'app/api/route.ts',
        { startLine: 4, startColumn: 1, endLine: 10, endColumn: 1 },
        '/* wrapped:4-10 */\ntry {',
        '} catch (e) { return NextResponse.json({ error: "failed" }, { status: 500 }); }',
        { idempotencyMarker: '/* wrapped:4-10 */' }
      );

      const engine = new PatchEngine(codeMap);
      const result1 = engine.applyPatch(patch);
      const result2 = engine.applyPatch(patch);

      expect(result1.success).toBe(true);
      expect(result1.skipped).toBe(false);

      expect(result2.success).toBe(true);
      expect(result2.skipped).toBe(true);
    });
  });

  describe('ReplaceCall', () => {
    it('should skip if replacement already present and original gone', () => {
      const patch = replaceCall(
        'app/api/route.ts',
        'processData(body)',
        'await validateAndProcessData(body)'
      );

      const engine = new PatchEngine(codeMap);
      const result1 = engine.applyPatch(patch);
      const result2 = engine.applyPatch(patch);

      expect(result1.success).toBe(true);
      expect(result1.skipped).toBe(false);

      expect(result2.success).toBe(true);
      expect(result2.skipped).toBe(true);

      // Verify replacement done once
      const code = engine.getCodeMap().get('app/api/route.ts')!;
      expect(code).not.toContain('processData(body)');
      expect(code).toContain('await validateAndProcessData(body)');
    });
  });

  describe('CreateFile', () => {
    it('should skip if file with identical content exists', () => {
      const testContent = `import { describe, it, expect } from 'vitest';

describe('test', () => {
  it('works', () => {
    expect(true).toBe(true);
  });
});
`;

      const patch = createFile('tests/api.test.ts', testContent, {
        category: 'test',
      });

      const engine = new PatchEngine(codeMap);
      const result1 = engine.applyPatch(patch);
      const result2 = engine.applyPatch(patch);

      expect(result1.success).toBe(true);
      expect(result1.skipped).toBe(false);

      expect(result2.success).toBe(true);
      expect(result2.skipped).toBe(true);
    });

    it('should fail if file exists with different content', () => {
      const engine = new PatchEngine(codeMap);

      const patch1 = createFile('tests/api.test.ts', 'content v1', {
        category: 'test',
      });
      const patch2 = createFile('tests/api.test.ts', 'content v2', {
        category: 'test',
      });

      const result1 = engine.applyPatch(patch1);
      const result2 = engine.applyPatch(patch2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('different content');
    });
  });

  describe('Multiple patches applied twice', () => {
    it('should produce identical results when applied twice', () => {
      const patches: Patch[] = [
        insertImport('app/api/route.ts', '{ rateLimit }', '@/lib/rate-limit'),
        addHelperFunction(
          'app/api/route.ts',
          'checkAuth',
          `async function checkAuth(req: Request) {
  const token = req.headers.get('authorization');
  return !!token;
}`
        ),
        replaceCall(
          'app/api/route.ts',
          'const body = await request.json();',
          `const body = await request.json();
  if (!await checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }`
        ),
      ];

      // First application
      const result1 = applyPatches(new Map(codeMap), patches);

      // Second application on result
      const result2 = applyPatches(result1.results[0]!.patch.file ? 
        new Map([['app/api/route.ts', result1.results.map(r => r.patch).find(p => p.file === 'app/api/route.ts') ? 
          new PatchEngine(codeMap).applyPatches(patches).results[0]?.patch.file === 'app/api/route.ts' ?
            new PatchEngine(codeMap).applyPatches(patches).unifiedDiff : '' : '']] as [string, string][]) :
        new Map(), patches);

      // Apply patches to codeMap, then apply again
      const engine1 = new PatchEngine(new Map(codeMap));
      const firstPass = engine1.applyPatches(patches);

      const engine2 = new PatchEngine(engine1.getCodeMap());
      const secondPass = engine2.applyPatches(patches);

      // All patches should be skipped on second pass
      expect(secondPass.skippedCount).toBe(patches.length);
      expect(secondPass.failedCount).toBe(0);

      // Code should be identical
      const code1 = engine1.getCodeMap().get('app/api/route.ts');
      const code2 = engine2.getCodeMap().get('app/api/route.ts');
      expect(code1).toBe(code2);
    });
  });
});

// ============================================================================
// Safety Tests
// ============================================================================

describe('Patch Engine - Safety', () => {
  let codeMap: Map<string, string>;

  beforeEach(() => {
    codeMap = new Map([
      ['app/api/route.ts', SAMPLE_ROUTE_HANDLER],
      ['lib/helpers.ts', SAMPLE_HELPER_FILE],
    ]);
  });

  describe('File access restrictions', () => {
    it('should reject patches to files not in allowed list', () => {
      const config: Partial<PatchEngineConfig> = {
        allowedFiles: {
          explicit: new Set(['app/api/route.ts']),
          patterns: [],
        },
      };

      const engine = new PatchEngine(codeMap, config);

      const allowedPatch = insertImport(
        'app/api/route.ts',
        '{ z }',
        'zod'
      );
      const disallowedPatch = insertImport(
        'lib/helpers.ts',
        '{ z }',
        'zod'
      );

      const result1 = engine.applyPatch(allowedPatch);
      const result2 = engine.applyPatch(disallowedPatch);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('not in allowed list');
    });

    it('should reject patches to non-existent files', () => {
      const engine = new PatchEngine(codeMap);

      const patch = insertImport(
        'does/not/exist.ts',
        '{ foo }',
        'bar'
      );

      const result = engine.applyPatch(patch);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('CreateFile restrictions', () => {
    it('should reject creating files with disallowed category', () => {
      const config: Partial<PatchEngineConfig> = {
        allowedCategories: new Set(['test']),
      };

      const engine = new PatchEngine(codeMap, config);

      const testFilePatch = createFile('tests/new.test.ts', 'test content', {
        category: 'test',
      });
      const configFilePatch = createFile('config/new.json', '{}', {
        category: 'config',
      });

      const result1 = engine.applyPatch(testFilePatch);
      const result2 = engine.applyPatch(configFilePatch);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('not allowed');
    });

    it('should respect allowNewTestFiles config', () => {
      const config: Partial<PatchEngineConfig> = {
        allowNewTestFiles: false,
        allowedCategories: new Set(['test']),
      };

      const engine = new PatchEngine(codeMap, config);

      const patch = createFile('tests/new.test.ts', 'test content', {
        category: 'test',
      });

      const result = engine.applyPatch(patch);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should respect allowNewHelperFiles config', () => {
      const config: Partial<PatchEngineConfig> = {
        allowNewHelperFiles: false,
        allowedCategories: new Set(['helper']),
      };

      const engine = new PatchEngine(codeMap, config);

      const patch = createFile('lib/new-helper.ts', 'helper content', {
        category: 'helper',
      });

      const result = engine.applyPatch(patch);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });
  });
});

// ============================================================================
// Unified Diff Tests
// ============================================================================

describe('Patch Engine - Unified Diff', () => {
  let codeMap: Map<string, string>;

  beforeEach(() => {
    codeMap = new Map([
      ['app/api/route.ts', SAMPLE_ROUTE_HANDLER],
    ]);
  });

  it('should generate unified diff for applied patches', () => {
    const patches: Patch[] = [
      insertImport('app/api/route.ts', '{ rateLimit }', '@/lib/rate-limit'),
    ];

    const result = applyPatches(codeMap, patches);

    expect(result.unifiedDiff).toContain('---');
    expect(result.unifiedDiff).toContain('+++');
    expect(result.unifiedDiff).toContain('@@ ');
    expect(result.unifiedDiff).toContain("import { rateLimit } from '@/lib/rate-limit';");
  });

  it('should generate diff for new files', () => {
    const patches: Patch[] = [
      createFile(
        'tests/api.test.ts',
        `import { describe, it } from 'vitest';

describe('api', () => {});
`,
        { category: 'test' }
      ),
    ];

    const result = applyPatches(codeMap, patches);

    expect(result.unifiedDiff).toContain('tests/api.test.ts');
    expect(result.createdFiles).toContain('tests/api.test.ts');
  });

  it('should report line changes accurately', () => {
    const patches: Patch[] = [
      insertImport('app/api/route.ts', '{ rateLimit }', '@/lib/rate-limit'),
      insertImport('app/api/route.ts', '{ z }', 'zod'),
    ];

    const result = applyPatches(codeMap, patches);

    expect(result.linesAdded).toBeGreaterThan(0);
    expect(result.linesRemoved).toBe(0);
  });
});

// ============================================================================
// Patch Type Specific Tests
// ============================================================================

describe('Patch Types', () => {
  let codeMap: Map<string, string>;

  beforeEach(() => {
    codeMap = new Map([
      ['app/api/route.ts', SAMPLE_ROUTE_HANDLER],
      ['lib/helpers.ts', SAMPLE_HELPER_FILE],
    ]);
  });

  describe('InsertImport', () => {
    it('should handle different import types', () => {
      const engine = new PatchEngine(codeMap);

      // Named import
      engine.applyPatch(
        insertImport('app/api/route.ts', '{ z }', 'zod', { importType: 'named' })
      );

      // Default import
      engine.applyPatch(
        insertImport('app/api/route.ts', 'React', 'react', { importType: 'default' })
      );

      // Type import
      engine.applyPatch(
        insertImport('app/api/route.ts', '{ RequestHandler }', 'express', {
          importType: 'type',
        })
      );

      const code = engine.getCodeMap().get('app/api/route.ts')!;

      expect(code).toContain("import { z } from 'zod';");
      expect(code).toContain("import React from 'react';");
      expect(code).toContain("import type { RequestHandler } from 'express';");
    });

    it('should insert imports after existing imports', () => {
      const engine = new PatchEngine(codeMap);

      engine.applyPatch(
        insertImport('app/api/route.ts', '{ z }', 'zod')
      );

      const code = engine.getCodeMap().get('app/api/route.ts')!;
      const lines = code.split('\n');

      // Find NextResponse import line
      const nextResponseLine = lines.findIndex((l) =>
        l.includes("import { NextResponse }")
      );
      // Find zod import line
      const zodLine = lines.findIndex((l) => l.includes("from 'zod'"));

      expect(zodLine).toBeGreaterThan(nextResponseLine);
    });
  });

  describe('AddHelperFunction', () => {
    it('should support different positions', () => {
      // Test 'top' position
      const engine1 = new PatchEngine(new Map(codeMap));
      engine1.applyPatch(
        addHelperFunction('lib/helpers.ts', 'helperA', 'function helperA() {}', {
          position: 'top',
        })
      );
      const code1 = engine1.getCodeMap().get('lib/helpers.ts')!;
      const helperALine = code1.split('\n').findIndex((l) => l.includes('helperA'));
      const formatDateLine = code1.split('\n').findIndex((l) => l.includes('formatDate'));
      expect(helperALine).toBeLessThan(formatDateLine);

      // Test 'bottom' position
      const engine2 = new PatchEngine(new Map(codeMap));
      engine2.applyPatch(
        addHelperFunction('lib/helpers.ts', 'helperB', 'function helperB() {}', {
          position: 'bottom',
        })
      );
      const code2 = engine2.getCodeMap().get('lib/helpers.ts')!;
      const helperBLine = code2.split('\n').findIndex((l) => l.includes('helperB'));
      const validateInputLine = code2
        .split('\n')
        .findIndex((l) => l.includes('validateInput'));
      expect(helperBLine).toBeGreaterThan(validateInputLine);
    });
  });

  describe('WrapHandler', () => {
    it('should wrap code at specified span', () => {
      const engine = new PatchEngine(codeMap);

      engine.applyPatch(
        wrapHandler(
          'app/api/route.ts',
          { startLine: 4, startColumn: 1, endLine: 4, endColumn: 50 },
          '// START WRAP\n',
          '\n// END WRAP',
          { idempotencyMarker: '// START WRAP' }
        )
      );

      const code = engine.getCodeMap().get('app/api/route.ts')!;
      expect(code).toContain('// START WRAP');
      expect(code).toContain('// END WRAP');
    });
  });

  describe('ReplaceCall', () => {
    it('should support regex replacement', () => {
      const engine = new PatchEngine(codeMap);

      engine.applyPatch(
        replaceCall(
          'app/api/route.ts',
          'process\\w+\\(body\\)',
          'safeProcess(body)',
          { regex: true }
        )
      );

      const code = engine.getCodeMap().get('app/api/route.ts')!;
      expect(code).toContain('safeProcess(body)');
      expect(code).not.toContain('processData(body)');
    });

    it('should support replaceAll option', () => {
      // Add duplicate occurrences
      const codeWithDupes = `const a = process(1);
const b = process(2);
const c = process(3);`;
      codeMap.set('test.ts', codeWithDupes);

      const engine = new PatchEngine(codeMap);

      engine.applyPatch(
        replaceCall('test.ts', 'process', 'safeProcess', { replaceAll: true })
      );

      const code = engine.getCodeMap().get('test.ts')!;
      expect(code).not.toContain('process(');
      expect((code.match(/safeProcess/g) ?? []).length).toBe(3);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty code map', () => {
    const engine = new PatchEngine(new Map());
    const result = engine.applyPatches([]);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(result.unifiedDiff).toBe('');
  });

  it('should handle patches with custom IDs', () => {
    const codeMap = new Map([['file.ts', 'const x = 1;']]);
    const engine = new PatchEngine(codeMap);

    const patch1: Patch = {
      type: 'ReplaceCall',
      file: 'file.ts',
      original: 'const x',
      replacement: 'const y',
      description: 'test',
      id: 'custom-id-1',
    };

    const patch2: Patch = {
      type: 'ReplaceCall',
      file: 'file.ts',
      original: 'const y',
      replacement: 'const z',
      description: 'test',
      id: 'custom-id-2',
    };

    const result1 = engine.applyPatch(patch1);
    const result2 = engine.applyPatch(patch2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    const code = engine.getCodeMap().get('file.ts');
    expect(code).toBe('const z = 1;');
  });

  it('should preserve original code map', () => {
    const originalCode = 'const x = 1;';
    const codeMap = new Map([['file.ts', originalCode]]);
    const engine = new PatchEngine(codeMap);

    engine.applyPatch(
      replaceCall('file.ts', 'const x', 'const y')
    );

    // Original map should be unchanged
    expect(codeMap.get('file.ts')).toBe(originalCode);
  });
});
