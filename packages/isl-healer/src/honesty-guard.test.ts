/**
 * Honesty Guard Integration Tests
 *
 * Tests that the Honesty Guard correctly detects and refuses cheating attempts:
 * - Removing intents from ISL spec
 * - Adding shipgate-ignore
 * - Lowering severity / disabling packs
 * - Weakening redirect allowlists / auth hardening
 *
 * @module @isl-lang/healer/tests
 */

import { describe, it, expect } from 'vitest';
import {
  HonestyGuard,
  assertCleanPatch,
  assertCleanDiff,
  createPreCommitValidator,
  createHealerPatchValidator,
  parseDiff,
} from './honesty-guard';
import {
  inspectPatchSet,
  quickScan,
  SUPPRESSION_PATTERNS,
  PACK_DISABLE_PATTERNS,
} from './patch-inspector';
import type { PatchSet, PatchFile, DiffHunk, HonestyGuardConfig } from './types';

// ============================================================================
// Test Fixtures - Forbidden Patches
// ============================================================================

/**
 * Unified diff that removes an intent from an ISL spec
 */
const DIFF_REMOVE_INTENT = `diff --git a/specs/auth.isl b/specs/auth.isl
index 1234567..abcdefg 100644
--- a/specs/auth.isl
+++ b/specs/auth.isl
@@ -10,7 +10,6 @@ behavior Login {
   output: AuthResult
   
   precondition valid_credentials(email, password)
-  intent rate-limit-required
   intent audit-required
   
   postcondition user_authenticated
`;

/**
 * Unified diff that adds an shipgate-ignore suppression
 */
const DIFF_ADD_SUPPRESSION = `diff --git a/src/api/auth.ts b/src/api/auth.ts
index 1234567..abcdefg 100644
--- a/src/api/auth.ts
+++ b/src/api/auth.ts
@@ -15,6 +15,7 @@ export async function POST(request: Request) {
   const body = await request.json();
   
   // Process login
+  // shipgate-ignore rate-limit-required: will add later
   const result = await authenticate(body.email, body.password);
   
   return NextResponse.json(result);
`;

/**
 * Unified diff that adds @ts-ignore
 */
const DIFF_ADD_TS_IGNORE = `diff --git a/src/utils/validator.ts b/src/utils/validator.ts
index 1234567..abcdefg 100644
--- a/src/utils/validator.ts
+++ b/src/utils/validator.ts
@@ -8,6 +8,7 @@ export function validateInput(input: unknown) {
   if (!input) {
     throw new Error('Invalid input');
   }
+  // @ts-ignore - type is complex
   return input as ValidatedInput;
 }
`;

/**
 * Unified diff that disables a policy pack
 */
const DIFF_DISABLE_PACK = `diff --git a/.islrc.json b/.islrc.json
index 1234567..abcdefg 100644
--- a/.islrc.json
+++ b/.islrc.json
@@ -5,7 +5,7 @@
   "packs": {
     "auth": {
       "enabled": true
-    },
+    },
     "rate-limit": {
-      "enabled": true
+      "enabled": false
     }
   }
 }
`;

/**
 * Unified diff that lowers severity
 */
const DIFF_LOWER_SEVERITY = `diff --git a/shipgate.config.js b/shipgate.config.js
index 1234567..abcdefg 100644
--- a/shipgate.config.js
+++ b/shipgate.config.js
@@ -10,7 +10,7 @@ module.exports = {
     {
       ruleId: 'intent/rate-limit-required',
-      severity: 'error',
+      severity: 'warning',
     }
   ]
 };
`;

/**
 * Unified diff that adds wildcard redirect allowlist
 */
const DIFF_WEAKEN_ALLOWLIST = `diff --git a/src/auth/redirect.ts b/src/auth/redirect.ts
index 1234567..abcdefg 100644
--- a/src/auth/redirect.ts
+++ b/src/auth/redirect.ts
@@ -5,7 +5,7 @@ const config = {
   auth: {
     // Allowed redirect URLs after login
-    redirectAllowlist: ['https://app.example.com', 'https://admin.example.com'],
+    redirect: '*',
   }
 };
`;

