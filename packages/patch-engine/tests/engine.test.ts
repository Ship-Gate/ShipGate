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
} from '../src';
import type { PatchEngineOptions, Patch } from '../src';

// ============================================================================
// Test Fixtures
// ============================================================================

const sampleTypescriptFile = `import { useState } from 'react';
import { api } from './api';

export function MyComponent() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    api.increment(count);
    setCount(count + 1);
  };

  return (
    <button onClick={handleClick}>
      Count: {count}
    </button>
  );
}

export default MyComponent;
`;

const sampleApiHandler = `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, amount } = body;

  // Process payment
  const result = await processPayment(userId, amount);

  return NextResponse.json({ success: true, result });
}

async function processPayment(userId: string, amount: number) {
  // Payment logic here
  return { transactionId: '12345' };
}
`;

function createFileMap(files: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(files));
}

function defaultOptions(): PatchEngineOptions {
  return {
    projectRoot: '/test-project',
    allowedFiles: ['src/component.tsx', 'src/api/route.ts', 'src/utils.ts'],
    allowedNewFileCategories: ['test', 'helper'],
  };
}

// ============================================================================
// InsertImport Tests
// ============================================================================

describe('InsertImport', () => {
  it('should insert an import statement', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      insertImport('src/component.tsx', "import { useEffect } from 'react';"),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.appliedPatches).toHaveLength(1);
    expect(result.files.get('src/component.tsx')).toContain("import { useEffect } from 'react';");
    expect(result.diff).toContain('+import { useEffect }');
  });

  it('should be idempotent - skip if import already exists', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      insertImport('src/component.tsx', "import { useState } from 'react';"),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.skippedPatches).toHaveLength(1);
    expect(result.appliedPatches).toHaveLength(0);
    expect(result.diff).toBe('');
  });

  it('should be idempotent - running twice produces same result', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      insertImport('src/component.tsx', "import { useCallback } from 'react';"),
    ];

    // First application
    const result1 = applyPatches(patches, files, defaultOptions());
    expect(result1.success).toBe(true);
    expect(result1.appliedPatches).toHaveLength(1);

    // Second application with updated content
    const updatedFiles = createFileMap({
      'src/component.tsx': result1.files.get('src/component.tsx')!,
    });
    const result2 = applyPatches(patches, updatedFiles, defaultOptions());

    expect(result2.success).toBe(true);
    expect(result2.skippedPatches).toHaveLength(1);
    expect(result2.appliedPatches).toHaveLength(0);
    expect(result2.diff).toBe('');

    // Content should be identical
    expect(result1.files.get('src/component.tsx')).toBe(
      result2.files.get('src/component.tsx')
    );
  });
});

// ============================================================================
// AddHelperFunction Tests
// ============================================================================

describe('AddHelperFunction', () => {
  it('should add a helper function at top position', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      addHelperFunction(
        'src/component.tsx',
        'formatCount',
        `function formatCount(n: number): string {
  return n.toLocaleString();
}`,
        { position: 'top' }
      ),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.appliedPatches).toHaveLength(1);
    expect(result.files.get('src/component.tsx')).toContain('function formatCount');
  });

  it('should be idempotent - skip if function already exists', () => {
    const fileWithHelper = sampleTypescriptFile.replace(
      "export function MyComponent()",
      `function formatCount(n: number): string {
  return n.toLocaleString();
}

export function MyComponent()`
    );

    const files = createFileMap({
      'src/component.tsx': fileWithHelper,
    });

    const patches: Patch[] = [
      addHelperFunction(
        'src/component.tsx',
        'formatCount',
        `function formatCount(n: number): string {
  return n.toLocaleString();
}`
      ),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.skippedPatches).toHaveLength(1);
    expect(result.appliedPatches).toHaveLength(0);
  });

  it('should be idempotent - running twice produces same result', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      addHelperFunction(
        'src/component.tsx',
        'debounce',
        `function debounce(fn: Function, ms: number) {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}`
      ),
    ];

    // First application
    const result1 = applyPatches(patches, files, defaultOptions());
    expect(result1.appliedPatches).toHaveLength(1);

    // Second application
    const updatedFiles = createFileMap({
      'src/component.tsx': result1.files.get('src/component.tsx')!,
    });
    const result2 = applyPatches(patches, updatedFiles, defaultOptions());

    expect(result2.skippedPatches).toHaveLength(1);
    expect(result2.appliedPatches).toHaveLength(0);
    expect(result1.files.get('src/component.tsx')).toBe(
      result2.files.get('src/component.tsx')
    );
  });
});

