/**
 * ISL Policy Engine - Starter Policy Pack
 *
 * Three foundational policies that every project should enforce:
 *   1. no-fake-endpoints  — block when API endpoint claims lack evidence
 *   2. no-missing-env-vars — block when env_variable claims are unverified
 *   3. no-swallowed-errors — block when catch blocks silently discard errors
 *
 * @module @isl-lang/isl-policy-engine
 */

import type { PolicyEnginePack, PolicyDef } from './types.js';

// ============================================================================
// Policy: no-fake-endpoints
// ============================================================================

export const noFakeEndpoints: PolicyDef = {
  id: 'starter/no-fake-endpoints',
  name: 'No Fake Endpoints',
  description:
    'Blocks when API endpoint claims exist but lack supporting evidence. ' +
    'Prevents shipping code that references routes which do not actually exist.',
  severity: 'error',
  tier: 'hard_block',
  when: {
    kind: 'logic',
    op: 'and',
    conditions: [
      { kind: 'claim_type', types: ['api_endpoint'] },
      { kind: 'metric', metric: 'claim_count', op: 'gt', value: 0 },
    ],
  },
  action: 'block',
  explanation:
    'blocked because {claimCount} API endpoint claim(s) found but evidence is missing — ' +
    'endpoints may not exist in the running application. ' +
    'Confidence: {confidence}%.',
  evidenceRefs: ['truthpack/routes', 'filesystem/route-files'],
  tags: ['endpoints', 'ghost-routes', 'verification'],
};

// ============================================================================
// Policy: no-missing-env-vars
// ============================================================================

export const noMissingEnvVars: PolicyDef = {
  id: 'starter/no-missing-env-vars',
  name: 'No Missing Env Vars',
  description:
    'Blocks when code references environment variables that are not declared ' +
    'in the truthpack or .env files. Prevents runtime crashes from undefined config.',
  severity: 'error',
  tier: 'hard_block',
  when: {
    kind: 'logic',
    op: 'and',
    conditions: [
      { kind: 'claim_type', types: ['env_variable'] },
      { kind: 'metric', metric: 'claim_count', op: 'gt', value: 0 },
    ],
  },
  action: 'block',
  explanation:
    'blocked because {claimCount} environment variable claim(s) found but evidence is missing — ' +
    'variables may be undefined at runtime. ' +
    'Confidence: {confidence}%.',
  evidenceRefs: ['truthpack/env', 'filesystem/.env'],
  tags: ['env', 'config', 'runtime-safety'],
};

// ============================================================================
// Policy: no-swallowed-errors
// ============================================================================

export const noSwallowedErrors: PolicyDef = {
  id: 'starter/no-swallowed-errors',
  name: 'No Swallowed Errors',
  description:
    'Warns when catch blocks exist that silently discard errors. ' +
    'Swallowed errors hide bugs and make debugging impossible.',
  severity: 'warning',
  tier: 'soft_block',
  when: {
    kind: 'logic',
    op: 'and',
    conditions: [
      {
        kind: 'claim_field',
        field: 'context',
        op: 'matches',
        value: 'catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}',
      },
      { kind: 'metric', metric: 'claim_count', op: 'gt', value: 0 },
    ],
  },
  action: 'warn',
  explanation:
    'warning: empty catch block(s) detected — errors are being silently swallowed. ' +
    '{violationCount} related violation(s) across {fileCount} file(s).',
  evidenceRefs: ['ast/catch-blocks'],
  tags: ['error-handling', 'quality', 'debugging'],
};

// ============================================================================
// Starter Pack
// ============================================================================

export const starterPolicyPack: PolicyEnginePack = {
  id: 'starter',
  name: 'Starter Policy Pack',
  version: '0.1.0',
  description:
    'Foundational policies: no fake endpoints, no missing env vars, no swallowed errors.',
  policies: [noFakeEndpoints, noMissingEnvVars, noSwallowedErrors],
};