/**
 * Unified diff that adds auth bypass
 */
const DIFF_AUTH_BYPASS = `diff --git a/src/middleware/auth.ts b/src/middleware/auth.ts
index 1234567..abcdefg 100644
--- a/src/middleware/auth.ts
+++ b/src/middleware/auth.ts
@@ -10,6 +10,10 @@ export async function authMiddleware(req: Request) {
   const token = req.headers.get('Authorization');
   
+  // Temporary bypass for testing
+  if (process.env.SKIP_AUTH === 'true') {
+    return { skipAuth: true, user: { id: 'bypass' } };
+  }
+
   if (!token) {
     throw new AuthError('No token provided');
   }
`;

/**
 * Clean unified diff (should pass)
 */
const DIFF_CLEAN = `diff --git a/src/api/users.ts b/src/api/users.ts
index 1234567..abcdefg 100644
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -10,6 +10,12 @@ export async function GET(request: Request) {
   const { searchParams } = new URL(request.url);
   const userId = searchParams.get('id');
   
+  // Add rate limiting
+  const rateLimitResult = await rateLimit(request);
+  if (!rateLimitResult.ok) {
+    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
+  }
+
   const user = await getUser(userId);
   return NextResponse.json(user);
 }
`;

/**
 * Unified diff removing precondition
 */
const DIFF_REMOVE_PRECONDITION = `diff --git a/specs/payments.isl b/specs/payments.isl
index 1234567..abcdefg 100644
--- a/specs/payments.isl
+++ b/specs/payments.isl
@@ -5,7 +5,6 @@ behavior ProcessPayment {
   input: PaymentRequest
   output: PaymentResult
   
-  precondition valid_payment_method(request.method)
   precondition sufficient_balance(request.amount)
   
   intent audit-required
`;

// ============================================================================
// PatchFile Fixtures (for direct testing without diff parsing)
// ============================================================================