// ============================================================================
// WrapHandler Tests
// ============================================================================

describe('WrapHandler', () => {
  it('should wrap a handler with prefix code', () => {
    const files = createFileMap({
      'src/api/route.ts': sampleApiHandler,
    });

    const patches: Patch[] = [
      wrapHandler(
        'src/api/route.ts',
        'POST',
        `// @isl-wrapped: rate-limit
  const rateLimit = await checkRateLimit(request);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }`,
        { wrapMarker: '@isl-wrapped: rate-limit' }
      ),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.appliedPatches).toHaveLength(1);
    expect(result.files.get('src/api/route.ts')).toContain('checkRateLimit');
    expect(result.files.get('src/api/route.ts')).toContain('@isl-wrapped: rate-limit');
  });

  it('should be idempotent - skip if wrap marker already exists', () => {
    const wrappedHandler = sampleApiHandler.replace(
      'const body = await request.json();',
      `// @isl-wrapped: rate-limit
  const rateLimit = await checkRateLimit(request);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }
  const body = await request.json();`
    );

    const files = createFileMap({
      'src/api/route.ts': wrappedHandler,
    });

    const patches: Patch[] = [
      wrapHandler(
        'src/api/route.ts',
        'POST',
        `// @isl-wrapped: rate-limit
  const rateLimit = await checkRateLimit(request);`,
        { wrapMarker: '@isl-wrapped: rate-limit' }
      ),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.skippedPatches).toHaveLength(1);
    expect(result.appliedPatches).toHaveLength(0);
  });

  it('should be idempotent - running twice produces same result', () => {
    const files = createFileMap({
      'src/api/route.ts': sampleApiHandler,
    });

    const patches: Patch[] = [
      wrapHandler(
        'src/api/route.ts',
        'POST',
        `// @isl-wrapped: audit
  await auditLog('payment_attempt', { userId });`,
        { wrapMarker: '@isl-wrapped: audit' }
      ),
    ];

    // First application
    const result1 = applyPatches(patches, files, defaultOptions());
    expect(result1.appliedPatches).toHaveLength(1);

    // Second application
    const updatedFiles = createFileMap({
      'src/api/route.ts': result1.files.get('src/api/route.ts')!,
    });
    const result2 = applyPatches(patches, updatedFiles, defaultOptions());

    expect(result2.skippedPatches).toHaveLength(1);
    expect(result2.appliedPatches).toHaveLength(0);
    expect(result1.files.get('src/api/route.ts')).toBe(
      result2.files.get('src/api/route.ts')
    );
  });
});

// ============================================================================
// ReplaceCall Tests
// ============================================================================

describe('ReplaceCall', () => {
  it('should replace a function call', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      replaceCall(
        'src/component.tsx',
        'api.increment(count)',
        'api.safeIncrement(count, userId)',
        { description: 'Use safe increment with user context' }
      ),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.appliedPatches).toHaveLength(1);
    expect(result.files.get('src/component.tsx')).toContain('api.safeIncrement(count, userId)');
    expect(result.files.get('src/component.tsx')).not.toContain('api.increment(count)');
  });

  it('should be idempotent - skip if replacement already exists', () => {
    const replacedFile = sampleTypescriptFile.replace(
      'api.increment(count)',
      'api.safeIncrement(count, userId)'
    );

    const files = createFileMap({
      'src/component.tsx': replacedFile,
    });

    const patches: Patch[] = [
      replaceCall(
        'src/component.tsx',
        'api.increment(count)',
        'api.safeIncrement(count, userId)'
      ),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.skippedPatches).toHaveLength(1);
    expect(result.appliedPatches).toHaveLength(0);
  });

  it('should be idempotent - running twice produces same result', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      replaceCall(
        'src/component.tsx',
        'setCount(count + 1)',
        'setCount(prev => prev + 1)'
      ),
    ];

    // First application
    const result1 = applyPatches(patches, files, defaultOptions());
    expect(result1.appliedPatches).toHaveLength(1);

    // Second application
    const updatedFiles = createFileMap({
      'src/component.tsx': result1.files.get('src/component.tsx')!,
    });
    const result2 = applyPatches(patches, updatedFiles, defaultOptions());

    expect(result2.skippedPatches).toHaveLength(1);
    expect(result2.appliedPatches).toHaveLength(0);
    expect(result1.files.get('src/component.tsx')).toBe(
      result2.files.get('src/component.tsx')
    );
  });
});

