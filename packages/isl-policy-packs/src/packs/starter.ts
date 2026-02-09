/**
 * ISL Policy Packs - Starter Policy Pack
 *
 * Three foundational policies every project should enforce:
 *   1. no-fake-endpoints  — block API endpoint claims without evidence
 *   2. no-missing-env-vars — block env variable claims without evidence
 *   3. no-swallowed-errors — catch blocks that silently discard errors
 *
 * @module @isl-lang/policy-packs/starter
 */

import type { PolicyPack, PolicyRule, RuleViolation, RuleContext } from '../types.js';
import { findClaimsByType, hasEvidence, getUnverifiedClaims, getLineNumber } from '../utils.js';

// ============================================================================
// Rule: starter/no-fake-endpoints
// ============================================================================

const ENDPOINT_PATTERNS = [
  /app\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /router\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /fetch\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /axios\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /NextResponse\.json|res\.json|res\.send|res\.status/gi,
];

const noFakeEndpointsRule: PolicyRule = {
  id: 'starter/no-fake-endpoints',
  name: 'No Fake Endpoints',
  description:
    'Blocks when API endpoint claims exist but lack supporting evidence in the truthpack. ' +
    'Prevents shipping code that references routes which do not actually exist.',
  severity: 'error',
  category: 'starter',
  tags: ['endpoints', 'ghost-routes', 'verification'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check claim-based: unverified api_endpoint claims
    const endpointClaims = findClaimsByType(ctx.claims, 'api_endpoint');
    const unverified = endpointClaims.filter(c => !hasEvidence(c, ctx.evidence));

    if (unverified.length > 0) {
      const routes = unverified.map(c => c.value).join(', ');
      return {
        ruleId: 'starter/no-fake-endpoints',
        ruleName: 'No Fake Endpoints',
        severity: 'error',
        tier: 'hard_block',
        message: `FAKE ENDPOINT: ${unverified.length} API endpoint(s) have no evidence in truthpack: ${routes}`,
        claim: unverified[0],
        location: {
          file: ctx.filePath,
          line: unverified[0]?.location?.line,
        },
        suggestion:
          'Add the endpoint(s) to your truthpack routes, or remove the reference if the endpoint does not exist.',
        metadata: {
          unverifiedEndpoints: unverified.map(c => c.value),
          totalEndpointClaims: endpointClaims.length,
        },
      };
    }

    // Fallback: pattern-based detection when no claims are available
    if (endpointClaims.length === 0 && ctx.truthpack.routes && ctx.truthpack.routes.length > 0) {
      const knownPaths = new Set(ctx.truthpack.routes.map(r => r.path));
      const content = ctx.content || '';

      for (const pattern of ENDPOINT_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
          // Extract the path from the match
          const path = match[2] || match[1];
          if (path && path.startsWith('/') && !knownPaths.has(path)) {
            const line = getLineNumber(content, match.index);
            return {
              ruleId: 'starter/no-fake-endpoints',
              ruleName: 'No Fake Endpoints',
              severity: 'error',
              tier: 'hard_block',
              message: `FAKE ENDPOINT: Route "${path}" is not declared in truthpack routes`,
              location: { file: ctx.filePath, line },
              suggestion: `Add "${path}" to your truthpack routes or verify it exists.`,
              metadata: { undeclaredRoute: path },
            };
          }
        }
      }
    }

    return null;
  },
};

// ============================================================================
// Rule: starter/no-missing-env-vars
// ============================================================================

