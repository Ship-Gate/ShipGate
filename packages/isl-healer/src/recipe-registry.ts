/**
 * Fix Recipe Registry - Map rule IDs to fix recipes
 *
 * @module @isl-lang/healer
 */

import type {
  FixRecipe,
  FixRecipeRegistry,
  Violation,
  FixContext,
  PatchOperation,
} from './types';

// ============================================================================
// Built-in Fix Recipes
// ============================================================================

export const BUILTIN_RECIPES: FixRecipe[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Rate Limiting
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'intent/rate-limit-required',
    name: 'Add Rate Limiting',
    description: 'Adds rate limiting middleware to the handler',
    priority: 10,
    match: { textPattern: /export\s+(async\s+)?function/ },
    locate: { type: 'text_search', search: /export\s+(async\s+)?function\s+\w+/, position: 'after' },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';
      const fw = ctx.framework;

      // Add import if missing
      if (!code.includes('rateLimit')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: fw.getRateLimitImport() + '\n',
          description: 'Add rate limit import',
        });
      }

      // Add rate limit check
      if (!code.includes('@intent rate-limit-required')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: '\n' + fw.getRateLimitCheck() + '\n',
          description: 'Add rate limit check',
        });
      }

      return patches;
    },
    validations: [
      { type: 'contains', value: 'rateLimit', errorMessage: 'Rate limit import missing' },
      { type: 'contains', value: '@intent rate-limit-required', errorMessage: 'Rate limit check missing' },
    ],
    rerunChecks: ['gate'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Audit Logging
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'intent/audit-required',
    name: 'Add Audit Logging',
    description: 'Adds audit logging to success and error paths',
    priority: 10,
    match: { textPattern: /export\s+(async\s+)?function/ },
    locate: { type: 'text_search', search: /return\s+/, position: 'before' },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';
      const fw = ctx.framework;

      // Add import if missing
      if (!code.includes('audit')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: fw.getAuditImport() + '\n',
          description: 'Add audit import',
        });
      }

      // Add audit call before returns
      if (!code.includes('@intent audit-required')) {
        const action = ctx.ast.behaviors[0]?.name || 'action';
        patches.push({
          type: 'insert',
          file: violation.file,
          content: '\n' + fw.getAuditSuccessCall(action) + '\n',
          description: 'Add audit success call',
        });
      }

      return patches;
    },
    validations: [
      { type: 'contains', value: 'audit', errorMessage: 'Audit import missing' },
    ],
    rerunChecks: ['gate'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // No PII Logging
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'intent/no-pii-logging',
    name: 'Remove PII from Logs',
    description: 'Removes console.log statements that may leak PII',
    priority: 15,
    match: { textPattern: /console\.(log|info|debug|warn)/ },
    locate: { type: 'text_search', search: /console\.(log|info|debug)\([^)]*\);?\n?/ },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      // Remove console.log statements
      if (code.match(/console\.(log|info|debug)\([^)]*\)/)) {
        patches.push({
          type: 'replace',
          file: violation.file,
          content: '',
          description: 'Remove console.log statements',
        });
      }

      // Add intent anchor
      if (!code.includes('@intent no-pii-logging')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: '// @intent no-pii-logging - no sensitive data in logs\n',
          description: 'Add no-pii-logging intent anchor',
        });
      }

      return patches;
    },
    validations: [
      { type: 'not_contains', value: 'console.log', errorMessage: 'console.log still present' },
    ],
    rerunChecks: ['gate'],
  },

  // Alias for PII console rule
  {
    ruleId: 'pii/console-in-production',
    name: 'Remove Console in Production',
    description: 'Removes console.log statements from production code',
    priority: 15,
    match: { textPattern: /console\.(log|info|debug)/ },
    locate: { type: 'text_search', search: /console\.(log|info|debug)\([^)]*\);?\n?/ },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      // Delegate to the main recipe
      return BUILTIN_RECIPES.find(r => r.ruleId === 'intent/no-pii-logging')!
        .createPatches(violation, ctx);
    },
    validations: [
      { type: 'not_contains', value: 'console.log', errorMessage: 'console.log still present' },
    ],
    rerunChecks: ['gate'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Input Validation
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'intent/input-validation',
    name: 'Add Input Validation',
    description: 'Adds Zod schema validation for inputs',
    priority: 10,
    match: { textPattern: /request\.json\(\)/ },
    locate: { type: 'text_search', search: /const body = await request\.json\(\);/, position: 'after' },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';
      const fw = ctx.framework;

      // Add zod import if missing
      if (!code.includes("from 'zod'")) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: fw.getValidationImport() + '\n',
          description: 'Add Zod validation import',
        });
      }

      // Add validation check
      if (!code.includes('safeParse')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: '\n' + fw.getValidationCheck('InputSchema') + '\n',
          description: 'Add input validation',
        });
      }

      return patches;
    },
    validations: [
      { type: 'contains', value: 'safeParse', errorMessage: 'Validation check missing' },
    ],
    rerunChecks: ['gate', 'typecheck'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Idempotency
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'intent/idempotency-required',
    name: 'Add Idempotency Key Handling',
    description: 'Adds idempotency key check for safe retries',
    priority: 10,
    match: { textPattern: /export\s+(async\s+)?function\s+POST/ },
    locate: { type: 'text_search', search: /export async function/, position: 'after' },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      if (!code.includes('@intent idempotency-required')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: `
  // @intent idempotency-required
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    const cached = await getIdempotencyCache(idempotencyKey);
    if (cached) return cached;
  }
`,
          description: 'Add idempotency key check',
        });
      }

      return patches;
    },
    validations: [
      { type: 'contains', value: '@intent idempotency-required', errorMessage: 'Idempotency check missing' },
    ],
    rerunChecks: ['gate'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Server-Side Amount
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'intent/server-side-amount',
    name: 'Ensure Server-Side Amount',
    description: 'Ensures amount is calculated server-side, not from client',
    priority: 20,
    match: { textPattern: /amount/ },
    locate: { type: 'text_search', search: /amount:\s*z\.\w+\([^)]*\)/ },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      // Remove client amount from schema
      if (code.includes('amount:')) {
        patches.push({
          type: 'replace',
          file: violation.file,
          content: '',
          description: 'Remove client-provided amount field',
        });
      }

      // Add server-side calculation
      if (!code.includes('@intent server-side-amount')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: `
    // @intent server-side-amount
    // Amount MUST be calculated server-side from order data
    const amount = await calculateOrderAmount(input.orderId);
`,
          description: 'Add server-side amount calculation',
        });
      }

      return patches;
    },
    validations: [
      { type: 'contains', value: '@intent server-side-amount', errorMessage: 'Server-side amount missing' },
    ],
    rerunChecks: ['gate'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // No Stubbed Handlers
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'quality/no-stubbed-handlers',
    name: 'Replace Stubbed Handlers',
    description: 'Replaces TODO/stub markers with implementation placeholders',
    priority: 5,
    match: { textPattern: /TODO|FIXME|Not implemented|throw new Error\(['"]Not implemented/ },
    locate: { type: 'text_search', search: /throw new Error\(['"]Not implemented/ },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      // Replace "Not implemented" errors with proper implementation markers
      if (code.includes('Not implemented')) {
        patches.push({
          type: 'replace',
          file: violation.file,
          content: '// TODO: Implement business logic\n    return ctx.framework.getErrorResponse(501, "Implementation pending")',
          description: 'Replace stub with implementation marker',
        });
      }

      return patches;
    },
    validations: [
      { type: 'not_contains', value: 'Not implemented', errorMessage: 'Stubbed handler still present' },
    ],
    rerunChecks: ['gate'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Constant-Time Compare (Login Security)
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'intent/constant-time-compare',
    name: 'Enforce Constant-Time Compare',
    description: 'Replace string comparisons on credentials with constant-time helper to prevent timing attacks',
    priority: 15,
    match: { textPattern: /password_hash\s*===|password\s*===|expectedHash\s*===/ },
    locate: { type: 'text_search', search: /password_hash\s*===/, position: 'replace' },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      // Add crypto import if missing
      if (!code.includes("from 'crypto'")) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: "import crypto from 'crypto';\n",
          description: 'Add crypto import',
        });
      }

      // Add constant-time compare helper
      if (!code.includes('constantTimeCompare')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: `
// @intent constant-time-compare - Prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
`,
          description: 'Add constantTimeCompare helper',
        });
      }

      return patches;
    },
    validations: [
      { type: 'contains', value: 'constantTimeCompare', errorMessage: 'constantTimeCompare function missing' },
      { type: 'contains', value: 'timingSafeEqual', errorMessage: 'timingSafeEqual call missing' },
    ],
    rerunChecks: ['gate', 'typecheck'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Lockout Threshold (Login Security)
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'intent/lockout-threshold',
    name: 'Enforce Lockout Threshold',
    description: 'Enforce account lockout after N failed login attempts',
    priority: 12,
    match: { textPattern: /failed_attempts|failedAttempts/ },
    locate: { type: 'text_search', search: /failed_attempts\s*\+\+/, position: 'after' },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      // Add lockout threshold constant
      if (!code.includes('LOCKOUT_THRESHOLD')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: '\n// @intent lockout-threshold\nconst LOCKOUT_THRESHOLD = 5;\n',
          description: 'Add LOCKOUT_THRESHOLD constant',
        });
      }

      return patches;
    },
    validations: [
      { type: 'contains', value: 'LOCKOUT_THRESHOLD', errorMessage: 'Lockout threshold constant missing' },
    ],
    rerunChecks: ['gate'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CAPTCHA Required (Login Security)
  // ─────────────────────────────────────────────────────────────────────────
  {
    ruleId: 'intent/captcha-required',
    name: 'Add CAPTCHA Verification',
    description: 'Add CAPTCHA verification for suspicious login attempts',
    priority: 8,
    match: { textPattern: /failed_attempts|login|authenticate/ },
    locate: { type: 'text_search', search: /export\s+(async\s+)?function/, position: 'after' },
    createPatches: (violation: Violation, ctx: FixContext): PatchOperation[] => {
      const patches: PatchOperation[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      // Add captcha import
      if (!code.includes('verifyCaptcha')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: "import { verifyCaptcha, isCaptchaRequired } from '@/lib/captcha';\n",
          description: 'Add captcha imports',
        });
      }

      // Add captcha threshold
      if (!code.includes('CAPTCHA_THRESHOLD')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          content: '\n// @intent captcha-required\nconst CAPTCHA_THRESHOLD = 3;\n',
          description: 'Add CAPTCHA_THRESHOLD constant',
        });
      }

      return patches;
    },
    validations: [
      { type: 'contains', value: 'verifyCaptcha', errorMessage: 'CAPTCHA verification missing' },
      { type: 'contains', value: 'CAPTCHA_THRESHOLD', errorMessage: 'CAPTCHA threshold missing' },
    ],
    rerunChecks: ['gate'],
  },
];