// ============================================================================
// CreateFile Tests
// ============================================================================

describe('CreateFile', () => {
  it('should create a test file', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const testContent = `import { describe, it, expect } from 'vitest';
import { MyComponent } from '../src/component';

describe('MyComponent', () => {
  it('should render', () => {
    expect(true).toBe(true);
  });
});
`;

    const patches: Patch[] = [
      createFile('tests/component.test.ts', testContent, 'test'),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.appliedPatches).toHaveLength(1);
    expect(result.files.get('tests/component.test.ts')).toBe(testContent);
  });

  it('should be idempotent - skip if file exists with same content', () => {
    const testContent = `import { describe, it, expect } from 'vitest';`;

    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
      'tests/component.test.ts': testContent,
    });

    const patches: Patch[] = [
      createFile('tests/component.test.ts', testContent, 'test'),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.skippedPatches).toHaveLength(1);
    expect(result.appliedPatches).toHaveLength(0);
  });

  it('should reject non-allowed file categories', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      createFile('src/newFile.ts', 'export const x = 1;', 'config'),
    ];

    const options: PatchEngineOptions = {
      ...defaultOptions(),
      allowedNewFileCategories: ['test'], // Only test files allowed
    };

    const result = applyPatches(patches, files, options);

    expect(result.success).toBe(false);
    expect(result.failedPatches).toHaveLength(1);
    expect(result.failedPatches[0]!.reason).toContain('Cannot create file');
  });
});

// ============================================================================
// Combined Patch Tests
// ============================================================================

describe('Combined Patches', () => {
  it('should apply multiple patches to the same file', () => {
    const files = createFileMap({
      'src/api/route.ts': sampleApiHandler,
    });

    const patches: Patch[] = [
      insertImport('src/api/route.ts', "import { checkRateLimit } from '@/lib/rate-limit';"),
      insertImport('src/api/route.ts', "import { auditLog } from '@/lib/audit';"),
      wrapHandler(
        'src/api/route.ts',
        'POST',
        `// @isl-wrapped: security
  await checkRateLimit(request);
  await auditLog('payment_request', { ip: request.headers.get('x-forwarded-for') });`,
        { wrapMarker: '@isl-wrapped: security' }
      ),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.appliedPatches).toHaveLength(3);

    const content = result.files.get('src/api/route.ts')!;
    expect(content).toContain("import { checkRateLimit }");
    expect(content).toContain("import { auditLog }");
    expect(content).toContain('@isl-wrapped: security');
  });

  it('should be fully idempotent with multiple patches', () => {
    const files = createFileMap({
      'src/api/route.ts': sampleApiHandler,
    });

    const patches: Patch[] = [
      insertImport('src/api/route.ts', "import { z } from 'zod';"),
      addHelperFunction(
        'src/api/route.ts',
        'validateInput',
        `const PaymentSchema = z.object({
  userId: z.string(),
  amount: z.number().positive(),
});

function validateInput(data: unknown) {
  return PaymentSchema.parse(data);
}`,
        { position: 'top' }
      ),
      replaceCall(
        'src/api/route.ts',
        'const { userId, amount } = body;',
        'const { userId, amount } = validateInput(body);'
      ),
    ];

    // First application
    const result1 = applyPatches(patches, files, defaultOptions());
    expect(result1.success).toBe(true);
    expect(result1.appliedPatches).toHaveLength(3);

    // Second application
    const updatedFiles = createFileMap({
      'src/api/route.ts': result1.files.get('src/api/route.ts')!,
    });
    const result2 = applyPatches(patches, updatedFiles, defaultOptions());

    expect(result2.success).toBe(true);
    expect(result2.skippedPatches).toHaveLength(3);
    expect(result2.appliedPatches).toHaveLength(0);
    expect(result2.diff).toBe('');
  });
});