const ENV_PATTERNS = [
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,
  /process\.env\[['"`]([A-Z_][A-Z0-9_]*)['"`]\]/g,
  /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
  /Deno\.env\.get\s*\(\s*['"`]([A-Z_][A-Z0-9_]*)['"`]\s*\)/g,
];

const noMissingEnvVarsRule: PolicyRule = {
  id: 'starter/no-missing-env-vars',
  name: 'No Missing Env Vars',
  description:
    'Blocks when code references environment variables that are not declared ' +
    'in the truthpack or .env configuration. Prevents runtime crashes from undefined config.',
  severity: 'error',
  category: 'starter',
  tags: ['env', 'config', 'runtime-safety'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check claim-based: unverified env_variable claims
    const envClaims = findClaimsByType(ctx.claims, 'env_variable');
    const unverified = envClaims.filter(c => !hasEvidence(c, ctx.evidence));

    if (unverified.length > 0) {
      const vars = unverified.map(c => c.value).join(', ');
      return {
        ruleId: 'starter/no-missing-env-vars',
        ruleName: 'No Missing Env Vars',
        severity: 'error',
        tier: 'hard_block',
        message: `MISSING ENV VAR: ${unverified.length} environment variable(s) not found in truthpack: ${vars}`,
        claim: unverified[0],
        location: {
          file: ctx.filePath,
          line: unverified[0]?.location?.line,
        },
        suggestion:
          'Declare the variable(s) in your truthpack env section or .env file.',
        metadata: {
          missingVars: unverified.map(c => c.value),
          totalEnvClaims: envClaims.length,
        },
      };
    }

    // Fallback: pattern-based detection when no claims exist
    if (envClaims.length === 0 && ctx.truthpack.env && ctx.truthpack.env.length > 0) {
      const knownVars = new Set(ctx.truthpack.env.map(e => e.name));
      const content = ctx.content || '';

      for (const pattern of ENV_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
          const varName = match[1];
          if (varName && !knownVars.has(varName)) {
            // Ignore common well-known vars
            if (['NODE_ENV', 'HOME', 'PATH', 'PWD', 'USER', 'SHELL', 'LANG', 'TERM'].includes(varName)) {
              continue;
            }
            const line = getLineNumber(content, match.index);
            return {
              ruleId: 'starter/no-missing-env-vars',
              ruleName: 'No Missing Env Vars',
              severity: 'error',
              tier: 'hard_block',
              message: `MISSING ENV VAR: "${varName}" is not declared in truthpack env`,
              location: { file: ctx.filePath, line },
              suggestion: `Add "${varName}" to your truthpack env section.`,
              metadata: { missingVar: varName },
            };
          }
        }
      }
    }

    return null;
  },
};

// ============================================================================
// Rule: starter/no-swallowed-errors
// ============================================================================

const EMPTY_CATCH_PATTERNS = [
  /catch\s*\([^)]*\)\s*\{\s*\}/g,
  /catch\s*\{\s*\}/g,
  /\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g,
  /\.catch\s*\(\s*function\s*\(\s*\)\s*\{\s*\}\s*\)/g,
  /\.catch\s*\(\s*\(\s*_?\w*\s*\)\s*=>\s*\{\s*\}\s*\)/g,
];

const COMMENT_ONLY_CATCH = /catch\s*\([^)]*\)\s*\{\s*\/\/[^\n]*\s*\}/g;

const noSwallowedErrorsRule: PolicyRule = {
  id: 'starter/no-swallowed-errors',
  name: 'No Swallowed Errors',
  description:
    'Detects catch blocks that silently discard errors. ' +
    'Swallowed errors hide bugs and make debugging impossible.',
  severity: 'warning',
  category: 'starter',
  tags: ['error-handling', 'quality', 'debugging'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const content = ctx.content || '';

    // Check for empty catch blocks
    for (const pattern of EMPTY_CATCH_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (match) {
        const line = getLineNumber(content, match.index);
        return {
          ruleId: 'starter/no-swallowed-errors',
          ruleName: 'No Swallowed Errors',
          severity: 'warning',
          tier: 'soft_block',
          message: 'SWALLOWED ERROR: Empty catch block silently discards errors',
          location: { file: ctx.filePath, line },
          suggestion:
            'Log the error, re-throw it, or handle it explicitly. ' +
            'If intentional, add a comment explaining why.',
          metadata: { pattern: match[0] },
        };
      }
    }

    // Check for catch blocks with only a comment (softer warning)
    COMMENT_ONLY_CATCH.lastIndex = 0;
    const commentMatch = COMMENT_ONLY_CATCH.exec(content);
    if (commentMatch) {
      const line = getLineNumber(content, commentMatch.index);
      return {
        ruleId: 'starter/no-swallowed-errors',
        ruleName: 'No Swallowed Errors',
        severity: 'info',
        tier: 'warn',
        message: 'SWALLOWED ERROR: Catch block contains only a comment — error is still discarded',
        location: { file: ctx.filePath, line },
        suggestion:
          'Consider logging the error or re-throwing. A comment alone does not handle the error.',
        metadata: { pattern: commentMatch[0] },
      };
    }

    return null;
  },
};

// ============================================================================
// Starter Policy Pack Export
// ============================================================================

export const starterPolicyPack: PolicyPack = {
  id: 'starter',
  name: 'Starter Policies',
  description:
    'Foundational policies: no fake endpoints, no missing env vars, no swallowed errors.',
  version: '0.1.0',
  rules: [noFakeEndpointsRule, noMissingEnvVarsRule, noSwallowedErrorsRule],
  defaultConfig: {
    enabled: true,
  },
};

export {
  noFakeEndpointsRule,
  noMissingEnvVarsRule,
  noSwallowedErrorsRule,
};

export default starterPolicyPack;