// ============================================================================
// Fix Recipe Registry Implementation
// ============================================================================

export class FixRecipeRegistryImpl implements FixRecipeRegistry {
  private recipes: Map<string, FixRecipe> = new Map();

  constructor() {
    // Register built-in recipes by default
    for (const recipe of BUILTIN_RECIPES) {
      this.recipes.set(recipe.ruleId, recipe);
    }
  }

  /**
   * Get recipe for a rule ID
   */
  get(ruleId: string): FixRecipe | undefined {
    return this.recipes.get(ruleId);
  }

  /**
   * Check if a rule has a recipe
   */
  has(ruleId: string): boolean {
    return this.recipes.has(ruleId);
  }

  /**
   * Get all registered rule IDs
   */
  ruleIds(): string[] {
    return Array.from(this.recipes.keys());
  }

  /**
   * Register a custom recipe
   */
  register(recipe: FixRecipe): void {
    this.recipes.set(recipe.ruleId, recipe);
  }

  /**
   * Find unknown rules from violations (rules with no recipe)
   */
  findUnknownRules(violations: Violation[]): string[] {
    const unknown: string[] = [];
    const seen = new Set<string>();

    for (const violation of violations) {
      if (!seen.has(violation.ruleId) && !this.has(violation.ruleId)) {
        unknown.push(violation.ruleId);
        seen.add(violation.ruleId);
      }
    }

    return unknown;
  }

  /**
   * Get recipes sorted by priority
   */
  getByPriority(): FixRecipe[] {
    return Array.from(this.recipes.values())
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clear all recipes (useful for testing)
   */
  clear(): void {
    this.recipes.clear();
  }
}