// ============================================================================
// Unified Diff Output Tests
// ============================================================================

describe('Unified Diff Output', () => {
  it('should produce valid unified diff format', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      insertImport('src/component.tsx', "import { useEffect } from 'react';"),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.diff).toContain('---');
    expect(result.diff).toContain('+++');
    expect(result.diff).toContain('@@');
    expect(result.diff).toContain('+import { useEffect }');
  });

  it('should produce per-file diffs', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
      'src/api/route.ts': sampleApiHandler,
    });

    const patches: Patch[] = [
      insertImport('src/component.tsx', "import { useMemo } from 'react';"),
      insertImport('src/api/route.ts', "import { z } from 'zod';"),
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.fileDiffs.size).toBe(2);
    expect(result.fileDiffs.has('src/component.tsx')).toBe(true);
    expect(result.fileDiffs.has('src/api/route.ts')).toBe(true);
  });

  it('should not produce diff when patches are skipped', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      insertImport('src/component.tsx', "import { useState } from 'react';"), // Already exists
    ];

    const result = applyPatches(patches, files, defaultOptions());

    expect(result.success).toBe(true);
    expect(result.skippedPatches).toHaveLength(1);
    expect(result.diff).toBe('');
  });
});

// ============================================================================
// Safety Tests
// ============================================================================

describe('Safety Constraints', () => {
  it('should reject patches to non-allowed files', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
      'src/secret.ts': 'const secret = "abc123";',
    });

    const patches: Patch[] = [
      insertImport('src/secret.ts', "import { expose } from 'bad';"),
    ];

    const options: PatchEngineOptions = {
      ...defaultOptions(),
      allowedFiles: ['src/component.tsx'], // secret.ts not allowed
    };

    const result = applyPatches(patches, files, options);

    expect(result.success).toBe(false);
    expect(result.failedPatches).toHaveLength(1);
    expect(result.failedPatches[0]!.reason).toContain('not in the allowed files');
  });

  it('should allow all files when no restrictions set', () => {
    const files = createFileMap({
      'src/any-file.ts': 'const x = 1;',
    });

    const patches: Patch[] = [
      insertImport('src/any-file.ts', "import { y } from './y';"),
    ];

    const options: PatchEngineOptions = {
      projectRoot: '/test',
      allowedFiles: [], // No restrictions
      allowedFilePatterns: [],
    };

    const result = applyPatches(patches, files, options);

    expect(result.success).toBe(true);
    expect(result.appliedPatches).toHaveLength(1);
  });
});

// ============================================================================
// Preflight Tests
// ============================================================================

describe('Preflight Checks', () => {
  it('should identify files to be modified', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      insertImport('src/component.tsx', "import { useCallback } from 'react';"),
    ];

    const engine = new PatchEngine(defaultOptions());
    const preflight = engine.preflight(patches, files);

    expect(preflight.ok).toBe(true);
    expect(preflight.filesToModify).toContain('src/component.tsx');
    expect(preflight.willSkip).toHaveLength(0);
  });

  it('should identify patches that will be skipped', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      insertImport('src/component.tsx', "import { useState } from 'react';"), // Already exists
    ];

    const engine = new PatchEngine(defaultOptions());
    const preflight = engine.preflight(patches, files);

    expect(preflight.ok).toBe(true);
    expect(preflight.willSkip).toHaveLength(1);
  });

  it('should report errors for invalid patches', () => {
    const files = createFileMap({
      'src/component.tsx': sampleTypescriptFile,
    });

    const patches: Patch[] = [
      insertImport('src/nonexistent.ts', "import { x } from 'x';"),
    ];

    const engine = new PatchEngine(defaultOptions());
    const preflight = engine.preflight(patches, files);

    expect(preflight.ok).toBe(false);
    expect(preflight.errors).toHaveLength(1);
  });
});