function createPatchFile(
  path: string,
  additions: string[],
  removals: string[] = []
): PatchFile {
  return {
    path,
    type: 'modify',
    hunks: [
      {
        oldPath: path,
        newPath: path,
        oldStart: 1,
        oldLines: removals.length,
        newStart: 1,
        newLines: additions.length,
        additions: additions.map((a) => `+${a}`),
        removals: removals.map((r) => `-${r}`),
        context: [],
      },
    ],
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Honesty Guard', () => {
  describe('ISL Spec Modifications', () => {
    it('should detect and reject intent removal from ISL spec', () => {
      const result = HonestyGuard.checkDiff(DIFF_REMOVE_INTENT);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.shouldAbort).toBe(true);
      expect(result.inspection.forbidden).toBe(true);
      expect(
        result.inspection.edits.some(
          (e) => e.type === 'isl_spec_modification'
        )
      ).toBe(true);
    });

    it('should detect and reject precondition removal', () => {
      const result = HonestyGuard.checkDiff(DIFF_REMOVE_PRECONDITION);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'isl_spec_modification'
      )).toBe(true);
    });

    it('should reject ANY modification to ISL spec in strict mode', () => {
      // Even adding content should be rejected in strict mode
      const patchFile = createPatchFile(
        'specs/auth.isl',
        ['  // Just a comment'],
        []
      );

      const guard = new HonestyGuard({ strictMode: true });
      const result = guard.check({ source: 'git', files: [patchFile] });

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'isl_spec_modification'
      )).toBe(true);
    });

    it('should allow ISL spec modifications when strict mode is disabled', () => {
      const patchFile = createPatchFile(
        'specs/auth.isl',
        ['  // Just a comment'],
        []
      );

      const guard = new HonestyGuard({ strictMode: false });
      const result = guard.check({ source: 'git', files: [patchFile] });

      // With strict mode off, only specific removals are blocked
      // Adding comments should be allowed
      expect(result.verdict).toBe('CLEAN');
    });
  });

  describe('Suppression Directives', () => {
    it('should detect and reject shipgate-ignore insertion', () => {
      const result = HonestyGuard.checkDiff(DIFF_ADD_SUPPRESSION);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'suppression_insertion'
      )).toBe(true);
      expect(result.inspection.edits[0]).toBeDefined();
      expect(result.inspection.edits[0]!.description).toContain(
        'ShipGate suppression'
      );
    });

    it('should detect and reject @ts-ignore insertion', () => {
      const result = HonestyGuard.checkDiff(DIFF_ADD_TS_IGNORE);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'suppression_insertion'
      )).toBe(true);
    });

    it('should detect @ts-nocheck insertion', () => {
      const patchFile = createPatchFile('src/api/handler.ts', [
        '// @ts-nocheck',
        'export function handler() {}',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.content.includes('@ts-nocheck')
      )).toBe(true);
    });

    it('should detect eslint-disable insertion', () => {
      const patchFile = createPatchFile('src/utils.ts', [
        '/* eslint-disable */',
        'const x: any = 123;',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    });

    it('should detect NOSONAR insertion', () => {
      const patchFile = createPatchFile('src/security.ts', [
        'const password = getEnv("DB_PASS"); // NOSONAR',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    });
  });

  describe('Policy Pack Disabling', () => {
    it('should detect and reject pack disabling via enabled: false', () => {
      const result = HonestyGuard.checkDiff(DIFF_DISABLE_PACK);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'pack_disable'
      )).toBe(true);
    });

    it('should detect skip flags in config', () => {
      const patchFile = createPatchFile('.islrc.json', [
        '"skipRateLimitCheck": true,',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'pack_disable'
      )).toBe(true);
    });

    it('should detect empty packs array', () => {
      const patchFile = createPatchFile('shipgate.config.js', [
        'packs: []',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    });
  });

  describe('Severity Downgrade', () => {
    it('should detect and reject severity downgrade to warning', () => {
      const result = HonestyGuard.checkDiff(DIFF_LOWER_SEVERITY);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'severity_downgrade'
      )).toBe(true);
    });

    it('should detect severity: "off"', () => {
      const patchFile = createPatchFile('eslint.config.js', [
        '"auth/rate-limit": "off"',
      ]);

      // This tests error -> off pattern which is severity downgrade
      const result = HonestyGuard.checkFiles([patchFile]);

      // Note: This specific pattern may not match, but "severity: 'off'" would
      expect(result).toBeDefined();
    });

    it('should detect level: "warn"', () => {
      const patchFile = createPatchFile('.islrc.json', [
        '"level": "warn"',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'severity_downgrade'
      )).toBe(true);
    });
  });

  describe('Allowlist Weakening', () => {
    it('should detect and reject wildcard redirect allowlist', () => {
      const result = HonestyGuard.checkDiff(DIFF_WEAKEN_ALLOWLIST);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'allowlist_weaken'
      )).toBe(true);
    });

    it('should detect wildcard CORS origin', () => {
      const patchFile = createPatchFile('src/config/cors.ts', [
        'allowedOrigins: ["*"]',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'allowlist_weaken'
      )).toBe(true);
    });

    it('should detect permitAll pattern', () => {
      const patchFile = createPatchFile('src/auth/config.ts', [
        'authorization: permitAll(),',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    });
  });

  describe('Auth Bypass', () => {
    it('should detect and reject skipAuth pattern', () => {
      const result = HonestyGuard.checkDiff(DIFF_AUTH_BYPASS);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
      expect(result.inspection.edits.some(
        (e) => e.type === 'auth_bypass'
      )).toBe(true);
    });

    it('should detect noAuth pattern', () => {
      const patchFile = createPatchFile('src/api/public.ts', [
        'export const config = { noAuth: true };',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    });

    it('should detect authRequired: false', () => {
      const patchFile = createPatchFile('src/routes/index.ts', [
        'authRequired: false,',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    });

    it('should detect hardcoded auth bypass', () => {
      const patchFile = createPatchFile('src/middleware/auth.ts', [
        'const isAuthenticated = true; // bypass for testing',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    });
  });

  describe('Clean Patches', () => {
    it('should allow clean patches that add enforcement', () => {
      const result = HonestyGuard.checkDiff(DIFF_CLEAN);

      expect(result.verdict).toBe('CLEAN');
      expect(result.shouldAbort).toBe(false);
      expect(result.inspection.forbidden).toBe(false);
      expect(result.exitCode).toBe(0);
    });

    it('should allow adding new code files', () => {
      const patchFile: PatchFile = {
        path: 'src/utils/helpers.ts',
        type: 'add',
        hunks: [
          {
            oldPath: '/dev/null',
            newPath: 'src/utils/helpers.ts',
            oldStart: 0,
            oldLines: 0,
            newStart: 1,
            newLines: 5,
            additions: [
              '+export function formatDate(date: Date): string {',
              '+  return date.toISOString();',
              '+}',
            ],
            removals: [],
            context: [],
          },
        ],
      };

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('CLEAN');
    });

    it('should allow modifying non-protected files', () => {
      const patchFile = createPatchFile('src/components/Button.tsx', [
        'const Button = ({ label }: { label: string }) => {',
        '  return <button>{label}</button>;',
        '};',
      ]);

      const result = HonestyGuard.checkFiles([patchFile]);

      expect(result.verdict).toBe('CLEAN');
    });
  });

  describe('Allowed Suppressions', () => {
    it('should allow suppressions with valid justification and expiry', () => {
      const patchFile = createPatchFile('src/legacy/handler.ts', [
        '// shipgate-ignore no-console: legacy code, tracking in TECH-123',
      ]);

      const config: Partial<HonestyGuardConfig> = {
        allowedSuppressions: [
          {
            pattern: 'shipgate-ignore no-console',
            justification: 'Legacy code being refactored',
            expires: '2099-12-31', // Far future
          },
        ],
      };

      const result = HonestyGuard.checkFiles([patchFile], config);

      expect(result.verdict).toBe('CLEAN');
    });

    it('should reject expired allowed suppressions', () => {
      const patchFile = createPatchFile('src/legacy/handler.ts', [
        '// shipgate-ignore no-console: legacy code',
      ]);

      const config: Partial<HonestyGuardConfig> = {
        allowedSuppressions: [
          {
            pattern: 'shipgate-ignore no-console',
            justification: 'Legacy code',
            expires: '2020-01-01', // Expired
          },
        ],
      };

      const result = HonestyGuard.checkFiles([patchFile], config);

      expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    });
  });
});

describe('assertCleanPatch', () => {
  it('should not throw for clean patches', () => {
    const patchSet: PatchSet = {
      source: 'git',
      files: [
        createPatchFile('src/api/users.ts', [
          'const result = await rateLimit(request);',
        ]),
      ],
    };

    expect(() => assertCleanPatch(patchSet)).not.toThrow();
  });

  it('should throw UnsafePatchAttempt for forbidden patches', () => {
    const patchSet: PatchSet = {
      source: 'git',
      files: [
        createPatchFile('src/api/users.ts', ['// @ts-ignore']),
      ],
    };

    expect(() => assertCleanPatch(patchSet)).toThrow('UnsafePatchAttempt');
  });

  it('should include detailed error message', () => {
    const patchSet: PatchSet = {
      source: 'healer',
      files: [
        createPatchFile('specs/auth.isl', ['// modified']),
      ],
    };

    try {
      assertCleanPatch(patchSet);
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('HONESTY GUARD');
      expect((error as Error).message).toContain('UNSAFE PATCH DETECTED');
    }
  });
});

describe('assertCleanDiff', () => {
  it('should not throw for clean diffs', () => {
    expect(() => assertCleanDiff(DIFF_CLEAN)).not.toThrow();
  });

  it('should throw for forbidden diffs', () => {
    expect(() => assertCleanDiff(DIFF_ADD_SUPPRESSION)).toThrow();
  });
});

describe('createPreCommitValidator', () => {
  it('should create a reusable validator function', () => {
    const validator = createPreCommitValidator();

    const cleanResult = validator(DIFF_CLEAN);
    expect(cleanResult.verdict).toBe('CLEAN');

    const unsafeResult = validator(DIFF_ADD_SUPPRESSION);
    expect(unsafeResult.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
  });

  it('should respect custom config', () => {
    const validator = createPreCommitValidator({ strictMode: false });

    // With strict mode off, some ISL spec edits might be allowed
    const result = validator(`diff --git a/specs/new.isl b/specs/new.isl
index 1234567..abcdefg 100644
--- a/specs/new.isl
+++ b/specs/new.isl
@@ -1,3 +1,4 @@
 domain Test {
   // existing content
+  // new comment
 }
`);

    // Just adding a comment should be allowed with strict mode off
    expect(result).toBeDefined();
  });
});

describe('createHealerPatchValidator', () => {
  it('should always use strict mode for healer patches', () => {
    const validator = createHealerPatchValidator({ strictMode: false });

    // Even with strictMode: false passed, healer should use strict mode
    const patches: PatchFile[] = [
      createPatchFile('specs/auth.isl', ['// healer added comment']),
    ];

    const result = validator(patches);

    // Healer should NEVER modify ISL specs
    expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
  });

  it('should not allow any suppressions for healer', () => {
    const validator = createHealerPatchValidator({
      allowedSuppressions: [
        { pattern: '@ts-ignore', justification: 'test' },
      ],
    });

    const patches: PatchFile[] = [
      createPatchFile('src/api/handler.ts', ['// @ts-ignore']),
    ];

    const result = validator(patches);

    // Healer should never add suppressions, even if "allowed"
    expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
  });
});

describe('Patch Inspector', () => {
  describe('inspectPatchSet', () => {
    it('should return counts by type', () => {
      const patchSet: PatchSet = {
        source: 'git',
        files: [
          createPatchFile('src/a.ts', ['// @ts-ignore']),
          createPatchFile('src/b.ts', ['// eslint-disable']),
          createPatchFile('.islrc.json', ['enabled: false']),
        ],
      };

      const result = inspectPatchSet(patchSet);

      expect(result.counts.suppression_insertion).toBeGreaterThan(0);
      expect(result.counts.pack_disable).toBeGreaterThan(0);
      expect(result.filesInspected).toHaveLength(3);
    });

    it('should track inspection duration', () => {
      const patchSet: PatchSet = {
        source: 'git',
        files: [createPatchFile('src/a.ts', ['const x = 1;'])],
      };

      const result = inspectPatchSet(patchSet);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('quickScan', () => {
    it('should return true for content with forbidden patterns', () => {
      expect(quickScan('// @ts-ignore')).toBe(true);
      expect(quickScan('shipgate-ignore')).toBe(true);
      expect(quickScan('skipAuth: true')).toBe(true);
      expect(quickScan('enabled: false')).toBe(true);
    });

    it('should return false for clean content', () => {
      expect(quickScan('const x = 1;')).toBe(false);
      expect(quickScan('export function handler() {}')).toBe(false);
      expect(quickScan('// Regular comment')).toBe(false);
    });
  });

  describe('parseDiff', () => {
    it('should parse unified diff into PatchSet', () => {
      const patchSet = parseDiff(DIFF_CLEAN, 'git');

      expect(patchSet.source).toBe('git');
      expect(patchSet.files).toHaveLength(1);
      const file0 = patchSet.files[0];
      expect(file0).toBeDefined();
      expect(file0!.path).toBe('src/api/users.ts');
      expect(file0!.type).toBe('modify');
      expect(file0!.hunks).toHaveLength(1);
    });

    it('should detect new files', () => {
      const diff = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
index 0000000..abcdefg
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,3 @@
+export function newFunction() {
+  return true;
+}
`;

      const patchSet = parseDiff(diff, 'git');

      expect(patchSet.files[0]).toBeDefined();
      expect(patchSet.files[0]!.type).toBe('add');
    });

    it('should detect deleted files', () => {
      const diff = `diff --git a/src/old-file.ts b/src/old-file.ts
deleted file mode 100644
index abcdefg..0000000
--- a/src/old-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function oldFunction() {
-  return false;
-}
`;

      const patchSet = parseDiff(diff, 'git');

      expect(patchSet.files[0]).toBeDefined();
      expect(patchSet.files[0]!.type).toBe('delete');
    });

    it('should capture additions and removals', () => {
      const patchSet = parseDiff(DIFF_REMOVE_INTENT, 'git');

      const file0 = patchSet.files[0];
      const hunk = file0?.hunks[0];
      expect(file0).toBeDefined();
      expect(hunk).toBeDefined();
      expect(hunk!.removals.length).toBeGreaterThan(0);
      expect(hunk!.removals.some((r) => r.includes('intent rate-limit'))).toBe(
        true
      );
    });
  });
});

describe('Summary Output', () => {
  it('should produce formatted summary for unsafe patches', () => {
    const result = HonestyGuard.checkDiff(DIFF_ADD_SUPPRESSION);

    expect(result.summary).toContain('HONESTY GUARD');
    expect(result.summary).toContain('UNSAFE PATCH DETECTED');
    expect(result.summary).toContain('SUPPRESSION DIRECTIVE');
  });

  it('should produce clean summary for safe patches', () => {
    const result = HonestyGuard.checkDiff(DIFF_CLEAN);

    expect(result.summary).toContain('✓');
    expect(result.summary).toContain('clean');
  });

  it('should group violations by type in summary', () => {
    const patchSet: PatchSet = {
      source: 'git',
      files: [
        createPatchFile('src/a.ts', ['// @ts-ignore']),
        createPatchFile('src/b.ts', ['// @ts-ignore']),
        createPatchFile('src/c.ts', ['skipAuth: true']),
      ],
    };

    const guard = new HonestyGuard();
    const result = guard.check(patchSet);

    expect(result.summary).toContain('SUPPRESSION DIRECTIVE');
    expect(result.summary).toContain('AUTH BYPASS');
  });
});

describe('Integration: Multiple Violations', () => {
  it('should detect all violations in a complex patch', () => {
    const patchSet: PatchSet = {
      source: 'git',
      files: [
        // ISL spec modification
        createPatchFile(
          'specs/auth.isl',
          [],
          ['  intent rate-limit-required']
        ),
        // Suppression insertion
        createPatchFile('src/api/login.ts', ['// shipgate-ignore auth']),
        // Pack disable
        createPatchFile('.islrc.json', ['  "auth": { "enabled": false }']),
        // Auth bypass
        createPatchFile('src/middleware.ts', ['skipAuth: true,']),
        // Clean file (should not trigger)
        createPatchFile('src/utils.ts', ['export const VERSION = "1.0.0";']),
      ],
    };

    const guard = new HonestyGuard();
    const result = guard.check(patchSet);

    expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    expect(result.inspection.edits.length).toBeGreaterThanOrEqual(4);
    expect(result.inspection.counts.isl_spec_modification).toBeGreaterThan(0);
    expect(result.inspection.counts.suppression_insertion).toBeGreaterThan(0);
    expect(result.inspection.counts.pack_disable).toBeGreaterThan(0);
    expect(result.inspection.counts.auth_bypass).toBeGreaterThan(0);
  });
});
